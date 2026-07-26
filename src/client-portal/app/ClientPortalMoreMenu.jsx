const MORE_ITEMS = ["Mensagens", "Documentos", "Agenda", "Equipe", "Assistência", "Configurações"];

export function ClientPortalMoreMenu({ open, onOpenChange, onNavigate }) {
  if (!open) return null;
  return <div className="arcd-client-more__backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}><section className="arcd-client-more" role="dialog" aria-modal="true" aria-label="Mais opções"><header><h2>Mais</h2><button type="button" className="arcd-client-icon-button" aria-label="Fechar mais opções" onClick={() => onOpenChange?.(false)}>×</button></header><div>{MORE_ITEMS.map(item => <button key={item} type="button" onClick={() => { onNavigate?.(item.toLowerCase()); onOpenChange?.(false); }}>{item}</button>)}</div></section></div>;
}
