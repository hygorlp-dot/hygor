import { useCallback, useEffect, useId, useRef, useState } from "react";
import { consultarGestaoDre, executarComandoConciliacao } from "../../api.js";
import "./dre-reconciliation-manager.css";

const money = cents => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalized = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const matches = (value, query) => normalized(query).split(/\s+/).every(word => normalized(value).includes(word));

export default function DreReconciliationManager({ data, currentUser, update }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [bankId, setBankId] = useState("");
  const [eventId, setEventId] = useState("");
  const [amount, setAmount] = useState("");
  const [reverseId, setReverseId] = useState("");
  const [reason, setReason] = useState("");
  const id = useId();
  const retry = useRef(null);
  const linkForm = useRef(null);
  const saving = useRef(false);
  const request = useRef(0);
  const allowed = ["admin", "financeiro"].includes(currentUser?.role) && !currentUser?.obraId;
  const load = useCallback(async () => {
    const version=++request.current;
    setLoading(true);setError("");
    try {
      const result=await consultarGestaoDre();
      if(version!==request.current)return;
      if(!result.ok)throw new Error(result.error||"Não foi possível consultar os saldos do DRE.");
      setReport(result);
    } catch(cause) { if(version===request.current)setError(cause.message); }
    finally { if(version===request.current)setLoading(false); }
  },[]);
  useEffect(()=>{
    if(open&&allowed)load();
    return ()=>{request.current+=1;};
  },[open,allowed,data,load]);
  if(!allowed)return null;
  const workName=obraId=>(data.obras||[]).find(work=>work.id===obraId)?.name||"Empresa";
  const entries=report?.entries||[];
  const banks=report?.banks||[];
  const bank=banks.find(item=>item.id===bankId);
  const entry=entries.find(item=>item.id===eventId);
  const candidates=entries.filter(item=>!item.metadata?.native&&!item.transactionId&&item.remainingCents>0
    &&(!bank||item.effect===(bank.direction==="in"?"cash_in":"cash_out"))
    &&matches(`${item.date} ${item.description} ${workName(item.obraId)} ${item.sourceId}`,search));
  const available=banks.filter(item=>["pendente","parcial"].includes(item.status)&&item.remainingCents>0&&!item.hold&&!item.canonicalSettlementLinked
    &&matches(`${item.date} ${item.description} ${workName(item.obraId)}`,search));
  const allocations=(report?.allocations||[]).filter(item=>item.status==="active");
  const held=banks.filter(item=>item.hold);
  const save = async (type,payload) => {
    if(saving.current)return;
    saving.current=true;setBusy(true);setError("");setStatus("Salvando…");
    const intent=JSON.stringify({type,payload});
    if(retry.current?.intent!==intent)retry.current={intent,key:`dre_${globalThis.crypto.randomUUID()}`};
    try {
      const sync=await update({__aguardarFila:true});
      if(!sync?.ok)throw new Error("Conclua o salvamento pendente antes de vincular.");
      const result=await executarComandoConciliacao({type,payload,idempotencyKey:retry.current.key});
      if(!result.ok)throw new Error(result.error||"O vínculo não foi confirmado. Tente novamente.");
      if(result.sections)await update({__adotarServidorPatch:true,sections:result.sections,updatedAt:result.updatedAt});
      else await update({__adotarServidor:true,data:result.data,updatedAt:result.updatedAt});
      retry.current=null;setStatus("Salvo. Pagamentos e valores do DRE preservados.");
      linkForm.current?.reset();
      setAmount("");setBankId("");setEventId("");setReverseId("");setReason("");
      await load();
    } catch(cause) {setError(cause.message);setStatus("Falha ao salvar");}
    finally {saving.current=false;setBusy(false);}
  };
  return <section className="dre-reconciliation" aria-label="Gestor de conciliação do DRE">
    <button type="button" className="dre-reconciliation__toggle" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls={`${id}-panel`}>
      <span><strong>Conciliação integrada ao DRE</strong><small>Vincule movimentos a registros existentes, inclusive por valores parciais.</small></span><span aria-hidden="true">{open?"−":"+"}</span>
    </button>
    {open&&<div id={`${id}-panel`} className="dre-reconciliation__body">
      <p>O vínculo comprova a origem do caixa. Ele não cria pagamentos nem reconhece receita ou custo novamente. Aportes permanecem como entrada de caixa.</p>
      <div className="dre-reconciliation__actions"><button type="button" className="arcd-btn" data-variant="ghost" data-size="sm" disabled={loading||busy} onClick={load}>Atualizar saldos</button><span role="status">{loading?"Consultando saldos…":status}</span></div>
      {error&&<p role="alert" className="dre-reconciliation__error">{error}</p>}
      {held.map(item=><div key={item.id} className="dre-reconciliation__hold"><strong>{money(item.amountCents)} · Pendente de composição</strong><p>{item.hold}</p></div>)}
      {report&&<>
        <div className="dre-reconciliation__totals"><span>Movimentos parciais <strong>{banks.filter(item=>item.status==="parcial").length}</strong></span><span>Vínculos ativos <strong>{allocations.length}</strong></span><span>Saldo bancário a vincular <strong>{money(banks.filter(item=>item.status!=="ignorado").reduce((sum,item)=>sum+item.remainingCents,0))}</strong></span></div>
        <label className="dre-reconciliation__field">Buscar por obra, descrição ou data<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: B2-04 aporte"/></label>
        <form ref={linkForm} onSubmit={event=>{event.preventDefault();save("LINK_PARTIAL_CASH",{transactionId:bankId,eventId,amount:Number(amount)});}}>
          <div className="dre-reconciliation__grid">
            <label className="dre-reconciliation__field">1. Movimento bancário<select required disabled={busy||loading} value={bankId} onChange={event=>{setBankId(event.target.value);setEventId("");setAmount("");}}><option value="">Selecione uma entrada ou saída</option>{available.map(item=><option key={item.id} value={item.id}>{item.date} · {item.direction==="in"?"Entrada":"Saída"} · {item.description} · saldo {money(item.remainingCents)}</option>)}</select></label>
            <label className="dre-reconciliation__field">2. Registro existente no DRE<select required disabled={!bank||busy||loading} value={eventId} onChange={event=>{setEventId(event.target.value);setAmount("");}}><option value="">Selecione um registro já lançado</option>{candidates.map(item=><option key={item.id} value={item.id}>{workName(item.obraId)} · {item.date} · {item.description} · {item.funding?"Aporte · ":""}saldo {money(item.remainingCents)}</option>)}</select></label>
            <label className="dre-reconciliation__field">3. Valor a vincular (R$)<input required type="number" min="0.01" step="0.01" max={bank&&entry?Math.min(bank.remainingCents,entry.remainingCents)/100:undefined} disabled={!entry||busy||loading} value={amount} onChange={event=>setAmount(event.target.value)}/></label>
          </div>
          {bank&&entry&&<p className="dre-reconciliation__preview">{workName(entry.obraId)} → {entry.description}<br/>Disponível no banco: <strong>{money(bank.remainingCents)}</strong> · disponível no registro: <strong>{money(entry.remainingCents)}</strong></p>}
          <button className="arcd-btn" data-variant="primary" data-size="sm" type="submit" disabled={!entry||!bank||busy||loading}>{busy?"Salvando…":"Confirmar vínculo"}</button>
        </form>
        {allocations.length>0&&<div className="dre-reconciliation__history"><h3>Vínculos confirmados</h3>{allocations.map(link=>{
          const target=entries.find(item=>item.id===link.eventId),movement=banks.find(item=>item.id===link.transactionId);
          return <div key={link.id} className="dre-reconciliation__link"><div><strong>{money(link.amountCents)} · {workName(link.obraId)}</strong><p>{movement?.date} · {movement?.description}</p><small>→ {target?.description||link.eventId}</small></div><button type="button" className="arcd-btn" data-variant="ghost" data-size="sm" disabled={busy} onClick={()=>{setReverseId(link.id);setReason("");}}>Desfazer vínculo</button></div>;
        })}</div>}
        {reverseId&&<form className="dre-reconciliation__reverse" onSubmit={event=>{event.preventDefault();const link=allocations.find(item=>item.id===reverseId);if(link)save("REVERSE_PARTIAL_CASH",{transactionId:link.transactionId,allocationId:link.id,reason});}}><label className="dre-reconciliation__field">Motivo para desfazer<input required value={reason} onChange={event=>setReason(event.target.value)} maxLength={500}/></label><p>O pagamento original será preservado.</p><button type="submit" className="arcd-btn" data-variant="danger" data-size="sm" disabled={busy}>Confirmar remoção do vínculo</button><button type="button" className="arcd-btn" data-variant="ghost" data-size="sm" disabled={busy} onClick={()=>setReverseId("")}>Cancelar</button></form>}
        {(report.issues||[]).filter(item=>item.code==="NATIVE_TITLE_WITHOUT_DRE_CLASSIFICATION").map(item=><p key={item.sourceId} className="dre-reconciliation__hold">{item.description} Referência: {item.sourceId}</p>)}
      </>}
    </div>}
  </section>;
}
