import "../styles/portal.css";

const currency = value => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle:"medium" }).format(new Date(`${value}T12:00:00`)) : "Sem prazo informado";

function Decision({ item, label }) {
  return <article className="arcd-client-record"><div className="arcd-client-record__heading"><div><p className="arcd-client-record__eyebrow">{label} · {item.status || "Publicada"}</p><h3>{item.title || "Decisão da obra"}</h3></div>{item.dueDate && <span>Até {date(item.dueDate)}</span>}</div>{item.description && <p>{item.description}</p>}{item.options?.length > 0 && <ul className="arcd-client-options">{item.options.map(option => <li key={option.id}><b>{option.label}</b>{option.description && <span>{option.description}</span>}{Number(option.financialImpact) !== 0 && <small>Impacto informado: {currency(option.financialImpact)}</small>}{Number(option.scheduleImpactDays) !== 0 && <small>Prazo: {option.scheduleImpactDays} dia(s)</small>}</li>)}</ul>}{item.technicalRecommendation && <p className="arcd-client-note"><b>Recomendação técnica:</b> {item.technicalRecommendation}</p>}{Number(item.financialImpact) !== 0 && <p><b>Impacto informado:</b> {currency(item.financialImpact)}</p>}{Number(item.scheduleImpactDays) !== 0 && <p><b>Impacto no prazo:</b> {item.scheduleImpactDays} dia(s)</p>}</article>;
}

export function ClientDecisionsPage({ data = {} }) {
  const decisions = data.decisions || [];
  const changes = data.approvedChanges || [];
  return <div className="arcd-client-page"><header className="arcd-client-page__header"><p>Alinhamentos</p><h2>Decisões e alterações publicadas</h2><span>Informações compartilhadas pela equipe. Aprovações formais seguem o canal indicado no contrato.</span></header><section className="arcd-client-section"><h2>Decisões em acompanhamento</h2>{decisions.length ? <div className="arcd-client-stack">{decisions.map(item => <Decision key={item.id} item={item} label="Decisão" />)}</div> : <p className="arcd-client-muted">Não há decisões publicadas aguardando acompanhamento.</p>}</section><section className="arcd-client-section"><h2>Alterações aprovadas</h2>{changes.length ? <div className="arcd-client-stack">{changes.map(item => <Decision key={item.id} item={item} label="Alteração" />)}</div> : <p className="arcd-client-muted">Não há alterações contratuais publicadas.</p>}</section></div>;
}
