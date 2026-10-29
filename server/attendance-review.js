import { inspectDay, CLOCK_FIELDS, sourceSignature, recordSignature } from "../src/domains/ponto-eletronico/conferencia.js";
import { calculateTimekeeping } from "../src/domains/ponto/timekeeping.js";

const fail = (error, status = 409) => ({ ok: false, error, status });
export function prepareAttendanceReview(data, user, command, now, events) {
  if (!["admin", "rh"].includes(user?.role)) return fail("Somente o RH e o administrador podem conferir e integrar batidas.", 403);
  if (!Array.isArray(events)) return fail("As batidas precisam ser consultadas pelo servidor.");
  if (command.date > new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Bahia" })) return fail("Não é possível conferir uma data futura.");
  const employee = (data.employees || []).find(e => String(e.id) === String(command.employeeId));
  const day = inspectDay(events, employee, command.date);
  if (!day.schedule?.working) return fail("Cadastre no RH uma escala vigente com expediente para este dia.");
  if (!day.batidas.length) return fail("Nenhuma batida recebida para este funcionário e dia.");
  if (command.sourceSignature !== sourceSignature(day.batidas)) return fail("As batidas mudaram. Atualize e confira novamente.");
  if (command.scheduleSignature !== JSON.stringify(day.schedule)) return fail("A escala mudou. Atualize e confira novamente.");
  const quinzena = `${command.date.slice(0,7)}-Q${Number(command.date.slice(8)) <= 15 ? 1 : 2}`;
  if (data.quinzenasArquivadas?.[quinzena]) return fail("Esta quinzena está arquivada. Restaure-a antes de conferir.");
  const current = data.attendance?.[command.employeeId]?.[command.date];
  if(current?.obraId && String(current.obraId)!==String(command.selectedObraId))return fail("O lançamento existente pertence a outra obra. Mantenha a obra original nesta conferência.");
  if (command.expectedRecord !== recordSignature(current)) return fail("O lançamento foi alterado por outra pessoa. Atualize antes de conferir.");
  const clocks = Object.fromEntries(CLOCK_FIELDS.map(k => [k, String(command.clocks?.[k] || "")]));
  if (!CLOCK_FIELDS.every((k,i) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clocks[k]) && (!i || clocks[k] > clocks[CLOCK_FIELDS[i-1]]))) return fail("Informe os quatro horários tratados em ordem: entrada, intervalo, retorno e saída.", 400);
  const calculation = calculateTimekeeping({ ...clocks, jornadaInicio: day.schedule.entrada });
  if (!calculation.valid || calculation.empty) return fail(calculation.error || "Jornada inválida.", 400);
  const reason = String(command.reason || "").trim().slice(0,2000);
  const adjusted = CLOCK_FIELDS.some(k => clocks[k] !== day.clocks[k]);
  if ((adjusted || day.warnings.length || current) && reason.length < 5) return fail("Informe a justificativa da conferência, dos ajustes ou da substituição do lançamento.", 400);
  const obraId = String(command.selectedObraId || "");
  if (!obraId || !(data.obras || []).some(o => String(o.id) === obraId)) return fail("Selecione a obra que receberá o lançamento.", 400);
  const status = command.status;
  if (!["P", "M"].includes(status)) return fail("Confirme presença ou meio dia para o lançamento.", 400);
  return { ok: true, record: { ...clocks, status, obraId,
    workedMinutes: calculation.workedMinutes, atrasoMin: calculation.delayMinutes,
    ot: Math.max(0, calculation.workedMinutes - day.schedule.minutes) / 60,
    note: reason,
    archivedWorkdayHours: day.schedule.minutes / 60, archivedWorkStart: day.schedule.entrada,
    pontoReview: { sourceSignature: sourceSignature(day.batidas), eventIds: day.batidas.map(b => String(b.eventId || b.id)),
      schedule: day.schedule, reviewedBy: String(user.id), reviewedByName: user.nome || user.email || "RH",
      reviewedAt: now, reason, adjusted, revision: Number(current?.pontoReview?.revision || 0) + 1 },
  } };
}
