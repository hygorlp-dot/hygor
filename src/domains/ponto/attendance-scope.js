// Separate company administrative staff from field workers without inventing a worksite.
// A worker with no obra and workArea=campo remains "sem_lotacao".
export const ATTENDANCE_SCOPE = Object.freeze({ OBRAS: "obras", ADMINISTRATIVO: "administrativo" });
export function classifyAttendanceScope(employee) {
  return employee?.workArea === "administrativo" ? ATTENDANCE_SCOPE.ADMINISTRATIVO : ATTENDANCE_SCOPE.OBRAS;
}
export function employeesForAttendanceScope(employees, scope, obraId = "") {
  const selection = (employees || []).filter(e => e && e.active !== false && !e.endDate && String(e.status || "").toLowerCase() !== "desligado");
  if (scope === ATTENDANCE_SCOPE.ADMINISTRATIVO) return selection.filter(e => classifyAttendanceScope(e) === scope);
  if (scope !== ATTENDANCE_SCOPE.OBRAS) return [];
  return selection.filter(e => classifyAttendanceScope(e) === scope && (!obraId || String(e.obra || "") === String(obraId)));
}
export function attendanceScopeCounts(employees) {
  return {
    obras: employeesForAttendanceScope(employees, ATTENDANCE_SCOPE.OBRAS).length,
    administrativo: employeesForAttendanceScope(employees, ATTENDANCE_SCOPE.ADMINISTRATIVO).length,
  };
}
