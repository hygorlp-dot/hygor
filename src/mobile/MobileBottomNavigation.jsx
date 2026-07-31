import { Building2, Home, Landmark, Menu, ScanLine } from "lucide-react";
import "./styles.css";

export const MOBILE_NAV_ITEMS = Object.freeze([
  { id: "home", label: "Início", icon: Home }, { id: "project", label: "Obra", icon: Building2 },
  { id: "field", label: "Campo", icon: ScanLine }, { id: "finance", label: "Financeiro", icon: Landmark },
  { id: "more", label: "Mais", icon: Menu },
]);

export function MobileBottomNavigation({ active, onNavigate, allowed = MOBILE_NAV_ITEMS.map(item => item.id) }) {
  return <nav className="arcd-mobile-bottom-nav" aria-label="Navegação principal">{MOBILE_NAV_ITEMS.map(item => { const Icon = item.icon; const permitted = allowed.includes(item.id); return <button key={item.id} type="button" className="arcd-mobile-bottom-nav__item" data-active={active === item.id} aria-current={active === item.id ? "page" : undefined} disabled={!permitted} aria-label={item.label} onClick={() => permitted && onNavigate?.(item.id)}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav>;
}
