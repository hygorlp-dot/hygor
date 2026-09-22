import { extrairElementosEstruturais } from './estrutural-pdf-extrator';
import { extrairResumosPavimentos } from './structural-import';
import { structuralBudgetRows } from './structural-budget-apply';
import { memoryFloors } from './budget-floors';

export function mergeStructuralImportSources(previous={},incoming={}){
  const next={...previous};
  const scopes=new Set(Object.keys(incoming).map(key=>key.split('.')[0]));
  for(const [key,source] of Object.entries(next))if(source?.tipo==='manual' && scopes.has(key.split('.')[0]))delete next[key];
  return {...next,...incoming};
}

export function quantitativeSourcePages(text,name){
  const markers=[...String(text).matchAll(/Grupo de Pisos Número \d+:\s*(.+?)\s*Número Pisos Iguais/g)];
  const index=markers.findIndex(m=>m[1].trim()===name);
  if(index<0)return [];
  const start=markers[index].index, end=markers[index+1]?.index ?? String(text).length;
  const first=String(text).slice(0,start).split('\f').length;
  const last=String(text).slice(0,end).trimEnd().split('\f').length;
  return Array.from({length:last-first+1},(_,i)=>first+i);
}

export function extractStructuralSources(text,arquivo){
  const sources={}, add=(key,page,criterio)=>{
    sources[key]={tipo:'extraido',arquivo,paginas:[...new Set([...(sources[key]?.paginas || []),page])],criterio};
  };
  String(text).split('\f').forEach((page,index)=>{
    const data=extrairElementosEstruturais(page);
    if(/QUADRO DE ELEMENTOS DE FUNDA/i.test(page))add('fundacao',index+1,'Quadro de elementos de fundação e cortes');
    for(const [collection,element] of [['pilares','pilares'],['pilaresAcoPorBitola','pilares'],['vigasAcoPorBitola','vigas'],['lajesAcoPorBitola','laje']]){
      for(const [floor,value] of Object.entries(data[collection] || {}))if(Array.isArray(value)?value.length:value)add(`${floor}-${element}`,index+1,'Detalhamento / resumo de aço do elemento');
    }
  });
  for(const [floor,summary] of Object.entries(extrairResumosPavimentos(text))){
    for(const [kind,element] of [['pilar','pilares'],['viga','vigas'],['laje','laje']]){
      if(!summary[kind])continue;
      for(const key of kind==='laje'?['concreto','area-vigota']:['concreto','forma'])
        sources[`${floor}-${element}.${key}`]={tipo:'extraido',arquivo,paginas:[summary.pagina],criterio:'Quadro-resumo do pavimento'};
    }
  }
  return sources;
}

export function structuralMeasureOrigin(budget,scope,row){
  const memory=budget?.memoriaCalculo || {}, key=`${scope}.${row.key}`;
  const floor=memoryFloors(memory).find(f=>scope.startsWith(`${f.id}-`));
  const origin=memory.origensEstruturais?.[key] || (row.key==='aco-vigota'?memory.origensEstruturais?.[`${scope}.area-vigota`]:null) || memory.origensEstruturais?.[scope];
  const computed=scope==='fundacao'||['magro','aco-vigota'].includes(row.key);
  if(row.missing)return {status:'Dado ausente',detail:'Nenhuma medida informada para este quantitativo.'};
  const status=computed?'Valor calculado':origin?.tipo==='extraido'?(row.value===0?'Zero extraído':'Valor extraído'):row.value===0?(floor?.origem&&!origin?'Zero inicial da cópia':'Zero informado'):'Valor informado';
  if(origin){
    const pages=origin.paginas?.length?`página(s) ${origin.paginas.join(', ')}`:'página não registrada';
    const detail=origin.tipo==='manual'?'Ajuste manual no memorial':`${origin.arquivo || 'Arquivo não registrado'} · ${pages} · ${origin.criterio || 'Origem registrada'}`;
    return {status,detail};
  }
  if(floor?.origem)return {status,detail:`Cópia de ${floor.origem==='terreo'?'Térreo':'1º pavimento'} com quantitativos zerados; não extraído do projeto.`};
  const [pav,element]=scope.split('-'), summary=memory.resumosProjeto?.[pav];
  if(summary?.pagina && (['concreto','forma'].includes(row.key)||element==='laje'&&row.key==='area-vigota'))
    return {status,detail:`Arquivo não registrado · página ${summary.pagina} · Quadro-resumo do pavimento`};
  return {status,detail:'Origem não registrada neste dado legado. Uma nova importação registra arquivo e página.'};
}

export function trackManualStructuralChanges(before,next){
  const oldRows=structuralBudgetRows(before), newRows=structuralBudgetRows(next);
  const memory=next.memoriaCalculo || {}, sources={...memory.origensEstruturais};
  for(const [scope,rows] of Object.entries(newRows)){
    // Metadados novos significam importação explícita: preservar sua origem.
    if(JSON.stringify(memory.origensEstruturais)!==JSON.stringify(before.memoriaCalculo?.origensEstruturais))break;
    for(const row of rows){
      const old=oldRows[scope]?.find(r=>r.key===row.key);
      if(old && (old.value!==row.value || !!old.missing!==!!row.missing))sources[`${scope}.${row.key}`]={tipo:'manual',alteradoEm:new Date().toISOString()};
    }
  }
  return {...next,memoriaCalculo:{...memory,origensEstruturais:sources}};
}
