import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { buildPilotCases, pilotMetrics, pilotReview } from "./pilot-model.js";
import { criarRegistroIdentidades } from "../../domains/conciliacao/identity.js";
import ReconciliationEvidence from "../conciliacao/ReconciliationEvidence.jsx";
import ReconciliationDocuments from "../conciliacao/ReconciliationDocuments.jsx";
import "./operational-pilot.css";

const PurchaseDossier = lazy(() => import("../../domains/compras/components/PurchaseDossier.jsx").then(module => ({ default: module.PurchaseDossier })));
const money = value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels = { proposed: "Automação simulada", executed: "Automática já executada", review: "Revisão necessária" };
const rate = metric => metric.rate == null ? "Sem amostra conferida" : `${(metric.rate * 100).toFixed(1)}% · n=${metric.sample}`;
export default function OperationalPilot({ data, mode, scope, automationRows, notes, onNotes, onClose }) {
  const [snapshot] = useState(() => ({ data, capturedAt: new Date().toISOString(), cases: buildPilotCases(data, mode, scope, automationRows) }));
  const identities = useMemo(() => mode === "compras" ? [] : criarRegistroIdentidades(snapshot.data).registros, [snapshot, mode]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [details, setDetails] = useState(false);
  const started = useRef(0);
  const cases = snapshot.cases;
  const visible = cases.filter(item => `${item.title} ${item.date}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const current = cases.find(item => item.id === selected);
  const metrics = pilotMetrics(cases, notes);
  const open = item => {setSelected(item.id);setDecision("");setReason("");setError("");setDetails(false);started.current=performance.now();};
  const save = () => {
    try {const review=pilotReview(current,{decision,reason,elapsedMs:performance.now()-started.current});onNotes({...notes,[current.id]:review});setSelected("");setError("");} catch(failure){setError(failure.message);}
  };
  const exportReport = () => {
    const report = { version: 1, mode, capturedAt: snapshot.capturedAt, exportedAt: new Date().toISOString(), metrics, financialWrites: 0, interpretation: "Resultados da amostra conferida nesta sessão; ajustes apontados não foram aplicados aos lançamentos." };
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`piloto-${mode}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  return <section className="operational-pilot" aria-label={`Piloto de ${mode === "compras" ? "Compras" : "Conciliação"}`}>
    <header><div><h1>Piloto de conferência · {mode === "compras" ? "Compras" : "Conciliação"}</h1><p>Consulta dos dados carregados, sem criar, pagar ou conciliar lançamentos.</p></div><Button variant="outline" onClick={onClose}>Voltar ao módulo</Button></header>
    <p>Retrato de {new Date(snapshot.capturedAt).toLocaleString("pt-BR")}. Avaliações ficam nesta sessão do navegador; exporte o relatório para guardar os resultados. O processamento de importações no servidor é independente deste piloto.</p>
    <dl className="operational-pilot__metrics">{[["Casos disponíveis",metrics.total],["Conferidos",metrics.reviewed],["Ajustes apontados",metrics.corrections],["Inconclusivos",metrics.inconclusive],["Tempo médio decorrido",metrics.averageMs == null ? "Sem medição" : `${Math.round(metrics.averageMs/1000)} s`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {mode !== "compras" && <div><p>Concordância com automação simulada: <strong>{rate(metrics.proposedAgreement)}</strong> · {metrics.automaticProposed} proposta(s) segura(s).</p><p>Acurácia observada em automáticas executadas: <strong>{rate(metrics.executedAccuracy)}</strong> · {metrics.automaticExecuted} caso(s) disponível(is).</p><p>Percentuais usam somente avaliações conclusivas. Desfazer um lançamento não é considerado prova automática de erro.</p></div>}
    <div className="operational-pilot__actions"><Input aria-label="Buscar casos do piloto" placeholder="Descrição ou data" value={query} onChange={event=>setQuery(event.target.value)}/><Button variant="outline" onClick={exportReport}>Exportar indicadores do piloto</Button></div>
    <div className="operational-pilot__workspace"><div className="operational-pilot__cases">{visible.slice(0,100).map(item=><article key={item.id}><strong>{item.title}</strong><p>{item.date} · {labels[item.prediction]}</p><p>{notes[item.id]?.fingerprint===item.fingerprint ? "Avaliação registrada nesta sessão" : "Ainda não conferido"}</p><Button variant="outline" aria-pressed={selected===item.id} onClick={()=>open(item)}>Conferir caso</Button></article>)}{!visible.length&&<p>Nenhum caso neste recorte. Ajuste a busca ou volte ao módulo para consultar outro conjunto de dados.</p>}{visible.length>100&&<p>Mostrando 100 de {visible.length} casos. Refine a busca para conferir os demais.</p>}</div>
    {current && <section className="operational-pilot__review" aria-label="Conferência do piloto"><h2>{current.title}</h2><p>{current.reason}</p>
      {current.transaction&&<p>{money(current.transaction.valor)} · {current.date} · {labels[current.prediction]}</p>}
      {current.candidate&&current.prediction!=="executed"&&<ReconciliationEvidence transaction={current.transaction} candidate={current.candidate} identities={identities} data={snapshot.data} fmt={money}/>}
      <Button variant="outline" onClick={()=>setDetails(value=>!value)}>{details?"Recolher documentos do caso":"Consultar ficha e documentos"}</Button>
      {details&&(mode==="compras"?<Suspense fallback={<p role="status">Carregando ficha…</p>}><PurchaseDossier inline data={snapshot.data} selection={{pedidoId:current.sourceId}} onClose={()=>setDetails(false)}/></Suspense>:<ReconciliationDocuments key={current.id} data={snapshot.data} transaction={current.transaction} selection={current.candidate?{candidate:current.candidate}:{bank:true}} onClose={()=>setDetails(false)}/>)}
      <fieldset><legend>Resultado da conferência</legend>{[["agree","Conferido sem ajuste"],["correct","Ajuste necessário"],["unknown","Não foi possível concluir"]].map(([value,label])=><label key={value}><input type="radio" name="pilot-decision" checked={decision===value} onChange={()=>setDecision(value)}/>{label}</label>)}</fieldset>
      <label>Motivo ou observação<Input value={reason} onChange={event=>setReason(event.target.value)} maxLength={1000}/></label>
      {error&&<p role="alert">{error}</p>}<Button onClick={save}>Registrar avaliação do piloto</Button><p>A avaliação não aplica correções e não aprova pagamentos.</p>
    </section>}</div>
  </section>;
}
