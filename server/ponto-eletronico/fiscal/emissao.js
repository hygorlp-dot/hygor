import { exportarSnapshot } from "./servico.js";
import { avaliarProntidaoFiscal } from "./prontidao.js";
import { exigir, sha256 } from "./campos.js";

// Renderer e assinatura são serviços privados injetados. Ausência, erro ou
// relatório incompleto bloqueiam a emissão; nunca retornar rascunho como assinado.
export async function emitirDocumentoFiscal(snapshot, options, { renderizarPdf, assinarEValidar } = {}) {
  const result = await exportarSnapshot(snapshot, options);
  const prontidao = avaliarProntidaoFiscal(snapshot, result.auditoria);
  exigir(prontidao.podePrepararEmissao, "FORMALIZACAO_FISCAL_PENDENTE");
  exigir(typeof assinarEValidar === "function", "ASSINADOR_ICP_BRASIL_NAO_CONFIGURADO");
  let bytes, nome, padrao;
  if (options.tipo === "comprovante") {
    exigir(typeof renderizarPdf === "function", "RENDERIZADOR_PDF_NAO_CONFIGURADO");
    const event = snapshot.eventos.find(e => e.event_id === options.eventId);
    const local = snapshot.config.locaisPorObra?.[event?.obra_id];
    exigir(local?.endereco, "LOCAL_DA_OBRA_NAO_CONFIGURADO");
    exigir(!(local.cno && local.caepf) && (!local.cno || /^\d{12}$/.test(local.cno))
      && (!local.caepf || /^\d{14}$/.test(local.caepf)), "INSCRICAO_OBRA_INVALIDA");
    const model = result.comprovante;
    const fields = new Map(model.fields);
    const obrigatorios = ["Empregador", "CNPJ/CPF do empregador", "Local da prestação", "Trabalhador", "CPF do trabalhador", "NSR", "Data e hora da marcação", "Fuso horário", "Registro no INPI"];
    exigir(obrigatorios.every(k => fields.get(k) && !["Não informado", "Nome não disponível na extração"].includes(fields.get(k))), "COMPROVANTE_INCOMPLETO");
    exigir(/^[a-f0-9]{64}$/.test(fields.get("Hash da marcação no leiaute AFD")), "HASH_AFD_AUSENTE");
    // NSR já é um inteiro da ARP; não incluir identificadores arbitrários no nome.
    exigir(/^\d{1,9}$/.test(fields.get("NSR")), "NSR_INVALIDO");
    bytes = Buffer.from(await renderizarPdf({ ...model, status: "preparado_para_assinatura", pendencias: [] }));
    exigir(bytes.subarray(0, 5).toString() === "%PDF-", "RENDERIZACAO_PDF_INVALIDA");
    nome = "comprovante-" + fields.get("NSR") + ".pdf"; padrao = "PAdES";
  } else {
    bytes = result.arquivo.bytes; nome = result.arquivo.nome; padrao = "CAdES detached";
  }
  const inputHash = sha256(bytes);
  const signed = await assinarEValidar({ bytes: Buffer.from(bytes), padrao, desenvolvedor: snapshot.config.rep.desenvolvedor });
  const output = Buffer.from(signed?.bytes || []), report = signed?.verificacao;
  exigir(sha256(bytes) === inputHash, "ENTRADA_ALTERADA_PELO_ASSINADOR");
  exigir(report?.padrao === padrao && report.integridade === true && report.confiavel === true
    && report.icpBrasil === true && report.revogacao === "verificada" && report.documentoInteiro === true
    && report.desenvolvedorConferido === true && report.entradaSha256 === inputHash
    && report.saidaSha256 === sha256(output) && /^[a-f0-9]{64}$/.test(report.certificadoSha256 || "")
    && Number.isFinite(Date.parse(report.validadoEm)), "ASSINATURA_NAO_VALIDADA");
  exigir(output.length > 0 && (padrao !== "PAdES" || output.subarray(0, 5).toString() === "%PDF-"), "ASSINATURA_SAIDA_INVALIDA");
  return { nome, bytes: padrao === "PAdES" ? output : bytes,
    ...(padrao === "CAdES detached" ? { assinaturaDestacada: { nome: nome + ".p7s", bytes: output } } : {}),
    manifesto: { status: "assinado_validado", conformidadeGlobal: false, padrao,
      sha256: sha256(padrao === "PAdES" ? output : bytes), origemSha256: inputHash,
      ...(options.eventId ? (() => {
        const event = snapshot.eventos.find(e => e.event_id === options.eventId);
        const registro = snapshot.registros.find(r => r.event_id === options.eventId);
        return { eventId: event.event_id, companyId: snapshot.companyId, employeeId: event.employee_id,
          estabelecimentoId: snapshot.estabelecimento.id, nsr: Number(registro.nsr), marcadoEm: event.marcado_em,
          timezone: snapshot.estabelecimento.timezone };
      })() : {}), certificadoSha256: report.certificadoSha256,
      validadoEm: report.validadoEm, somenteLeitura: true } };
}
