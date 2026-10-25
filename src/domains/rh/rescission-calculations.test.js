import { describe, expect, it } from "vitest";
import { calculateRescission, suggestedRescissionMonthlyBase } from "./rescission-calculations.js";

const form = overrides => ({
  admissao:"2024-01-10", demissao:"2024-07-15", valorMensal:3000,
  diasNoMes:15, tipo:"sem_justa_causa", incluirSaldo:true, incluir13:true,
  incluirFerias:true, incluirAviso:false, descAdiantamento:0, descOutros:0,
  ...overrides,
});

describe("calculateRescission - avos de 13º e férias", () => {
  it("não passa de 12 avos e distingue os dois períodos aquisitivos para tenure de 18 meses", () => {
    // Admitido 2024-01-10, demitido 2025-07-15: 18 meses e 5 dias de casa.
    // Achado de bug de 18/08/2026: a fórmula antiga usava o total de meses
    // desde a admissão como avos de 13º E de férias, sem limite de 12 -
    // este funcionário teria avos13=avosFerias=18, quando o correto é dois
    // números diferentes, cada um dentro do período aquisitivo em aberto.
    const result = calculateRescission(form({ admissao:"2024-01-10", demissao:"2025-07-15" }));
    expect(result.totalMeses).toBe(18); // tempo de casa continua correto (informativo)
    // Janeiro a junho têm mês integral; julho tem 15 dias inclusivos.
    expect(result.avos13).toBe(7);
    expect(result.dec13).toBe(1750);
    // Férias: do aniversário de admissão mais recente (2025-01-10, início
    // do 2º período aquisitivo) até 2025-07-15 = 6 meses e 5 dias -> 6 avos.
    expect(result.avosFerias).toBe(6);
    expect(result.avos13).toBeLessThanOrEqual(12);
    expect(result.avosFerias).toBeLessThanOrEqual(12);
  });

  it("mantém 13º e férias corretos para tenure de 24 meses (exatamente 2 anos)", () => {
    // Exatamente 2 períodos aquisitivos completos de férias (24 meses, 0
    // dias) - a fração do 3º período em aberto é 0 avos (não modela férias
    // vencidas dos períodos completos anteriores, decisão de produto).
    const result = calculateRescission(form({ admissao:"2023-03-05", demissao:"2025-03-05" }));
    expect(result.totalMeses).toBe(24);
    // 13º: do início do ano civil (2025-01-01) até 2025-03-05 = 2 meses e 4 dias -> 2 avos.
    expect(result.avos13).toBe(2);
    // Férias: aniversário de admissão em 2025 é exatamente a data de
    // demissão -> 0 meses no período em aberto.
    expect(result.avosFerias).toBe(0);
  });

  it("respeita o limite de 12 avos para tenure de 36+ meses", () => {
    // Demitido quase no fim do ano civil e quase no fim do período
    // aquisitivo de férias - os dois avos devem ficar em 12, nunca acima.
    const result = calculateRescission(form({ admissao:"2021-01-01", demissao:"2024-12-20" }));
    expect(result.totalMeses).toBe(47);
    expect(result.avos13).toBe(12); // ano civil 2024 quase inteiro trabalhado
    expect(result.avosFerias).toBe(12); // período aquisitivo aberto quase completo
    expect(result.avos13).toBeLessThanOrEqual(12);
    expect(result.avosFerias).toBeLessThanOrEqual(12);
  });

  it("calcula 13º e férias com a mesma base para tenure de 13 meses (dentro do 2º período)", () => {
    const result = calculateRescission(form({ admissao:"2024-06-01", demissao:"2025-07-10" }));
    expect(result.totalMeses).toBe(13);
    // 13º: do início do ano civil 2025 (2025-01-01, posterior à admissão)
    // até 2025-07-10 = 6 meses e 9 dias -> 6 avos.
    expect(result.avos13).toBe(6);
    // Férias: aniversário de admissão em 2025 é 2025-06-01, até 2025-07-10
    // = 1 mês e 9 dias -> 1 avo.
    expect(result.avosFerias).toBe(1);
  });

  it("13º do ano de admissão conta a partir da admissão, não de 1º de janeiro, quando contratado durante o ano", () => {
    const result = calculateRescission(form({ admissao:"2025-09-01", demissao:"2025-12-20" }));
    // Admitido e demitido no mesmo ano civil: 13º conta da admissão, não de
    // 1º de janeiro (o funcionário não trabalhou os meses anteriores).
    expect(result.avos13).toBe(4); // set->dez = 3 meses e 19 dias -> 4 avos
    expect(result.avosFerias).toBe(4); // primeiro período aquisitivo = mesma janela
  });

  it("não altera o modo acordo_interno (valor fixo x tempo ativo)", () => {
    const result = calculateRescission(form({
      admissao:"2023-01-01", demissao:"2024-07-15", tipo:"acordo_interno", valorFixoAcordo:500,
    }));
    expect(result.isAcordoInterno).toBe(true);
    expect(result.avos13).toBe(0);
    expect(result.avosFerias).toBe(0);
    expect(result.totalMeses).toBe(18);
  });
});


describe("13º por mês civil, com dias inclusivos",()=>{
  it.each([
    ["2025-01-01","2025-01-14",0],
    ["2025-01-01","2025-01-15",1],
    ["2025-01-17","2025-01-31",1],
    ["2025-01-18","2025-01-31",0],
    ["2025-01-20","2025-02-10",0],
    ["2024-02-15","2024-02-29",1],
    ["2024-02-16","2024-02-29",0],
    ["2023-05-01","2025-12-15",12],
    ["2025-09-16","2025-12-14",3],
  ])("%s a %s corresponde a %i avos",(admissao,demissao,expected)=>{
    const result=calculateRescission(form({admissao,demissao}));
    expect(result.avos13).toBe(expected);expect(result.dec13).toBe(250*expected);
  });
  it("rejeita data impossível em vez de mudar o mês silenciosamente",()=>{
    expect(calculateRescission(form({admissao:"2025-02-30"}))).toBeNull();
  });
});

describe("base mensal sugerida para rescisão",()=>{
  it("usa salário CLT contratual com centavos e respeita modalidade na data",()=>{
    const employee={startDate:"2026-01-01",dailyRate:150,monthlySalary:2406.8,remunerationMode:"clt",remunerationEffectiveFrom:"2026-08-01"};
    expect(suggestedRescissionMonthlyBase(employee,"2026-09-01")).toBe("2406.8");
    expect(suggestedRescissionMonthlyBase(employee,"2026-07-31")).toBe("");
  });
  it("reaproveita salário declarado no perfil, nunca diária vezes 26",()=>{
    expect(suggestedRescissionMonthlyBase({startDate:"2026-01-01",remunerationMode:"clt",monthlySalary:0,dailyRate:100,cltPayroll:{profile:{salary:3000}}},"2026-09-01")).toBe("3000");
    expect(suggestedRescissionMonthlyBase({startDate:"2026-01-01",dailyRate:100,monthlySalary:3000},"2026-09-01")).toBe("");
    expect(suggestedRescissionMonthlyBase({startDate:"2026-01-01",remunerationMode:"clt",dailyRate:100},"2026-09-01")).toBe("");
  });
  it('respeita salário vigente no desligamento, sem usar reajuste futuro',()=>{
    const employee={startDate:'2026-01-01',remunerationMode:'clt',monthlySalary:3000,remunerationValuesHistory:[{date:'2026-01-01',monthlySalary:2406.8},{date:'2026-10-01',monthlySalary:3000}]};
    expect(suggestedRescissionMonthlyBase(employee,'2026-09-30')).toBe('2406.8');
    expect(suggestedRescissionMonthlyBase(employee,'2026-10-01')).toBe('3000');
  });
});
