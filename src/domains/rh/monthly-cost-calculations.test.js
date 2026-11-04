import { describe,expect,it } from "vitest";
import {
  DEFAULT_MONTHLY_COST_PREMISES,calculateMonthlyCrewCost,calculateMonthlyWorkerCost,
  employeeInss,normalizeMonthlyCostPremises,productiveHoursPerMonth,
} from "./monthly-cost-calculations.js";

// Valores de referência: resultados calculados pela planilha
// Custo_Mensal_Profissional_Servente_Marcell.xlsx com as premissas padrão.
const close=(actual,expected)=>expect(actual).toBeCloseTo(expected,6);

describe("simulador de custo mensal — confere com a planilha",()=>{
  const { professional:p,helper:s,crew:d,indicators }=calculateMonthlyCrewCost();

  it("calcula os encargos mensais sobre a folha (subtotal B)",()=>{
    close(p.cpp,481.36); close(s.cpp,362.12);
    close(p.rat,72.204); close(s.rat,54.318);
    close(p.terc,0); close(s.terc,0);
    close(p.fgts,192.544); close(s.fgts,144.848);
    close(p.B,746.108); close(s.B,561.286); close(d.B,1307.394);
  });

  it("calcula as provisões de 13º, férias e rescisão (subtotal C)",()=>{
    close(p.d13,200.566666666667); close(p.fer,267.422222222222);
    close(p.encProv,145.076555555556); close(s.encProv,109.138944444444);
    close(p.aviso,100.283333333333); close(s.aviso,75.4416666666667);
    close(p.fgtsAviso,8.02266666666667);
    close(p.proj,19.499537037037); close(s.proj,14.669212962963);
    close(p.multa,86.2436666666667); close(s.multa,64.8798333333334);
    close(p.C,827.114648148148); close(s.C,622.226101851852); close(d.C,1449.34075);
  });

  it("calcula os benefícios da CCT (subtotal D)",()=>{
    close(p.cafe,193.16); close(p.almoco,308.88); close(p.cesta,65);
    close(p.vt,75.592); close(s.vt,111.364);
    close(p.ferr,0);
    close(p.D,642.632); close(s.D,678.404); close(d.D,1321.036);
  });

  it("calcula saúde e segurança do trabalho (subtotal E)",()=>{
    close(p.aso,33.3333333333333); close(p.trein,12.5); close(p.unif,27.5);
    close(p.E,145.333333333333); close(d.E,290.666666666667);
  });

  it("fecha o custo total e os indicadores",()=>{
    close(p.total,4767.98798148148); close(s.total,3817.84943518519); close(d.total,8585.83741666667);
    close(indicators.multiplier.professional,1.98104868766889);
    close(indicators.multiplier.helper,2.1086100934415);
    close(indicators.multiplier.crew,2.03581292186339);
    close(indicators.chargesOnSalary.crew,0.653657407407408);
    close(indicators.costPerPaidHour.crew,39.0265337121212);
    close(indicators.productiveHours.professional,160.6);
    close(indicators.productiveHours.crew,321.2);
    close(indicators.costPerProductiveHour.professional,29.6885926617776);
    close(indicators.costPerProductiveHour.helper,23.77241242332);
    close(indicators.costPerProductiveHour.crew,53.4610050850976);
  });

  it("separa o desembolso de caixa das provisões e reconcilia com o custo econômico",()=>{
    close(p.inssRat,553.564); close(s.inssRat,416.438);
    close(p.des,3940.87333333333); close(s.des,3195.62333333333); close(d.des,7136.49666666667);
    close(d.eco,d.total);
  });

  it("estima o contracheque do trabalhador",()=>{
    expect(p.inssEmp).toBe(192.3); expect(s.inssEmp).toBe(138.64);
    expect(p.vtEmp).toBe(144.41); expect(s.vtEmp).toBe(108.64);
    expect(p.taxa).toBe(48.14); expect(s.taxa).toBe(36.21);
    close(p.liq,2021.95); close(s.liq,1527.11);
  });
});

describe("regras de borda do simulador",()=>{
  const P=DEFAULT_MONTHLY_COST_PREMISES;

  it("paga a ajuda de ferramenta só ao profissional que usa ferramenta própria",()=>{
    const premises={ ...P,usaFerr:1 };
    expect(calculateMonthlyWorkerCost(premises,P.salP,{ professional:true }).ferr).toBe(57.94);
    expect(calculateMonthlyWorkerCost(premises,P.salS).ferr).toBe(0);
  });

  it("corta a cesta acima do teto salarial e zera o VT quando o desconto cobre as passagens",()=>{
    const high=calculateMonthlyWorkerCost(P,4500.01);
    expect(high.cesta).toBe(0);
    expect(high.vt).toBe(0);
    expect(high.vtEmp).toBe(220);
    expect(calculateMonthlyWorkerCost(P,4500).cesta).toBe(65);
  });

  it("aplica a tabela progressiva do INSS até o teto",()=>{
    expect(employeeInss(1621,P)).toBe(121.58);
    expect(employeeInss(20000,P)).toBe(employeeInss(P.inss4,P));
  });

  it("limita a taxa assistencial a 2% do maior piso",()=>{
    expect(calculateMonthlyWorkerCost(P,10000).taxa).toBe(48.14);
  });

  it("desconta férias, feriados, folgas e faltas das horas produtivas",()=>{
    expect(productiveHoursPerMonth({ ...P,faltas:0 })).toBeCloseTo((260-22-11-4)*8.8/12,10);
  });

  it("ignora premissas salvas inválidas ou desconhecidas",()=>{
    const premises=normalizeMonthlyCostPremises({ salP:"3000",cpp:"abc",fgts:null,dias:"",extra:7 });
    expect(premises.salP).toBe(3000);
    expect(premises.cpp).toBe(P.cpp);
    expect(premises.fgts).toBe(P.fgts);
    expect(premises.dias).toBe(P.dias);
    expect(premises).not.toHaveProperty("extra");
    expect(normalizeMonthlyCostPremises("lixo")).toEqual({ ...P });
  });
});
