const cloneAttendance = attendance => Object.fromEntries(
  Object.entries(attendance || {}).map(([employeeId, dates]) => [employeeId, {...(dates || {})}])
);

// Restaura apenas dias que não foram relançados depois do arquivamento. A
// fotografia arquivada permanece intacta: ela é a evidência do fechamento.
export const restoreArchivedAttendance = ({attendance = {}, archiveAttendance = {}} = {}) => {
  const restored = cloneAttendance(attendance);
  let devolvidos = 0;
  let mantidos = 0;

  for (const [employeeId, dates] of Object.entries(archiveAttendance || {})) {
    const target = {...(restored[employeeId] || {})};
    for (const [date, record] of Object.entries(dates || {})) {
      if (target[date]) {
        mantidos += 1;
        continue;
      }
      target[date] = record;
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
