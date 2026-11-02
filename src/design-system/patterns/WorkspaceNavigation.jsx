import { useId, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Select } from "../primitives/Select.jsx";

/** One set of destinations; desktop tabs and a native mobile selector. */
export function WorkspaceNavigation({ label, active, onChange, items = [], groups = [], tools = [], toolsLabel = "Consultas e configurações", className = "", toolsClassName = "" }) {
  const selectedTool = tools.find(item => item.id === active);
  const destinations = groups.length ? groups.filter(group => group.items.length) : [{label:"Áreas de trabalho",items}];
  const selectedGroup = selectedTool ? toolsLabel : destinations.find(group=>group.items.some(item=>item.id===active))?.label;
  const destinationButton = item => <Button key={item.id} variant="ghost" className="workspace-navigation__tab" aria-label={item.label}
    aria-current={active === item.id ? "page" : undefined} onClick={() => onChange(item.id)}>
    {item.label}{item.count != null && <small className="workspace-navigation__count" aria-hidden="true">{item.count}</small>}
  </Button>;
  return <div className={`workspace-navigation ${className}`.trim()}>
    <div className="workspace-navigation__mobile">
      <Select label={label} description={groups.length ? selectedGroup : undefined} value={active} onChange={event => onChange(event.target.value)}>
        {destinations.map(group => <optgroup key={group.label} label={group.label}>{group.items.map(item => <option key={item.id} value={item.id}>{item.label}{item.count != null ? ` (${item.count})` : ""}</option>)}</optgroup>)}
        {tools.length > 0 && <optgroup label={toolsLabel}>{tools.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}
      </Select>
    </div>
    <div className="workspace-navigation__desktop">
      <nav aria-label={label} data-grouped={groups.length>0||undefined}>{groups.length ? destinations.map(group => <div key={group.label} className="workspace-navigation__group" role="group" aria-label={group.label}>
        <span className="workspace-navigation__group-label">{group.label}</span><div>{group.items.map(destinationButton)}</div>
      </div>) : items.map(destinationButton)}</nav>
      {tools.length > 0 && <details className={`workspace-navigation__tools ${toolsClassName}`.trim()} key={active} onKeyDown={event => {
        if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
      }}>
        <summary><span>{selectedTool ? `${toolsLabel} · ${selectedTool.label}` : toolsLabel}</span><ChevronDown aria-hidden="true" /></summary>
        <nav aria-label={toolsLabel}>{tools.map(item => <Button key={item.id} variant="ghost" aria-current={active === item.id ? "page" : undefined}
          onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onChange(item.id); }}>{item.label}</Button>)}</nav>
      </details>}
    </div>
  </div>;
}

/** Advanced filters stay in the DOM so collapsing never discards their values. */
export function WorkspaceFilters({ children, activeCount = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className="workspace-filters" data-expanded={expanded}>
    <Button variant="outline" className="workspace-filters__toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <SlidersHorizontal data-icon="inline-start" />Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
    </Button>
    <div id={id} className="workspace-filters__fields">{children}</div>
  </div>;
}
