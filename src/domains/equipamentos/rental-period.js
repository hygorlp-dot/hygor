// Período e datas da Central operacional de locações. Puro: sem React, sem
// dados de locação - só calendário (UTC, para não depender do fuso do
// navegador) e a resolução dos atalhos de período em janelas [inicio, fim].

// ---------------------------------------------------------------- datas ----
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = n => String(n).padStart(2, "0");
const parseIso = iso => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toIso = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
export const isIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

export const addDays = (iso, amount) => { const d = parseIso(iso); d.setUTCDate(d.getUTCDate() + amount); return toIso(d); };
export const daysBetween = (from, to) => Math.round((parseIso(to) - parseIso(from)) / 86400000);
export const monthOf = iso => String(iso || "").slice(0, 7);
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const monthBounds = ym => {
  const [y, m] = ym.split("-").map(Number);
  return { inicio: `${ym}-01`, fim: toIso(new Date(Date.UTC(y, m, 0))) };
};
export const monthLabel = ym => { const [y, m] = String(ym || "").split("-").map(Number); return MESES[m - 1] ? `${MESES[m - 1]} ${y}` : ""; };
export const formatDate = iso => { if (!isIso(iso)) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };
export const formatDateFull = iso => { if (!isIso(iso)) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
export const listDays = (inicio, fim, limit = 3660) => {
  const out = [];
  if (!isIso(inicio) || !isIso(fim) || fim < inicio) return out;
  for (let cursor = inicio; cursor <= fim && out.length < limit; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
};

// -------------------------------------------------------------- período ----
export const PERIOD_PRESET = Object.freeze({
  TODAY: "hoje", WEEK: "semana", MONTH: "mes", LAST_30: "30d", CUSTOM: "personalizado", ALL: "tudo",
});

// state: { preset, ym?, inicio?, fim? }  ->  janela efetiva [inicio, fim].
// "Este mês" e "Mês anterior" são o mesmo preset MONTH com `ym` diferente -
// é isso que permite navegar com ‹ › sem inventar um segundo modelo.
export const resolveRentalPeriod = (state = {}, { hoje, rentals = [] } = {}) => {
  const preset = state.preset || PERIOD_PRESET.MONTH;
  if (preset === PERIOD_PRESET.TODAY) {
    return { preset, inicio: hoje, fim: hoje, label: `Hoje · ${formatDate(hoje)}`, mensal: false };
  }
  if (preset === PERIOD_PRESET.WEEK) {
    const dow = parseIso(hoje).getUTCDay();
    const inicio = addDays(hoje, -((dow + 6) % 7));
    const fim = addDays(inicio, 6);
    return { preset, inicio, fim, label: `Esta semana · ${formatDate(inicio)} → ${formatDate(fim)}`, mensal: false };
  }
  if (preset === PERIOD_PRESET.LAST_30) {
    return { preset, inicio: addDays(hoje, -29), fim: hoje, label: `Últimos 30 dias · ${formatDate(addDays(hoje, -29))} → ${formatDate(hoje)}`, mensal: false };
  }
  if (preset === PERIOD_PRESET.CUSTOM) {
    let { inicio, fim } = state;
    if (isIso(inicio) && isIso(fim)) {
      if (fim < inicio) [inicio, fim] = [fim, inicio];
      return { preset, inicio, fim, label: `${formatDate(inicio)} → ${formatDate(fim)}`, mensal: false };
    }
    // Datas incompletas: cai no mês atual em vez de uma janela vazia.
    const bounds = monthBounds(monthOf(hoje));
    return { preset, ...bounds, label: `${formatDate(bounds.inicio)} → ${formatDate(bounds.fim)}`, mensal: false, incompleto: true };
  }
  if (preset === PERIOD_PRESET.ALL) {
    const starts = rentals.map(item => item.inicio).filter(isIso).sort();
    const ends = rentals.map(item => item.fim).filter(isIso).sort();
    const inicio = starts[0] || hoje;
    const fim = [hoje, ends.at(-1)].filter(Boolean).sort().at(-1);
    return { preset, inicio, fim, label: "Todo o período", mensal: false };
  }
  const ym = /^\d{4}-\d{2}$/.test(String(state.ym || "")) ? state.ym : monthOf(hoje);
  return { preset: PERIOD_PRESET.MONTH, ym, ...monthBounds(ym), label: monthLabel(ym), mensal: true };
};

// Valor exibido no seletor: os atalhos "Este mês"/"Mês anterior" são o mesmo
// preset MONTH apontando para um ym; um mês navegado além disso vira "mes:YYYY-MM".
export const periodSelectValue = (state = {}, hoje) => {
  const preset = state.preset || PERIOD_PRESET.MONTH;
  if (preset !== PERIOD_PRESET.MONTH) return preset;
  const ym = state.ym || monthOf(hoje);
  if (ym === monthOf(hoje)) return "mes";
  if (ym === shiftMonth(monthOf(hoje), -1)) return "mes_anterior";
  return `mes:${ym}`;
};

export const periodSelectOptions = (state = {}, hoje) => {
  const options = [
    { value: PERIOD_PRESET.TODAY, label: "Hoje" },
    { value: PERIOD_PRESET.WEEK, label: "Esta semana" },
    { value: "mes", label: "Este mês" },
    { value: "mes_anterior", label: "Mês anterior" },
    { value: PERIOD_PRESET.LAST_30, label: "Últimos 30 dias" },
    { value: PERIOD_PRESET.CUSTOM, label: "Personalizado" },
    { value: PERIOD_PRESET.ALL, label: "Todo o período" },
  ];
  const current = periodSelectValue(state, hoje);
  if (current.startsWith("mes:")) options.splice(4, 0, { value: current, label: monthLabel(current.slice(4)) });
  return options;
};

export const periodStateFromSelect = (value, hoje, previous = {}) => {
  if (value === "mes") return { preset: PERIOD_PRESET.MONTH, ym: monthOf(hoje) };
  if (value === "mes_anterior") return { preset: PERIOD_PRESET.MONTH, ym: shiftMonth(monthOf(hoje), -1) };
  if (String(value).startsWith("mes:")) return { preset: PERIOD_PRESET.MONTH, ym: String(value).slice(4) };
  if (value === PERIOD_PRESET.CUSTOM) {
    const base = resolveRentalPeriod(previous, { hoje });
    return { preset: PERIOD_PRESET.CUSTOM, inicio: previous.inicio || base.inicio, fim: previous.fim || base.fim };
  }
  return { preset: value };
};

