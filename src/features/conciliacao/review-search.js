export const emptyReviewFilters = { work: "", party: "", start: "", end: "", min: "", max: "", status: "" };
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterReviewEntries(entries, data, search, filters) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const work = id => (data.obras || []).find(item => String(item.id) === String(id))?.name || id;
  return entries.filter(item => terms.every(term => normalize(`${item.description} ${item.counterparty} ${item.date} ${work(item.obraId)} ${item.documentNumber || ""}`).includes(term))
    && (!filters.work || String(item.obraId) === filters.work)
    && (!filters.party || item.counterparty === filters.party)
    && (!filters.start || Boolean(item.date && item.date >= filters.start))
    && (!filters.end || Boolean(item.date && item.date <= filters.end))
    && (filters.min === "" || item.remainingCents >= Math.round(Number(filters.min) * 100))
    && (filters.max === "" || item.remainingCents <= Math.round(Number(filters.max) * 100))
    && (!filters.status || (filters.status === "partial" ? item.allocatedCents > 0 : item.allocatedCents === 0)));
}
