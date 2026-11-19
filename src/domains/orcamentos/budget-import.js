import {MAX_BUDGET_LEVELS,assertBudgetHierarchy} from './hierarchy.js';
import {importacaoComPendencia} from './budget-import-mapping.js';

export function budgetImportHierarchyError(lines=[]){
 const stack=[],paths=new Set();
 for(const row of lines){
  if(row.hierarchyError)return `Linha ${row._i}: ${row.hierarchyError}`;
  if(row.kind!=='etapa'){
   if(row.ordem&&stack.length){
    const parent=row.ordem.split('.').slice(0,-1).join('.');
    // Títulos podem fechar o conteúdo de uma etapa-pai após seus subníveis.
    const valid=row.kind==='titulo'?stack.includes(parent):stack.at(-1)===parent;
    if(!valid)return `Linha ${row._i}: o item não pertence à etapa numerada anterior.`;
   }
   continue;
  }
  const level=row.nivel,path=row.ordem||'';
  if(!Number.isInteger(level)||level<1||level>MAX_BUDGET_LEVELS)return `Linha ${row._i}: use de 1 a ${MAX_BUDGET_LEVELS} níveis de etapas.`;
  if(level>1&&!stack[level-2])return `Linha ${row._i}: falta a etapa superior do nível ${level}. Confira a origem.`;
  if(path&&(paths.has(path)||level>1&&stack[level-2]!==path.split('.').slice(0,-1).join('.')))return `Linha ${row._i}: numeração duplicada ou etapa superior divergente. Confira a origem.`;
  stack.length=level;stack[level-1]=path||true;if(path)paths.add(path);
 }
 return '';
}

export function applyBudgetImport(budget,lines,{replace=false,includePending=true,createId}={}){
 const error=budgetImportHierarchyError(lines);if(error)throw Error(error);
 const etapas=replace?[]:[...(budget?.etapas||[])],itens=replace?[]:[...(budget?.itens||[])],stack=[];
 let current='',skipped=0;
 for(const row of lines||[]){
  if(row.kind==='etapa'){
   const id=createId();etapas.push({id,nome:row.nome,parentId:row.nivel===1?'':stack[row.nivel-2]});
   stack.length=row.nivel;stack[row.nivel-1]=id;current=id;continue;
  }
  if(row.kind!=='titulo'&&!includePending&&importacaoComPendencia(row)){skipped++;continue;}
  if(!current){current=createId();etapas.push({id:current,nome:'Itens importados',parentId:''});}
  const titleStage=row.kind==='titulo'&&row.ordem?stack[row.ordem.split('.').length-2]:null;
  itens.push(row.kind==='titulo'?{id:createId(),etapaId:titleStage||current,tipo:'titulo',codigo:'',fonte:budget?.fonte,descricao:row.descricao,unidade:'un',quantidade:0,precoUnit:0}:
   {id:createId(),etapaId:current,tipo:'item',codigo:row.codigo,fonte:row.fonte,descricao:row.descricao,unidade:row.unidade,quantidade:row.quantidade,precoUnit:row.precoUnit,composicao:row.composicao||'',codigoNaoEncontrado:!!row.codigoNaoEncontrado,
    ...(row.referencia?{baseData:row.referencia.baseData,baseUf:row.referencia.baseUf}: {})});
 }
 assertBudgetHierarchy({etapas,itens});return {etapas,itens,skipped};
}
