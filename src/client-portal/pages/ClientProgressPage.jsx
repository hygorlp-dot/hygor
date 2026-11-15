import {portalDate} from "../format.js";
import "../styles/portal.css";

const percent = value => Math.max(0, Math.min(100, Number(value || 0)));
const date = value => portalDate(value,"A confirmar");

function WeeklyCard({ update }) {
  return <article className="arcd-client-record">
    <p className="arcd-client-record__eyebrow">{update.period || "Atualização"}</p>
    <h3>{update.summary || "A equipe ainda não publicou um resumo."}</h3>
    {update.completed?.length > 0 && <p><b>Concluído:</b> {update.completed.join(" · ")}</p>}
    {update.inProgress?.length > 0 && <p><b>Em andamento:</b> {update.inProgress.join(" · ")}</p>}
    {update.nextSteps?.length > 0 && <p><b>Próximo:</b> {update.nextSteps.join(" · ")}</p>}
  </article>;
}

export function ClientProgressPage({ data = {} }) {
  const timeline = data.timeline || [];
  const updates = data.weeklyUpdates || [];
  return <div className="arcd-client-page">
    <header className="arcd-client-page__header"><p>Obra</p><h2>Progresso publicado</h2><span>O cronograma abaixo mostra somente marcos compartilhados pela equipe.</span></header>
    <section className="arcd-client-section"><h2>Linha do tempo</h2>{timeline.length ? <div className="arcd-client-timeline">{timeline.map(item => <article className="arcd-client-record" key={item.id}><div className="arcd-client-record__heading"><div><p className="arcd-client-record__eyebrow">{item.status || "Em atualização"}</p><h3>{item.phase || "Etapa da obra"}</h3></div><b>{percent(item.progress)}%</b></div><div className="arcd-client-progressbar" aria-label={`${percent(item.progress)}% concluído`} role="progressbar" aria-valuenow={percent(item.progress)} aria-valuemin="0" aria-valuemax="100"><i style={{ width:`${percent(item.progress)}%` }} /></div><p>Planejado: {date(item.plannedStart)} — {date(item.plannedEnd)}</p>{item.actualStart && <p>Iniciado em: {date(item.actualStart)}</p>}{item.variance && <p>{item.variance}</p>}{item.justification && <p>{item.justification}</p>}</article>)}</div> : <p className="arcd-client-muted">Ainda não há marcos publicados para esta obra.</p>}</section>
    <section className="arcd-client-section"><h2>Atualizações da equipe</h2>{updates.length ? <div className="arcd-client-stack">{updates.map(update => <WeeklyCard key={update.id} update={update} />)}</div> : <p className="arcd-client-muted">A próxima atualização será publicada pela equipe responsável.</p>}</section>

  </div>;
}
