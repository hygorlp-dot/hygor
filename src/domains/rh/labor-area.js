export const LABOR_AREAS = [
  { id: "obras", label: "Pessoal de obra" },
  { id: "central", label: "Administrativo", description:"Inclui a equipe administrativa, engenheiros e mestres. A lotação e o histórico de cada pessoa permanecem preservados." },
  { id: "all", label: "Todos" },
];

// Administração local usa provisoriamente o mesmo grupo da central.
// Esta classificação de consulta não altera a lotação nem o ponto histórico.
export function laborArea(employee = {}) {
  const role = String(employee.role || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return employee.workArea === "administrativo" || /\bengenheir[oa]\b|\bmestre\b/.test(role) ? "central" : "obras";
}
export const matchesLaborArea = (employee, area) => area === "all" || laborArea(employee) === area;
export const laborAreaLabel = area => LABOR_AREAS.find(item => item.id === area)?.label || "Consolidado";
