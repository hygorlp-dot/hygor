// Registros operacionais e financeiros não devem desaparecer. O cancelamento
// preserva o fato original e acrescenta a evidência necessária à auditoria.
export function cancelRecord(
  record,
  reason,
  user,
  status = "cancelado",
  { now = () => new Date().toISOString() } = {},
) {
  return {
    ...record,
    status,
    motivoCancelamento: String(reason || "").trim(),
    canceladoEm: now(),
    canceladoPorId: user?.id || "",
    canceladoPor: user?.nome || "",
  };
}
