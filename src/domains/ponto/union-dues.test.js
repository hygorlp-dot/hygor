import {describe,expect,it} from "vitest";
import {allocateUnionDueByWork,calculatePayrollSettlement,calculateUnionDue,normalizeUnionDuesConfig,summarizeUnionDues,UNION_DUE_GROUP} from "./union-dues";

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
