import "../styles/portal.css";

export function ClientPortalLoading({ message = "Preparando seu acompanhamento de obra…" }) {
  return <main className="arcd-client-loading" aria-busy="true"><div><span aria-hidden="true" className="arcd-client-loading__mark" /><h1>Portal do Cliente ARCD</h1><p>{message}</p></div></main>;
}
