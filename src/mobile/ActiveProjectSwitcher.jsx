import "./styles.css";

export function ActiveProjectSwitcher({ value, projects = [], onChange, label = "Obra atual" }) {
  if (!projects.length) return <p className="arcd-mobile-app-bar__title">Selecione uma obra para continuar.</p>;
  return <label className="arcd-mobile-project-switcher"><span className="sr-only">{label}</span><select value={value || ""} aria-label={label} onChange={event => onChange?.(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id} disabled={project.active === false}>{project.name}</option>)}</select></label>;
}
