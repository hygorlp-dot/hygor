import { describe,it,expect } from "vitest";
import { custoFinalDaProposta,validarCustoFinal } from "./final-cost";
import { avaliarEscolhasCotacao,sugestaoDeEscolhas } from "./quote-map";
const quote={itens:[{id:"a",qtd:3},{id:"b",qtd:7}]};
const proposal={id:"p",fornecedorId:"f",precos:{a:10,b:20},custoFinal:{frete:30,desconto:10,impostos:5,despesas:2}};
describe("custo final da compra",()=>{
  it("inclui adicionais e desconto, conservando centavos no rateio",()=>{
    const cost=custoFinalDaProposta(quote,proposal);
    expect(cost.total).toBe(197);
    expect(Math.round((cost.precosFinais.a*3+cost.precosFinais.b*7)*100)).toBe(19700);
  });
  it("não trata dados ausentes como custo zero nem sugere decisão",()=>{
    const incomplete={...proposal,custoFinal:{frete:0}};
    expect(custoFinalDaProposta(quote,incomplete)).toMatchObject({total:null,missing:["desconto","impostos","despesas"]});
    expect(sugestaoDeEscolhas({...quote,propostas:[incomplete]})).toEqual({});
    expect(avaliarEscolhasCotacao({...quote,propostas:[incomplete]},{a:"p"},{a:"único"}).erro).toMatch(/Complete/);
  });
  it("impede valores inválidos e desconto que zera a compra",()=>{
    for(const frete of [-1,"inválido",Infinity])expect(validarCustoFinal(quote,{...proposal,custoFinal:{...proposal.custoFinal,frete}})).not.toBe("");
    expect(validarCustoFinal(quote,{...proposal,custoFinal:{frete:0,impostos:0,despesas:0,desconto:170}})).not.toBe("");
  });
  it("exige revisão para fracionar uma proposta com frete fixo",()=>{
    expect(avaliarEscolhasCotacao({...quote,propostas:[proposal]},{a:"p"},{a:"único"}).erro).toMatch(/integralmente/);
  });
  it("escolhe pelo custo final e não apenas pelo preço unitário",()=>{
    const q={itens:[{id:"a",qtd:1}],propostas:[
      {...proposal,precos:{a:90},custoFinal:{frete:30,desconto:0,impostos:0,despesas:0}},
      {...proposal,id:"p2",fornecedorId:"f2",precos:{a:100},custoFinal:{frete:0,desconto:0,impostos:0,despesas:0}},
    ]};
    expect(sugestaoDeEscolhas(q)).toEqual({a:"p2"});
    expect(avaliarEscolhasCotacao(q,{a:"p2"}).total).toBe(100);
  });
});
