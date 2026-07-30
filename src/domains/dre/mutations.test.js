import { describe, expect, it } from "vitest";
import { buildFinancialLedger, selectCashFlow, selectDRE } from "../financeiro/ledger";
import { cancelCompanyExpense, cancelDreExpense, createDreExpense, createManualReceipt, replicateCompanyRecurringExpenses, reverseManualReceipt, saveCompanyExpense } from "./mutations";

describe("cancelamento auditável de despesa no DRE", () => {
  const data={ outrasDesp:[{ id:"desp-1", obraId:"obra-1", valor:1250, descricao:"Argamassa", status:"ativo" }] };
  const actor={ id:"u-1", nome:"Controladora" };

  it("preserva o fato financeiro e registra motivo, autor e instante", () => {
    const result=cancelDreExpense({ data, expenseId:"desp-1", reason:"Lançamento duplicado", actor, now:"2026-07-25T12:00:00.000Z" });
    expect(result.outrasDesp).toHaveLength(1);
    expect(result.outrasDesp[0]).toMatchObject({ id:"desp-1", valor:1250, status:"cancelado", motivoCancelamento:"Lançamento duplicado", canceladoPorId:"u-1", canceladoPor:"Controladora", canceladoEm:"2026-07-25T12:00:00.000Z" });
  });

  it("recusa cancelamento sem sessão, motivo ou duplicado", () => {
    expect(() => cancelDreExpense({ data, expenseId:"desp-1", reason:"x", actor:null })).toThrow("Sessão do usuário indisponível");
    expect(() => cancelDreExpense({ data, expenseId:"desp-1", reason:"", actor })).toThrow("Informe o motivo");
    expect(() => cancelDreExpense({ data:{ outrasDesp:[{ ...data.outrasDesp[0], status:"cancelado" }] }, expenseId:"desp-1", reason:"x", actor })).toThrow("já está cancelada");
  });

  it("cria despesa auditável e a reconhece uma única vez no DRE da competência", () => {
    const result=createDreExpense({ data:{ outrasDesp:[] }, expense:{ obraId:"obra-1", competencia:"2026-07", categoria:"material", descricao:"Argamassa", valor:"1250.50" }, actor, id:"desp-2", now:"2026-07-03T10:00:00.000Z" });
    expect(result.outrasDesp[0]).toMatchObject({ id:"desp-2", status:"ativo", origem:"dre_obra", createdById:"u-1", valor:1250.5 });
    const dre=selectDRE(buildFinancialLedger(result),{ obraId:"obra-1", competence:"2026-07" });
    expect(dre.costs).toBe(1250.5);
    expect(dre.events.filter(event=>event.sourceId==="desp-2" && event.effect==="cost")).toHaveLength(1);
  });

  it("recusa inclusão sem autor, competência, descrição ou valor válido", () => {
    const input={ data:{}, expense:{ obraId:"obra-1", competencia:"2026-07", descricao:"Cimento", valor:1 }, actor, id:"x" };
    expect(() => createDreExpense({ ...input, actor:null })).toThrow("Sessão do usuário indisponível");
    expect(() => createDreExpense({ ...input, expense:{ ...input.expense, competencia:"julho" } })).toThrow("competência válida");
    expect(() => createDreExpense({ ...input, expense:{ ...input.expense, descricao:"" } })).toThrow("descrição");
    expect(() => createDreExpense({ ...input, expense:{ ...input.expense, valor:0 } })).toThrow("valor positivo");
  });

  it("registra recebimento manual auditável somente como entrada de caixa", () => {
    const result=createManualReceipt({data:{payments:[]},receipt:{obraId:"obra-1",date:"2026-07-05",amount:"700.25",description:"Sinal"},actor,id:"rec-1",now:"2026-07-05T10:00:00.000Z"});
    expect(result.payments[0]).toMatchObject({id:"rec-1",status:"ativo",origem:"manual",tipo:"recebimento_avulso",createdById:"u-1",amount:700.25});
    const ledger=buildFinancialLedger(result);
    const cash=selectCashFlow(ledger,{obraId:"obra-1",startDate:"2026-07-01",endDate:"2026-07-31"});
    expect(cash.cashIn).toBe(700.25);
    const dre=selectDRE(ledger,{obraId:"obra-1",competence:"2026-07"});
    expect(dre.costs).toBe(0);
  });

  it("estorna recebimento manual preservando autoria e bloqueia fato conciliado", () => {
    const data=createManualReceipt({data:{payments:[]},receipt:{obraId:"obra-1",date:"2026-07-05",amount:700},actor,id:"rec-1"});
    const result=reverseManualReceipt({data,receiptId:"rec-1",reason:"Duplicidade",actor,now:"2026-07-06T10:00:00.000Z"});
    expect(result.payments[0]).toMatchObject({status:"estornado",motivoCancelamento:"Duplicidade",canceladoPorId:"u-1"});
    expect(selectCashFlow(buildFinancialLedger(result),{obraId:"obra-1",startDate:"2026-07-01",endDate:"2026-07-31"}).cashIn).toBe(0);
    expect(()=>reverseManualReceipt({data:{payments:[{...data.payments[0],conciliado:true,transacaoId:"tx-1"}]},receiptId:"rec-1",reason:"x",actor})).toThrow("Desfaça a conciliação");
  });

  it("cancela despesa corporativa com autoria e a remove do razão", () => {
    const result=cancelCompanyExpense({data:{despesasEmpresa:[{id:"corp-1",competencia:"2026-07",valor:90,descricao:"Software"}]},expenseId:"corp-1",reason:"Duplicidade",actor,now:"2026-07-04T10:00:00.000Z"});
    expect(result.despesasEmpresa[0]).toMatchObject({status:"cancelada",canceladoPorId:"u-1",motivoCancelamento:"Duplicidade"});
    expect(selectDRE(buildFinancialLedger(result),{competence:"2026-07"}).costs).toBe(0);
  });

  it("cria e versiona despesa corporativa reconhecida uma única vez", () => {
    const created=saveCompanyExpense({data:{},expense:{competencia:"2026-07",categoria:"software",descricao:"Sistema",valor:"99.9",recorrente:true},actor,id:"corp-2",now:"2026-07-01T00:00:00.000Z"});
    expect(created.despesasEmpresa[0]).toMatchObject({status:"ativo",origem:"dre_empresa",createdById:"u-1",version:1,valor:99.9});
    const edited=saveCompanyExpense({data:created,expense:{competencia:"2026-07",categoria:"software",descricao:"Sistema",valor:120,recorrente:true},actor,id:"corp-2",now:"2026-07-02T00:00:00.000Z"});
    expect(edited.despesasEmpresa[0]).toMatchObject({valor:120,version:2,createdAt:"2026-07-01T00:00:00.000Z",updatedAt:"2026-07-02T00:00:00.000Z"});
    expect(selectDRE(buildFinancialLedger(edited),{competence:"2026-07"}).costs).toBe(120);
  });

  it("mantém competência e caixa separados no cadastro operacional", () => {
    const created=saveCompanyExpense({
      data:{},actor,id:"corp-office",now:"2026-07-01T00:00:00.000Z",
      expense:{
        competencia:"2026-07",categoria:"internet",descricao:"Link escritório",valor:200,
        fornecedor:"Operadora",centroCusto:"escritorio",vencimento:"2026-08-05",
        formaPagamento:"cartao_credito",cartao:"Corporativo final 4321",parcelas:1,
        pago:true,dataPagamento:"2026-08-05",
      },
    });
    const expense=created.despesasEmpresa[0];
    expect(expense).toMatchObject({
      competencia:"2026-07",categoria:"internet",pago:true,dataPagamento:"2026-08-05",
      fornecedor:"Operadora",cartao:"Corporativo final 4321",
    });
    const ledger=buildFinancialLedger(created);
    expect(selectDRE(ledger,{competence:"2026-07"}).costs).toBe(200);
    expect(selectCashFlow(ledger,{startDate:"2026-07-01",endDate:"2026-07-31"}).cashOut).toBe(0);
    expect(selectCashFlow(ledger,{startDate:"2026-08-01",endDate:"2026-08-31"}).cashOut).toBe(200);
  });

  it("copia somente recorrências ativas com nova autoria e sem duplicar destino", () => {
    const data={despesasEmpresa:[{id:"a",competencia:"2026-06",categoria:"software",descricao:"Sistema",valor:100,recorrente:true,pago:true,dataPagamento:"2026-06-10",transacaoId:"tx-a"},{id:"b",competencia:"2026-06",categoria:"aluguel",descricao:"Sede",valor:50,recorrente:true,status:"cancelada"}]};
    const result=replicateCompanyRecurringExpenses({data,fromCompetence:"2026-06",toCompetence:"2026-07",actor,ids:["new-a"],now:"2026-07-01T00:00:00.000Z"});
    expect(result.copied).toBe(1);expect(result.despesasEmpresa.at(-1)).toMatchObject({id:"new-a",competencia:"2026-07",origem:"recorrencia_dre_empresa",createdById:"u-1",status:"ativo",pago:false,dataPagamento:"",transacaoId:""});
  });
});
