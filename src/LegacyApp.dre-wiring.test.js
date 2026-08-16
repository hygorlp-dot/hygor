import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
const reconciliationServer=readFileSync(resolve(process.cwd(), "server/reconciliation-command.js"), "utf8");
const api=readFileSync(resolve(process.cwd(), "api/data.js"), "utf8");
// Terceiros foi extraído de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-15 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #3) - o
// contrato de comando dele agora mora aqui, não em `source`.
const terceirosSource=readFileSync(resolve(process.cwd(), "src/domains/terceirizados/components/TerceirosView.jsx"), "utf8");
// Conciliação foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #2) - o
// contrato de comando dela agora mora aqui, não em `source`.
const conciliacaoSource=readFileSync(resolve(process.cwd(), "src/features/conciliacao/ConciliacaoView.jsx"), "utf8");
// Compras foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #4) - o
// contrato de comando dela agora mora aqui, não em `source`.
const comprasSource=readFileSync(resolve(process.cwd(), "src/domains/compras/components/ComprasView.jsx"), "utf8");
// Comercial foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #7) - o
// contrato de comando dela agora mora aqui, não em `source`.
const comercialSource=readFileSync(resolve(process.cwd(), "src/domains/comercial/components/ComercialView.jsx"), "utf8");

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
    expect(comprasSource).toContain('type:OPERATIONAL_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED');
    expect(comprasSource).toContain('targetType:"pedido",targetId:pedido.id,paymentId:pagamentoId,newOrigin:novaOrigem');
    expect(comprasSource).not.toContain('targetType:"pedido",targetId:pedido.id,paymentId,newOrigin:novaOrigem');
    expect(comprasSource).toContain('type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED');
    expect(comprasSource).not.toContain('const caixaObra=f.origem==="caixa_obra"?[...(data.caixaObra||[])');
    expect(comprasSource).toContain('type:OPERATIONAL_COMMAND.PURCHASE_CANCELLED');
    expect(comprasSource).not.toContain('const caixaObra=(data.caixaObra||[]).map(m=>m.pedidoId!==p.id?m:');
    expect(conciliacaoSource).toContain('type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED');
    expect(conciliacaoSource).toContain('type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IGNORED');
    expect(conciliacaoSource).toContain('type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_REOPENED');
    expect(conciliacaoSource).not.toContain('transacoes: [...(data.transacoes||[]), ...novas]');
    expect(conciliacaoSource).not.toContain('transacoes:(data.transacoes||[]).map(t=>ids.has(t.id)');
    expect(terceirosSource).toContain('type:OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_RECORDED');
    expect(terceirosSource).toContain('type:OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_REVERSED');
    expect(terceirosSource).toContain('type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED');
    expect(terceirosSource).toContain('type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED');
    expect(terceirosSource).toContain('type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_PAID');
    expect(terceirosSource).toContain('type:OPERATIONAL_COMMAND.THIRD_PARTY_INVOICE_LINKED');
    expect(terceirosSource).not.toContain('update(createThirdPartyPayment(');
    expect(terceirosSource).not.toContain('update(reverseThirdPartyPayment(');
    expect(terceirosSource).not.toContain('update(createThirdPartyMeasurement(');
    expect(terceirosSource).not.toContain('update(cancelThirdPartyMeasurement(');
    expect(terceirosSource).not.toContain('update(payThirdPartyMeasurement(');
    expect(source).toContain('type:OPERATIONAL_COMMAND.INVOICE_SAVED');
    expect(source).toContain('type:OPERATIONAL_COMMAND.INVOICE_APPROVED');
    expect(source).not.toContain('update({...data,notasFiscais:form.id?');
    expect(source).not.toContain('update({...data,notasFiscais:notas.map(');
    expect(source).not.toContain("update(createDreExpense(");
    expect(source).not.toContain("update(cancelDreExpense(");
    expect(source).not.toContain("update(saveCompanyExpense(");
    expect(source).not.toContain("update(cancelCompanyExpense(");
    expect(source).toContain("type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED");
    expect(source).toContain("type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED");
    expect(source).toContain("<Financeiro   data={data} update={update} showToast={showToast} currentUser={currentUser} dispatchCommand={dispatchOperationalCommand} />");
    expect(source).toContain("type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED");
    expect(comercialSource).toContain("type:OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED");
    expect(source).not.toContain("medicoes:[...(data.medicoes||[]),...contas]");
    expect(source).toContain('origem:"revisao_vencidas"');
    expect(source).not.toContain('origem: "revisao_vencidas", actor:currentUser');
    // REC-001: o recebimento bancário não é mais montado no React. A tela
    // envia a intenção e o servidor aplica o recebimento sobre o extrato
    // autoritativo, preservando origem e vínculo da transação.
    expect(conciliacaoSource).toContain('type:"CONFIRM_RECEIPT"');
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
    expect(source).toContain('"Atualizando a projeção do razão canônico para este período…"');
  });

  it("declara as ações do formulário corporativo dentro do DRE da empresa", () => {
    const companyDre=source.split("function DREEmpresa(")[1]?.split("function ")[0]||"";
    const workFinance=source.split("function FinanceiroObraPainel(")[1]?.split("function ")[0]||"";
    expect(companyDre).toContain("const openNewCompanyExpense=");
    expect(companyDre).toContain("const openEditCompanyExpense=");
    expect(companyDre.indexOf("const openNewCompanyExpense=")).toBeLessThan(companyDre.indexOf("onClick={openNewCompanyExpense}"));
    expect(workFinance).not.toContain("const openNewCompanyExpense=");
  });

  it("reconstrói no servidor uma projeção ausente ou desatualizada", () => {
    expect(api).toContain('String(currentEvent.payload?.sourceRevision||"")!==sourceRevision');
    expect(api).toContain("buildRequestedDreProjectionRows(atual,projectionRequests)");
    expect(api).toContain('code:"DRE_PROJECTION_SYNC_FAILED"');
    expect(source).toContain('report?.status===200&&report?.source==="canonical_ledger"&&report.current');
  });
});
