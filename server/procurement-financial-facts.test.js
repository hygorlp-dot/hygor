import {describe, expect, it} from "vitest";
import {buildLegacyFinancialFacts} from "./financial-shadow.js";
import {buildProcurementFinancialFacts, compareProcurementDreRecognition} from "./procurement-financial-facts.js";
import {buildFinancialLedger, selectDRE, selectCashFlow} from "../src/domains/financeiro/ledger.js";

const order = {id:"p1",obraId:"o1",numero:"PC-01",status:"enviado",data:"2026-06-26",
  itens:[{qtd:10,precoUnit:25,qtdRecebida:10}],
  pagamentos:[{id:"pag1",valor:250,data:"2026-07-01",origem:"caixa_obra"}]};
const invoice = {id:"nf1",pedidoId:"p1",obraId:"o1",status:"reconhecida",valorBruto:250,
  emissao:"2026-08-01",pagamentos:[{id:"pag1",valor:250,data:"2026-07-01",origem:"caixa_obra"}]};
const canonical = facts => facts.filter(f=>f.recognizedAmount>0).map(f=>({event_type:"cost_recognized",
  source_type:f.legacyType,source_id:f.legacyId,effective_date:f.date,
  payload:{active:true,amount:f.recognizedAmount,obraId:f.obraId,category:f.category}}));

describe("Compras usa o mesmo reconhecimento do DRE",()=>{
  it("receber e pagar não reconhece custo nem cria documento; preserva pagamento real",()=>{
    const data={pedidos:[structuredClone(order)],notasFiscais:[]};const before=structuredClone(data);
    const facts=buildLegacyFinancialFacts(data,{includeDreSnapshots:false}).facts;
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({recognizedAmount:0,titleAmount:250,metadata:{financialKind:"commitment"},
      settlements:[{legacyId:"pag1",amount:250,date:"2026-07-01"}]});
    expect(data).toEqual(before);
    expect(selectDRE(buildFinancialLedger(data)).costs).toBe(0);
    expect(selectCashFlow(buildFinancialLedger(data)).cashOut).toBe(250);
    expect(compareProcurementDreRecognition(data,canonical(facts))).toEqual([]);
  });
  it("reconhece documento existente na competência e não duplica pagamento espelhado no pedido",()=>{
    const data={pedidos:[order],notasFiscais:[invoice]};
    const facts=buildProcurementFinancialFacts(data);
    expect(facts.find(f=>f.legacyType==="pedido").settlements).toEqual([]);
    expect(facts.find(f=>f.legacyType==="nota_fiscal")).toMatchObject({recognizedAmount:250,date:"2026-08-01"});
    expect(facts.flatMap(f=>f.settlements)).toHaveLength(1);
    expect(selectDRE(buildFinancialLedger(data),{competence:"2026-08"}).costs).toBe(250);
    expect(compareProcurementDreRecognition(data,canonical(facts))).toEqual([]);
  });
  it("respeita cancelamentos, estornos e rascunhos",()=>{
    expect(buildProcurementFinancialFacts({pedidos:[{...order,status:"cancelado"}],notasFiscais:[{...invoice,status:"cancelada"}]})).toEqual([]);
    expect(buildProcurementFinancialFacts({pedidos:[{...order,status:"rascunho"}],notasFiscais:[{...invoice,status:"rascunho"}]})).toEqual([]);
  });
  it("nota cancelada não apaga o pagamento real que continua ativo no pedido",()=>{
    const data={pedidos:[order],notasFiscais:[{...invoice,status:"cancelada"}]};
    expect(selectCashFlow(buildFinancialLedger(data)).cashOut).toBe(250);
    expect(buildProcurementFinancialFacts(data)[0].settlements[0].legacyId).toBe("pag1");
  });
  it("não reconhece novamente documento vinculado à medição de terceiro",()=>{
    const facts=buildProcurementFinancialFacts({notasFiscais:[{...invoice,medicaoTercId:"m1"}],medicoesTerc:[{id:"m1",obraId:"o1",total:250,data:"2026-08-01"}]});
    expect(facts).toEqual([]);
  });
  it("rateia custo por obra sem fabricar pagamentos",()=>{
    const data={notasFiscais:[{...invoice,pagamentos:[],rateios:[{id:"r1",obraId:"o1",valor:100},{id:"r2",obraId:"o2",valor:150}]}]};
    const facts=buildProcurementFinancialFacts(data);
    expect(facts.map(f=>[f.obraId,f.recognizedAmount])).toEqual([["o1",100],["o2",150]]);
    expect(facts.flatMap(f=>f.settlements)).toEqual([]);
    expect(compareProcurementDreRecognition(data,canonical(facts))).toEqual([]);
  });
  it("agrupa rateios da mesma obra sem duplicar a liquidação",()=>{
    const data={notasFiscais:[{...invoice,rateios:[{id:"r1",obraId:"o1",valor:100},{id:"r2",obraId:"o1",valor:150}]}]};
    const facts=buildProcurementFinancialFacts(data);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({titleAmount:250,recognizedAmount:250});
    expect(facts[0].settlements).toHaveLength(1);
  });
  it("preserva data do documento e reconhece pela competência informada",()=>{
    const data={notasFiscais:[{...invoice,competencia:"2026-09"}]};
    const facts=buildProcurementFinancialFacts(data);
    expect(facts[0]).toMatchObject({date:"2026-09-01",metadata:{documentDate:"2026-08-01",competence:"2026-09"}});
    expect(compareProcurementDreRecognition(data,canonical(facts))).toEqual([]);
  });
  it("o gate detecta custo de pedido indevido mesmo se a própria sombra concordar",()=>{
    const events=[{event_type:"cost_recognized",effective_date:"2026-06-26",payload:{active:true,category:"purchases",obraId:"o1",amount:250}}];
    expect(compareProcurementDreRecognition({pedidos:[order]},events)).toEqual([{scope:"o1|2026-06",expectedCents:0,actualCents:25000,differenceCents:25000}]);
  });
  it("o gate detecta competência e obra erradas, e ignora evento desativado",()=>{
    const data={notasFiscais:[invoice]};const events=canonical(buildProcurementFinancialFacts(data));
    events[0].effective_date="2026-07-01";
    expect(compareProcurementDreRecognition(data,events)).toHaveLength(2);
    events[0].effective_date="2026-08-01";events[0].payload.obraId="o2";
    expect(compareProcurementDreRecognition(data,events)).toHaveLength(2);
    expect(compareProcurementDreRecognition({},[{...events[0],payload:{...events[0].payload,active:false}}])).toEqual([]);
  });
});

describe("pagamento direto do cliente (D-C)", () => {
  it("continua sendo liquidação do título, mesmo fora do caixa da empresa", () => {
    const data = {pedidos:[{...order, pagamentos:[{id:"pg-cli", valor:250, data:"2026-07-01", origem:"cliente_direto"}]}], notasFiscais:[]};
    const facts = buildProcurementFinancialFacts(data);
    expect(facts.find(f=>f.legacyType==="pedido").settlements).toMatchObject([{legacyId:"pg-cli", amount:250}]);
    expect(selectCashFlow(buildFinancialLedger(data)).cashOut).toBe(0);
  });
});
