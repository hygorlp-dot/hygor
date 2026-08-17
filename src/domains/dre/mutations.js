// Mutações pequenas e auditáveis do DRE. A tela não pode cancelar uma despesa
// sem uma identidade de usuário: além de quebrar no navegador, isso criaria um
// evento financeiro sem autoria.
import { active } from "../financeiro/ledger.js";

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
  if (expense.transacaoId) throw new Error("Desfaça a conciliação bancária antes de cancelar esta despesa.");
  return {
    ...data,
    outrasDesp:despesas.map(item => item.id !== expenseId ? item : ({
      ...item, status:"cancelado", motivoCancelamento, canceladoEm:now,
      canceladoPorId:actor.id, canceladoPor:actor.nome || actor.email || "Usuário autenticado",
      updatedAt:now, updatedById:actor.id, updatedBy:actor.nome || actor.email || "Usuário autenticado",
      version:Number(item.version || 0)+1,
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
    contaAdmin:expense?.contaAdmin !== false,
    status:"ativo", origem:"dre_obra", createdAt:now, createdById:actor.id, createdBy:actor.nome || actor.email || "Usuário autenticado",
    updatedAt:now, updatedById:actor.id, updatedBy:actor.nome || actor.email || "Usuário autenticado",
    version:1,
  };
  return { ...data, outrasDesp:[...(Array.isArray(data?.outrasDesp) ? data.outrasDesp : []), registro] };
};

export const createManualReceipt = ({ data, receipt, actor, id, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para registrar o recebimento.");
  if (!id) throw new Error("Identificador do recebimento ausente.");
  const obraId=String(receipt?.obraId || "");
  const date=String(receipt?.date || receipt?.data || "");
  const amount=Number(receipt?.amount ?? receipt?.valor);
  if (!obraId) throw new Error("Selecione a obra do recebimento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Informe uma data válida para o recebimento.");
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Informe um valor positivo para o recebimento.");
  const userName=actor.nome || actor.email || "Usuário autenticado";
  const registro={
    id, obraId, date, amount, description:String(receipt?.description || receipt?.descricao || "Recebimento avulso").trim() || "Recebimento avulso",
    tipo:"recebimento_avulso", origem:"manual", transacaoId:"", conciliado:false, medicaoId:"", contratoId:"", status:"ativo",
    createdAt:now, createdById:actor.id, createdBy:userName, updatedAt:now, updatedById:actor.id, updatedBy:userName,
    version:1,
  };
  return { ...data, payments:[...(Array.isArray(data?.payments) ? data.payments : []), registro] };
};

export const reverseManualReceipt = ({ data, receiptId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para estornar o recebimento.");
  const motivoCancelamento=String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do estorno do recebimento.");
  const payments=Array.isArray(data?.payments) ? data.payments : [];
  const receipt=payments.find(item=>item.id===receiptId);
  if (!receipt) throw new Error("Recebimento não encontrado.");
  if (["cancelado","cancelada","estornado"].includes(String(receipt.status || "").toLowerCase())) throw new Error("Este recebimento já está estornado.");
  if (receipt.conciliado || receipt.transacaoId) throw new Error("Desfaça a conciliação bancária antes de estornar este recebimento.");
  const userName=actor.nome || actor.email || "Usuário autenticado";
  return {...data,payments:payments.map(item=>item.id!==receiptId?item:{...item,status:"estornado",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:userName,updatedAt:now,updatedById:actor.id,updatedBy:userName,version:Number(item.version||0)+1})};
};

export const cancelCompanyExpense = ({ data, expenseId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para cancelar a despesa corporativa.");
  const motivoCancelamento=String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do cancelamento da despesa corporativa.");
  const despesas=Array.isArray(data?.despesasEmpresa) ? data.despesasEmpresa : [];
  const expense=despesas.find(item=>item.id===expenseId);
  if (!expense) throw new Error("Despesa corporativa não encontrada.");
  if (["cancelado","cancelada","estornado"].includes(String(expense.status || "").toLowerCase())) throw new Error("Esta despesa corporativa já está cancelada ou estornada.");
  if (expense.transacaoId) throw new Error("Desfaça a conciliação bancária antes de cancelar esta despesa corporativa.");
  return {...data,despesasEmpresa:despesas.map(item=>item.id!==expenseId?item:{...item,status:"cancelada",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:actor.nome||actor.email||"Usuário autenticado",updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||actor.email||"Usuário autenticado",version:Number(item.version||0)+1})};
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
  const vencimento=String(expense?.vencimento||"");
  const dataPagamento=String(expense?.dataPagamento||"");
  if (vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) throw new Error("Informe um vencimento válido.");
  if (dataPagamento && !/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) throw new Error("Informe uma data de pagamento válida.");
  const parcelas=Math.max(1,Math.trunc(Number(expense?.parcelas||1)));
  if (parcelas>120) throw new Error("A quantidade de parcelas deve ser de no máximo 120.");
  const formaPagamento=String(expense?.formaPagamento||"");
  const pago=expense?.pago===true;
  if (pago&&!dataPagamento) throw new Error("Informe a data em que a despesa foi paga.");
  const registro={
    ...anterior,...expense,id,competencia,descricao,valor,
    categoria:String(expense?.categoria||"outros"),recorrente:!!expense?.recorrente,
    fornecedor:String(expense?.fornecedor||"").trim(),documento:String(expense?.documento||"").trim(),
    centroCusto:String(expense?.centroCusto||"escritorio"),vencimento,formaPagamento,
    cartao:formaPagamento==="cartao_credito"||formaPagamento==="cartao_debito"
      ? String(expense?.cartao||"").trim() : "",
    parcelas, pago, dataPagamento:pago?dataPagamento:"",
    observacao:String(expense?.observacao||"").trim(),
    status:anterior?.status||"ativo",origem:anterior?.origem||"dre_empresa",
    createdAt:anterior?.createdAt||now,createdById:anterior?.createdById||actor.id,
    createdBy:anterior?.createdBy||actor.nome||actor.email||"Usuário autenticado",
    updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||actor.email||"Usuário autenticado",
    version:Number(anterior?.version||0)+1,
  };
  return {...data,despesasEmpresa:anterior?despesas.map(item=>item.id===id?registro:item):[...despesas,registro]};
};

export const replicateCompanyRecurringExpenses = ({ data, fromCompetence, toCompetence, actor, ids = [], now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para copiar despesas recorrentes.");
  if (!/^\d{4}-\d{2}$/.test(String(fromCompetence || "")) || !/^\d{4}-\d{2}$/.test(String(toCompetence || ""))) throw new Error("Informe competências válidas para copiar despesas recorrentes.");
  const despesas=Array.isArray(data?.despesasEmpresa) ? data.despesasEmpresa : [];
  const existentes=new Set(despesas
    .filter(item=>item.competencia===toCompetence&&active(item))
    .map(item=>`${item.categoria}|${item.descricao}`));
  const fontes=despesas.filter(item=>
    item.competencia===fromCompetence
    &&item.recorrente
    &&active(item)
    &&!existentes.has(`${item.categoria}|${item.descricao}`));
  if (ids.length<fontes.length) throw new Error("Identificadores insuficientes para copiar despesas recorrentes.");
  const novos=fontes.map((item,index)=>({
    ...item,id:ids[index],competencia:toCompetence,status:"ativo",
    origem:"recorrencia_dre_empresa",
    // A recorrência cria uma nova obrigação, nunca reaproveita a baixa ou o
    // vínculo bancário do mês anterior.
    pago:false,dataPagamento:"",pagamentoId:"",transacaoId:"",conciliado:false,
    createdAt:now,createdById:actor.id,createdBy:actor.nome||actor.email||"Usuário autenticado",
    updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||actor.email||"Usuário autenticado",
    version:1,motivoCancelamento:"",canceladoEm:"",canceladoPorId:"",canceladoPor:"",
  }));
  return {...data,despesasEmpresa:[...despesas,...novos],copied:novos.length};
};
