import { auditarSnapshot } from "./auditoria.js";
import { gerarAfd, validarAfd } from "./afd.js";
import { gerarAej, validarAej } from "./aej.js";
import { exigir, dh, periodo, identificacao, texto } from "./campos.js";
import { tratamentoDoPontoExistente } from "./tratamento.js";

export function empregadorDoSnapshot(s) {
  const e = s.estabelecimento;
  return { tipo: e.tipo_inscricao, numero: e.numero_inscricao, nome: e.nome, timezone: e.timezone, cno: e.cno, caepf: e.caepf };
}
export function registrosAfdDoSnapshot(s) {
  const events = new Map(s.eventos.map(e => [e.event_id, e]));
  return s.registros.map(r => {
    const e = events.get(r.event_id);
    exigir(e, "EVENTO_FISCAL_AUSENTE");
    return { tipo: 7, nsr: Number(r.nsr), cpf: e.cpf, marcadoEm: e.marcado_em_texto, gravadoEm: r.gravado_em_texto, coletor: "01", offline: e.payload.offline };
  });
}
function conferirSaida(arquivo, tipo) {
  const result = tipo === "afd" ? validarAfd(arquivo.bytes, { hashAnterior: arquivo.hashAnteriorAoPeriodo }) : validarAej(arquivo.bytes);
  exigir(result.ok, "SAIDA_FISCAL_INVALIDA");
  return { ...arquivo, validacaoEstrutural: result };
}
export async function exportarSnapshot(s, { tipo, de, ate, geradoEm, eventId }) {
  exigir(["afd", "aej", "comprovante"].includes(tipo), "EXPORTACAO_INVALIDA");
  periodo(de, ate);
  if (tipo === "aej" && !s.config?.tratamento && s.dadosPonto) {
    s = { ...s, config: { ...s.config, tratamento: tratamentoDoPontoExistente(s, s.dadosPonto, { de, ate }) } };
  }
  const auditoria = await auditarSnapshot(s);
  exigir(auditoria.integridadeValida, "INTEGRIDADE_REPROVADA");
  const empregador = empregadorDoSnapshot(s);
  if (tipo === "comprovante") {
    const comprovante = prepararComprovante(s, eventId, { de, ate });
    if (auditoria.aptoParaGeracao.afd) {
      const afd = gerarAfd({ empregador, rep: s.config.rep, registros: registrosAfdDoSnapshot(s), de, ate, geradoEm });
      const nsr = s.registros.find(r => r.event_id === eventId).nsr;
      comprovante.fields = comprovante.fields.map(([label, value]) => label === "Hash da marcação no leiaute AFD" ? [label, afd.hashes[nsr]] : [label, value]);
      comprovante.rastreabilidade.hashAfdDerivadoNestaExtracao = true;
    }
    return { auditoria, comprovante };
  }
  exigir(auditoria.aptoParaGeracao[tipo], "DADOS_FISCAIS_PENDENTES", tipo);
  if (tipo === "afd") return { auditoria, arquivo: conferirSaida(gerarAfd({ empregador, rep: s.config.rep, registros: registrosAfdDoSnapshot(s), de, ate, geradoEm }), tipo) };
  const originais = s.eventos.filter(e => e.tipo_registro === "ponto" && dh(e.marcado_em_texto, empregador.timezone).slice(0, 10) >= de && dh(e.marcado_em_texto, empregador.timezone).slice(0, 10) <= ate)
    .map(e => ({ eventId: e.event_id, employeeId: e.employee_id, cpf: e.cpf, marcadoEm: e.marcado_em_texto }));
  return { auditoria, arquivo: conferirSaida(gerarAej({ ...s.config.tratamento, empregador, de, ate, geradoEm, originais }), tipo) };
}
export function prepararComprovante(s, eventId, { de, ate }) {
  const e = s.eventos.find(e => e.event_id === eventId && e.tipo_registro === "ponto");
  exigir(e, "BATIDA_INEXISTENTE");
  const stamp = dh(e.marcado_em_texto, s.estabelecimento.timezone);
  exigir(stamp.slice(0, 10) >= de && stamp.slice(0, 10) <= ate, "BATIDA_FORA_DO_PERIODO");
  const r = s.registros.find(r => r.event_id === eventId);
  exigir(r, "BATIDA_SEM_NSR_FISCAL");
  const employee = (s.employees || []).find(w => String(w.id) === String(e.employee_id));
  const employer = empregadorDoSnapshot(s);
  const local = s.config?.locaisPorObra?.[e.obra_id];
  let id = "Não informado";
  try { id = identificacao(employer)[1]; } catch { /* A ausência fica explícita no rascunho. */ }
  const fields = [
    ["Empregador", employer.nome || "Não informado"], ["CNPJ/CPF do empregador", id],
    ["CNO / CAEPF", local?.cno || local?.caepf || employer.cno || employer.caepf || "Não informado"],
    ["Local da prestação", local?.endereco || s.config?.localPrestacao || "Não informado"],
    ["Trabalhador", employee?.name || "Nome não disponível na extração"], ["CPF do trabalhador", e.cpf || "Não informado"],
    ["NSR", String(r.nsr)], ["Data e hora da marcação", stamp.slice(0, 17) + e.marcado_em_texto.slice(17, 19) + stamp.slice(19)],
    ["Fuso horário", employer.timezone], ["Registro no INPI", s.config?.rep?.inpi || "Não informado"],
    ["Hash da marcação no leiaute AFD", "Não emitido: aguarda dados completos e formalização"],
  ];
  for (const [name, value] of fields) texto(value, 500, name);
  return { status: "rascunho_nao_assinado", eventId, fields,
    rastreabilidade: { origemNome: employee ? "cadastro_atual" : "ausente", instanteOriginal: e.marcado_em_texto, hashFiscalInterno: r.fiscal_hash },
    pendencias: ["PDF sem assinatura PAdES ICP-Brasil", "Hash fiscal interno não substitui hash do leiaute AFD", "Este rascunho não substitui o comprovante oficial"] };
}
const escape = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function comprovanteHtml(model) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de Registro de Ponto do Trabalhador</title></head><body>'
    + '<h1>Comprovante de Registro de Ponto do Trabalhador</h1><h2>Rascunho - não assinado digitalmente</h2>'
    + '<p>Documento de conferência. Não substitui o comprovante oficial exigido pela Portaria 671.</p><table><tbody>'
    + model.fields.map(([label, value]) => "<tr><th scope=\"row\">" + escape(label) + "</th><td>" + escape(value).replace(/([a-f0-9]{32})(?=[a-f0-9])/g, "$1<wbr>") + "</td></tr>").join("")
    + '</tbody></table><h2>Rastreabilidade</h2><p>Identificador: ' + escape(model.eventId) + '</p><p>Instante original, sem alteração: '
    + escape(model.rastreabilidade.instanteOriginal) + '</p><p>Nome: ' + escape(model.rastreabilidade.origemNome) + '</p>'
    + '<p>Hash de integridade interno (não é o hash oficial do AFD):<br>' + escape(model.rastreabilidade.hashFiscalInterno) + '</p>'
    + '<h2>Pendências</h2><ul>' + model.pendencias.map(p => "<li>" + escape(p) + "</li>").join("") + '</ul></body></html>';
}
