"""Testes criptográficos com CA efêmera. Não é ICP-Brasil nem cadastro do ERP."""
import asyncio
import io
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from asn1crypto import core
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID, ObjectIdentifier, ExtendedKeyUsageOID
from reportlab.pdfgen import canvas
from assinador import assinar, validar, digest, metadados_pdf, carregar, contexto
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign import signers
from pyhanko.sign.validation.status import SignatureCoverageLevel


class AssinaturaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="marcell-certificado-sintetico-")
        self.root = Path(self.tmp.name)
        self.env = patch.dict(os.environ, {"PONTO_ASSINATURA_PERMITIR_TESTE": "1", "PONTO_SENHA_TESTE": "somente-teste-local"})
        self.env.start()
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "CA SINTETICA - SEM VALIDADE ICP-BRASIL")])
        now = datetime.now(timezone.utc)
        ca = x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=2)).add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True).add_extension(x509.KeyUsage(False,False,False,False,False,True,True,False,False),critical=True).sign(key,hashes.SHA256())
        self.ca = ca
        self.ca_key = key
        self.leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.config = {"modo":"teste","senhaEnv":"PONTO_SENHA_TESTE","pkcs12":str(self.root/'teste.p12'),"raizesPem":[str(self.root/'ca.pem')],"raizesSha256":[digest(ca.public_bytes(serialization.Encoding.DER))],"desenvolvedor":{"tipo":"cnpj","numero":"11222333000181"}}
        (self.root/'ca.pem').write_bytes(ca.public_bytes(serialization.Encoding.PEM))
        self.make_leaf(now-timedelta(hours=1),now+timedelta(days=1))
        pdf=io.BytesIO(); page=canvas.Canvas(pdf);page.setTitle("SIMULACAO CRIPTOGRAFICA - NAO ICP-BRASIL");page.drawString(40,780,"MARCELL - TESTE SINTETICO DE ASSINATURA");page.drawString(40,755,"Sem validade como comprovante de ponto ou certificado ICP-Brasil.");page.save();self.pdf=pdf.getvalue()

    def make_leaf(self, start, end):
        name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,"DESENVOLVEDOR SINTETICO PARA TESTE")])
        san=x509.SubjectAlternativeName([x509.OtherName(ObjectIdentifier("2.16.76.1.3.3"),core.UTF8String("11222333000181").dump())])
        leaf=x509.CertificateBuilder().subject_name(name).issuer_name(self.ca.subject).public_key(self.leaf_key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(start).not_valid_after(end).add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True).add_extension(x509.KeyUsage(True,True,False,False,False,False,False,False,False),critical=True).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION]),critical=False).add_extension(san,critical=False).sign(self.ca_key,hashes.SHA256())
        self.config['certificadoSha256']=digest(leaf.public_bytes(serialization.Encoding.DER))
        Path(self.config['pkcs12']).write_bytes(pkcs12.serialize_key_and_certificates(b'teste',self.leaf_key,leaf,[self.ca],serialization.BestAvailableEncryption(b'somente-teste-local')))

    def tearDown(self):
        self.env.stop(); self.tmp.cleanup()

    def test_pades_assina_valida_e_nao_se_declara_icp(self):
        signed,report=asyncio.run(assinar(self.pdf,'pdf',self.config))
        self.assertTrue(report['integridade']);self.assertTrue(report['documentoInteiro']);self.assertFalse(report['icpBrasil'])
        self.assertEqual(report['revogacao'],'nao_verificada_teste')
        self.assertEqual(report['entradaSha256'],digest(self.pdf))
        self.assertTrue(asyncio.run(validar(signed,'pdf',self.config))['confiavel'])

    def test_pdf_adulterado_nao_e_liberado(self):
        signed,_=asyncio.run(assinar(self.pdf,'pdf',self.config))
        with self.assertRaises(Exception):asyncio.run(validar(signed+b'\n% alterado\n','pdf',self.config))

    def test_dss_embutido_na_mesma_revisao_preserva_cobertura_integral(self):
        async def executar():
            _, roots=carregar(self.config)
            signer=signers.SimpleSigner.load_pkcs12(self.config['pkcs12'],passphrase=b'somente-teste-local')
            meta=metadados_pdf('TesteDSS','SIMULACAO CRIPTOGRAFICA',contexto(roots,True,signer.cert_registry),True)
            result=(await signers.async_sign_pdf(IncrementalPdfFileWriter(io.BytesIO(self.pdf)),meta,signer=signer)).getvalue()
            reader=PdfFileReader(io.BytesIO(result));sig=reader.embedded_signatures[0]
            sig.compute_integrity_info()
            self.assertEqual(sig.coverage,SignatureCoverageLevel.ENTIRE_FILE)
            self.assertIn('/DSS',reader.root)
            self.assertTrue((await validar(result,'pdf',self.config))['documentoInteiro'])
            with self.assertRaises(Exception):await validar(result+b'\n% modificado\n','pdf',self.config)
        asyncio.run(executar())

    def test_cades_destacado_e_conteudo_alterado(self):
        data=b'AFD SINTETICO\r\n'
        signed,report=asyncio.run(assinar(data,'cades',self.config))
        self.assertEqual(report['padrao'],'CAdES detached')
        with self.assertRaises(Exception):asyncio.run(validar(signed,'cades',self.config,original=b'AFD MODIFICADO\r\n'))

    def test_certificado_outro_titular_bloqueado(self):
        self.config['desenvolvedor']['numero']='00000000000000'
        with self.assertRaisesRegex(ValueError,'OUTRO_DESENVOLVEDOR'):asyncio.run(assinar(self.pdf,'pdf',self.config))

    def test_certificado_expirado_bloqueado(self):
        now=datetime.now(timezone.utc);self.make_leaf(now-timedelta(days=3),now-timedelta(days=2))
        with self.assertRaisesRegex(ValueError,'FORA_DA_VALIDADE'):asyncio.run(assinar(self.pdf,'pdf',self.config))

    def test_ca_sintetica_nao_passa_por_producao(self):
        self.config['modo']='producao'
        with self.assertRaisesRegex(ValueError,'RAIZ_NAO_ICP_BRASIL'):asyncio.run(assinar(self.pdf,'pdf',self.config))

    def test_ca_trocada_e_modo_teste_nao_autorizado(self):
        self.config['raizesSha256']=['0'*64]
        with self.assertRaisesRegex(ValueError,'RAIZ_NAO_CONFERIDA'):asyncio.run(assinar(self.pdf,'pdf',self.config))
        os.environ.pop('PONTO_ASSINATURA_PERMITIR_TESTE')
        with self.assertRaisesRegex(ValueError,'TESTE_NAO_AUTORIZADO'):asyncio.run(assinar(self.pdf,'pdf',self.config))


if __name__=='__main__':unittest.main()
