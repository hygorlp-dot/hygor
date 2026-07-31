export const normalizeAttendanceRecord = value => {
  if (!value) return null;
  if (typeof value === "string") {
    return { status:value || null, ot:0, note:"", obraId:"" };
  }
  return {
    ...value,
    status:value.status || null,
    ot:Number(value.ot || 0),
    note:value.note || "",
    obraId:value.obraId || "",
  };
};
