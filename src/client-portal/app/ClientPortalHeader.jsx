export function ClientPortalHeader({ project, onOpenMore }) {
  return <header className="arcd-client-header"><div><p>Minha obra</p><h1>{project?.name || "Acompanhamento da obra"}</h1></div><button type="button" className="arcd-client-icon-button" aria-label="Abrir mais opções" onClick={onOpenMore}>•••</button></header>;
}
