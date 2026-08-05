import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const source=readFileSync(resolve(process.cwd(),"src/LegacyApp.jsx"),"utf8");

describe("folha líquida após desconto sindical",()=>{
  it("usa o cálculo canônico e rateia o desconto por obra",()=>{
    expect(source).toContain("calculatePayrollSettlement({gross,benefits:vt+vr,advances:advTotal,unionDue:unionResult.amount})");
    expect(source).toContain("allocateUnionDueByWork(obrasPorDiaArr,settlement.appliedUnionDue)");
    expect(source).toContain("unionDue:o.unionDueObra||0");
  });

  it("expõe o líquido final na tela e nos relatórios",()=>{
    expect(source).toContain('className="payroll-summary-strip__net"');
    expect(source).toContain("Líquido a pagar aos funcionários");
    expect(source).toContain("Desconto sindical\",\"Líquido a pagar");
  });
});
