import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {allocationSuggestions,COST_CONTROL_COMMAND} from '../../domains/financeiro/cost-control.js';
import './cost-control.css';

const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function CostControlReview({data,work,report,asOf,onOpen,view={},onViewChange,dispatchCommand,currentUser}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const patch=next=>onViewChange(previous=>({...previous,[work.id]:{...previous[work.id],...next}}));
 const setDraft=(id,next)=>patch({drafts:{...view.drafts,[id]:{...view.drafts?.[id],...next}}});
 const suggestions=allocationSuggestions(data,report,work.id);
 const filtered=suggestions.filter(s=>`${s.entry.description} ${s.entry.counterparty||''} ${s.entry.documentNumber||''}`.toLowerCase().includes((view.query||'').toLowerCase()));
 const page=Math.min(view.page||0,Math.max(0,Math.ceil(filtered.length/10)-1));
 const rows=report.rows.filter(r=>r.id!=='unassigned'),stage=rows.find(r=>r.id===view.stageId)||rows[0];
 const draft=view.forecasts?.[stage?.id]||{};
 const amount=draft.amount??(stage?.reviewValid?String(stage.remaining/100):'');
 const parsed=Number(amount),cents=Math.round(parsed*100),valid=amount!==''&&Number.isFinite(parsed)&&parsed>=0&&Number.isSafeInteger(cents);
 const note=draft.note??'';
 const basis=stage?{incurred:stage.incurred,committed:stage.committed,budget:stage.budget}:null;
 const staleDraft=Boolean(draft.fingerprint&&draft.fingerprint!==report.fingerprint||draft.version!=null&&draft.version!==report.planningVersion||draft.asOf&&draft.asOf!==asOf||draft.basis&&Object.keys(basis||{}).some(k=>draft.basis[k]!==basis[k]));
 const setForecast=next=>patch({forecasts:{...view.forecasts,[stage.id]:{...draft,...next,version:draft.version??report.planningVersion,fingerprint:draft.fingerprint??report.fingerprint,basis:draft.basis??basis,asOf:draft.asOf??asOf}}});
 const send=async command=>{
   if(busy)return false;setBusy(true);setError('');setMessage('');
   try{const idempotencyKey=`cost-control-${crypto.randomUUID()}`;const result=await dispatchCommand(()=>({...command,actorId:currentUser?.id,actorName:currentUser?.nome,idempotencyKey}));
     if(!result?.ok)throw new Error(result?.reason||result?.error||'Não foi possível salvar. Atualize a tela e tente novamente.');
     setMessage('Revisão salva. Os totais e o memorial foram atualizados.');return true;
   }catch(e){setError(e.message);return false;}finally{setBusy(false);}
 };
 if(!report.budget)return null;
 return <div className="cost-control" aria-label={`Conferência de custos de ${work.name}`}>
 <details open={view.open??false} onToggle={e=>{if(e.currentTarget.open!==(view.open??false))patch({open:e.currentTarget.open});}}>
 <summary>Conferir apropriação e previsão · {suggestions.length} custo(s) pendente(s)</summary>
 <p>As sugestões usam descrições idênticas às dos itens do orçamento. Confira a origem e confirme cada vínculo. Pagamentos com vários rateios continuam sem etapa quando não há identificação suficiente.</p>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <fieldset disabled={busy}>
 <legend>Apropriação assistida</legend>
 <label>Buscar custo pendente<Input value={view.query||''} onChange={e=>patch({query:e.target.value,page:0})}/></label>
 <p>{filtered.length} custo(s) · {money(filtered.reduce((sum,s)=>sum+s.entry.amountCents,0))} de custo incorrido para conferir neste recorte.</p>
 {filtered.slice(page*10,page*10+10).map(s=>{
   const d=view.drafts?.[s.id]||{},selected=d.stageId??s.suggestedStageId;
   return <article className="cost-control__pending" key={s.id} aria-label={s.entry.description}>
     <div><strong>{s.entry.description}</strong><p>{s.entry.date||s.entry.competence||'Data não informada'} · {s.entry.counterparty||'Contraparte não informada'} · {money(s.entry.amountCents)}</p><p>{s.reason}</p>
     <Button variant="outline" onClick={()=>onOpen({title:`${work.name} · Conferir origem`,context:'Custo pendente de apropriação. Consulte o lançamento e seus documentos antes de confirmar.',items:[s.entry],totalCents:s.entry.amountCents})}>Ver origem e documentos</Button></div>
     {s.supported?<form onSubmit={async e=>{e.preventDefault();const ok=await send({type:COST_CONTROL_COMMAND.COST_ALLOCATION_SAVED,expectedVersion:d.version??Number(s.entry.record.version||0),payload:{obraId:work.id,budgetId:report.budget.id,sourceType:s.entry.sourceType,sourceId:s.entry.sourceId,sourceSubId:s.entry.sourceSubId,stageId:selected,note:d.note}});if(ok)setDraft(s.id,{note:''});}}>
       <label>Etapa para {s.entry.description}<select required value={selected} onChange={e=>setDraft(s.id,{stageId:e.target.value,version:d.version??Number(s.entry.record.version||0)})}><option value="">Escolha após conferir</option>{rows.map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></label>
       <label>Justificativa da apropriação<Input required minLength={5} maxLength={2000} value={d.note||''} onChange={e=>setDraft(s.id,{note:e.target.value,version:d.version??Number(s.entry.record.version||0)})}/></label>
       <Button type="submit" disabled={!selected||(d.note||'').trim().length<5}>{busy?'Salvando…':'Confirmar apropriação'}</Button>
     </form>:<p>Esta origem exige conferência no cadastro responsável; a apropriação assistida atende notas fiscais, despesas da obra e medições de terceiros.</p>}
   </article>;
 })}
 {!filtered.length&&<p>Nenhum custo incorrido pendente neste recorte.</p>}
 {filtered.length>10&&<div className="cost-control__actions"><Button variant="outline" disabled={page===0} onClick={()=>patch({page:page-1})}>Anteriores</Button><span>Página {page+1} de {Math.ceil(filtered.length/10)}</span><Button variant="outline" disabled={(page+1)*10>=filtered.length} onClick={()=>patch({page:page+1})}>Próximos</Button></div>}
 </fieldset>
 {stage&&<fieldset disabled={busy}><legend>Previsão para concluir por etapa</legend>
 <label>Etapa da previsão<select value={stage.id} onChange={e=>patch({stageId:e.target.value})}>{rows.map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></label>
 <p>Informe todo o custo que ainda será incorrido nesta etapa, incluindo compras já comprometidas que ainda não viraram custo. Não inclua novamente o incorrido nem use o saldo a pagar.</p>
 <dl className="cost-control__basis"><div><dt>Incorrido</dt><dd>{money(stage.incurred)}</dd></div><div><dt>Referência automática para concluir</dt><dd>{money(stage.automaticRemaining)}</dd></div><div><dt>Orçado</dt><dd>{money(stage.budget)}</dd></div></dl>
 {stage.revision&&<p role="status">{stage.reviewValid?'Previsão revisada em uso':'Revisão anterior precisa de reconferência; referência automática em uso'} · {stage.revision.by} · {stage.revision.asOf}. {stage.revision.note}</p>}
 <form onSubmit={async e=>{e.preventDefault();const ok=await send({type:COST_CONTROL_COMMAND.COST_FORECAST_SAVED,expectedVersion:draft.version??report.planningVersion,payload:{obraId:work.id,budgetId:report.budget.id,stageId:stage.id,remainingCents:cents,asOf,fingerprint:draft.fingerprint??report.fingerprint,basis:{incurred:stage.incurred,committed:stage.committed,budget:stage.budget},note}});if(ok)patch({forecasts:{...view.forecasts,[stage.id]:undefined}});}}>
 <label>Custo restante para concluir (R$)<Input type="number" min="0" step="0.01" required value={amount} onChange={e=>setForecast({amount:e.target.value})}/></label>
 <label>Premissas da previsão<Input required minLength={5} maxLength={2000} value={note} onChange={e=>setForecast({note:e.target.value})}/></label>
 {valid&&<p className="cost-control__result">Custo final após revisão: <strong>{money(stage.incurred+cents)}</strong> · Desvio do orçamento: {money(stage.incurred+cents-stage.budget)}.</p>}
 {valid&&cents<Math.max(0,stage.committed-stage.incurred)&&<p role="status">O restante informado está abaixo do saldo entre compras comprometidas e incorrido. Explique cancelamentos, economias ou outras premissas na justificativa.</p>}
 <div className="cost-control__actions"><Button type="submit" disabled={!valid||note.trim().length<5||staleDraft}>{busy?'Salvando…':'Confirmar previsão'}</Button><Button variant="outline" type="button" onClick={()=>setForecast({amount:String(stage.automaticRemaining/100)})}>Usar referência automática</Button><Button variant="ghost" type="button" onClick={()=>patch({forecasts:{...view.forecasts,[stage.id]:undefined}})}>Descartar rascunho</Button></div>
 {staleDraft&&<p role="alert">A base deste rascunho mudou. Descarte o rascunho e confira os valores atuais antes de confirmar.</p>}
 </form>
 {Boolean(work.costPlanning?.history?.length)&&<details><summary>Histórico das previsões desta obra</summary><ol>{[...work.costPlanning.history].reverse().map(r=><li key={r.version}>{rows.find(x=>x.id===r.stageId)?.label||r.stageId} · {money(r.remainingCents)} para concluir · {r.asOf} · {r.by}: {r.note}</li>)}</ol></details>}
 </fieldset>}
 </details></div>;
}
