import "../styles/portal.css";
import { useState } from "react";
import { decideClientPortalChange } from "../services/clientPortalApi.js";

const currency = value => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle:"medium" }).format(new Date(`${value}T12:00:00`)) : "Sem prazo informado";

function Decision({ item, label }) {
  return <article className="arcd-client-record"><div className="arcd-client-record__heading"><div><p className="arcd-client-record__eyebrow">{label} · {item.status || "Publicada"}</p><h3>{item.title || "Decisão da obra"}</h3></div>{item.dueDate && <span>Até {date(item.dueDate)}</span>}</div>{item.description && <p>{item.description}</p>}{item.options?.length > 0 && <ul className="arcd-client-options">{item.options.map(option => <li key={option.id}><b>{option.label}</b>{option.description && <span>{option.description}</span>}{Number(option.financialImpact) !== 0 && <small>Impacto informado: {currency(option.financialImpact)}</small>}{Number(option.scheduleImpactDays) !== 0 && <small>Prazo: {option.scheduleImpactDays} dia(s)</small>}</li>)}</ul>}{item.technicalRecommendation && <p className="arcd-client-note"><b>Recomendação técnica:</b> {item.technicalRecommendation}</p>}{Number(item.financialImpact) !== 0 && <p><b>Impacto informado:</b> {currency(item.financialImpact)}</p>}{Number(item.scheduleImpactDays) !== 0 && <p><b>Impacto no prazo:</b> {item.scheduleImpactDays} dia(s)</p>}</article>;
}

// Aditivo proposto: quem tem permissão de aprovar decide aqui (Onda 4.3). A
// decisão fica registrada com data e usuário; a equipe efetiva no contrato.
function PendingChange({ item, projectId }) {
  const [comment, setComment] = useState("");
  const [state, setState] = useState({ sending:false, done:"", error:"" });
  const decide = async decision => {
    setState({ sending:true, done:"", error:"" });
    try {
      const result = await decideClientPortalChange(projectId, item.id, decision, comment.trim());
      setState({ sending:false, done:decision, error:"", reference:result?.reference });
    } catch (error) { setState({ sending:false, done:"", error:error.message }); }
  };
  return <article className="arcd-client-record">
    <Decision item={item} label="Alteração proposta" />
    {state.done
      ? <p className="arcd-client-note" role="status">Sua decisão ({state.done === "aprovado" ? "aprovada" : "recusada"}) foi registrada. A equipe vai efetivá-la no contrato.</p>
      : item.canDecide && <div className="arcd-client-stack">
        <label className="arcd-client-muted">Comentário (opcional)<textarea value={comment} maxLength={500} onChange={event => setComment(event.target.value)} rows={2} style={{ width:"100%" }}/></label>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button type="button" className="arcd-client-button" disabled={state.sending} onClick={() => decide("aprovado")}>Aprovar alteração</button>
          <button type="button" className="arcd-client-button arcd-client-button--secondary" disabled={state.sending} onClick={() => decide("recusado")}>Recusar</button>
        </div>
        {state.error && <p role="alert" className="arcd-client-muted">{state.error}</p>}
      </div>}
  </article>;
}

export function ClientDecisionsPage({ data = {} }) {
  const decisions = data.decisions || [];
  const allChanges = data.approvedChanges || [];
  const pending = allChanges.filter(item => item.pendingClient);
  const changes = allChanges.filter(item => !item.pendingClient);
  const projectId = data.project?.id || "";
  return <div className="arcd-client-page"><header className="arcd-client-page__header"><p>Alinhamentos</p><h2>Decisões e alterações publicadas</h2><span>Informações compartilhadas pela equipe. Alterações de contrato podem ser aprovadas aqui; sua decisão fica registrada com data e usuário.</span></header>{pending.length > 0 && <section className="arcd-client-section"><h2>Alterações aguardando sua aprovação</h2><div className="arcd-client-stack">{pending.map(item => <PendingChange key={item.id} item={item} projectId={projectId} />)}</div></section>}<section className="arcd-client-section"><h2>Decisões em acompanhamento</h2>{decisions.length ? <div className="arcd-client-stack">{decisions.map(item => <Decision key={item.id} item={item} label="Decisão" />)}</div> : <p className="arcd-client-muted">Não há decisões publicadas aguardando acompanhamento.</p>}</section><section className="arcd-client-section"><h2>Alterações aprovadas</h2>{changes.length ? <div className="arcd-client-stack">{changes.map(item => <Decision key={item.id} item={item} label="Alteração" />)}</div> : <p className="arcd-client-muted">Não há alterações contratuais publicadas.</p>}</section></div>;
}
