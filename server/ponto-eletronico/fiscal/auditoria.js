import { calcularHashLocal, canonicalizarEvento, validarEvento } from "../../../src/domains/ponto-eletronico/evento.js";
import { verificarCadeiaFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";
import { sha256 } from "./campos.js";
import { identificacao } from "./campos.js";
import { cpfValido } from "../../../src/domains/ponto-eletronico/estabelecimento.js";

export function eventoDoBanco(e) {
  return { ...e.payload, eventId: e.event_id, deviceId: e.dispositivo_id, estabelecimentoId: e.estabelecimento_id,
    localSequence: Number(e.local_sequence), localPreviousHash: e.local_previous_hash, localHash: e.local_hash,
    tipoRegistro: e.tipo_registro, employeeId: e.employee_id, terceiroId: e.terceiro_id, cpf: e.cpf,
    marcadoEm: e.marcado_em_texto, relogioAparelho: Date.parse(e.relogio_aparelho) === Date.parse(e.payload?.relogioAparelho) ? e.payload.relogioAparelho : e.relogio_aparelho, horaConfiavel: e.hora_confiavel,
    relogioAlterado: e.relogio_alterado, divergenciaMs: e.divergencia_ms, fonteHora: e.fonte_hora,
    idadeReferenciaMs: e.idade_referencia_ms, metodo: e.metodo, confianca: e.confianca,
    encarregadoId: e.encarregado_id, gps: e.gps, fotoSha256: e.foto_sha256 };
}
export function registroFiscalDoBanco(r, e) {
  return { estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id,
    tipoRegistro: e.tipo_registro, cpf: e.cpf, employeeId: e.employee_id, marcadoEm: e.marcado_em_texto,
    gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id, localSequence: Number(r.local_sequence),
    localHash: e.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash };
}
export async function auditarSnapshot(snapshot) {
  const pendencias = [], add = (codigo, alvo, referencia = null, integridade = false) => pendencias.push({ codigo, alvo, referencia, integridade });
  if (snapshot?.versao !== 1 || !snapshot?.companyId || !snapshot?.estabelecimento?.id
    || !["eventos", "registros", "dispositivos", "legados"].every(k => Array.isArray(snapshot?.[k]))) add("SNAPSHOT_INVALIDO", ["afd", "aej", "comprovante"], null, true);
  if (!snapshot?.completo) add("EXTRACAO_INCOMPLETA_OU_CONCORRENTE", ["afd", "aej", "comprovante"], null, true);
  const events = snapshot?.eventos || [], records = snapshot?.registros || [], estabId = snapshot?.estabelecimento?.id;
  try { identificacao({ tipo: snapshot?.estabelecimento?.tipo_inscricao, numero: snapshot?.estabelecimento?.numero_inscricao }); }
  catch { add("INSCRICAO_EMPREGADOR_AUSENTE_OU_INVALIDA", ["afd", "aej", "comprovante"]); }
  const eventMap = new Map(), nsrs = new Set(), deviceMap = new Map((snapshot?.dispositivos || []).map(d => [d.id, d]));
  for (const e of events) {
    if (eventMap.has(e.event_id)) add("EVENTO_DUPLICADO", ["afd", "aej", "comprovante"], e.event_id, true);
    eventMap.set(e.event_id, e);
    if (e.company_id !== snapshot.companyId || e.estabelecimento_id !== estabId || !deviceMap.has(e.dispositivo_id)) add("ESCOPO_EVENTO_INVALIDO", ["afd", "aej", "comprovante"], e.event_id, true);
    if (!e.payload || !validarEvento(e.payload).ok || e.payload.localHash !== e.local_hash || canonicalizarEvento(eventoDoBanco(e)) !== canonicalizarEvento(e.payload)
      || await calcularHashLocal(e.payload, sha256) !== e.local_hash) add("HASH_LOCAL_DIVERGENTE", ["afd", "aej", "comprovante"], e.event_id, true);
    if (Date.parse(e.marcado_em) !== Date.parse(e.marcado_em_texto)) add("HORARIO_MATERIAL_DIVERGENTE", ["afd", "aej", "comprovante"], e.event_id, true);
    if (e.tipo_registro === "ponto" && typeof e.payload?.offline !== "boolean") add("MODO_CAPTURA_NAO_REGISTRADO", ["afd", "comprovante"], e.event_id);
    if (e.tipo_registro === "ponto" && typeof e.payload?.offline === "boolean" && e.payload.versaoCaptura !== 1) add("MODO_CAPTURA_SEM_PROTECAO_HASH", ["afd", "comprovante"], e.event_id);
    if (e.tipo_registro === "ponto" && !cpfValido(e.cpf)) add("CPF_TRABALHADOR_INVALIDO", ["afd", "aej", "comprovante"], e.event_id);
    if (!e.hora_confiavel || e.relogio_alterado) add("HORA_REQUER_CONFERENCIA", ["afd", "aej", "comprovante"], e.event_id);
  }
  for (const d of deviceMap.values()) {
    if (d.company_id !== snapshot.companyId || d.estabelecimento_id !== estabId) add("ESCOPO_APARELHO_INVALIDO", ["afd", "aej", "comprovante"], d.id, true);
    const chain = events.filter(e => e.dispositivo_id === d.id).sort((a, b) => Number(a.local_sequence) - Number(b.local_sequence));
    let previous = "0".repeat(64), seq = 0;
    for (const e of chain) {
      if (Number(e.local_sequence) !== seq + 1 || e.local_previous_hash !== previous) add("CADEIA_LOCAL_INTERROMPIDA", ["afd", "aej", "comprovante"], e.event_id, true);
      previous = e.local_hash; seq = Number(e.local_sequence);
    }
    if (seq !== Number(d.ultima_sequencia_local) || previous !== d.ultimo_hash_local) add("TOPO_LOCAL_DIVERGENTE", ["afd", "aej", "comprovante"], d.id, true);
  }
  const fiscais = [];
  for (const r of records) {
    const e = eventMap.get(r.event_id);
    if (nsrs.has(Number(r.nsr))) add("NSR_DUPLICADO", ["afd", "aej", "comprovante"], String(r.nsr), true);
    nsrs.add(Number(r.nsr));
    if (!e || e.tipo_registro !== "ponto" || r.company_id !== snapshot.companyId || r.estabelecimento_id !== estabId
      || e.dispositivo_id !== r.dispositivo_id || Number(e.local_sequence) !== Number(r.local_sequence)
      || Date.parse(r.gravado_em) !== Date.parse(r.gravado_em_texto)) { add("VINCULO_FISCAL_INVALIDO", ["afd", "aej", "comprovante"], r.event_id, true); continue; }
    fiscais.push(registroFiscalDoBanco(r, e));
  }
  const chain = await verificarCadeiaFiscal(fiscais, sha256);
  if (!chain.ok) add("CADEIA_FISCAL_INVALIDA", ["afd", "aej", "comprovante"], null, true);
  const sorted = [...records].sort((a, b) => Number(a.nsr) - Number(b.nsr)), last = sorted.at(-1);
  if (Number(snapshot?.contador?.ultimo_nsr || 0) !== Number(last?.nsr || 0)
    || (snapshot?.contador?.ultimo_hash_fiscal || "0".repeat(64)) !== (last?.fiscal_hash || "0".repeat(64))) add("TOPO_FISCAL_DIVERGENTE", ["afd", "aej", "comprovante"], null, true);
  const fiscalEvents = new Set(records.map(r => r.event_id));
  for (const e of events) if (e.tipo_registro === "ponto" && !fiscalEvents.has(e.event_id)) add("BATIDA_SEM_NSR_FISCAL", ["afd", "aej", "comprovante"], e.event_id, true);
  if (snapshot?.legados?.length) add("LEGADO_SEM_NSR_FISCAL_NAO_CONVERTER", ["afd", "aej", "comprovante"]);
  if (!snapshot?.config?.rep?.inpi) add("REGISTRO_INPI_PENDENTE", ["afd", "aej", "comprovante"]);
  if (!snapshot?.config?.rep?.desenvolvedor) add("DESENVOLVEDOR_REP_PENDENTE", ["afd"]);
  if (!snapshot?.config?.tratamento) add("TRATAMENTO_AEJ_PENDENTE", ["aej"]);
  // Não há NSR histórico para cadastros/ajustes/eventos sensíveis neste esquema.
  if (snapshot?.config?.historicoAdministrativoCompleto !== true) add("HISTORICO_ADMINISTRATIVO_NAO_COMPROVADO", ["afd", "comprovante"]);
  return { versao: 1, somenteLeitura: true, conforme: false,
    integridadeValida: !pendencias.some(p => p.integridade),
    aptoParaGeracao: Object.fromEntries(["afd", "aej", "comprovante"].map(t => [t, !pendencias.some(p => p.alvo.includes(t))])),
    pendencias, contagens: { eventos: events.length, registrosFiscais: records.length, legados: snapshot?.legados?.length || 0 },
    assinatura: "ICP_BRASIL_NAO_CONFIGURADA", captura: "Sem pareamento, alteração ou renumeração de batidas" };
}
