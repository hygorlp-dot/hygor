const cloneAttendance = attendance => Object.fromEntries(
  Object.entries(attendance || {}).map(([employeeId, dates]) => [employeeId, {...(dates || {})}])
);

// Restaura apenas dias que não foram relançados depois do arquivamento. A
// fotografia arquivada permanece intacta: ela é a evidência do fechamento.
// A diária e os benefícios do dia também voltam congelados no lançamento:
// reabrir o ponto não pode recalcular meses fechados com o salário de hoje.
export const restoreArchivedAttendance = ({attendance = {}, archiveAttendance = {}, employeesSnapshot = []} = {}) => {
  const restored = cloneAttendance(attendance);
  const rates=new Map((employeesSnapshot||[]).map(employee=>[String(employee.id),{
    archivedDailyRate:Number(employee.dailyRate||0),
    archivedVtDaily:Number(employee.vtDaily||0),
    archivedVrDaily:Number(employee.vrDaily||0),
    archivedWorkdayHours:Number(employee.workdayHours||8),
    archivedWorkStart:String(employee.workStart||"07:00"),
    archivedOvertimeAdditionalPercent:Number(employee.overtimeAdditionalPercent??50),
  }]));
  let devolvidos = 0;
  let mantidos = 0;

  for (const [employeeId, dates] of Object.entries(archiveAttendance || {})) {
    const target = {...(restored[employeeId] || {})};
    for (const [date, record] of Object.entries(dates || {})) {
      if (target[date]) {
        mantidos += 1;
        continue;
      }
      target[date] = {...record,...(rates.get(String(employeeId))||{})};
      devolvidos += 1;
    }
    restored[employeeId] = target;
  }

  return {attendance: restored, devolvidos, mantidos};
};

export const restorationRecord = ({archive = {}, quinzenaId, actor = {}, at}) => ({
  quinzenaId,
  archiveKey: archive?.meta?.quinzenaId || quinzenaId,
  restoredAt: at,
  restoredBy: {id: actor.id || "", nome: actor.nome || ""},
  sourceArchivedAt: archive?.meta?.archivedAt || "",
});
