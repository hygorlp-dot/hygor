import { Button } from "../../design-system/primitives/Button.jsx";
import "./styles.css";

function Metric({ label, value, detail }) { return <article className="arcd-mobile-dashboard__metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>; }

export function MobileDashboard({ project, metrics = {}, pending = [], quickActions = [], loading = false, error, onSelectAction }) {
  if (loading) return <section className="arcd-mobile-dashboard" aria-busy="true"><p role="status">Carregando visão da obra…</p></section>;
  if (error) return <section className="arcd-mobile-dashboard"><p role="alert">{error}</p></section>;
  if (!project) return <section className="arcd-mobile-dashboard"><h1>Selecione uma obra</h1><p>Escolha uma obra para ver as prioridades de campo.</p></section>;
  return <section className="arcd-mobile-dashboard">
    <header className="arcd-mobile-dashboard__project"><p>Obra ativa</p><h1>{project.name}</h1>{project.address && <span>{project.address}</span>}</header>
    <div className="arcd-mobile-dashboard__metrics">
      <Metric label="Progresso físico" value={metrics.progress ?? "—"} detail={metrics.progressDetail} />
      <Metric label="Prazo" value={metrics.deadline ?? "—"} detail={metrics.deadlineDetail} />
      <Metric label="Custo realizado" value={metrics.cost ?? "—"} detail={metrics.costDetail} />
    </div>
    <section className="arcd-mobile-dashboard__section"><h2>Pendências</h2>{pending.length ? <ul>{pending.map(item => <li key={item.id || item.label}><strong>{item.value}</strong><span>{item.label}</span></li>)}</ul> : <p>Nenhuma pendência prioritária.</p>}</section>
    <section className="arcd-mobile-dashboard__section"><h2>Ações rápidas</h2><div className="arcd-mobile-dashboard__actions">{quickActions.map(action => <Button key={action.id} variant={action.primary ? "primary" : "secondary"} disabled={action.disabled} onClick={() => onSelectAction?.(action.id)}>{action.label}</Button>)}</div></section>
  </section>;
}
