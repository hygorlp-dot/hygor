import { describe,expect,it } from "vitest";
import { calculateCltPayslip,newCltDraft,progressiveInss2026,monthlyIrrf2026 } from "./clt-payslip.js";
import { cltPayslipHtml,cltAdvanceHtml } from "./clt-report.js";
const draft=overrides=>({...newCltDraft("2026-09"),salary:2406.80,workedDays:22,confirmed:true,...overrides});
describe("holerite CLT mensal · CCT Caruaru",()=>{
  it("aplica INSS progressivo, teto e IRRF 2026 com redução",()=>{
    expect(progressiveInss2026(1621)).toBe(121.58);
    expect(progressiveInss2026(2406.80)).toBe(192.30);
    expect(progressiveInss2026(10000)).toBe(progressiveInss2026(8475.55));
    expect(monthlyIrrf2026(5000,0).amount).toBe(0);
    expect(monthlyIrrf2026(6000,0).amount).toBe(394.54);
    expect(monthlyIrrf2026(8000,1000).amount).toBe(1016.27);
  });
  it("discrimina proventos, descontos e FGTS sem descontá-lo do empregado",()=>{
    const result=calculateCltPayslip(draft());
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({gross:2406.80,inss:192.30,irrf:0,fgts:192.54,net:2214.50});
    expect(result.rows.some(r=>r.label==="FGTS")).toBe(false);
  });
  it("calcula extras 70/100, reflexo em DSR, faltas, VT e sindicato opt-in",()=>{
    const result=calculateCltPayslip(draft({overtimeHours:10,extraordinaryHours:2,dsrWorkingDays:25,dsrRestDays:5,transportCost:50,transportDays:30,unionAuthorized:true}));
    expect(result.rows.find(r=>r.code==="010").amount).toBe(185.98);
    expect(result.rows.find(r=>r.code==="011").amount).toBe(43.76);
    expect(result.rows.find(r=>r.code==="012").amount).toBe(45.95);
    expect(result.rows.find(r=>r.code==="110").amount).toBe(50);
    expect(result.rows.find(r=>r.code==="120").amount).toBe(48.14);
    expect(calculateCltPayslip(draft()).rows.some(r=>r.code==="120")).toBe(false);
  });
  it("não converte diária em salário e bloqueia piso/vigência/ano desconhecido",()=>{
    expect(newCltDraft("2026-09",{dailyRate:150}).salary).toBe("");
    expect(calculateCltPayslip(draft({salary:1000})).errors.join(" ")).toMatch(/piso/);
    expect(calculateCltPayslip(draft({competence:"2027-09"})).errors.join(" ")).toMatch(/vigência/);
    expect(calculateCltPayslip(draft({paymentDate:"2027-01-05"})).errors.join(" ")).toMatch(/2026/);
  });
  it("limita VT ao custo e à base salarial do período, sem confundir dias de viagem",()=>{
    const result=calculateCltPayslip(draft({salary:3000,days:15,workedDays:11,transportCost:300,transportDays:30}));
    expect(result.rows.find(r=>r.code==="110").amount).toBe(90);
    expect(calculateCltPayslip(draft({transportCost:20})).rows.find(r=>r.code==="110").amount).toBe(20);
  });
  it("exige apuração contábil quando adiantamento e saldo caem em meses diferentes",()=>{
    const advances=[{id:"a",amount:600,date:"2026-09-20"}];
    expect(calculateCltPayslip(draft({advances})).errors.join(" ")).toMatch(/regime de caixa/);
    const result=calculateCltPayslip(draft({advances,fiscalMode:"manual",manualInss:192.3,manualIrrf:0,manualIrrfBase:1799.6,manualReason:"Contador — memória 2026/09"}));
    expect(result.errors).toEqual([]);expect(result.net).toBe(1614.5);
  });
  it("separa informativos, valida cesta e não esconde líquido negativo",()=>{
    expect(calculateCltPayslip(draft({basketEligible:true,absenceDays:1})).errors.join(" ")).toMatch(/cesta/);
    expect(calculateCltPayslip(draft({custom:[{label:"Ticket",amount:300,kind:"info",inss:true}]})).gross).toBe(2406.8);
    expect(calculateCltPayslip(draft({custom:[{label:"Desconto",amount:9000,kind:"deduction"}]})).errors.join(" ")).toMatch(/excedem/);
  });
  it("exporta identidade, rubricas e bases com escape e sem declarar pagamento",()=>{
    const d=draft({notes:'<script>alert(1)</script>'}),result=calculateCltPayslip(d);
    const args={company:{companyName:"Empresa & Cia",cnpj:"12"},employee:{name:"José",cpf:"123"},draft:d,result};
    const html=cltPayslipHtml(args);
    expect(html).toContain("Empresa &amp; Cia");expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("data-marcell-report=");expect(html).toContain("não comprova pagamento");
    expect(html).toContain("Base FGTS");expect(html).toContain("2.214,50");
    expect(cltAdvanceHtml({...args,advance:{id:"a",date:"2026-09-20",amount:600}})).toContain("600,00");
  });
});
