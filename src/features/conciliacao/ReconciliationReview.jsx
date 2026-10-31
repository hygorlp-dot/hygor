import "./reconciliation-review.css";
import { useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { buildDreCashManagement } from "../../domains/conciliacao/cash-allocations.js";
import { criarRegistroIdentidades } from "../../domains/conciliacao/identity.js";
import ReconciliationEvidence from "./ReconciliationEvidence.jsx";
import ReviewSearchFilters from "./ReviewSearchFilters.jsx";
import { emptyReviewFilters, filterReviewEntries } from "./review-search.js";
import ReconciliationDocuments from "./ReconciliationDocuments.jsx";

export default function ReconciliationReview({ data, transaction, analysis, reason, fmt, busy, canOperate, onLink, onSaving, onCandidate, onCreate, onTransfer }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ ...emptyReviewFilters });
  const [documents, setDocuments] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const report = useMemo(() => buildDreCashManagement(data), [data]);
  const identities = useMemo(() => criarRegistroIdentidades(data).registros, [data]);
  const bank = report.banks.find(item => item.id === String(transaction.id));
  const candidates = [analysis?.melhorCandidata, ...(analysis?.alternativas || [])].filter(Boolean);
  const available = report.entries.filter(item => item.remainingCents > 0 && !item.transactionId && item.effect === (Number(transaction.valor) > 0 ? "cash_in" : "cash_out"));
  const entries = filterReviewEntries(available, data, search, filters);
  const chosen = available.filter(item => selected[item.id]);
  const total = chosen.reduce((sum, item) => sum + Math.round(Number(selected[item.id]) * 100), 0);
  const difference = (bank?.remainingCents || 0) - total;
  const valid = chosen.length > 0 && difference >= 0 && chosen.every(item => {
    const value = Number(selected[item.id]) * 100;
    return Number.isFinite(value) && Math.abs(value - Math.round(value)) < 0.000001 && value > 0 && Math.round(value) <= item.remainingCents;
  });
  const disabled = busy || saving || !canOperate || Boolean(bank?.hold);
  const save = async () => {
    if (lock.current || disabled || !valid) return;
    lock.current = true; setSaving(true); onSaving(true); setMessage("");
    try {
      for (const entry of chosen) {
        const ok = await onLink(entry.id, Number(selected[entry.id]));
        if (!ok) { setMessage("A operação parou. Os vínculos já confirmados foram preservados; confira os saldos antes de continuar."); return; }
        setSelected(current => { const next = { ...current }; delete next[entry.id]; return next; });
      }
      setMessage(difference === 0 ? "Movimento totalmente vinculado." : "Vínculos salvos. O saldo restante continua para revisão.");
    } finally { lock.current = false; setSaving(false); onSaving(false); }
  };
  return <div className="reconciliation-review flex min-w-0 flex-col gap-4">
    <div className="reconciliation-review__identity">
      <section aria-label="Movimento do banco">
        <h3 className="font-semibold">Movimento do banco</h3>
        <p className="break-words">{transaction.descricao}</p><p>{transaction.data}</p>
        <strong>{fmt(Number(transaction.valor))}</strong>
        <p>{Number(transaction.valor)>0?"Entrada":"Saída"} · {(data.contasBancarias || []).find(a=>String(a.id)===String(transaction.contaBancariaId))?.nome || "Sem conta definida"}</p>
        <p>Saldo a vincular: {fmt((bank?.remainingCents || 0) / 100)}</p>
        <Button variant="ghost" size="sm" onClick={()=>setDocuments({bank:true})}>Documentos do movimento</Button>
      </section>
      <section aria-label="Identificação no app">
        <h3 className="font-semibold">Identificação no app</h3>
        <p>{analysis?.identidadeProvavel?.nome || "Contraparte não identificada"}</p>
        <p>{analysis?.identidadeProvavel?.evidencias?.join(" · ")}</p>
        <p>Identificar a pessoa não confirma o lançamento financeiro.</p>
        <p className="reconciliation-review__reason"><strong>Motivo da revisão: </strong>{bank?.hold || reason || "Confira os lançamentos antes de vincular."}</p>
      </section>
    </div>
    {documents&&<ReconciliationDocuments key={documents.event?.id || documents.candidate?.entidadeId || "bank"} data={data} transaction={transaction} selection={documents} onClose={()=>setDocuments(null)}/>}
    {candidates.length>0&&<section aria-label="Correspondências sugeridas" className="flex flex-col gap-2">
      <h3 className="font-semibold">Correspondências sugeridas</h3>
      {candidates.map((candidate,index)=><div key={`${candidate.tipo}:${candidate.entidadeId}:${index}`} className="rounded-md border p-3">
        <strong>{candidate.titulo}</strong><p>{candidate.contraparte}</p>
        <ReconciliationEvidence transaction={transaction} candidate={candidate} identities={identities} data={data} fmt={fmt}/>
        <dl className="reconciliation-review__comparison"><div><dt>Valor do banco</dt><dd>{fmt(Math.abs(Number(transaction.valor)))}</dd></div><div><dt>Saldo do lançamento</dt><dd>{fmt(Number(candidate.saldoCentavos || 0)/100)}</dd></div><div><dt>Diferença de valores</dt><dd>{fmt(Math.abs(Number(transaction.valor))-Number(candidate.saldoCentavos || 0)/100)}</dd></div></dl>
        <ul>{(candidate.motivos || []).map((text,i)=><li key={i}>{text}</li>)}</ul>
        {[...(candidate.alertas || []),...(candidate.bloqueios || [])].map((text,i)=><p key={i}>{text}</p>)}
        <Button variant="outline" size="sm" disabled={disabled} onClick={()=>onCandidate(candidate)}>Revisar esta sugestão</Button>
        <Button variant="ghost" size="sm" onClick={()=>setDocuments({candidate})} aria-label={`Documentos e ficha de ${candidate.titulo}`}>Documentos e ficha</Button>
      </div>)}
    </section>}
    <section className="flex flex-col gap-3" aria-label="Buscar lançamentos existentes">
      <h3 className="font-semibold">Vincular um ou mais registros de caixa existentes</h3>
      <p>Use para pagamentos ou recebimentos já registrados. Não cria uma nova despesa ou receita. Títulos ainda em aberto são tratados nas sugestões acima.</p>
      <Input aria-label="Buscar lançamentos existentes" placeholder="Descrição, pessoa, data ou obra" value={search} onChange={event=>setSearch(event.target.value)}/>
      <ReviewSearchFilters data={data} available={available} filters={filters} onChange={setFilters} disabled={disabled}/>
      <p role="status">{entries.length} de {available.length} registro(s) disponível(is)</p>
      {chosen.filter(item=>!entries.some(entry=>entry.id===item.id)).map(item=><p key={item.id}>Selecionado fora dos filtros: {item.description} · {fmt(Number(selected[item.id]))} <Button variant="ghost" size="sm" disabled={disabled} onClick={()=>setSelected(current=>{const next={...current};delete next[item.id];return next;})}>Remover seleção de {item.description}</Button></p>)}
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {entries.map(entry=><div key={entry.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" disabled={disabled} checked={selected[entry.id]!==undefined} onChange={event=>setSelected(current=>{const next={...current};if(event.target.checked)next[entry.id]=String(Math.min(entry.remainingCents,Math.max(0,difference))/100);else delete next[entry.id];return next;})}/><span className="break-words">{entry.description || "Registro de caixa"} · {entry.counterparty} · {entry.date} · disponível {fmt(entry.remainingCents/100)}</span></label>
          {selected[entry.id]!==undefined&&<Input className="w-32" aria-label={`Valor a vincular: ${entry.description}`} type="number" step="0.01" min="0.01" disabled={disabled} value={selected[entry.id]} onChange={event=>setSelected(current=>({...current,[entry.id]:event.target.value}))}/>}
          <Button variant="ghost" size="sm" onClick={()=>setDocuments({event:entry})} aria-label={`Documentos de ${entry.description}`}>Ver documentos</Button>
        </div>)}
        {!entries.length&&<p>Nenhum registro de caixa disponível para esta busca.</p>}
      </div>

    </section>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={disabled || transaction.status!=="pendente"} onClick={onCreate}>{Number(transaction.valor)>0?"Classificar nova entrada":"Classificar nova saída"}</Button>
      <Button variant="outline" disabled={disabled || transaction.status!=="pendente"} onClick={onTransfer}>Identificar transferência</Button>
    </div>
      <div className="reconciliation-review__totals" aria-label="Resumo dos vínculos"><Alert><AlertDescription><p>Saldo do banco: {fmt((bank?.remainingCents || 0)/100)} · Selecionado: {fmt(total/100)} · Diferença: {fmt(difference/100)}</p><p>{difference<0?"A seleção supera o saldo bancário.":difference>0?"O restante ficará pendente para revisão.":"Os valores fecham."}</p>{message&&<p role="status">{message}</p>}</AlertDescription></Alert>
      <Button disabled={disabled || !valid} onClick={save}>{saving?"Vinculando…":"Confirmar vínculos selecionados"}</Button></div>
  </div>;
}
