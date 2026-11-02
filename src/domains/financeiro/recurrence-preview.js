const active = item => !['cancelado','cancelada','estornado'].includes(String(item.status || '').toLowerCase());
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const monthIndex = value => /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(String(value || '')) ? Number(value.slice(0,4)) * 12 + Number(value.slice(5,7)) - 1 : null;
const identity = item => JSON.stringify([item.categoria||'outros', norm(item.descricao), norm(item.fornecedor)]);
const snapshot = item => [String(item.id),Number(item.version||0),String(item.competencia||''),String(item.categoria||'outros'),String(item.descricao||''),String(item.fornecedor||''),Number(item.valor||0),String(item.vencimento||''),Boolean(item.recorrente),String(item.status||'ativo'),String(item.recurrenceSeriesId||'')];

export function shiftRecurringDueDate(value, months) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Vencimento inválido na origem.');
  const [year, month, day] = value.split('-').map(Number);
  const source = new Date(Date.UTC(year, month - 1, day));
  if (source.toISOString().slice(0,10) !== value) throw new Error('Vencimento inválido na origem.');
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0,10);
}

export function previewCompanyRecurrences(data, {fromCompetence, toCompetence}) {
  const from = monthIndex(fromCompetence), to = monthIndex(toCompetence);
  if (from === null || to === null || to <= from) return {error:'Escolha uma competência de destino posterior à origem.', rows:[], fingerprint:''};
  const expenses = data.despesasEmpresa || [];
  const targets = expenses.filter(item => item.competencia === toCompetence && active(item));
  const planned = new Set();
  const rows = expenses.filter(item => item.competencia === fromCompetence && item.recorrente && active(item)).map(source => {
    const key = identity(source);
    const series = source.recurrenceSeriesId || source.id;
    const existing = targets.find(item => item.recurrenceSeriesId === series || identity(item) === key);
    let dueDate = '', issue = '';
    try { dueDate = shiftRecurringDueDate(source.vencimento || '', to - from); } catch (error) { issue = error.message; }
    if (!String(source.descricao || '').trim() || !Number.isFinite(Number(source.valor)) || Number(source.valor) <= 0) issue = 'Descrição ou valor inválido na origem.';
    const duplicate = Boolean(existing || planned.has(key));
    planned.add(key);
    return {source, dueDate, series, duplicate, existingId:existing?.id || '', issue, eligible:!duplicate && !issue};
  });
  // The server compares this same plan against its current data before copying.
  const fingerprint = JSON.stringify([fromCompetence,toCompetence,rows.map(row => [snapshot(row.source), row.dueDate, row.existingId, row.duplicate, row.issue]).sort((a,b)=>a[0][0].localeCompare(b[0][0])),targets.map(snapshot).sort((a,b)=>a[0].localeCompare(b[0]))]);
  return {rows, fingerprint, error:''};
}
