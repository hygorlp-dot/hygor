// Mutações pequenas e auditáveis do DRE. A tela não pode cancelar uma despesa
// sem uma identidade de usuário: além de quebrar no navegador, isso criaria um
// evento financeiro sem autoria.
export const cancelDreExpense = ({ data, expenseId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para cancelar a despesa.");
  const motivoCancelamento = String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do cancelamento da despesa.");
  const despesas = Array.isArray(data?.outrasDesp) ? data.outrasDesp : [];
  const expense = despesas.find(item => item.id === expenseId);
  if (!expense) throw new Error("Despesa não encontrada.");
  if (["cancelado", "cancelada", "estornado"].includes(String(expense.status || "").toLowerCase())) {
    throw new Error("Esta despesa já está cancelada ou estornada.");
  }
  return {
    ...data,
    outrasDesp:despesas.map(item => item.id !== expenseId ? item : ({
      ...item, status:"cancelado", motivoCancelamento, canceladoEm:now,
      canceladoPorId:actor.id, canceladoPor:actor.nome || actor.email || "Usuário autenticado",
      updatedAt:now, updatedById:actor.id, updatedBy:actor.nome || actor.email || "Usuário autenticado",
    })),
  };
};
