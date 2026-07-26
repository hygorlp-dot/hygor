export const CLIENT_NAV_ITEMS = Object.freeze([
  { id:"home", label:"Início", icon:"⌂" }, { id:"progress", label:"Progresso", icon:"◔" }, { id:"decisions", label:"Decisões", icon:"✓" }, { id:"financial", label:"Financeiro", icon:"$" }, { id:"more", label:"Mais", icon:"•••" },
]);

export function ClientPortalBottomNav({ active = "home", onNavigate, permissions = {} }) {
  return <nav className="arcd-client-bottom-nav" aria-label="Navegação do portal">{CLIENT_NAV_ITEMS.map(item => {
    const disabled = item.id === "financial" && !permissions.viewFinancial;
    return <button key={item.id} type="button" disabled={disabled} data-active={active === item.id} aria-current={active === item.id ? "page" : undefined} onClick={() => onNavigate?.(item.id)}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>;
  })}</nav>;
}
