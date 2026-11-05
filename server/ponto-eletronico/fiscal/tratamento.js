import { sourceSignature } from "../../../src/domains/ponto-eletronico/conferencia.js";
import { exigir, dh, periodo } from "./campos.js";

// Reaproveita somente dias já conferidos, com quatro batidas explícitas e
// sem ajuste. Não reconstrói decisões do RH a partir de uma grade resumida.
export function tratamentoDoPontoExistente(s, dados, { de, ate }) {
  periodo(de, ate);
  const timezone = s.estabelecimento.timezone, groups = new Map();
  for (const e of s.eventos.filter(e => e.tipo_registro === "ponto")) {
    const day = dh(e.marcado_em_texto, timezone).slice(0, 10);
    if (day < de || day > ate) continue;
    const key = e.employee_id + "|" + day;
    if (!groups.has(key)) groups.set(key, { employeeId: e.employee_id, day, events: [] });
    groups.get(key).events.push(e);
  }
  for (const [employeeId, days] of Object.entries(dados?.attendance || {})) {
    for (const [day, record] of Object.entries(days || {})) if (day >= de && day <= ate && record?.status) {
      exigir(groups.has(employeeId + "|" + day), "GRADE_SEM_ORIGINAIS_EXIGE_TRATAMENTO_EXPLICITO");
      exigir(record.status === "P", "AUSENCIA_EXIGE_TRATAMENTO_EXPLICITO");
    }
  }
  const employeeIds = [...new Set([...groups.values()].map(g => g.employeeId))].sort();
  const vinculos = employeeIds.map((employeeId, index) => {
    const employee = (dados?.employees || []).find(e => String(e.id) === String(employeeId));
    exigir(employee, "CADASTRO_FUNCIONARIO_AUSENTE");
    return { id: index + 1, employeeId, cpf: String(employee.cpf || "").replace(/\D/g, ""), nome: employee.name, matriculaEsocial: employee.employeeRegistration };
  });
  const horarios = [], marcacoes = [], codes = new Map();
  for (const group of [...groups.values()].sort((a, b) => (a.employeeId + a.day).localeCompare(b.employeeId + b.day))) {
    const record = dados?.attendance?.[group.employeeId]?.[group.day], review = record?.pontoReview;
    exigir(review?.reviewedBy && review?.reviewedAt, "DIA_NAO_CONFERIDO_PELO_RH");
    exigir(record.status === "P" && review.adjusted === false, "AJUSTE_EXIGE_TRATAMENTO_EXPLICITO");
    const events = [...group.events].sort((a, b) => Date.parse(a.marcado_em_texto) - Date.parse(b.marcado_em_texto));
    const source = events.map(e => ({ eventId: e.event_id, marcadoEm: e.marcado_em_texto, tipoRegistro: "ponto", obraId: e.obra_id, tipoEvento: e.payload?.tipoEvento }));
    exigir(review.sourceSignature === sourceSignature(source), "CONFERENCIA_DESATUALIZADA");
    exigir(events.length === 4 && events.every((e, i) => e.payload?.versaoJornada === 1 && e.payload.tipoEvento === ["entrada", "intervalo", "retorno", "saida"][i]), "INTERVALO_OU_TIPOS_EXIGEM_TRATAMENTO_EXPLICITO");
    const schedule = review.schedule;
    exigir(schedule?.working && schedule.minutes > 0, "HORARIO_CONTRATUAL_AUSENTE");
    const fields = ["entrada", "intervaloSaida", "intervaloRetorno", "saida"];
    exigir(events.every((e, i) => record[fields[i]] === dh(e.marcado_em_texto, timezone).slice(11, 16)), "GRADE_DIVERGE_DAS_ORIGINAIS");
    const fingerprint = JSON.stringify(schedule);
    if (!codes.has(fingerprint)) {
      const codigo = "H" + (horarios.length + 1); codes.set(fingerprint, codigo);
      horarios.push({ codigo, duracaoMinutos: schedule.minutes, pares: [
        { entrada: schedule.entrada.replace(":", ""), saida: schedule.intervaloSaida.replace(":", "") },
        { entrada: schedule.intervaloRetorno.replace(":", ""), saida: schedule.saida.replace(":", "") },
      ] });
    }
    for (let i = 0; i < events.length; i++) marcacoes.push({ eventId: events[i].event_id, vinculoId: vinculos.find(w => w.employeeId === group.employeeId).id,
      repId: 1, marcadoEm: events[i].marcado_em_texto, tipo: i % 2 ? "S" : "E", fonte: "O", par: i < 2 ? 1 : 2,
      horarioCodigo: i === 0 ? codes.get(fingerprint) : "" });
  }
  return { ptrp: s.config?.ptrp, reps: [{ id: 1, tipo: 3, inpi: s.config?.rep?.inpi }], vinculos, horarios, marcacoes, ausencias: [] };
}
