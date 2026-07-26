import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
const reconciliationServer=readFileSync(resolve(process.cwd(), "server/reconciliation-command.js"), "utf8");

describe("contrato de autoria do DRE", () => {
  it("entrega o usuário autenticado até o cancelamento auditável", () => {
    expect(source).toContain("function DRE({data,update,showToast,currentUser=null,obraIdFixo=\"\"})");
    expect(source).toContain("<DRELegado data={data} update={update} showToast={showToast} currentUser={currentUser}/>");
    expect(source).toContain("cancelDreExpense({ data, expenseId:id, reason:motivo, actor:currentUser })");
    expect(source).toContain("createDreExpense({ data, expense:{ ...despForm, obraId, competencia:despForm.competencia || periodo }, actor:currentUser, id:uid() })");
    expect(source).toContain("createDreExpense({data,expense:despForm,actor:currentUser,id:uid()})");
    expect(source).toContain("createManualReceipt({data,receipt:payForm,actor:currentUser,id:uid()})");
    expect(source).toContain("reverseManualReceipt({data,receiptId:id,reason:motivo,actor:currentUser})");
    expect(source).toContain('origem: "revisao_vencidas", actor:currentUser');
    // REC-001: o recebimento bancário não é mais montado no React. A tela
    // envia a intenção e o servidor aplica o recebimento sobre o extrato
    // autoritativo, preservando origem e vínculo da transação.
    expect(source).toContain('type:"CONFIRM_RECEIPT"');
    expect(reconciliationServer).toContain('origem:"conciliacao_bancaria",transacaoId:transaction.id,actor');
    expect(source).toContain("<DRE          data={data} update={update} showToast={showToast} currentUser={currentUser} />");
  });

  it("consome a projeção canônica quando ela está disponível, mesmo antes do bloqueio FIN-003", () => {
    expect(source).toContain('relatorio?.source==="canonical_ledger"&&relatorio.current');
    expect(source).toContain('razaoEmpresa?.source==="canonical_ledger"&&razaoEmpresa.current');
    expect(source).not.toContain("const calcDREEmpresa =");
  });

  it("mostra o aviso de projeção pendente pelo componente de alerta disponível", () => {
    expect(source).not.toContain("<Notice v=\"warn\">");
    expect(source).toContain('<Alert variant="warning"><AlertDescription className="text-xs">A DRE está aguardando a projeção do razão canônico');
  });
});
