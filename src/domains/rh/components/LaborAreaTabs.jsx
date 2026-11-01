import { FlowTabs } from "../../../features/workflow/WorkflowNavigation.jsx";
import { LABOR_AREAS } from "../labor-area.js";
import './labor-area-tabs.css';

export function LaborAreaTabs({ value, onChange }) {
  return <div className="labor-area-tabs"><FlowTabs label="Grupo da equipe" steps={LABOR_AREAS} active={value} onChange={onChange}/></div>;
}
