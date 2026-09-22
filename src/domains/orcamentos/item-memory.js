import { memoryBudgetItems, normalizeStructuralText } from './structural-budget-matching';
import { budgetIsImmutable } from './calculations';
import { ITEM_MEMORY_MODELS, calculateItemMemory, measurementUnit, newMeasurementRow } from './item-memory-models';

export const itemMemorySignature = item => JSON.stringify([item.fonte || '',item.codigo || '',item.descricao || '',measurementUnit(item.unidade)]);

export function existingMemoryOwner(item,budget){
  const source=Object.entries(budget.memoriaCalculo?.vinculosEstruturais || {}).find(([,target])=>target===item.id)?.[0];
  if(source)return {name:'Memorial estrutural',discipline:'estrutural',scope:source.split('.')[0]};
  const text=normalizeStructuralText(item.descricao), stage=normalizeStructuralText(item.stagePath);
  if(/^(armacao|montagem e desmontagem de forma|fabricacao.*forma|concretagem|laje pre|escoramento de formas?|execucao de radier)\b/.test(text))return {name:'Memorial estrutural',discipline:'estrutural'};
  if(/sistema hidraulico|sanitario\/drenagem|hidrossanitar/.test(stage) || /^(tubo.*(?:pvc|pead)|(?:adaptador|joelho|curva|luva|te |uniao|bucha).*pvc|kit cavalete|hidrometro|caixa d[´'’ ]?agua|torneira|bacia sanitaria|cuba de|caixa (?:sifonada|enterrada hidraulica))/.test(text))return {name:'Instalações hidrossanitárias',discipline:'hidrossanitario'};
  if(/eletrica|eletrico/.test(stage) || /^(entrada de energia|disjuntor|quadro de distribuicao de energia|cabo de cobre|eletroduto|modulo roteador|camera |interruptor|tomada |luminaria)/.test(text))return {name:'Instalações elétricas',discipline:null};
  return null;
}

export function suggestItemMemory(item){
  const text=normalizeStructuralText(item.descricao), unit=measurementUnit(item.unidade), stage=normalizeStructuralText(item.stagePath);
  let model='direct',warning='';
  if(!text.trim())return {model,warning:'Item sem descrição: identifique a composição antes de medir.'};
  if(unit==='M2'){
    if(/^alvenaria|^muro |tapume/.test(text))model='wall';
    else if(/sanca/.test(text))model='strip';
    else if(/piso/.test(stage) && /impermeabilizacao|^revestimento/.test(text))model='area';
    else if(/teto|forro|piso|contrapiso|grama|limpeza|placa de obra|passeio|compactacao|camada separadora|lastro/.test(text))model='area';
    else if(/chapisco|emboco|reboco|gesso|pintura|selador|massa|parede|fachada/.test(text))model='surface';
    else if(/impermeabilizacao/.test(text))model='surface';
    else model='area';
  } else if(unit==='M3')model=/lastro|camada|magro/.test(text)?'layer':'volume';
  else if(unit==='M')model=/contraverga|\bverga\b/.test(text)?'lintel':/contramarco/.test(text)?'perimeter':'linear';
  else if(unit==='UN'){
    model='count';
    if(/^(?:aplicacao.*(?:pintura|massa)|emassamento|muro em alvenaria|pintura|revestimento|forro)/.test(text)){
      model='direct';warning='Serviço de superfície cadastrado em UN. Verifique se a composição representa um conjunto ou se a unidade precisa ser corrigida; não converta m² em UN automaticamente.';
    }
  }
  return {model,warning};
}

export function itemMemoryRows(budget){
  // Inclui também itens sem etapa: não podem desaparecer da conferência.
  const displayed=memoryBudgetItems(budget), found=new Set(displayed.map(i=>i.id));
  const rows=[...displayed,...(budget.itens || []).filter(i=>i.tipo!=='titulo'&&!found.has(i.id)).map(i=>({...i,stagePath:'Sem etapa',codigoItem:'—'}))];
  return rows.map(item=>({...item,owner:existingMemoryOwner(item,budget),suggestion:suggestItemMemory(item)}));
}

export function startItemMemory(item,model=suggestItemMemory(item).model){
  return {version:1,model,unit:measurementUnit(item.unidade),signature:itemMemorySignature(item),active:false,source:'',note:'',origin:'manual',rows:[newMeasurementRow(model,'row-1')]};
}

export function evaluateItemMemory(item,budget){
  const record=item.memorialMedicao;
  if(!record)return {valid:false,total:null,errors:['Medidas ainda não preenchidas.'],rows:[]};
  const result=calculateItemMemory(record,item.unidade);
  const errors=[...result.errors];
  if(record.signature!==itemMemorySignature(item))errors.unshift('A composição foi alterada. Reabra o memorial e confirme o modelo e as medidas.');
  if(!String(item.descricao || '').trim())errors.unshift('Identifique a composição antes de aplicar.');
  if(existingMemoryOwner(item,budget))errors.unshift('Este item é controlado pelo memorial da disciplina; utilize o vínculo existente.');
  if(suggestItemMemory(item).warning && !String(record.note || '').trim())errors.unshift('Explique o critério da unidade cadastrada no campo de observações.');
  return {...result,valid:!errors.length,errors,total:errors.length?null:result.total};
}

export function syncItemMemories(budget){
  if(budgetIsImmutable(budget))return {budget,changes:[]};
  const rows=new Map(itemMemoryRows(budget).map(i=>[i.id,i])),changes=[];
  const itens=(budget.itens || []).map(item=>{
    if(!item.memorialMedicao?.active)return item;
    const result=evaluateItemMemory(rows.get(item.id) || item,budget);
    if(!result.valid || Number(item.quantidade)===result.total)return item;
    changes.push({id:item.id,before:item.quantidade,after:result.total,unit:item.unidade,description:item.descricao});
    return {...item,quantidade:result.total};
  });
  return {budget:{...budget,itens},changes};
}

export function saveItemMemory(budget,itemId,record,{draft=false}={}){
  if(budgetIsImmutable(budget))throw new Error('Crie uma revisão do orçamento aprovado.');
  const item=itemMemoryRows(budget).find(i=>i.id===itemId);
  if(!item)throw new Error('Item removido do orçamento.');
  if(item.owner)throw new Error('Utilize o memorial existente desta disciplina.');
  const updated={...record,signature:itemMemorySignature(item),active:!draft};
  const result=evaluateItemMemory({...item,memorialMedicao:updated},budget);
  if(!draft && !result.valid)throw new Error(result.errors[0]);
  return {...budget,itens:budget.itens.map(i=>i.id===itemId?{...i,memorialMedicao:updated,...(!draft?{quantidade:result.total}:{})}:i)};
}

export function auditItemMemories(budget){
  return itemMemoryRows(budget).flatMap(item=>{
    if(item.owner || !item.memorialMedicao)return [];
    const result=evaluateItemMemory(item,budget);
    const message=!result.valid?result.errors[0]:!item.memorialMedicao.active?'Memorial salvo como rascunho; quantidade anterior preservada.':Number(item.quantidade)!==result.total?'Quantidade diferente do memorial do item.':'';
    return message?[{id:`item-memory:${item.id}`,itemId:item.id,label:`Item ${item.codigoItem} · ${item.descricao}`,message,destination:'item-memory'}]:[];
  });
}

// Biblioteca: só o modelo e instruções. Dimensões, locais e quantidades nunca
// viram valores padrão de outra obra. Compatibilidade é por composição exata.
export function reusableItemModel(item,record,name,id){
  if(!String(name).trim())throw new Error('Dê um nome ao modelo.');
  const model=ITEM_MEMORY_MODELS[record.model];
  if(!model || (model.unit && model.unit!==measurementUnit(item.unidade)))throw new Error('Modelo incompatível com a unidade.');
  return {id,name:String(name).trim(),model:record.model,signature:itemMemorySignature(item),unit:measurementUnit(item.unidade)};
}
export const compatibleItemModels = (item,models=[]) => models.filter(m=>m.signature===itemMemorySignature(item) && measurementUnit(m.unit)===measurementUnit(item.unidade) && ITEM_MEMORY_MODELS[m.model]);
