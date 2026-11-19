import {contar} from '../../design-system/copy.js';

const positivo = value => Number.isFinite(Number(value)) && Number(value)>0;
const chave = item => JSON.stringify([item.id,item.etapaId,item.codigo,item.descricao,item.unidade,item.quantidade,item.precoUnit]);
export function canExcludeBudgetItem(item){
  if(!budgetPendingKind(item))return false;
  const quantity=Number(item.quantidade||0), price=Number(item.precoUnit||0);
  return Number.isFinite(quantity)&&Number.isFinite(price)&&quantity>=0&&price>=0&&quantity*price===0;
}

export function budgetPendingKind(item){
  if(!item || item.tipo==='titulo')return null;
  if(!positivo(item.quantidade))return 'measure';
  if(!positivo(item.precoUnit))return 'quote';
  return null;
}

export function budgetScopeExclusion(item){
  const record=item?.exclusaoEscopo;
  return record?.chave===chave(item||{}) && typeof record.motivo==='string' && record.motivo.trim() && record.motivo.length<=500
    && record.autorId && typeof record.autor==='string' && record.autor.trim() && typeof record.data==='string' && Number.isFinite(Date.parse(record.data)) && canExcludeBudgetItem(item)
    ? record : null;
}

export function changeBudgetScopeExclusion(item,{exclude,reason,actorId,actorName,now}){
  if(!item || !budgetPendingKind(item))throw new Error('Confira se o item ainda tem uma pendência de quantidade ou preço.');
  if(!exclude){
    const {exclusaoEscopo,...included}=item;
    return included;
  }
  const motivo=String(reason||'').trim();
  if(!motivo || motivo.length>500)throw new Error('Informe um motivo com até 500 caracteres.');
  if(!actorId || !now)throw new Error('Não foi possível identificar o responsável.');
  if(!canExcludeBudgetItem(item))
    throw new Error('Corrija os valores inválidos antes de excluir o item do escopo.');
  return {...item,exclusaoEscopo:{chave:chave(item),motivo,autorId:actorId,autor:actorName||actorId,data:now}};
}

export function budgetCompletion(budget){
  const result={measure:0,quote:0,excluded:[]};
  for(const item of budget?.itens||[]){
    const kind=budgetPendingKind(item);
    if(!kind)continue;
    const exclusion=budgetScopeExclusion(item);
    if(exclusion)result.excluded.push({item,exclusion});
    else result[kind]++;
  }
  const partial=Boolean(result.measure||result.quote);
  const details=[result.measure?contar(result.measure,'serviço a medir','serviços a medir'):'',
    result.quote?contar(result.quote,'serviço a cotar','serviços a cotar'):''].filter(Boolean).join(' e ');
  return {...result,partial,warning:partial?`Total parcial. ${details}.`:''};
}
