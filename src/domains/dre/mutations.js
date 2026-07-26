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

export const createDreExpense = ({ data, expense, actor, id, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para registrar a despesa.");
  if (!id) throw new Error("Identificador da despesa ausente.");
  const descricao=String(expense?.descricao || "").trim();
  const competencia=String(expense?.competencia || "").trim();
  const valor=Number(expense?.valor);
  if (!descricao) throw new Error("Informe a descrição da despesa.");
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Informe uma competência válida para a despesa.");
  if (!(valor > 0) || !Number.isFinite(valor)) throw new Error("Informe um valor positivo para a despesa.");
  const registro={
    id, obraId:String(expense?.obraId || ""), competencia, categoria:String(expense?.categoria || "outros"), descricao, valor,
    status:"ativo", origem:"dre_obra", createdAt:now, createdById:actor.id, createdBy:actor.nome || actor.email || "Usuário autenticado",
    updatedAt:now, updatedById:actor.id, updatedBy:actor.nome || actor.email || "Usuário autenticado",
  };
  return { ...data, outrasDesp:[...(Array.isArray(data?.outrasDesp) ? data.outrasDesp : []), registro] };
};
