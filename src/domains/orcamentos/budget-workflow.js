import { auditItemMemories } from './item-memory';
import { budgetIsImmutable } from './calculations';
import { auditStructuralLinks } from './structural-auto-sync';
import { memoryBudgetItems } from './structural-budget-matching';
import { structuralBudgetRows } from './structural-budget-apply';
import { memoryFloors } from './budget-floors';
import {budgetHierarchyError} from './hierarchy.js';
import {custoComponentes} from './composition-search.js';
import {budgetPendingKind,budgetScopeExclusion,canExcludeBudgetItem} from './budget-pending.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const moeda = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
const numerico = value => (typeof value==='number'||(typeof value==='string'&&value.trim()!==''))&&Number.isFinite(Number(value));

function auditItemCost(item){
  const price=Number(item.precoUnit);
  if(numerico(item.precoUnit)&&price<0)return 'Custo unitário negativo. Confira o valor lançado.';
  if(Number(item.quantidade)>0&&(!numerico(item.precoUnit)||price===0))return 'Preço unitário pendente. Confira a composição ou cotação.';
  if(!numerico(item.precoUnit)||price<=0||typeof item.composicao!=='string'||!item.composicao.trimStart().startsWith('['))return null;
  let components;
  try { components=JSON.parse(item.composicao); } catch { return null; }
  if(!Array.isArray(components)||!components.length||components.some(component=>
    !numerico(component?.coeficiente)||Number(component.coeficiente)<=0||!numerico(component.precoUnit)||Number(component.precoUnit)<0))return null;
  const computed=custoComponentes(components);
  if(!Number.isFinite(computed)||Math.round(computed*100)===Math.round(price*100))return null;
  return `Custo unitário lançado ${moeda.format(price)}. Composição gravada ${moeda.format(computed)}. Confira a referência.`;
}

export function budgetChangeReceipt(before,after){
  const keys=Object.keys({...before,...after}).filter(key=>!['updatedAt','id'].includes(key)&&!same(before[key],after[key]));
  return {budgetId:before.id,keys,before:Object.fromEntries(keys.map(k=>[k,before[k]])),after:Object.fromEntries(keys.map(k=>[k,after[k]]))};
}
export function undoBudgetChange(current,receipt){
  if(!current || budgetIsImmutable(current))throw new Error('Orçamento indisponível ou aprovado.');
  if(!receipt || current.id!==receipt.budgetId || receipt.keys.some(k=>!same(current[k],receipt.after[k])))throw new Error('Há alterações posteriores. O desfazer foi bloqueado para preservá-las.');
  const restored={...current};
  for(const key of receipt.keys){
    if(receipt.before[key]===undefined)delete restored[key]; else restored[key]=receipt.before[key];
  }
  return restored;
}
export function repositionBudgetItem(items,id,position,stageId){
  const item=items.find(i=>i.id===id);
  if(!item)throw new Error('Item não encontrado.');
  const targetStage=stageId ?? item.etapaId;
  const peers=items.filter(i=>i.id!==id&&i.etapaId===targetStage);
  const target=Number(position);
  if(!Number.isInteger(target)||target<1||target>peers.length+1)throw new Error(`Informe uma posição de 1 a ${peers.length+1}.`);
  const moved={...item,etapaId:targetStage};
  // Troca apenas os slots dos irmãos ao reordenar dentro da mesma etapa.
  if(targetStage===item.etapaId){
    peers.splice(target-1,0,moved);let index=0;
    return items.map(i=>i.etapaId===targetStage?peers[index++]:i);
  }
  const next=items.filter(i=>i.id!==id), anchor=peers[target-1];
  const index=anchor?next.findIndex(i=>i.id===anchor.id):peers.length?next.findIndex(i=>i.id===peers.at(-1).id)+1:next.length;
  next.splice(index,0,moved);return next;
}
export function auditWholeBudget(budget){
  const issues=auditStructuralLinks(budget).map(issue=>({...issue,id:`memory:${issue.source}`,destination:'memory',canRemove:!!budget?.memoriaCalculo?.vinculosEstruturais?.[issue.source]}));
  const hierarchy=budgetHierarchyError(budget);
  if(hierarchy)issues.push({id:'budget-hierarchy',label:'Hierarquia do orçamento',message:hierarchy,destination:'budget'});
  for(const floor of memoryFloors(budget?.memoriaCalculo))if(floor.etapaId && !(budget?.etapas || []).some(s=>s.id===floor.etapaId))
    issues.push({id:`floor:${floor.id}`,floorId:floor.id,label:floor.nome,message:'Etapa do pavimento foi removida',destination:'budget'});
  issues.push(...auditItemMemories(budget));
  const items=memoryBudgetItems(budget);
  for(const item of budget?.itens || []){
    if(item.tipo==='titulo')continue;
    const display=items.find(i=>i.id===item.id);
    const label=`Item ${display?.codigoItem || item.codigo || 'sem etapa'} · ${item.descricao || 'Sem descrição'}`;
    const base={itemId:item.id,stageId:item.etapaId,label,destination:'budget'};
    const exclusion=budgetScopeExclusion(item);
    if(exclusion){
      issues.push({...base,id:`item:${item.id}:excluded`,kind:'excluded',message:`Fora do escopo. ${exclusion.motivo}`,exclusion});
      continue;
    }
    const pending=budgetPendingKind(item);
    const problems=[];
    if(item.quantidade==null || item.quantidade==='')problems.push('Quantitativo não informado');
    else if(!Number.isFinite(Number(item.quantidade))||Number(item.quantidade)<0)problems.push('Quantitativo inválido');
    else if(Number(item.quantidade)===0)problems.push('Quantidade zerada — confirmar se o serviço será executado');
    if(!String(item.unidade || '').trim())problems.push('Unidade não informada');
    if(!(budget.etapas || []).some(s=>s.id===item.etapaId))problems.push('Item sem etapa válida');
    for(const [index,message] of problems.entries())issues.push({...base,id:`item:${item.id}:${index}`,message,
      ...(index===0&&pending==='measure'?{kind:pending,canExclude:canExcludeBudgetItem(item)}:{})});
    const costIssue=auditItemCost(item);
    if(costIssue)issues.push({...base,id:`item:${item.id}:cost`,message:costIssue,
      ...(pending==='quote'?{kind:pending,canExclude:canExcludeBudgetItem(item)}:{})});
  }
  const rows=new Set(Object.keys(budget?.memoriaCalculo?.vinculosEstruturais || {}));
  const available=new Set(Object.entries(structuralBudgetRows(budget)).flatMap(([scope,measures])=>measures.map(row=>`${scope}.${row.key}`)));
  // Fontes removidas também precisam continuar visíveis para correção.
  for(const source of rows){
    if(!budget.memoriaCalculo.vinculosEstruturais[source])continue;
    const scope=source.split('.')[0];
    if(!issues.some(i=>i.source===source)&&!available.has(source))
      issues.push({id:`orphan:${source}`,source,scope,label:source,message:'Origem do vínculo não reconhecida',destination:'memory',canRemove:true});
  }
  return issues;
}
