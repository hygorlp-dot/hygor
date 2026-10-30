import { scheduleOnDate } from "../rh/work-schedule.js";

export const CLOCK_FIELDS = ["entrada", "intervaloSaida", "intervaloRetorno", "saida"];
export const EVENT_TYPES = ["entrada", "intervalo", "retorno", "saida"];
export const CLOCK_LABELS = ["Entrada", "Saída para intervalo", "Retorno do intervalo", "Saída"];
export const localClock = iso => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const sourceSignature = events => JSON.stringify([...events].map(e => [String(e.eventId || e.id), new Date(e.marcadoEm).toISOString(), e.tipoEvento || "", String(e.obraId || e.obraCapturaId || "")]).sort((a,b) => a[0].localeCompare(b[0])));
export const recordSignature = record => {
  if (!record) return "null";
  if (typeof record === "string") record = { status:record };
  return JSON.stringify([record.status || null, ...CLOCK_FIELDS.map(k=>record[k] || ""),
    Number(record.ot || 0), Number(record.workedMinutes || 0), Number(record.atrasoMin || 0),
    record.obraId || "", record.role || "", record.note || "", record.pontoReview || null]);
};

export function inspectDay(events, employee, date) {
  const batidas = [...events].filter(e => e.tipoRegistro === "ponto").sort((a,b) => a.marcadoEm.localeCompare(b.marcadoEm));
  const schedule = scheduleOnDate(employee, date);
  const clocks = Object.fromEntries(CLOCK_FIELDS.map((field, i) => {
    const matches = batidas.filter(e => e.tipoEvento === EVENT_TYPES[i]);
    return [field, matches.length === 1 ? localClock(matches[0].marcadoEm) : ""];
  }));
  const complete = batidas.length === 4 && batidas.every((b,i) => b.tipoEvento === EVENT_TYPES[i]) &&
    CLOCK_FIELDS.every((field,i) => !i || clocks[field] > clocks[CLOCK_FIELDS[i-1]]);
  const warnings = [];
  if (!schedule) warnings.push("Escala ainda não definida pelo RH para este dia.");
  else if (!schedule.working && batidas.length) warnings.push("Batidas em dia sem expediente previsto.");
  if (batidas.some(b => !EVENT_TYPES.includes(b.tipoEvento))) warnings.push("Há batidas sem tipo identificado. O RH deve informar os horários tratados.");
  if (batidas.length && !complete) warnings.push("Registros incompletos ou sequência incompatível; confira entrada, intervalo e saída.");
  if (batidas.some(b => !b.horaConfiavel || b.relogioAlterado || b.metodo === "encarregado")) warnings.push("Há batidas que exigem conferência da identificação ou do horário.");
  return { batidas, schedule, clocks, complete, warnings,
    situacao: !batidas.length ? "sem_batida" : complete && !warnings.length ? "aguardando_rh" : "conferir" };
}
