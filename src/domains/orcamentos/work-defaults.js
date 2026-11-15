const text = value => value == null ? '' : String(value);

function defaults(work) {
  return {
    cliente: text(work?.cliente || work?.client),
    local: text(work?.address),
    areaM2: text(work?.areaM2),
  };
}

// Only inherit from the exact work selected by the operator. Explicit edits survive.
export function budgetWorkDefaults(form, workId, works = []) {
  const previous = defaults(works.find(work => work.id === form.obraId));
  const next = defaults(works.find(work => work.id === workId));
  const result = {...form, obraId: workId};
  for (const field of Object.keys(next)) {
    if (!text(form[field]).trim() || text(form[field]) === previous[field]) {
      result[field] = next[field];
    }
  }
  return result;
}
