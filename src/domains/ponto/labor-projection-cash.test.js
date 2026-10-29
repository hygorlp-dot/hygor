import { describe, expect, it } from "vitest";
import { buildLaborProjectionCash } from "./labor-projection-cash.js";
import { buildFinancialLedger } from "../financeiro/ledger.js";

const period = { key: "2026-10-Q2", startDate: "2026-10-21", endDate: "2026-11-05", fortnight: 2 };
const day = (changes = {}) => ({ date: "2026-10-22", employeeId: "e1", obraId: "w1", groupId: "work:w1",
  mode: "daily", status: "P", partition: "actual", laborCost: 1000, chargesCost: 0,
  benefitCost: 0, totalCost: 1000, reserveCost: 1000, workedDaysWeight: 1, ...changes });
const person = days => ({ id: "e1", name: "Pessoa sintética", days: days || [day()] });
const report = (days, changes = {}) => ({ period, asOf: "2026-10-29", filters: {},
  totals: { projectedCost: 1000 }, people: [person(days)], ...changes });
const data = (changes = {}) => ({ employees: [{ id: "e1", name: "Pessoa sintética", role: "Pedreiro" }],
  obras: [{ id: "w1", name: "Obra A", contractType: "empreitada" }, { id: "w2", name: "Obra B", contractType: "administracao" }],
  config: {}, ...changes });
const title = (changes = {}) => ({ id: "title1", closingId: "close1", employeeId: "e1", ...period,
  periodKey: period.key, liquido: 800, adiantamentos: 100, descontos: 0,
  rateiosPorObra: [{ obraId: "w1", valor: 800 }], liquidacoes: [], ...changes });

describe("caixa da projeção de mão de obra", () => {
  it("separa encargos do líquido e aplica só a parcela do adiantamento neste ciclo", () => {
    const source = data({ advances: [{ id: "a1", empId: "e1", amount: 300, installments: [
      { dueDate: "2026-10-20", amount: 100 }, { dueDate: "2026-11-05", amount: 100 },
      { dueDate: "2026-11-20", amount: 100 },
    ] }] });
    const projection = report([day({ laborCost: 1100, chargesCost: 100, benefitCost: 50, totalCost: 1150 })]);
    const before = structuredClone({ source, projection });
    const cash = buildLaborProjectionCash(source, projection);
    expect(cash).toMatchObject({ projectedNet: 950, remainingToPay: 950, advancesApplied: 100, paidAmount: 0 });
    expect({ source, projection }).toEqual(before);
  });

  it("título fechado substitui a previsão e não abate o adiantamento uma segunda vez", () => {
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title({ liquidacoes: [
      { id: "l1", transacaoId: "tx1", data: "2026-10-28", valor: 300 },
      { id: "l2", data: "2026-10-28", valor: 200, status: "estornado" },
      { id: "l3", data: "2026-11-03", valor: 100 },
    ] })], advances: [{ empId: "e1", date: "2026-10-22", amount: 100 }] }), report());
    expect(cash).toMatchObject({ projectedNet: 800, existingObligations: 800, paidAmount: 300,
      remainingToPay: 500, advancesApplied: 100, partial: false });
  });

  it("deduplica liquidação e pagamento que apontam para a mesma transação", () => {
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title({ liquidacoes: [
      { id: "l1", transacaoId: "tx1", data: "2026-10-28", valor: 300 },
      { id: "l2", transacaoId: "tx1", data: "2026-10-28", valor: 300 },
    ] })], pagamentosFolha: [{ id: "p1", employeeId: "e1", periodKey: period.key,
      transacaoId: "tx1", data: "2026-10-28", valor: 300 }] }), report());
    expect(cash.paidAmount).toBe(300);
    expect(cash.remainingToPay).toBe(500);
    expect(cash.issues.some(issue => issue.code === "LABOR_PAYMENT_DUPLICATED")).toBe(true);
  });

  it("deduplica o espelho do pagamento legado registrado no próprio título", () => {
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title({ valorPago: 100,
      dataPagamento: "2026-10-28", transacaoId: "legacy-tx" })], pagamentosFolha: [
      { id: "mirror", employeeId: "e1", payrollTitleId: "title1", periodKey: period.key,
        transacaoId: "legacy-tx", data: "2026-10-28", valor: 100 },
    ] }), report());
    expect(cash).toMatchObject({ projectedNet: 800, paidAmount: 100, remainingToPay: 700 });
  });

  it("rateia cada liquidação em centavos com o mesmo resultado do razão", () => {
    const days = [1, 2, 3].map(index => day({ obraId: `w${index}`, groupId: `work:w${index}`, laborCost: 1, totalCost: 1 }));
    const source = data({ titulosFolha: [title({ liquido: 3, adiantamentos: 0,
      rateiosPorObra: [1, 2, 3].map(index => ({ obraId: `w${index}`, valor: 1 })),
      liquidacoes: [{ id: "cent1", data: "2026-10-28", valor: 0.01 },
        { id: "cent2", data: "2026-10-29", valor: 0.01 }] })] });
    const cash = buildLaborProjectionCash(source, report(days));
    const ledger = buildFinancialLedger(source);
    for (const row of cash.responsibilities) {
      const paid = ledger.events.filter(event => event.effect === "cash_out" && event.obraId === row.obraId)
        .reduce((total, event) => total + event.amountCents, 0) / 100;
      expect(row.paidAmount).toBe(paid);
    }
    expect(cash.responsibilities.find(row => row.obraId === "w3").paidAmount).toBe(0.02);
  });

  it("vincula pagamento por ID e ciclo, ignorando nome/valor ou ciclo anterior", () => {
    const cash = buildLaborProjectionCash(data({ pagamentosFolha: [
      { id: "other", employeeId: "e2", name: "Pessoa sintética", periodKey: period.key, valor: 1000, data: "2026-10-22" },
      { id: "past", employeeId: "e1", periodKey: "2026-10-Q1", valor: 1000, data: "2026-10-22" },
      { id: "reversed", employeeId: "e1", periodKey: period.key, valor: 200, data: "2026-10-22", status: "reversed" },
      { id: "valid", employeeId: "e1", periodKey: period.key, valor: 250, data: "2026-10-22" },
    ] }), report());
    expect(cash).toMatchObject({ projectedNet: 1000, paidAmount: 250, remainingToPay: 750 });
  });

  it("pagamento legado sem ciclo deixa o saldo indisponível, sem inferência por data", () => {
    const cash = buildLaborProjectionCash(data({ pagamentosFolha: [{ id: "legacy", employeeId: "e1",
      data: "2026-10-22", valor: 1000, obraId: "w1" }] }), report());
    expect(cash).toMatchObject({ projectedNet: 1000, paidAmount: 0, remainingToPay: null,
      knownRemainingToPay: 0, partial: true });
    expect(cash.issues.some(issue => issue.code === "LABOR_PAYMENT_PERIOD_UNLINKED")).toBe(true);
  });

  it("não trata salário CLT de competência como líquido, mas aceita título do ciclo", () => {
    const projection = report([day({ mode: "clt" })]);
    expect(buildLaborProjectionCash(data(), projection)).toMatchObject({ projectedNet: null, remainingToPay: null, partial: true });
    expect(buildLaborProjectionCash(data({ titulosFolha: [title()] }), projection)).toMatchObject({ projectedNet: 800, remainingToPay: 800 });
  });

  it("título de diarista não completa o líquido CLT após mudança de modalidade no ciclo", () => {
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title()] }),
      report([day(), day({ date: "2026-10-23", mode: "clt" })]));
    expect(cash).toMatchObject({ projectedNet: null, remainingToPay: null, knownNetAmount: 800,
      knownRemainingToPay: 800, existingObligations: 800, partial: true });
  });

  it("rateia adiantamento e sindicato pela pessoa inteira antes do filtro de obra", () => {
    const days = [day({ laborCost: 600, totalCost: 600, workedDaysWeight: 6 }),
      day({ obraId: "w2", groupId: "work:w2", laborCost: 400, totalCost: 400, workedDaysWeight: 4 })];
    const source = data({ advances: [{ empId: "e1", date: "2026-10-22", amount: 200 }],
      config: { unionDues: { enabled: true, frequency: "every_payroll", professionalValue: 30,
        roleGroups: { pedreiro: "professional" } } } });
    const all = buildLaborProjectionCash(source, report(days));
    const first = buildLaborProjectionCash(source, report([days[0]], { _cashBasis: { people: [person(days)] } }));
    const second = buildLaborProjectionCash(source, report([days[1]], { _cashBasis: { people: [person(days)] } }));
    expect(all).toMatchObject({ projectedNet: 770, advancesApplied: 200, unionWithheldAmount: 30, withheldTransfer: null });
    expect(first).toMatchObject({ projectedNet: 462, advancesApplied: 120, unionWithheldAmount: 18 });
    expect(second).toMatchObject({ projectedNet: 308, advancesApplied: 80, unionWithheldAmount: 12 });
    expect(first.projectedNet + second.projectedNet).toBe(all.projectedNet);
    expect(second.responsibilities[0]).toMatchObject({ payer: "obra_administracao", obraId: "w2", projectedNet: 308 });
    expect(first.responsibilities[0].payer).toBe("construtora");
  });

  it("título multiobra e pagamento parcial conservam centavos no recorte", () => {
    const days = [day({ laborCost: 1, totalCost: 1 }), day({ obraId: "w2", groupId: "work:w2", laborCost: 2, totalCost: 2 })];
    const source = data({ titulosFolha: [title({ liquido: 1.01, rateiosPorObra: [
      { obraId: "w1", valor: 0.34 }, { obraId: "w2", valor: 0.67 },
    ], liquidacoes: [{ id: "one", data: "2026-10-22", valor: 0.5 }] })] });
    const all = buildLaborProjectionCash(source, report(days));
    const first = buildLaborProjectionCash(source, report([days[0]], { _cashBasis: { people: [person(days)] } }));
    const second = buildLaborProjectionCash(source, report([days[1]], { _cashBasis: { people: [person(days)] } }));
    expect(all).toMatchObject({ projectedNet: 1.01, paidAmount: 0.5, remainingToPay: 0.51 });
    expect(first).toMatchObject({ projectedNet: 0.34, paidAmount: 0.17, remainingToPay: 0.17 });
    expect(second).toMatchObject({ projectedNet: 0.67, paidAmount: 0.33, remainingToPay: 0.34 });
  });

  it("cancelamento reabre a previsão e exclui parcelas de adiantamento canceladas", () => {
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title({ status: "cancelado" })],
      advances: [{ empId: "e1", installments: [{ dueDate: "2026-11-05", amount: 300, status: "cancelada" }] }] }), report());
    expect(cash).toMatchObject({ projectedNet: 1000, existingObligations: 0, advancesApplied: 0 });
  });

  it("títulos duplicados ou sem rateio seguro não viram dupla obrigação", () => {
    const duplicate = buildLaborProjectionCash(data({ titulosFolha: [title(), title({ id: "title2" })] }), report());
    expect(duplicate).toMatchObject({ projectedNet: null, existingObligations: 0, partial: true });
    const unallocated = buildLaborProjectionCash(data({ titulosFolha: [title({ rateiosPorObra: [{ obraId: "w2", valor: 800 }] })] }), report());
    expect(unallocated.projectedNet).toBeNull();
    expect(unallocated.issues[0].code).toBe("LABOR_TITLE_ALLOCATION_MISSING");
  });

  it("não reassocia título sem rateio à obra atual nem perde o pagamento como zero", () => {
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title({ rateiosPorObra: [],
      liquidacoes: [{ id: "paid", valor: 300, data: "2026-10-22" }] })] }), report());
    expect(cash).toMatchObject({ projectedNet: null, remainingToPay: null, partial: true });
    expect(cash.issues[0].code).toBe("LABOR_TITLE_ALLOCATION_MISSING");
  });

  it("título sem pessoa projetável impede caixa completo zerado sem revelar outra obra", () => {
    const source = data({ titulosFolha: [title()] });
    const empty = report([], { people: [] });
    expect(buildLaborProjectionCash(source, empty)).toMatchObject({ projectedNet: null, remainingToPay: null, partial: true });
    expect(buildLaborProjectionCash(source, empty, { access: { allowedWorkIds: ["w2"] } }))
      .toMatchObject({ projectedNet: 0, remainingToPay: 0, partial: false, issues: [] });
  });

  it("não publica saldo completo com liquidação sem data nem fonte parcial", () => {
    const incompletePayment = buildLaborProjectionCash(data({ titulosFolha: [title({ valorPago: 100 })] }), report());
    expect(incompletePayment).toMatchObject({ projectedNet: 800, remainingToPay: null, paidAmount: 0 });
    const partial = buildLaborProjectionCash(data(), report([day({ totalCost: null, laborCost: null })]));
    expect(partial).toMatchObject({ projectedNet: null, remainingToPay: null, knownNetAmount: 0 });
  });

  it("mostra total líquido parcial conhecido sem esconder pessoa sem base", () => {
    const projection = report();
    projection.people.push({ id: "e2", days: [day({ employeeId: "e2", mode: "clt" })] });
    const cash = buildLaborProjectionCash(data(), projection);
    expect(cash).toMatchObject({ projectedNet: null, remainingToPay: null, knownNetAmount: 1000, knownRemainingToPay: 1000 });
  });

  it("não apresenta líquido da quinzena inteira como líquido de alguns dias filtrados", () => {
    const days = [day(), day({ date: "2026-10-23" })];
    const cash = buildLaborProjectionCash(data(), report([days[0]], { filters: { onlyIssues: true },
      _cashBasis: { people: [person(days)] } }));
    expect(cash).toMatchObject({ projectedNet: null, remainingToPay: null, partial: true });
    expect(cash.issues[0].code).toBe("LABOR_CASH_FILTER_PARTIAL");
  });

  it("não inventa rateio de descontos que o título fechado não armazenou", () => {
    const days = [day(), day({ obraId: "w2", groupId: "work:w2" })];
    const cash = buildLaborProjectionCash(data({ titulosFolha: [title({ liquido: 800, adiantamentos: 100,
      descontos: 30, rateiosPorObra: [{ obraId: "w1", valor: 300 }, { obraId: "w2", valor: 500 }] })] }),
    report([days[0]], { _cashBasis: { people: [person(days)] } }));
    expect(cash).toMatchObject({ projectedNet: 300, remainingToPay: 300, advancesApplied: null,
      unionWithheldAmount: null, withheldTransfer: null, partial: true });
  });
});
