import { describe,expect,it } from "vitest";
import { PAYROLL_PAYER,payrollPayerForWork,splitPayrollResponsibility } from "./payroll-responsibility.js";

describe("responsabilidade pelo pagamento da folha",()=>{
  it("atribui somente obra admin_only à obra e mantém contratos fixos na construtora",()=>{
    expect(payrollPayerForWork({contractType:"admin_only"})).toBe(PAYROLL_PAYER.ADMIN_WORK);
    expect(payrollPayerForWork({contractType:"administracao"})).toBe(PAYROLL_PAYER.ADMIN_WORK);
    expect(payrollPayerForWork({contractType:"fixed_labor_admin"})).toBe(PAYROLL_PAYER.BUILDER);
    expect(payrollPayerForWork({contractType:"fixed_labor"})).toBe(PAYROLL_PAYER.BUILDER);
    expect(payrollPayerForWork()).toBe(PAYROLL_PAYER.BUILDER);
  });

  it("separa por apontamento e preserva exatamente o total líquido",()=>{
    const result=splitPayrollResponsibility({
      works:[{id:"oa",name:"Admin",contractType:"admin_only"},{id:"om",name:"Mista",contractType:"fixed_labor_admin"}],
      allocations:[
        {empId:"e1",obraId:"oa",obraName:"Admin",netObra:700},
        {empId:"e1",obraId:"om",obraName:"Mista",netObra:300},
        {empId:"e2",obraId:"",obraName:"Administrativo",netObra:500},
      ],
    });
    expect(result.administrationWorks).toHaveLength(1);
    expect(result.builder).toHaveLength(2);
    expect(result.totals).toEqual({administrationWorks:700,builder:800,total:1500});
  });
});
