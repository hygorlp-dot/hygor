import { describe, expect, it } from "vitest";
import { resolveHolidayObraId } from "./permissions.js";
import { createLaborCostEngine } from "../financeiro/labor-cost-engine.js";
import { calculateContractProjection } from "../dre/calculations.js";
import {
  getAtt, getHolidayPayRule, getPayrollHolidays, getQ, isEmployeeEmployedOnDate, prIsWeekdayIso,
} from "./attendance-engine.js";

// Feriado é pago pela obra do último dia trabalhado antes dele - não pela
// lotação do cadastro. Caso real (outubro/2026): funcionário global lotado
// numa obra de contrato fixo trabalhando numa obra por administração; o
// feriado de 12/10 ia para a obra de lotação e saía da base da taxa.
const FERIADO = "2026-10-12";                                     // segunda-feira
const obras = [
  { id:"adm", name:"Obra por administração", contractType:"admin_only", adminPercentage:15 },
  { id:"fixa", name:"Obra de contrato fixo", contractType:"fixed_labor" },
  { id:"outra", name:"Outra obra", contractType:"admin_only", adminPercentage:10 },
];
const funcionario = { id:"e1", name:"Zé", obra:"fixa", dailyRate:100, active:true };
const quinzena = getQ(2026, 9).q1;                                // 06/10 a 20/10
const motor = () => createLaborCostEngine({
  getPayrollHolidays, isWeekdayIso:prIsWeekdayIso, isEmployeeEmployedOnDate,
  getAttendance:getAtt, getHolidayPayRule,
});
const comPonto = attendance => ({ obras, employees:[funcionario], attendance:{ e1:attendance }, changeLog:[], config:{} });
const diasUteis = obraId => Object.fromEntries(quinzena.filter(d => prIsWeekdayIso(d) && d !== FERIADO).map(d => [d, { status:"P", obraId }]));

describe("obra que paga o feriado", () => {
  it("é a obra do último dia trabalhado antes do feriado, não a lotação", () => {
    const data = comPonto({ "2026-10-09":{ status:"P", obraId:"adm" } });
    expect(resolveHolidayObraId({ data, employee:funcionario, holidayIso:FERIADO })).toBe("adm");
  });

  it("pula fim de semana e dias sem trabalho até achar o último dia trabalhado", () => {
    const data = comPonto({
      "2026-10-07":{ status:"P", obraId:"outra" },
      "2026-10-08":{ status:"M", obraId:"adm" },                   // meio período conta como trabalhado
      "2026-10-09":{ status:"F", obraId:"outra" },                  // falta não é dia trabalhado
    });
    expect(resolveHolidayObraId({ data, employee:funcionario, holidayIso:FERIADO })).toBe("adm");
  });

  it("dia trabalhado sem obra no ponto usa a lotação histórica daquele dia", () => {
    const transferido = { ...funcionario, obra:"adm", obraHistory:[{ date:"2026-10-10", fromObraId:"outra", toObraId:"adm" }] };
    const data = { ...comPonto({ "2026-10-09":"P" }), employees:[transferido] };
    expect(resolveHolidayObraId({ data, employee:transferido, holidayIso:FERIADO })).toBe("outra");
  });

  it("sem dia trabalhado nos 31 dias anteriores, vale a lotação", () => {
    const data = comPonto({ "2026-09-01":{ status:"P", obraId:"adm" } });
    expect(resolveHolidayObraId({ data, employee:funcionario, holidayIso:FERIADO })).toBe("fixa");
  });

  it("ponto lançado no próprio feriado em outra obra não muda: vale a obra do dia anterior", () => {
    // Caso real (H-02, 20/10/2026): presente na H-02 em 09/10 e um "P" lançado
    // em 12/10 com a P1-08 - o feriado é da H-02.
    const data = comPonto({ "2026-10-09":{ status:"P", obraId:"adm" }, [FERIADO]:{ status:"P", obraId:"outra" } });
    expect(resolveHolidayObraId({ data, employee:funcionario, holidayIso:FERIADO })).toBe("adm");
    const custo = obra => motor().calculateCurrentCost(data, obra, quinzena).laborCost;
    expect([custo("adm"), custo("outra")]).toEqual([200, 0]);
  });

  it("mão de obra e taxa de administração da obra incluem o feriado; a lotação não recebe nada", () => {
    const data = comPonto(diasUteis("adm"));
    const adm = motor().calculateCurrentCost(data, "adm", quinzena);
    const fixa = motor().calculateCurrentCost(data, "fixa", quinzena);
    expect(adm.laborCost).toBe(1100);                               // 10 dias + feriado
    expect(fixa.laborCost).toBe(0);
    expect(calculateContractProjection(obras[0], adm.laborCost).revenue).toBeCloseTo(165);
  });

  it("feriado perdido (falta no dia útil anterior) não gera custo em obra nenhuma", () => {
    const ponto = diasUteis("adm");
    ponto["2026-10-09"] = { status:"F", obraId:"adm" };
    const data = comPonto(ponto);
    const total = ["adm", "fixa", "outra"].reduce((s, o) => s + motor().calculateCurrentCost(data, o, quinzena).laborCost, 0);
    expect(total).toBe(900);                                        // 9 dias, feriado perdido
  });

  it("o total do funcionário não muda: o feriado só troca de obra", () => {
    const ponto = { ...diasUteis("adm") };
    ["2026-10-13", "2026-10-14"].forEach(d => { ponto[d] = { status:"P", obraId:"outra" }; });
    const data = comPonto(ponto);
    const porObra = Object.fromEntries(["adm", "fixa", "outra"].map(o => [o, motor().calculateCurrentCost(data, o, quinzena).laborCost]));
    expect(porObra).toEqual({ adm:900, fixa:0, outra:200 });       // feriado (100) com a obra de sexta 09/10
    expect(porObra.adm + porObra.fixa + porObra.outra).toBe(1100);
  });
});
