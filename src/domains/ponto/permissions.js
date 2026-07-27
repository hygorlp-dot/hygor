export const resolveAttendanceObraId = ({ record, selectedObraId, employeeObraId } = {}) => {
  if (record?.obraId) return String(record.obraId);
  if (selectedObraId && selectedObraId !== "all") return String(selectedObraId);
  return String(employeeObraId || "");
};

export const canManageAttendanceWorkforce = role =>
  ["admin", "rh"].includes(String(role || ""));
