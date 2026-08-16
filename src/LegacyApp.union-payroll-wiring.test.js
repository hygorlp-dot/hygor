import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const source=readFileSync(resolve(process.cwd(),"src/LegacyApp.jsx"),"utf8");
// Folha foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #8) - o
// cálculo de folha líquida agora mora aqui, não em `source`.
const folhaSource=readFileSync(resolve(process.cwd(),"src/domains/ponto/components/FolhaView.jsx"),"utf8");

describe("folha líquida após desconto sindical",()=>{
  it("usa o cálculo canônico e rateia o desconto por obra",()=>{
    expect(folhaSource).toContain("calculatePayrollSettlement({gross,benefits:vt+vr,advances:advTotal,unionDue:unionResult.amount})");
    expect(folhaSource).toContain("allocateUnionDueByWork(obrasPorDiaArr,settlement.appliedUnionDue)");
    expect(folhaSource).toContain("unionDue:o.unionDueObra||0");
  });

  it("expõe o líquido final na tela e nos relatórios",()=>{
    expect(folhaSource).toContain('className="payroll-summary-strip__net"');
    expect(folhaSource).toContain("Líquido a pagar aos funcionários");
    expect(folhaSource).toContain("Desconto sindical\",\"Líquido a pagar");
  });
});
