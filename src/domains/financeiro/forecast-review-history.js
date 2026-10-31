export const FORECAST_REVIEW_DECISIONS=Object.freeze({included:'Já está no restante',separate:'Custo separado do restante',unreviewed:'Ainda não conferido'});

// Retrato dos registros no momento da confirmação, sem depender de renomeações
// posteriores do aditivo ou da etapa. Autor e data vêm da revisão no servidor.
export function snapshotAmendmentReviews(work,budget,revision){
 return Object.entries(revision.amendmentCoverage||{}).map(([id,coverage])=>{
   const item=(work.aditivosContrato||[]).find(a=>a.id===id);
   return {amendmentId:id,amendmentNumber:item?.numero||'',description:item?.descricao||'',stageId:revision.stageId,stageLabel:(budget?.etapas||[]).find(s=>s.id===revision.stageId)?.nome||'Sem apropriação',mode:coverage.mode,justification:String(coverage.justification||'').trim(),amountCents:coverage.amountCents,remainingCents:coverage.remainingCents,
     basisCurrent:coverage.remainingCents===revision.remainingCents&&coverage.amountCents===Math.round(Number(item?.impactoCustoRestante||0)*100)&&revision.budgetId===(budget?.id||'')};
 });
}

export function forecastReviewHistory(work){
 const planning=work?.costPlanning;
 const revisions=[...(planning?.history||[])];
 for(const r of Object.values(planning?.stages||{}))if(!revisions.some(h=>h.version===r.version&&h.stageId===r.stageId))revisions.push(r);
 const fromRevisions=revisions.flatMap((revision,index)=>{
   const legacy=!Array.isArray(revision.amendmentReviewDetails);
   const reviews=legacy?Object.entries(revision.amendmentCoverage||{}).map(([id,c])=>({amendmentId:id,mode:c.mode,justification:String(c.justification||'').trim(),amountCents:c.amountCents,remainingCents:c.remainingCents,stageId:revision.stageId,stageLabel:revision.stageId==='unassigned'?'Sem apropriação':revision.stageId,basisCurrent:c.remainingCents===revision.remainingCents})):revision.amendmentReviewDetails;
   return reviews.map((review,subIndex)=>({...review,id:`${revision.version||index}:${revision.stageId}:${review.amendmentId}:${subIndex}`,version:revision.version,at:revision.at||'',by:revision.by||revision.byId||'',byId:revision.byId||'',premises:revision.note||'',legacy}));
 });
 const key=row=>`${row.version}:${row.stageId}:${row.amendmentId}`;
 const saved=planning?.amendmentReviewHistory||[],keys=new Set(saved.map(key));
 return [...saved,...fromRevisions.filter(row=>!keys.has(key(row)))].map((row,index)=>({...row,id:row.id||`${key(row)}:${index}`})).sort((a,b)=>Number(b.version||0)-Number(a.version||0));
}
