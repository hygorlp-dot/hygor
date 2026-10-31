import { Spinner } from "../primitives/Spinner.jsx";
import "./styles.css";

function State({ title, description, action, loading = false, error=false, headingLevel=2 }) { const Heading=headingLevel===3?'h3':'h2';return <section className="arcd-feedback-state" role={loading ? "status" : error?'alert':undefined} aria-busy={loading||undefined}>{loading && <Spinner />}{title && <Heading className="arcd-feedback-state__title">{title}</Heading>}{description && <p className="arcd-feedback-state__description">{description}</p>}{action}</section>; }
export function EmptyState(props) { return <State {...props} />; }
export function ErrorState(props) { return <State {...props} error />; }
export function LoadingState({ title = "Carregando", description = "Aguarde enquanto os dados são preparados." }) { return <State title={title} description={description} loading />; }
