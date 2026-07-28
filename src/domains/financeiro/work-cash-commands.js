import { calculateWorkCash } from "./work-cash.js";
import { active } from "./ledger.js";

export const WORK_CASH_COMMAND=Object.freeze({
  WORK_CASH_MOVEMENT_CREATED:"MOVIMENTO_CAIXA_OBRA_CRIADO",
  WORK_CASH_MOVEMENT_CANCELLED:"MOVIMENTO_CAIXA_OBRA_CANCELADO",
});
export const WORK_CASH_COMMAND_TYPES=new Set(Object.values(WORK_CASH_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const inactive=item=>!active(item);
const movementById=(data,id)=>(data?.caixaObra||[]).find(item=>item.id===id);

export const workCashCommandObraId=(data={},command={})=>{
  if(command.type===WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED){
    return String(command.payload?.movement?.obraId||"");
  }
  return String(movementById(data,command.payload?.movementId)?.obraId||"");
};

export const applyWorkCashCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!WORK_CASH_COMMAND_TYPES.has(command.type))return null;
  const actor={id:command.actorId||"",nome:command.actorName||""};
  if(!actor.id)return fail("Sessão do usuário indisponível para alterar o caixa da obra.");

  if(command.type===WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED){
    const raw=command.payload?.movement||{};
    const id=String(raw.id||""),obraId=String(raw.obraId||"");
    const project=(data.obras||[]).find(item=>String(item.id)===obraId);
    if(!id)return fail("Movimento do caixa sem identificação.");
    if(!project)return fail("A obra do movimento não existe.");
    if(!project.hasCaixa)return fail("O caixa desta obra não está ativado.");
    if(movementById(data,id))return fail("Já existe um movimento com esta identificação.");
    const tipo=String(raw.tipo||"");
    if(!["aporte","despesa"].includes(tipo))return fail("Tipo de movimento do caixa inválido.");
    const valor=Number(raw.valor);
    if(!(valor>0)||!Number.isFinite(valor))return fail("Informe um valor positivo para o movimento.");
    const date=String(raw.data||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail("Informe uma data válida para o movimento.");
    if(tipo==="despesa"&&valor>calculateWorkCash(data,obraId).saldo+0.001){
      return fail("O caixa da obra não possui saldo suficiente para esta despesa.");
    }
    const userName=actor.nome||"Usuário autenticado";
    const movement={
      ...raw,id,obraId,data:date,tipo,valor,
      categoria:String(raw.categoria||(tipo==="aporte"?"aporte":"outros")),
      descricao:String(raw.descricao||"").trim(),
      conciliado:false,transacaoId:"",
      naturezaEntrada:tipo==="aporte"?"aporte_manual":"",
      efeitoDRE:tipo==="aporte"?"sem_efeito":"custo_obra",
      status:"ativo",version:1,
      registradoEm:now,registradoPorId:actor.id,registradoPor:userName,
      updatedAt:now,updatedById:actor.id,updatedBy:userName,
    };
    return {
      ok:true,data:{...data,caixaObra:[...(data.caixaObra||[]),movement]},
      entityId:id,
    };
  }

  const id=String(command.payload?.movementId||"");
  const current=movementById(data,id);
  if(!current)return fail("Movimento do caixa não encontrado.");
  if(inactive(current))return fail("Este movimento já está cancelado ou estornado.");
  if(current.pagamentoId)return fail("Este movimento foi gerado por um pagamento. Estorne o pagamento de origem.");
  if(current.transacaoId)return fail("Desfaça a conciliação bancária antes de cancelar este movimento.");
  if(command.expectedVersion!=null&&versionOf(current)!==Number(command.expectedVersion)){
    return fail("O movimento foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.");
  }
  const reason=String(command.payload?.reason||"").trim();
  if(!reason)return fail("Informe o motivo do cancelamento do movimento.");
  const userName=actor.nome||"Usuário autenticado";
  const cancelled={
    ...current,status:current.tipo==="aporte"?"cancelado":"estornado",
    motivoCancelamento:reason,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:userName,
    updatedAt:now,updatedById:actor.id,updatedBy:userName,version:versionOf(current)+1,
  };
  return {
    ok:true,
    data:{...data,caixaObra:(data.caixaObra||[]).map(item=>item.id===id?cancelled:item)},
    entityId:id,
  };
};
