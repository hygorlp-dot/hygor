const MORE_ITEMS = Object.freeze([
  {id:"transparency",label:"Caixa e suprimentos",permissions:["viewProjectCash","viewProcurement"]},
  {id:"documents",label:"Documentos",permissions:["downloadDocuments"]},
]);

export function ClientPortalMoreMenu({ open, onOpenChange, onNavigate, permissions = {} }) {
  if (!open) return null;
  const items=MORE_ITEMS.filter(item=>!item.permissions || item.permissions.some(permission=>permissions[permission]));
  return <div className="arcd-client-more__backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}><section className="arcd-client-more" role="dialog" aria-modal="true" aria-label="Mais opções"><header><h2>Mais</h2><button type="button" className="arcd-client-icon-button" aria-label="Fechar mais opções" onClick={() => onOpenChange?.(false)}>×</button></header><div>{items.map(item => <button key={item.id} type="button" onClick={() => { onNavigate?.(item.id); onOpenChange?.(false); }}>{item.label}</button>)}</div></section></div>;
}
