"""Worker offline de assinatura. Segredos somente em arquivo privado e ambiente.

Não é serviço HTTP, não lê .env e não aceita certificados pelo navegador.
Produção: raízes ICP-Brasil previamente conferidas/pinadas e revogação hard-fail.
Teste: certificado sintético, flag explícita e relatório icpBrasil=false.
"""
import argparse
import asyncio
import hashlib
import io
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from asn1crypto import cms, core, pem, x509
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign import fields, signers, validation
from pyhanko.sign.signers.pdf_signer import DSSContentSettings, SigDSSPlacementPreference
from pyhanko.sign.validation import async_validate_detached_cms
from pyhanko.sign.validation.status import SignatureCoverageLevel
from pyhanko_certvalidator import ValidationContext
from cryptography import x509 as crypto_x509
from segredo import senha_do_certificado


def digest(data):
    return hashlib.sha256(data).hexdigest()


def exigir(ok, codigo):
    if not ok:
        raise ValueError(codigo)


def carregar(config):
    testing = config.get("modo", "producao") == "teste"
    exigir(not testing or os.environ.get("PONTO_ASSINATURA_PERMITIR_TESTE") == "1", "MODO_TESTE_NAO_AUTORIZADO")
    allowed = config.get("raizesSha256", [])
    exigir(bool(allowed), "RAIZES_CONFIAVEIS_NAO_CONFIGURADAS")
    roots = []
    for path in config.get("raizesPem", []):
        raw = Path(path).read_bytes()
        _, _, der = pem.unarmor(raw) if pem.detect(raw) else (None, None, raw)
        exigir(digest(der) in allowed, "RAIZ_NAO_CONFERIDA")
        root = x509.Certificate.load(der)
        if not testing:
            exigir("ICP-Brasil" in root.subject.human_friendly, "RAIZ_NAO_ICP_BRASIL")
        roots.append(root)
    exigir(bool(roots), "CADEIA_CONFIAVEL_AUSENTE")
    return testing, roots


def conferir_titular(cert, config, testing):
    raw = cert.dump()
    exigir(digest(raw) == config.get("certificadoSha256"), "CERTIFICADO_NAO_AUTORIZADO")
    crypto = crypto_x509.load_der_x509_certificate(raw)
    now = datetime.now(timezone.utc)
    exigir(crypto.not_valid_before_utc <= now <= crypto.not_valid_after_utc, "CERTIFICADO_FORA_DA_VALIDADE")
    expected = config.get("desenvolvedor", {})
    number = expected.get("numero", "")
    kind = expected.get("tipo")
    exigir(kind in ("cnpj", "cpf") and number.isdigit() and len(number) == (14 if kind == "cnpj" else 11), "DESENVOLVEDOR_INVALIDO")
    identities = []
    try:
        san = crypto.extensions.get_extension_for_class(crypto_x509.SubjectAlternativeName).value
        for name in san.get_values_for_type(crypto_x509.OtherName):
            value = core.Asn1Value.load(name.value).native
            if isinstance(value, bytes):
                value = value.decode("ascii")
            if name.type_id.dotted_string == "2.16.76.1.3.3" and kind == "cnpj":
                identities.append(value)
            if name.type_id.dotted_string == "2.16.76.1.3.1" and kind == "cpf":
                identities.append(value[8:19])
    except crypto_x509.ExtensionNotFound:
        pass
    exigir(number in identities, "CERTIFICADO_DE_OUTRO_DESENVOLVEDOR")
    if not testing:
        try:
            policies = crypto.extensions.get_extension_for_class(crypto_x509.CertificatePolicies).value
            exigir(any(p.policy_identifier.dotted_string.startswith("2.16.76.1.2.") for p in policies), "POLITICA_ICP_BRASIL_AUSENTE")
        except crypto_x509.ExtensionNotFound:
            raise ValueError("POLITICA_ICP_BRASIL_AUSENTE") from None


def contexto(roots, testing, others=()):
    return ValidationContext(trust_roots=roots, other_certs=others,
                             allow_fetching=not testing,
                             revocation_mode="soft-fail" if testing else "hard-fail")


async def validar(data, kind, config, original=None):
    testing, roots = carregar(config)
    if kind == "pdf":
        reader = PdfFileReader(io.BytesIO(data), strict=True)
        exigir(len(reader.embedded_signatures) == 1, "QUANTIDADE_ASSINATURAS_INVALIDA")
        embedded = reader.embedded_signatures[0]
        exigir(embedded.sig_object.get("/SubFilter") == "/ETSI.CAdES.detached", "PADRAO_PADES_INVALIDO")
        status = await validation.async_validate_pdf_signature(embedded, signer_validation_context=contexto(roots, testing))
        cert = embedded.signer_cert
        entire = status.coverage == SignatureCoverageLevel.ENTIRE_FILE
        integrity = bool(status.intact and status.valid)
    else:
        exigir(original is not None, "CONTEUDO_ORIGINAL_OBRIGATORIO")
        content = cms.ContentInfo.load(data)
        exigir(content["content_type"].native == "signed_data", "CMS_INVALIDO")
        signed = content["content"]
        exigir(signed["encap_content_info"]["content"].native is None, "ASSINATURA_NAO_DESTACADA")
        exigir(len(signed["signer_infos"]) == 1, "QUANTIDADE_ASSINATURAS_INVALIDA")
        attrs = signed["signer_infos"][0]["signed_attrs"]
        exigir(any(attr["type"].native in ("signing_certificate", "signing_certificate_v2") for attr in attrs), "ATRIBUTO_CADES_AUSENTE")
        status = await async_validate_detached_cms(original, signed, signer_validation_context=contexto(roots, testing))
        cert = status.signing_cert
        integrity, entire = bool(status.intact and status.valid), True
    conferir_titular(cert, config, testing)
    exigir(integrity and status.trusted and entire, "ASSINATURA_OU_CADEIA_INVALIDA")
    return {"padrao": "PAdES" if kind == "pdf" else "CAdES detached", "integridade": integrity,
            "confiavel": bool(status.trusted), "icpBrasil": not testing, "documentoInteiro": entire,
            "desenvolvedorConferido": True, "certificadoSha256": digest(cert.dump()),
            "revogacao": "nao_verificada_teste" if testing else "verificada",
            "modo": "teste_sintetico" if testing else "producao",
            "saidaSha256": digest(data), "validadoEm": datetime.now(timezone.utc).isoformat()}


def metadados_pdf(field_name, reason, validation_context, embed_validation_info):
    # DSS no mesmo incremento da assinatura. A opção padrão acrescenta uma
    # revisão posterior sem timestamp, incompatível com ENTIRE_FILE. Não
    # enfraquecer o validador nem aceitar alterações posteriores ao PDF.
    return signers.PdfSignatureMetadata(field_name=field_name, md_algorithm="sha256",
        subfilter=fields.SigSeedSubFilter.PADES, reason=reason,
        validation_context=validation_context, embed_validation_info=embed_validation_info,
        dss_settings=DSSContentSettings(include_vri=False, placement=SigDSSPlacementPreference.TOGETHER_WITH_SIGNATURE))


async def assinar(data, kind, config):
    testing, roots = carregar(config)
    password = senha_do_certificado(config)
    signer = signers.SimpleSigner.load_pkcs12(config["pkcs12"], passphrase=password)
    del password
    exigir(signer is not None, "CERTIFICADO_NAO_CARREGADO")
    conferir_titular(signer.signing_cert, config, testing)
    if kind == "pdf":
        exigir(not PdfFileReader(io.BytesIO(data)).embedded_signatures, "PDF_JA_ASSINADO")
        meta = metadados_pdf("AssinaturaREP", "Registro original de ponto",
                contexto(roots, testing, signer.cert_registry), not testing)
        result = (await signers.async_sign_pdf(IncrementalPdfFileWriter(io.BytesIO(data)), meta, signer=signer)).getvalue()
    else:
        result = (await signer.async_sign_general_data(data, "sha256", detached=True, use_cades=True)).dump()
    report = await validar(result, kind, config, original=data)
    report["entradaSha256"] = digest(data)
    return result, report


def main():
    parser = argparse.ArgumentParser(description="Assinatura fiscal privada PAdES/CAdES")
    parser.add_argument("operacao", choices=["assinar", "validar"])
    parser.add_argument("--tipo", choices=["pdf", "cades"], required=True)
    parser.add_argument("--entrada", required=True)
    parser.add_argument("--saida")
    parser.add_argument("--original")
    args = parser.parse_args()
    # Nenhum certificado, senha ou caminho sensível aparece no stdout/stderr.
    logging.disable(logging.CRITICAL)
    try:
        config_path = os.environ.get("PONTO_ASSINATURA_CONFIG")
        exigir(bool(config_path), "CONFIGURACAO_PRIVADA_AUSENTE")
        config = json.loads(Path(config_path).read_text(encoding="utf-8-sig"))
        data = Path(args.entrada).read_bytes()
        exigir(0 < len(data) <= 20_000_000, "DOCUMENTO_FORA_DO_LIMITE")
        if args.operacao == "assinar":
            exigir(bool(args.saida), "SAIDA_OBRIGATORIA")
            exigir(not Path(args.saida).exists(), "SAIDA_JA_EXISTE")
            output, report = asyncio.run(assinar(data, args.tipo, config))
            with open(args.saida, "xb") as target:
                target.write(output)
            os.chmod(args.saida, 0o600)
        else:
            original = Path(args.original).read_bytes() if args.original else None
            report = asyncio.run(validar(data, args.tipo, config, original))
        print(json.dumps(report))
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error).replace("_", "").isalnum() else "FALHA_ASSINATURA_OU_VALIDACAO"
        print(json.dumps({"error": code, "assinadoValidado": False}))
        sys.exit(1)


if __name__ == "__main__":
    main()
