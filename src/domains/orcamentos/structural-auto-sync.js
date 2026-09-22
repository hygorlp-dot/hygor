import { structuralBudgetRows } from './structural-budget-apply';
import { compatibleStructuralItem, memoryBudgetItems, structuralOrigin } from './structural-budget-matching';
import { aplicarCriterioEstrutural } from './structural-quantity-policy';
import { budgetIsImmutable } from './calculations';

const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const round = n => Math.round(n * 1e6) / 1e6;
const entriesFor = budget => Object.entries(structuralBudgetRows(budget)).flatMap(([scope,rows]) => rows.map(row=>({...row,scope,source:`${scope}.${row.key}`})));

// Destinos independentes: uma pendência não impede salvar outra medição válida.
export function syncStructuralQuantities(before, candidate) {
  if (budgetIsImmutable(before)) return {budget:before,changes:[],issues:[]};
  const memory=aplicarCriterioEstrutural(candidate.memoriaCalculo || {});
  const links=memory.vinculosEstruturais || {};
  const previous={...before.memoriaCalculo?.aplicacoesEstruturais,...memory.aplicacoesEstruturais};
  const entries=entriesFor({...candidate,memoriaCalculo:memory});
  const targets=new Set([...Object.values(links),...Object.values(previous)].filter(Boolean));
  const applied={...previous}, quantities=new Map(), issues=[];
  for(const id of targets){
    const item=(candidate.itens || []).find(i=>i.id===id);
    const sources=Object.entries(links).filter(([,target])=>target===id).map(([source])=>source);
    const measures=sources.map(source=>entries.find(e=>e.source===source));
    const problem=!item ? 'Destino removido' : measures.some(m=>!m) ? 'Quantitativo removido' :
      measures.some(m=>m.pending || m.missing) ? 'Dado ausente ou pendência técnica' :
      measures.some(m=>!Number.isFinite(m.value) || m.value<0 || !compatibleStructuralItem(m,item)) ? 'Serviço, unidade ou valor incompatível' : '';
    if(problem){issues.push({itemId:id,source:sources[0],message:problem});continue;}
    quantities.set(id,round(measures.reduce((sum,m)=>sum+m.value,0)));
    for(const [source,target] of Object.entries(applied)) if(target===id) delete applied[source];
    for(const source of sources) applied[source]=id;
  }
  const changes=[];
  const itens=(candidate.itens || []).map(item=>{
    if(!quantities.has(item.id))return item;
    const after=quantities.get(item.id), previousItem=(before.itens || []).find(i=>i.id===item.id);
    const prior=Number(previousItem?.quantidade || 0);
    if(prior!==after)changes.push({id:item.id,before:prior,after,unit:item.unidade,description:item.descricao});
    return {...item,quantidade:after};
  });
  return {budget:{...candidate,itens,memoriaCalculo:{...memory,aplicacoesEstruturais:applied}},changes,issues};
}

export function undoStructuralChange(current, receipt) {
  if(budgetIsImmutable(current))throw new Error('Este orçamento está aprovado.');
  if(current.id!==receipt.budgetId || !same(current.memoriaCalculo,receipt.afterMemory)
    || receipt.changes.some(change=>Number(current.itens.find(i=>i.id===change.id)?.quantidade)!==change.after)) {
    throw new Error('Há alterações posteriores. A restauração não foi aplicada para preservar essas alterações.');
  }
  return {...current,memoriaCalculo:receipt.beforeMemory,itens:current.itens.map(item=>{
    const change=receipt.changes.find(c=>c.id===item.id);
    return change ? {...item,quantidade:change.before} : item;
  })};
}

export function auditStructuralLinks(budget) {
  const links=budget?.memoriaCalculo?.vinculosEstruturais || {};
  const items=memoryBudgetItems(budget), entries=entriesFor(budget), issues=[];
  for(const measure of entries){
    const id=links[measure.source], item=items.find(i=>i.id===id);
    const origin=structuralOrigin(measure.scope,budget?.memoriaCalculo);
    const label=`${origin.floor} · ${origin.element} · ${measure.label}`;
    let message='';
    if(id && !item)message='Destino removido';
    else if(id && (measure.pending || measure.missing))message='Dado ausente ou pendência técnica';
    else if(item && !compatibleStructuralItem(measure,item))message='Serviço ou unidade incompatível';
    else if(item){
      const shared=entries.filter(e=>links[e.source]===id);
      if(shared.length>1)message='Destino compartilhado por mais de um quantitativo';
      else if(Math.abs(Number(item.quantidade || 0)-measure.value)>0.000001)message='Quantidade diferente do memorial';
    } else if(measure.value>0)message='Quantitativo sem vínculo';
    if(message)issues.push({source:measure.source,scope:measure.scope,label,message});
  }
  return issues;
}
