// Indícios para conferência humana. Nunca corrige, exclui ou soma valores.
const cents=value=>Math.round(Number(value||0)*100);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop=new Set(['para','pela','pelo','com','uma','por','dos','das','nos','nas','que','aditivo','mudanca']);
const money=value=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export function forecastStageRoot(budget,id){
 if(!id||id==='unassigned')return 'unassigned';
 const stages=new Map((budget?.etapas||[]).map(s=>[s.id,s]));
 let stage=stages.get(id);const seen=new Set();
 while(stage?.parentId){if(seen.has(stage.id))return 'unassigned';seen.add(stage.id);stage=stages.get(stage.parentId);}
 return stage?.id||'unassigned';
}

export function forecastStageAmendments(work,budget,stageId){
 return (work?.aditivosContrato||[]).filter(a=>forecastStageRoot(budget,a.etapaId)===stageId&&a.impactoCustoRestante!=null&&Number(a.impactoCustoRestante)!==0);
}

function mentionedAsIncluded(note,item){
 const words=normalize(item.descricao).match(/[a-z0-9]+/g)||[];
 const tokens=[...new Set(words.filter(w=>w.length>2&&!stop.has(w)))];
 return normalize(note).split(/[.;\n]/).some(clause=>{
   if(!/inclu[is]|incluid|incorpor|contempl|embut/.test(clause))return false;
   if(/nao\s+(?:\w+\s+){0,3}(?:inclu|incorpor|contempl)|sem\s+(?:\w+\s+){0,2}inclu|separad|fora do restante|exclu/.test(clause))return false;
   const number=String(item.numero||'');
   const numbered=/^\d+$/.test(number)&&new RegExp(`\\baditivo\\s+(?:n[ºo.]?\\s*)?${number}\\b`).test(clause);
   const present=new Set(clause.match(/[a-z0-9]+/g)||[]);
   return numbered||tokens.length>=2&&tokens.filter(w=>present.has(w)).length>=2;
 });
}

export function forecastDuplicationWarnings(work,budget){
 if(budget&&budget.obraId!==work?.id)budget=null;
 const planning=work?.costPlanning,output=[];
 for(const [stageId,revision] of Object.entries(planning?.stages||{})){
   // Revisões de etapas removidas não entram na previsão atual.
   if(stageId!=='unassigned'&&!(budget?.etapas||[]).some(s=>s.id===stageId&&!s.parentId))continue;
   const stageLabel=(budget?.etapas||[]).find(s=>s.id===stageId)?.nome||'Sem apropriação';
   const stageChanges=forecastStageAmendments(work,budget,stageId);
   const candidates=stageChanges.filter(a=>a.impactoNaPrevisao==='adicional'&&Number.isSafeInteger(cents(a.impactoCustoRestante)));
   const pending=[];
   const add=(items,reason,explanation)=>{
     const amountCents=items.reduce((s,a)=>s+cents(a.impactoCustoRestante),0);
     const names=items.map(a=>`Aditivo ${a.numero||a.id}: ${a.descricao}`).join('; ');
     output.push({id:`forecast-duplication:${stageId}:${reason}:${items.map(a=>a.id).sort().join(',')}`,code:'COST_FORECAST_POSSIBLE_DUPLICATION',blocking:false,stageId,amendmentIds:items.map(a=>a.id),reason,amountCents,stage:'Previsão de custo',owner:'Responsável pela previsão e pelo aditivo',
       message:`Possível duplicidade em ${stageLabel} — ${names} (${money(amountCents)}). ${explanation}`,
       resolution:'Confira o custo restante e o acompanhamento da mudança. Se o impacto já estiver no restante, marque Já incluído no aditivo. Se continuar separado, registre Fora do restante nesta revisão. Você pode continuar com o aviso.'});
   };
   for(const item of candidates){
     const coverage=revision.amendmentCoverage?.[item.id];
     // Uma conferência vale para a mesma etapa, orçamento e valor de impacto.
     const current=coverage&&coverage.amountCents===cents(item.impactoCustoRestante)&&coverage.remainingCents===revision.remainingCents&&revision.budgetId===(budget?.id||'');
     if(current&&coverage.mode==='included')add([item],'declared_included','A revisão declara este impacto dentro do restante, mas o aditivo ainda está marcado como adicional.');
     else if(current&&coverage.mode==='separate')continue;
     else if(mentionedAsIncluded(revision.note,item))add([item],'premises','As premissas indicam inclusão deste aditivo, que também continua adicional. Confira se é o mesmo custo.');
     else pending.push(item);
   }
   const previous=(planning?.history||[]).filter(r=>r.stageId===stageId&&r.budgetId===revision.budgetId&&r.remainingCents!==revision.remainingCents&&Number(r.version)<Number(revision.version)).sort((a,b)=>Number(b.version)-Number(a.version))[0];
   if(!previous||!Number.isSafeInteger(revision.remainingCents)||!Number.isSafeInteger(previous.remainingCents))continue;
   const delta=revision.remainingCents-previous.remainingCents;
   if(!delta)continue;
   const matches=pending.filter(a=>Math.abs(cents(a.impactoCustoRestante)-delta)<=1);
   if(matches.length){for(const item of matches)add([item],'remaining_delta',`O restante mudou em ${money(delta)}, coincidindo com o impacto deste aditivo, que continua adicional. A coincidência exige conferência; não comprova duplicidade.`);}
   else if(pending.length>1&&pending.length===candidates.length&&Math.abs(pending.reduce((s,a)=>s+cents(a.impactoCustoRestante),0)-delta)<=1)add(pending,'remaining_delta_sum',`A variação do restante (${money(delta)}) coincide com a soma destes impactos adicionais. Confira se foram incorporados nesta revisão.`);
 }
 return output;
}
