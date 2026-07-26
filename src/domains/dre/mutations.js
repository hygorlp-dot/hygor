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

export const cancelCompanyExpense = ({ data, expenseId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para cancelar a despesa corporativa.");
  const motivoCancelamento=String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do cancelamento da despesa corporativa.");
  const despesas=Array.isArray(data?.despesasEmpresa) ? data.despesasEmpresa : [];
  const expense=despesas.find(item=>item.id===expenseId);
  if (!expense) throw new Error("Despesa corporativa não encontrada.");
  if (["cancelado","cancelada","estornado"].includes(String(expense.status || "").toLowerCase())) throw new Error("Esta despesa corporativa já está cancelada ou estornada.");
  return {...data,despesasEmpresa:despesas.map(item=>item.id!==expenseId?item:{...item,status:"cancelada",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:actor.nome||actor.email||"Usuário autenticado",updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||actor.email||"Usuário autenticado"})};
};

export const saveCompanyExpense = ({ data, expense, actor, id, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para registrar a despesa corporativa.");
  if (!id) throw new Error("Identificador da despesa corporativa ausente.");
  const descricao=String(expense?.descricao || "").trim(), competencia=String(expense?.competencia || "").trim(), valor=Number(expense?.valor);
  if (!descricao) throw new Error("Informe a descrição da despesa corporativa.");
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Informe uma competência válida para a despesa corporativa.");
  if (!(valor > 0) || !Number.isFinite(valor)) throw new Error("Informe um valor positivo para a despesa corporativa.");
  const despesas=Array.isArray(data?.despesasEmpresa) ? data.despesasEmpresa : [];
  const anterior=despesas.find(item=>item.id===id);
  if (anterior && ["cancelado","cancelada","estornado"].includes(String(anterior.status || "").toLowerCase())) throw new Error("Não é permitido editar uma despesa corporativa cancelada.");
  const registro={...anterior,...expense,id,competencia,descricao,valor,categoria:String(expense?.categoria||"outros"),recorrente:!!expense?.recorrente,status:anterior?.status||"ativo",origem:anterior?.origem||"dre_empresa",createdAt:anterior?.createdAt||now,createdById:anterior?.createdById||actor.id,createdBy:anterior?.createdBy||actor.nome||actor.email||"Usuário autenticado",updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||actor.email||"Usuário autenticado",version:Number(anterior?.version||0)+1};
  return {...data,despesasEmpresa:anterior?despesas.map(item=>item.id===id?registro:item):[...despesas,registro]};
};
