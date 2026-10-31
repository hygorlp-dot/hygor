export const LABOR_AREAS = [
  { id: "all", label: "Consolidado" },
  { id: "obras", label: "Obras" },
  { id: "central", label: "Administração Central", description:"Inclui provisoriamente a administração local: engenheiros e mestres. A lotação de cada pessoa permanece preservada." },
];

// Administração local usa provisoriamente o mesmo grupo da central.
// Esta classificação de consulta não altera a lotação nem o ponto histórico.
export function laborArea(employee = {}) {
  const role = String(employee.role || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return employee.workArea === "administrativo" || /\bengenheir[oa]\b|\bmestre\b/.test(role) ? "central" : "obras";
}
export const matchesLaborArea = (employee, area) => area === "all" || laborArea(employee) === area;
export const laborAreaLabel = area => LABOR_AREAS.find(item => item.id === area)?.label || "Consolidado";
