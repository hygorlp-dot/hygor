import { isProjectDate } from "./model.js";

const projectDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const historyDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short",
});

export function displayDate(value) {
  if (value == null || value === "") return "Sem prazo";
  return isProjectDate(value) ? projectDate.format(new Date(value)) : "Prazo inválido";
}

export function displayTimestamp(value, emptyLabel = "Data não informada") {
  if (value == null || value === "") return emptyLabel;
  if (typeof value !== "string" || !isProjectDate(value.slice(0, 10))) return "Data inválida";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? historyDate.format(timestamp) : "Data inválida";
}
