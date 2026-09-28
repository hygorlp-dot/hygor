export const normalizeAttendanceRecord = value => {
  if (!value) return null;
  if (typeof value === "string") {
    return { status:value || null, ot:0, note:"", obraId:"", role:"" };
  }
  return {
    ...value,
    status:value.status || null,
    ot:Number(value.ot || 0),
    note:value.note || "",
    obraId:value.obraId || "",
    // Função exercida NESTE dia - independente do cadastro do funcionário
    // (que pode mudar). Vazio significa "usa a função do cadastro", nunca é
    // gravado sozinho: só existe quando alguém ajustou explicitamente o dia.
    role:value.role || "",
  };
};
