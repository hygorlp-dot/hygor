import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
const reconciliationServer=readFileSync(resolve(process.cwd(), "server/reconciliation-command.js"), "utf8");

describe("contrato de autoria do DRE", () => {
  it("entrega o usuário autenticado até o cancelamento auditável", () => {
    expect(source).toContain('type:OPERATIONAL_COMMAND.PROJECT_EXPENSE_CREATED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.PROJECT_EXPENSE_CANCELLED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.COMPANY_EXPENSE_CANCELLED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CREATED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CANCELLED');
    expect(source).toContain('<CaixaObra    data={data} showToast={showToast} currentUser={currentUser} dispatchCommand={dispatchOperationalCommand} />');
    expect(source).not.toContain('update({...data, caixaObra:[...(data.caixaObra||[]), payload]})');
    expect(source).toContain('type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED');
    expect(source).not.toContain('const caixaObra=f.origem==="caixa_obra"?[...(data.caixaObra||[])');
    expect(source).toContain('type:OPERATIONAL_COMMAND.PURCHASE_CANCELLED');
    expect(source).not.toContain('const caixaObra=(data.caixaObra||[]).map(m=>m.pedidoId!==p.id?m:');
    expect(source).not.toContain("update(createDreExpense(");
    expect(source).not.toContain("update(cancelDreExpense(");
    expect(source).not.toContain("update(saveCompanyExpense(");
    expect(source).not.toContain("update(cancelCompanyExpense(");
    expect(source).toContain("type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED");
    expect(source).toContain("type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED");
    expect(source).toContain("<Financeiro   data={data} update={update} showToast={showToast} currentUser={currentUser} dispatchCommand={dispatchOperationalCommand} />");
    expect(source).toContain("type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED");
    expect(source).toContain("type:OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED");
    expect(source).not.toContain("medicoes:[...(data.medicoes||[]),...contas]");
    expect(source).toContain('origem:"revisao_vencidas"');
    expect(source).not.toContain('origem: "revisao_vencidas", actor:currentUser');
    // REC-001: o recebimento bancário não é mais montado no React. A tela
    // envia a intenção e o servidor aplica o recebimento sobre o extrato
    // autoritativo, preservando origem e vínculo da transação.
    expect(source).toContain('type:"CONFIRM_RECEIPT"');
    expect(reconciliationServer).toContain('origem:"conciliacao_bancaria",transacaoId:transaction.id,actor');
    expect(source).toContain("<DRE          data={data} showToast={showToast} currentUser={currentUser} dispatchCommand={dispatchOperationalCommand} />");
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
