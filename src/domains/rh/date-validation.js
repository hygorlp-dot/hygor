// Validação de data compartilhada pelos comandos de RH (funcionário,
// adiantamento, rescisão). Achado de auditoria de 18/08/2026: a validação
// duplicada em cada arquivo só checava o FORMATO (regex), aceitando datas
// com formato correto mas inexistentes no calendário (ex. "2026-02-31",
// "2026-13-01") - o Date nativo do JS "rola" essas datas para o mês/dia
// seguinte em silêncio em vez de rejeitar, então sem essa checagem extra
// o valor inválido passava despercebido para o cálculo.
export const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
