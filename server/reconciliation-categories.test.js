import { describe, expect, test } from "vitest";
import { applyReconciliationCommand } from "./reconciliation-command.js";
import { buildFinancialLedger, selectCashFlow, selectDRE } from "../src/domains/financeiro/ledger.js";
import { buildLegacyFinancialFacts } from "./financial-shadow.js";
import { desfazerConciliacao } from "../src/domains/conciliacao/mutations.js";
import { buildRequestedDreProjectionRows } from "./dre-projection.js";

const actor = { id:"finance", role:"financeiro", nome:"Financeiro" };
const fixture = (value = 1000) => ({
  obras:[{ id:"o1", name:"Obra 1" }, { id:"o2", name:"Obra 2" }],
  transacoes:[{ id:"bank", data:"2026-10-28", descricao:"Movimento teste", valor:value, status:"pendente" }],
  payments:[], outrasDesp:[], despesasEmpresa:[], historicoConc:[],
});
const allocate = (data, allocations, extra = {}) => applyReconciliationCommand(data, {
  type:"CONFIRM_ALLOCATION", payload:{ transactionId:"bank", allocations, ...extra },
}, actor);

describe("categorias e competência da conciliação integrada ao DRE", () => {
  test("reconhece receita explicitamente classificada por competência e preserva a data do caixa", () => {
    const result = allocate(fixture(), [{ destination:"empresa", category:"receita_servicos", value:1000 }], { competence:"2026-09" });
    expect(result.resumo.ok).toBe(true);
    const receipt = result.data.payments[0];
    expect(receipt).toMatchObject({ categoria:"receita_servicos", competencia:"2026-09", efeitoDRE:"receita", date:"2026-10-28", amount:1000 });
    const ledger = buildFinancialLedger(result.data);
    expect(selectDRE(ledger, { competence:"2026-09" }).revenueCents).toBe(100000);
    expect(selectDRE(ledger, { competence:"2026-10" }).revenueCents).toBe(0);
    expect(selectCashFlow(ledger, { startDate:"2026-10-01", endDate:"2026-10-31" }).cashInCents).toBe(100000);
    expect(ledger.issues.some(item => item.code === "RECEIPT_UNALLOCATED")).toBe(false);
    expect(buildLegacyFinancialFacts(result.data, { includeDreSnapshots:false }).facts[0]).toMatchObject({
      recognizedAmount:1000, recognitionType:"revenue_recognized", date:"2026-09-01", metadata:{ competencia:"2026-09", categoria:"receita_servicos" },
      settlements:[{ amount:1000, date:"2026-10-28" }],
    });
  });

  test.each(["aporte_cliente", "capital_socio", "credito", "outros_recursos", "receita"])("classifica %s sem transformar entrada em faturamento", category => {
    const result = allocate(fixture(), [{ destination:"empresa", category, value:1000 }]);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.payments[0].categoria).toBe(category);
    const ledger = buildFinancialLedger(result.data);
    expect(selectDRE(ledger).revenueCents).toBe(0);
    expect(selectCashFlow(ledger).cashInCents).toBe(100000);
    expect(buildLegacyFinancialFacts(result.data, { includeDreSnapshots:false }).facts[0].recognizedAmount).toBe(0);
  });

  test("recusa categoria de sentido ou destino errado e categoria inventada", () => {
    for (const [value, destination, category] of [[1000,"empresa","software"],[-1000,"empresa","receita_servicos"],[-1000,"empresa","material"],[-1000,"obra","inexistente"]]) {
      const data = fixture(value);
      const result = allocate(data, [{ destination, obraId:"o1", category, value:1000 }]);
      expect(result.resumo.ok).toBe(false);
      expect(result.resumo.motivo).toMatch(/categoria/i);
      expect(result.data).toBe(data);
    }
  });

  test("usa a categoria personalizada do DRE da obra e separa custo de pagamento", () => {
    const data = { ...fixture(-1000), categoriasDesp:[{ v:"sondagem", l:"Sondagem do solo" }] };
    const result = allocate(data, [{ destination:"obra", obraId:"o1", category:"sondagem", value:1000 }], { competence:"2026-09" });
    expect(result.resumo.ok).toBe(true);
    expect(result.data.outrasDesp[0]).toMatchObject({ categoria:"sondagem", competencia:"2026-09", dataPagamento:"2026-10-28" });
    expect(result.data.transacoes[0].rateios[0]).toMatchObject({ destino:"obra", categoria:"sondagem", valor:1000 });
    const ledger = buildFinancialLedger(result.data);
    expect(selectDRE(ledger, { competence:"2026-09" }).costCents).toBe(100000);
    expect(selectDRE(ledger, { competence:"2026-10" }).costCents).toBe(0);
    expect(selectCashFlow(ledger, { startDate:"2026-10-01", endDate:"2026-10-31" }).cashOutCents).toBe(100000);
  });

  test.each([1000, -1000])("rateios iguais preservam todo o caixa (%s)", value => {
    const category = value > 0 ? "outras_receitas" : "material";
    const result = allocate(fixture(value), ["o1","o2"].map(obraId => ({ destination:"obra", obraId, category, value:500 })));
    const ledger = buildFinancialLedger(result.data);
    expect(result.resumo.ok).toBe(true);
    expect(selectCashFlow(ledger)[value > 0 ? "cashInCents" : "cashOutCents"]).toBe(100000);
    expect(selectDRE(ledger)[value > 0 ? "revenueCents" : "costCents"]).toBe(100000);
    expect(ledger.issues.some(item => item.code === "DUPLICATE_TRANSACTION_EFFECT")).toBe(false);
  });

  test("não aplica categoria de receita nova ao recebimento de uma medição existente", () => {
    const data = { ...fixture(), medicoes:[{ id:"m1", obraId:"o1", valorPrevisto:1000, competencia:"2026-09", dataEmissao:"2026-09-10" }] };
    const result = allocate(data, [{ destination:"obra", obraId:"o1", category:"receita_servicos", value:1000 }], { measurementId:"m1" });
    expect(result.resumo.ok).toBe(false);
    expect(result.data).toBe(data);
  });

  test("impede rateio em data bancária ou competência fechada", () => {
    for (const month of ["09", "10"]) {
      const data = { ...fixture(), fechamentosFinanceiros:[{ status:"fechado", dataInicio:`2026-${month}-01`, dataFim:`2026-${month}-31` }] };
      const result = allocate(data, [{ destination:"empresa", category:"outras_receitas", value:1000 }], { competence:"2026-09" });
      expect(result.resumo.ok).toBe(false);
      expect(result.resumo.motivo).toMatch(/fechad/i);
      expect(result.data).toBe(data);
    }
  });

  test("reversão respeita competência fechada e, quando aberta, anula só a receita criada", () => {
    const created = allocate(fixture(), [{ destination:"empresa", category:"outras_receitas", value:1000 }], { competence:"2026-09" });
    const closed = { ...created.data, fechamentosFinanceiros:[{ status:"fechado", dataInicio:"2026-09-01", dataFim:"2026-09-30" }] };
    expect(desfazerConciliacao(closed, "bank", actor, "Correção").resumo.ok).toBe(false);
    const reversed = desfazerConciliacao(created.data, "bank", actor, "Correção");
    expect(reversed.resumo.ok).toBe(true);
    expect(reversed.data.payments[0].status).toBe("estornado");
    expect(selectDRE(buildFinancialLedger(reversed.data)).revenueCents).toBe(0);
  });

  test("não cria uma segunda despesa para salário cujo título já existe", () => {
    const data = { ...fixture(-1000), employees:[{ id:"e1", name:"João", obra:"o1" }], titulosFolha:[{ id:"f1", employeeId:"e1", competencia:"2026-10", liquido:1000, liquidacoes:[] }] };
    const result = allocate(data, [{ destination:"obra", obraId:"o1", category:"mao_obra", value:1000 }], { worker:{ employeeId:"e1" } });
    expect(result.resumo.ok).toBe(false);
    expect(result.resumo.motivo).toMatch(/título.*folha/i);
    expect(result.data).toBe(data);
  });

  test("salário ainda sem título registra somente o caixa e mantém o custo original do ponto", () => {
    const data={...fixture(-100),config:{paymentHolidays:[]},employees:[{id:"e1",name:"Ana",obra:"o1",dailyRate:100}],
      transacoes:[{id:"bank",valor:-100,data:"2026-07-10",status:"pendente"}],
      attendance:{e1:{"2026-07-10":{status:"P",obraId:"o1"}}}};
    const request=[{year:2026,month:6,period:"mes",scope:"o1"}];
    const before=buildRequestedDreProjectionRows(data,request)[0].payload.totalCustos;
    const result=allocate(data,[{destination:"obra",obraId:"o1",category:"mao_obra",value:100}],{worker:{employeeId:"e1",employeeName:"Nome incorreto do navegador"}});
    expect(result.resumo.ok).toBe(true);
    expect(before).toBe(100);
    expect(result.data.outrasDesp).toHaveLength(0);
    expect(result.data.pagamentosFolha[0]).toMatchObject({employeeId:"e1",obraId:"o1",valor:100,transacaoId:"bank"});
    expect(result.data.transacoes[0].recebedorMaoObra.employeeName).toBe("Ana");
    expect(buildRequestedDreProjectionRows(result.data,request)[0].payload.totalCustos).toBe(100);
    expect(selectCashFlow(buildFinancialLedger(result.data)).cashOutCents).toBe(10000);
  });

  test("folha paga de outro mês não bloqueia evidência de um novo pagamento", () => {
    const data={...fixture(-1000),employees:[{id:"e1",name:"Ana",obra:"o1"}],
      titulosFolha:[{id:"old",employeeId:"e1",competencia:"2026-07",liquido:500,liquidacoes:[{id:"paid",valor:500}]}]};
    const result=allocate(data,[{destination:"obra",obraId:"o1",category:"mao_obra",value:1000}],{worker:{employeeId:"e1"}});
    expect(result.resumo.ok).toBe(true);
    expect(result.data.outrasDesp).toHaveLength(0);
    expect(result.data.pagamentosFolha).toHaveLength(1);
  });

  test("não aceita funcionário inexistente nem rateio salarial misto como custo genérico", () => {
    const data={...fixture(-1000),employees:[{id:"e1",name:"Ana",obra:"o1"}]};
    expect(allocate(data,[{destination:"obra",obraId:"o1",category:"mao_obra",value:1000}],{worker:{employeeId:"forjado"}}).resumo.ok).toBe(false);
    expect(allocate(data,[{destination:"obra",obraId:"o1",category:"material",value:1000}],{worker:{employeeId:"e1"}}).resumo.ok).toBe(false);
  });

  test("projeção do DRE da empresa e da obra usa a mesma receita e competência", () => {
    const result=allocate(fixture(),[{destination:"obra",obraId:"o1",category:"receita_servicos",value:600},{destination:"empresa",category:"outras_receitas",value:400}],{competence:"2026-09"});
    const rows=buildRequestedDreProjectionRows(result.data,[{year:2026,month:8,scope:"o1"},{year:2026,month:8,scope:"company_dre"},{year:2026,month:9,scope:"company_dre"}]);
    expect(rows[0].payload.faturamento).toBe(600);
    expect(rows[1].payload).toMatchObject({faturamentoObras:600,receitaCorporativa:400,faturamentoTotal:1000});
    expect(rows[2].payload.faturamentoTotal).toBe(0);
  });
});
