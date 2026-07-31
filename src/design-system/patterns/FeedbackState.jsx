import { Spinner } from "../primitives/Spinner.jsx";
import "./styles.css";

function State({ title, description, action, loading = false }) { return <section className="arcd-feedback-state" role={loading ? "status" : undefined}>{loading && <Spinner />}{title && <h2 className="arcd-feedback-state__title">{title}</h2>}{description && <p className="arcd-feedback-state__description">{description}</p>}{action}</section>; }
export function EmptyState(props) { return <State {...props} />; }
export function ErrorState(props) { return <State {...props} />; }
export function LoadingState({ title = "Carregando", description = "Aguarde enquanto os dados são preparados." }) { return <State title={title} description={description} loading />; }
