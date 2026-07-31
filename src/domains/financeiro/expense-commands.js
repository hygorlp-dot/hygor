import {
  cancelCompanyExpense,
  cancelDreExpense,
  createDreExpense,
  replicateCompanyRecurringExpenses,
  saveCompanyExpense,
} from "../dre/mutations.js";

export const EXPENSE_COMMAND=Object.freeze({
  PROJECT_EXPENSE_CREATED:"DESPESA_OBRA_CRIADA",
  PROJECT_EXPENSE_CANCELLED:"DESPESA_OBRA_CANCELADA",
  COMPANY_EXPENSE_SAVED:"DESPESA_EMPRESA_SALVA",
  COMPANY_EXPENSE_CANCELLED:"DESPESA_EMPRESA_CANCELADA",
  COMPANY_RECURRING_EXPENSES_REPLICATED:"DESPESAS_EMPRESA_RECORRENTES_REPLICADAS",
});

export const EXPENSE_COMMAND_TYPES=new Set(Object.values(EXPENSE_COMMAND));
export const COMPANY_EXPENSE_COMMAND_TYPES=new Set([
  EXPENSE_COMMAND.COMPANY_EXPENSE_SAVED,
  EXPENSE_COMMAND.COMPANY_EXPENSE_CANCELLED,
  EXPENSE_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED,
]);

const fail=reason=>({ok:false,reason});
const actorFrom=command=>({id:command.actorId||"",nome:command.actorName||""});
const versionOf=item=>Number(item?.version||0);
const versionError=(current,expected,label)=>{
  if(expected==null)return "";
  return versionOf(current)===Number(expected)
    ?""
    :`${label} foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.`;
};
const projectExpenseById=(data,id)=>(data?.outrasDesp||[]).find(item=>item.id===id);
const companyExpenseById=(data,id)=>(data?.despesasEmpresa||[]).find(item=>item.id===id);

export const expenseCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  if(command.type===EXPENSE_COMMAND.PROJECT_EXPENSE_CREATED)return String(payload.expense?.obraId||"");
  if(command.type===EXPENSE_COMMAND.PROJECT_EXPENSE_CANCELLED){
    return String(projectExpenseById(data,payload.expenseId)?.obraId||"");
  }
  return "";
};

export const applyExpenseCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!EXPENSE_COMMAND_TYPES.has(command.type))return null;
  const actor=actorFrom(command);
  if(!actor.id)return fail("Sessão do usuário indisponível para alterar despesas.");
  const payload=command.payload||{};

  if(command.type===EXPENSE_COMMAND.PROJECT_EXPENSE_CREATED){
    const expense=payload.expense||{};
    const id=String(expense.id||"");
    if(!id)return fail("Identificador da despesa ausente.");
    if(!(data.obras||[]).some(item=>String(item.id)===String(expense.obraId||""))){
      return fail("A obra da despesa não existe.");
    }
    if(projectExpenseById(data,id)||companyExpenseById(data,id))return fail("Já existe uma despesa com esta identificação.");
    try{
      return {ok:true,data:createDreExpense({data,expense,actor,id,now}),entityId:id};
    }catch(error){
      return fail(error?.message||"Não foi possível registrar a despesa.");
    }
  }

  if(command.type===EXPENSE_COMMAND.PROJECT_EXPENSE_CANCELLED){
    const id=String(payload.expenseId||"");
    const current=projectExpenseById(data,id);
    if(!current)return fail("Despesa não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A despesa");
    if(stale)return fail(stale);
    try{
      return {ok:true,data:cancelDreExpense({
        data,expenseId:id,reason:payload.reason,actor,now,
      }),entityId:id};
    }catch(error){
      return fail(error?.message||"Não foi possível cancelar a despesa.");
    }
  }

  if(command.type===EXPENSE_COMMAND.COMPANY_EXPENSE_SAVED){
    const expense=payload.expense||{};
    const id=String(expense.id||"");
    if(!id)return fail("Identificador da despesa corporativa ausente.");
    const current=companyExpenseById(data,id);
    if(!current&&projectExpenseById(data,id))return fail("Já existe uma despesa com esta identificação.");
    if(current?.transacaoId)return fail("Desfaça a conciliação bancária antes de editar esta despesa corporativa.");
    const stale=versionError(current,command.expectedVersion,"A despesa corporativa");
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0){
      return fail("A nova despesa corporativa precisa iniciar na versão zero.");
    }
    try{
      return {ok:true,data:saveCompanyExpense({data,expense,actor,id,now}),entityId:id};
    }catch(error){
      return fail(error?.message||"Não foi possível salvar a despesa corporativa.");
    }
  }

  if(command.type===EXPENSE_COMMAND.COMPANY_EXPENSE_CANCELLED){
    const id=String(payload.expenseId||"");
    const current=companyExpenseById(data,id);
    if(!current)return fail("Despesa corporativa não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A despesa corporativa");
    if(stale)return fail(stale);
    try{
      return {ok:true,data:cancelCompanyExpense({
        data,expenseId:id,reason:payload.reason,actor,now,
      }),entityId:id};
    }catch(error){
      return fail(error?.message||"Não foi possível cancelar a despesa corporativa.");
    }
  }

  const ids=Array.isArray(payload.ids)?payload.ids.filter(Boolean):[];
  if(new Set(ids).size!==ids.length)return fail("Há identificadores repetidos na cópia das despesas recorrentes.");
  const occupied=new Set([
    ...(data.outrasDesp||[]).map(item=>item.id),
    ...(data.despesasEmpresa||[]).map(item=>item.id),
  ]);
  if(ids.some(id=>occupied.has(id)))return fail("Um identificador da cópia já está em uso.");
  try{
    const result=replicateCompanyRecurringExpenses({
      data,fromCompetence:payload.fromCompetence,toCompetence:payload.toCompetence,
      actor,ids,now,
    });
    const {copied,...next}=result;
    return {
      ok:true,data:next,copied,
      entityId:`despesas-recorrentes:${payload.toCompetence||""}`,
    };
  }catch(error){
    return fail(error?.message||"Não foi possível copiar as despesas recorrentes.");
  }
};
