import {calculateItem} from './calculations.js';
import {budgetScopeExclusion} from './budget-pending.js';

const id=value=>String(value??'').trim();
const normalized=value=>id(value).normalize('NFD').replace(/\p{M}/gu,'').replace(/[²³]/g,c=>c==='²'?'2':'3').toUpperCase();

export function budgetRevisionFamily(versions=[],current){
  if(!current?.id)return [];
  const sameWork=versions.filter(version=>(version.obraId||'')===(current.obraId||''));
  const byVersion=new Map();
  for(const version of sameWork){
    const key=id(version.versionId||version.id);
    if(!key)continue;
    byVersion.set(key,byVersion.has(key)?null:version);
  }
  const chainOf=version=>{
    const chain=[];
    let node=version;
    while(node){
      const key=id(node.versionId||node.id);
      if(!key||byVersion.get(key)!==node||chain.includes(key))return [];
      chain.push(key);
      node=node.revisionOf?byVersion.get(id(node.revisionOf)):null;
    }
    return chain;
  };
  const currentChain=new Set(chainOf(current));
  return sameWork.filter(version=>version===current||chainOf(version).some(key=>currentChain.has(key)))
    .sort((a,b)=>Number(a.versionNumber||1)-Number(b.versionNumber||1)||id(a.createdAt).localeCompare(id(b.createdAt))||id(a.id).localeCompare(id(b.id)));
}

const impacts=()=>({quantity:0,price:0,bdi:0,scope:0,unresolved:0});
const groupSum=list=>list.reduce((total,row)=>total+row.totalCentavos,0);

function snapshot(budget){
  const stages=new Map((budget.etapas||[]).map(stage=>[stage.id,stage]));
  const stagePath=stageId=>{
    const path=[],seen=new Set();
    let stage=stages.get(stageId);
    while(stage&&!seen.has(stage.id)){
      path.unshift(stage.nome);
      seen.add(stage.id);
      stage=stages.get(stage.parentId);
    }
    return path.join(' / ');
  };
  const items=(budget.itens||[]).filter(row=>row.tipo!=='titulo').map(item=>({
    ...calculateItem(item,budget.bdi),stage:stagePath(item.etapaId),exclusion:budgetScopeExclusion(item),
  }));
  const groups=new Map();
  for(const item of items){
    const key=id(item.id);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item);
  }
  return {groups,total:groupSum(items),valid:items.every(item=>Number.isSafeInteger(item.totalCentavos))};
}

function compareMatched(before,after,impact,changes){
  const add=(factor,label)=>changes.push({factor,label});
  const scopeChanged=Boolean(before.exclusion)!==Boolean(after.exclusion);
  const unitChanged=normalized(before.unidade)!==normalized(after.unidade);
  const referenceChanged=normalized(before.codigo)!==normalized(after.codigo)||normalized(before.fonte)!==normalized(after.fonte);
  if(scopeChanged)add('scope',after.exclusion?'Excluído do escopo':'Reincluído no escopo');
  if(unitChanged)add('scope','Unidade alterada');
  if(referenceChanged)add('scope','Código ou fonte alterados');
  if(before.etapaId!==after.etapaId||before.stage!==after.stage)add('scope','Etapa alterada');
  if(id(before.descricao)!==id(after.descricao))add('scope','Descrição alterada');
  if(before.exclusion?.motivo!==after.exclusion?.motivo&&!scopeChanged)add('scope','Justificativa de exclusão alterada');

  if(scopeChanged||unitChanged||referenceChanged){
    impact.scope=after.totalCentavos-before.totalCentavos;
    return;
  }
  if(before.quantidade!==after.quantidade)add('quantity','Quantidade alterada');
  if(before.custoUnitario!==after.custoUnitario)add('price','Preço alterado');
  if(before.bdiEfetivo!==after.bdiEfetivo)add('bdi','BDI alterado');
  const usingQuantity=calculateItem({quantidade:after.quantidade,precoUnit:before.custoUnitario,bdi:before.bdiEfetivo}).totalCentavos;
  const usingPrice=calculateItem({quantidade:after.quantidade,precoUnit:after.custoUnitario,bdi:before.bdiEfetivo}).totalCentavos;
  impact.quantity=usingQuantity-before.totalCentavos;
  impact.price=usingPrice-usingQuantity;
  impact.bdi=after.totalCentavos-usingPrice;
}

// A chamada só recebe versões cuja linhagem foi conferida no conjunto disponível.
export function compareBudgetRevisions(base,revision){
  if(!base||!revision||base.id===revision.id||(base.obraId||'')!==(revision.obraId||''))
    return {error:'Escolha duas versões distintas da mesma obra.'};
  const from=snapshot(base),to=snapshot(revision);
  if(!from.valid||!to.valid||!Number.isSafeInteger(from.total)||!Number.isSafeInteger(to.total))
    return {error:'Há valores inválidos nas versões. Confira os itens antes de comparar.'};
  const rows=[],totals=impacts();
  for(const key of new Set([...from.groups.keys(),...to.groups.keys()])){
    const before=from.groups.get(key)||[],after=to.groups.get(key)||[];
    const impact=impacts(),changes=[];
    const delta=groupSum(after)-groupSum(before);
    let kind='matched';
    if(!key||before.length>1||after.length>1){
      kind='unresolved';impact.unresolved=delta;
      changes.push({factor:'unresolved',label:key?'ID repetido. Confira os serviços correspondentes.':'Serviço sem ID. Confira a origem da linha.'});
    }else if(!before.length||!after.length){
      kind=before.length?'removed':'added';impact.scope=delta;
      changes.push({factor:'scope',label:before.length?'Retirado da versão comparada':'Adicionado na versão comparada'});
    }else compareMatched(before[0],after[0],impact,changes);
    for(const factor of Object.keys(totals))totals[factor]+=impact[factor];
    rows.push({id:JSON.stringify([key]),before,after,kind,impact,changes,delta});
  }
  if(!Number.isSafeInteger(to.total-from.total)||!Object.values(totals).every(Number.isSafeInteger)||
    !rows.every(row=>Number.isSafeInteger(row.delta)&&Object.values(row.impact).every(Number.isSafeInteger)))
    return {error:'Uma variação excede o limite de cálculo. Confira os valores das versões.'};
  return {baseTotal:from.total,revisionTotal:to.total,delta:to.total-from.total,totals,rows};
}
