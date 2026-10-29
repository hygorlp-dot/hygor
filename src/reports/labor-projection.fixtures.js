// Dados inteiramente sintéticos. Este snapshot testa a apresentação; as regras
// de calendário, frequência e custo são exercitadas no domínio e no servidor.
export function laborProjectionFixture() {
  const intervals = [
    { key: "h1", startDate: "2026-07-21", endDate: "2026-08-20", expectedDays: 10, eligibleDays: 10, observedDays: 10, missingDays: 0, excludedDays: 0, absenceDays: 2, halfDays: 0, coverage: 1, representedIntervals: 1 },
    { key: "h2", startDate: "2026-08-21", endDate: "2026-09-20", expectedDays: 20, eligibleDays: 20, observedDays: 20, missingDays: 0, excludedDays: 0, absenceDays: 1, halfDays: 0, coverage: 1, representedIntervals: 1 },
    { key: "h3", startDate: "2026-09-21", endDate: "2026-10-20", expectedDays: 30, eligibleDays: 30, observedDays: 30, missingDays: 0, excludedDays: 0, absenceDays: 3, halfDays: 0, coverage: 1, representedIntervals: 1 },
  ];
  const history = { startDate: "2026-07-21", endDate: "2026-10-20", intervals, expectedDays: 60, eligibleDays: 60, observedDays: 60, missingDays: 0, excludedDays: 0, absenceDays: 6, halfDays: 0, coverage: 1, representedIntervals: 3 };
  const totals = { employeeCount: 1, actualCost: 900, confirmedFutureCost: 0, estimatedCost: 540, pendingCost: 0, projectedCost: 1440, fullAttendanceReserve: 1500, futureDays: 4, pendingDays: 0, unpricedDays: 0, partial: false, provisional: false };
  const rate = { value: 0.1, source: "individual", numerator: 6, denominator: 60, coverage: 1, limitedClassification: false, reason: "Amostra individual suficiente.", halfDayProbability: 0, presentProbability: 0.9, representedIntervals: 3 };
  const days = ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28"].map(day => ({ date: day, employeeId: "person-a", obraId: "work-a", groupId: "work:work-a", component: "daily", partition: "actual", status: "P", source: { kind: "live" }, mode: "daily", laborCost: 140, chargesCost: 20, benefitCost: 10, totalCost: 150, reserveCost: 150, issues: [], assumptions: [] }));
  days.push(...["2026-10-30", "2026-11-03", "2026-11-04", "2026-11-05"].map(day => ({ date: day, employeeId: "person-a", obraId: "work-a", groupId: "work:work-a", component: "daily", partition: "estimated", status: null, source: { kind: "simulated" }, mode: "daily", laborCost: 126, chargesCost: 18, benefitCost: 9, totalCost: 135, reserveCost: 150, issues: [], assumptions: ["Estimativa pela referência individual."] })));
  return {
    methodologyVersion: "labor-projection-v1", generatedAt: "2026-10-29T15:30:00.000Z", asOf: "2026-10-29", timeZone: "America/Bahia", sourceVersion: "snapshot-sintetico-v7",
    policy: { minimumObservedDays: 20, minimumCoverage: 0.8 },
    period: { key: "2026-10-Q2", startDate: "2026-10-21", endDate: "2026-11-05", year: 2026, monthIndex: 9, fortnight: 2, paymentDate: "2026-11-06", basePaymentDate: "2026-11-06" },
    history, totals,
    groups: [{ id: "work:work-a", kind: "work", obraId: "work-a", name: "Obra Sintética Alameda", ...totals, history, rate: { ...rate, source: "aggregate" } }],
    people: [{ id: "person-a", name: "Pessoa Sintética Alfa", role: "Função sintética", workArea: "campo", mode: "daily", ...totals, rate, history, days }],
    issues: [], assumptions: ["Valores e pessoas exclusivamente sintéticos para validação."],
    filters: { area: "all", obraId: "", employeeId: "", mode: "", role: "", onlyIssues: false },
    permissions: { canViewPeople: true },
    options: { works: [{ id: "work-a", name: "Obra Sintética Alameda" }, { id: "work-b", name: "Obra Sintética Horizonte" }], modes: ["daily", "clt"], roles: ["Função sintética"], employees: [{ id: "person-a", name: "Pessoa Sintética Alfa" }] },
    cash: { available: true, partial: false, projectedNet: 1200, remainingToPay: 900, knownNetAmount: 1200, knownRemainingToPay: 900, paidAmount: 300, existingObligations: 1200, advancesApplied: 100, unionWithheldAmount: 0, withheldTransfer: 0, responsibilities: [{ id: "company", payer: "company", label: "Construtora", obraId: null, projectedNet: 1200, paidAmount: 300, remainingToPay: 900, partial: false }], issues: [] },
  };
}
