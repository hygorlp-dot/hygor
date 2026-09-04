import {describe,expect,it} from "vitest";
import {
  allocateUnionDueByWork,buildUnionDuePeriodKey,calculatePayrollSettlement,calculateUnionDue,
  isEmployeeExemptForPeriod,normalizeUnionDuesConfig,summarizeUnionDues,toggleUnionDueExemption,UNION_DUE_GROUP,
} from "./union-dues";

const config={enabled:true,frequency:"monthly",monthlyCycle:"2",professionalValue:35,helperValue:20,roleGroups:{pedreiro:"professional",servente:"helper"}};

describe("desconto sindical na folha",()=>{
  it("aplica valores diferentes conforme a função configurada",()=>{
    expect(calculateUnionDue({employee:{role:"Pedreiro"},config,payrollCycle:"2"}).amount).toBe(35);
    expect(calculateUnionDue({employee:{role:"Servente"},config,payrollCycle:"2"}).amount).toBe(20);
  });
  it("não duplica desconto mensal na outra quinzena",()=>expect(calculateUnionDue({employee:{role:"Pedreiro"},config,payrollCycle:"1"}).amount).toBe(0));
  it("não altera competências anteriores à vigência",()=>expect(calculateUnionDue({employee:{role:"Pedreiro"},config:{...config,effectiveFrom:"2026-08-01"},payrollCycle:"2",periodEnd:"2026-07-31"}).amount).toBe(0));
  it("mantém cargo não classificado isento",()=>expect(calculateUnionDue({employee:{role:"Administrativo"},config,payrollCycle:"2"}).group).toBe(UNION_DUE_GROUP.EXEMPT));
  it("não desconta funcionário sem movimento na folha",()=>expect(calculateUnionDue({employee:{role:"Pedreiro"},config,payrollCycle:"2",hasPayrollMovement:false}).amount).toBe(0));
  it("normaliza valores inválidos sem criar desconto negativo",()=>expect(normalizeUnionDuesConfig({...config,helperValue:-10}).helperValue).toBe(0));
  it("consolida o valor a recolher por grupo",()=>expect(summarizeUnionDues([{unionDue:35,unionDueGroup:"professional"},{unionDue:20,unionDueGroup:"helper"}])).toEqual({total:55,professionals:1,helpers:1,professionalTotal:35,helperTotal:20}));
  it("reduz o pagamento líquido pelo desconto sindical",()=>expect(calculatePayrollSettlement({gross:900,benefits:100,advances:200,unionDue:35})).toEqual({netBeforeUnion:800,requestedUnionDue:35,appliedUnionDue:35,netPayable:765}));
  it("não permite desconto maior que o valor disponível ao funcionário",()=>expect(calculatePayrollSettlement({gross:20,unionDue:35})).toEqual({netBeforeUnion:20,requestedUnionDue:35,appliedUnionDue:20,netPayable:0}));
  it("rateia o sindicato entre obras e preserva o total líquido",()=>{
    const rows=allocateUnionDueByWork([{obraId:"a",netObra:600},{obraId:"b",netObra:200}],40);
    expect(rows).toEqual([
      {obraId:"a",netBeforeUnionObra:600,unionDueObra:30,netObra:570},
      {obraId:"b",netBeforeUnionObra:200,unionDueObra:10,netObra:190},
    ]);
    expect(rows.reduce((sum,row)=>sum+row.netObra,0)).toBe(760);
  });
});

describe("isenção pontual por funcionário/quinzena",()=>{
  it("monta a chave de período no mesmo formato do arquivamento de ponto",()=>{
    expect(buildUnionDuePeriodKey(2026,8,"2")).toBe("2026-09-Q2"); // month é 0-based (agosto=8 -> "09")
    expect(buildUnionDuePeriodKey(2026,0,"1")).toBe("2026-01-Q1");
  });

  it("toggleUnionDueExemption liga e desliga sem afetar outras quinzenas/funcionários",()=>{
    let exemptions={};
    exemptions=toggleUnionDueExemption(exemptions,"2026-09-Q2","emp1",true);
    expect(exemptions).toEqual({"2026-09-Q2":["emp1"]});
    exemptions=toggleUnionDueExemption(exemptions,"2026-09-Q2","emp2",true);
    expect(exemptions["2026-09-Q2"]).toEqual(["emp1","emp2"]);
    exemptions=toggleUnionDueExemption(exemptions,"2026-09-Q2","emp1",false);
    expect(exemptions).toEqual({"2026-09-Q2":["emp2"]});
    // desligar o último da quinzena remove a chave inteira, não deixa array vazio
    exemptions=toggleUnionDueExemption(exemptions,"2026-09-Q2","emp2",false);
    expect(exemptions).toEqual({});
  });

  it("ignora chaves de período em formato inválido ao normalizar (defesa contra dado externo malformado)",()=>{
    const normalized=normalizeUnionDuesConfig({...config,exemptionsByPeriod:{"2026-09-Q2":["emp1"],"formato-errado":["emp2"]}});
    expect(normalized.exemptionsByPeriod).toEqual({"2026-09-Q2":["emp1"]});
  });

  it("isEmployeeExemptForPeriod reflete a lista da quinzena, sem período informado nunca isenta",()=>{
    const withExemption={...config,exemptionsByPeriod:{"2026-09-Q2":["emp1"]}};
    expect(isEmployeeExemptForPeriod(withExemption,"emp1","2026-09-Q2")).toBe(true);
    expect(isEmployeeExemptForPeriod(withExemption,"emp1","2026-09-Q1")).toBe(false);
    expect(isEmployeeExemptForPeriod(withExemption,"emp2","2026-09-Q2")).toBe(false);
    expect(isEmployeeExemptForPeriod(withExemption,"emp1","")).toBe(false);
  });

  it("calculateUnionDue zera o desconto só na quinzena isenta, mantendo a classificação do cargo intacta",()=>{
    const comIsencao={...config,exemptionsByPeriod:{"2026-09-Q2":["emp1"]}};
    const naQuinzenaIsenta=calculateUnionDue({employee:{id:"emp1",role:"Pedreiro"},config:comIsencao,payrollCycle:"2",periodKey:"2026-09-Q2"});
    expect(naQuinzenaIsenta).toMatchObject({amount:0,group:UNION_DUE_GROUP.PROFESSIONAL,applied:false,exempted:true});
    // mesma pessoa, mesma quinzena do desconto mensal, mas SEM isenção nesse período específico
    const emOutraQuinzena=calculateUnionDue({employee:{id:"emp1",role:"Pedreiro"},config:comIsencao,payrollCycle:"2",periodKey:"2026-07-Q2"});
    expect(emOutraQuinzena).toMatchObject({amount:35,applied:true,exempted:false});
    // outro funcionário, mesma quinzena isenta - não é afetado
    const outroFuncionario=calculateUnionDue({employee:{id:"emp2",role:"Pedreiro"},config:comIsencao,payrollCycle:"2",periodKey:"2026-09-Q2"});
    expect(outroFuncionario).toMatchObject({amount:35,applied:true,exempted:false});
  });

  it("sem periodKey informado, calculateUnionDue nunca aplica isenção pontual (compatível com chamadas antigas)",()=>{
    const comIsencao={...config,exemptionsByPeriod:{"2026-09-Q2":["emp1"]}};
    expect(calculateUnionDue({employee:{id:"emp1",role:"Pedreiro"},config:comIsencao,payrollCycle:"2"}).amount).toBe(35);
  });
});
