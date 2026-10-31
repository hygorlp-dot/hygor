import { validDate } from "./date-validation.js";

export const SCHEDULE_44 = "44h-seg-sex";
export const SCHEDULE_LABEL = "44h semanais · seg–qui 07h–12h / 13h–17h · sex 07h–12h / 13h–16h · sábado e domingo livres";

// Histórico definido pelo RH; nunca presume uma escala para cadastros antigos.
export function scheduleOnDate(employee, date) {
  if (!validDate(date)) return null;
  const version = [...(employee?.workSchedules || [])].filter(s => s.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!version || version.code !== SCHEDULE_44) return null;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const working = day >= 1 && day <= 5;
  return { ...version, working, minutes: working ? (day === 5 ? 480 : 540) : 0,
    entrada: working ? "07:00" : "", intervaloSaida: working ? "12:00" : "",
    intervaloRetorno: working ? "13:00" : "", saida: working ? (day === 5 ? "16:00" : "17:00") : "" };
}

export function appendWorkSchedule(before, draft, actorId, now) {
  const history = before?.workSchedules || [];
  if (!draft) return { ok: true, history };
  if (draft.code !== SCHEDULE_44 || !validDate(draft.effectiveFrom)) return { ok: false, reason: "Informe uma vigência válida para a escala de 44h." };
  if (history.some(s => s.effectiveFrom >= draft.effectiveFrom)) return { ok: false, reason: "A nova vigência deve ser posterior à última escala cadastrada. O histórico é preservado." };
  return { ok: true, history: [...history, { code: SCHEDULE_44, effectiveFrom: draft.effectiveFrom, definedBy: actorId, definedAt: now }] };
}
