export function priorityContext(records, workNames, dateOf, dateLabel) {
  const workIds = new Set(records.map(record => String(record.obraId || '')));
  const names = [...workIds].map(id => workNames.get(id)).filter(Boolean);
  const obraId = workIds.size === 1 && names.length === 1 ? [...workIds][0] : '';
  const date = dateOf ? records.map(dateOf).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort()[0] : '';
  return { obraId, names, hasOtherRecords: workIds.size > names.length, date, dateLabel };
}

export function dashboardPriorities(queue) {
  const groups = new Set();
  return queue.filter(item => item.severidade >= 2)
    .sort((a, b) => b.severidade - a.severidade || b.quantidade - a.quantidade)
    .filter(item => {
      const key = ['ponto-hoje', 'rh-ponto'].includes(item.id) ? 'ponto' : item.id;
      if (groups.has(key)) return false;
      groups.add(key);
      return true;
    }).slice(0, 3);
}
