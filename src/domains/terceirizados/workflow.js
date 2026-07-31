export const THIRD_PARTY_KANBAN_COLUMNS = Object.freeze([
  { v: "contratado", l: "Contratado", cor: "#54a0ff", dica: "Fechado, ainda não começou" },
  { v: "andamento", l: "Em andamento", cor: "#f6d833", dica: "Executando em obra" },
  { v: "pausado", l: "Paralisado", cor: "#ff9f1c", dica: "Interrompido temporariamente" },
  { v: "concluido", l: "Concluído", cor: "#26de81", dica: "Contrato entregue" },
]);

export function thirdPartyKanbanColumn(status) {
  return THIRD_PARTY_KANBAN_COLUMNS.find(column => column.v === status)
    || THIRD_PARTY_KANBAN_COLUMNS[1];
}

export function daysUntil(isoDate, now = new Date()) {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}
