const employedOn = (employee, date) =>
  (!employee?.startDate || date >= employee.startDate) &&
  (!employee?.endDate || date <= employee.endDate);

// Fonte financeira autoritativa de uma quinzena encerrada. O cálculo usa
// somente o arquivo imutável criado pelo servidor, nunca valores do cliente.
export const summarizeArchivedCosts = archive => {
  const snapshots = new Map((archive?.employeesSnapshot || []).map(employee => [String(employee.id), employee]));
  const byDate = {};
  for (const [employeeId, attendance] of Object.entries(archive?.attendance || {})) {
    const employee = snapshots.get(String(employeeId)) || {};
    for (const [date, raw] of Object.entries(attendance || {})) {
      if (!employedOn(employee, date)) continue;
      const record = typeof raw === "string" ? {status: raw} : (raw || {});
      const factor = record.status === "P" ? 1 : record.status === "M" ? 0.5 : 0;
      const workId = String(record.obraId || employee.obra || "");
      if (!factor || !workId) continue;
      const previous = byDate[date]?.[workId] || {laborCost: 0, benefitCost: 0};
      byDate[date] = {
        ...(byDate[date] || {}),
        [workId]: {
          laborCost: previous.laborCost + Number(employee.dailyRate || 0) * factor,
          benefitCost: previous.benefitCost +
            (Number(employee.vtDaily || 0) + Number(employee.vrDaily || 0)) * factor,
        },
      };
    }
  }
  return {byDate};
};

export const normalizeArchivedCosts = summary => {
  const byDate = {};
  for (const [date, works] of Object.entries(summary?.byDate || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const [workId, cost] of Object.entries(works || {})) {
      if (!workId) continue;
      byDate[date] = {
        ...(byDate[date] || {}),
        [String(workId)]: {
          laborCost: Math.max(0, Number(cost?.laborCost || 0)),
          benefitCost: Math.max(0, Number(cost?.benefitCost || 0)),
        },
      };
    }
  }
  return {byDate};
};
