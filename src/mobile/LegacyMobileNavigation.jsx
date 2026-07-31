import { lazy, Suspense, useMemo, useState } from "react";
import "./styles.css";

const DEFAULT_PRIORITY = ["painel", "eng_grp", "compras_grp", "fin_grp"];
const LazyMobileMoreMenu = lazy(() => import("./MobileMoreMenu.jsx")
  .then(module => ({ default:module.MobileMoreMenu })));

export function selectMobilePrimaryGroups(groups = [], activeGroupId = "", limit = 4) {
  const available = groups.filter(Boolean);
  const ordered = [
    ...DEFAULT_PRIORITY.map(id => available.find(group => group.id === id)).filter(Boolean),
    ...available.filter(group => !DEFAULT_PRIORITY.includes(group.id)),
  ];
  const primary = ordered.slice(0, Math.max(1, limit));
  const active = available.find(group => group.id === activeGroupId);

  if (active && !primary.some(group => group.id === active.id)) {
    primary[Math.max(0, primary.length - 1)] = active;
  }

  const uniquePrimary = primary.filter((group, index, list) =>
    list.findIndex(candidate => candidate.id === group.id) === index);
  const primaryIds = new Set(uniquePrimary.map(group => group.id));
  return {
    primary: uniquePrimary,
    overflow: available.filter(group => !primaryIds.has(group.id)),
  };
}

export function LegacyMobileNavigation({
  groups = [],
  activeGroupId = "",
  badges = {},
  onSelectGroup,
  renderIcon,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary, overflow } = useMemo(
    () => selectMobilePrimaryGroups(groups, activeGroupId),
    [groups, activeGroupId],
  );
  const itemCount = primary.length + (overflow.length ? 1 : 0);
  const moreMenuId = "arcd-mobile-modules-menu";

  const selectById = id => {
    const group = groups.find(item => item.id === id);
    if (group) onSelectGroup?.(group);
  };

  return <>
    <div
      className="mobile-primary-nav"
      style={{ "--arcd-mobile-primary-count": Math.max(1, itemCount) }}
    >
      {primary.map(group => {
        const active = activeGroupId === group.id;
        const badge = badges[group.id];
        return <button
          key={group.id}
          type="button"
          data-active={active}
          aria-current={active ? "page" : undefined}
          aria-label={`Abrir ${group.label}`}
          onClick={() => onSelectGroup?.(group)}
          style={{
            "--ic-color": active ? group.color : undefined,
            "--mobile-group-color": group.color,
          }}
        >
          {renderIcon?.(group.icon, active ? 20 : 18)}
          <span className="mobile-primary-nav__label">{group.label}</span>
          {badge && <span className="mobile-primary-nav__badge" aria-label="Há pendências" />}
        </button>;
      })}
      {overflow.length > 0 && <button
        type="button"
        className="mobile-primary-nav__more"
        aria-label="Abrir mais setores"
        aria-expanded={moreOpen}
        aria-controls={moreMenuId}
        onClick={() => setMoreOpen(true)}
      >
        <span className="mobile-primary-nav__dots" aria-hidden="true">•••</span>
        <span className="mobile-primary-nav__label">Mais</span>
        {overflow.some(group => badges[group.id]) &&
          <span className="mobile-primary-nav__badge" aria-label="Há pendências" />}
      </button>}
    </div>
    {moreOpen && <Suspense fallback={null}><LazyMobileMoreMenu
        id={moreMenuId}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        onNavigate={selectById}
        items={overflow.map(group => ({
          id: group.id,
          label: group.label,
          icon: renderIcon?.(group.icon, 19),
          active: group.id === activeGroupId,
        }))}
      /></Suspense>}
  </>;
}
