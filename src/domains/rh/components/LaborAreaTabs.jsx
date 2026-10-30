import { FlowTabs } from "../../../features/workflow/WorkflowNavigation.jsx";
import { LABOR_AREAS } from "../labor-area.js";

export function LaborAreaTabs({ value, onChange }) {
  return <FlowTabs label="Grupo da equipe" steps={LABOR_AREAS} active={value} onChange={onChange}/>;
}
