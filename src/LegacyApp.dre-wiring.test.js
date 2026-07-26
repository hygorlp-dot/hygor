import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("contrato de autoria do DRE", () => {
  it("entrega o usuário autenticado até o cancelamento auditável", () => {
    expect(source).toContain("function DRE({data,update,showToast,currentUser=null,obraIdFixo=\"\"})");
    expect(source).toContain("<DRELegado data={data} update={update} showToast={showToast} currentUser={currentUser}/>");
    expect(source).toContain("cancelDreExpense({ data, expenseId:id, reason:motivo, actor:currentUser })");
    expect(source).toContain("createDreExpense({ data, expense:{ ...despForm, obraId, competencia:despForm.competencia || periodo }, actor:currentUser, id:uid() })");
    expect(source).toContain("<DRE          data={data} update={update} showToast={showToast} currentUser={currentUser} />");
  });
});
