import {describe,test,expect} from "vitest";
import {registrarPagamentoEConciliar,vincularPagamentoExistente,desfazerConciliacao} from "./mutations.js";
import {buildLegacyFinancialFacts} from "../../../server/financial-shadow.js";

const actor={id:"finance",role:"financeiro"};
const fixture=()=>({transacoes:[{id:"bank",valor:-100,data:"2026-10-23",status:"pendente",gerados:[]}],
  pedidos:[{id:"order",status:"enviado",itens:[{id:"item",qtd:1,precoUnit:100}],pagamentos:[]}],
  notasFiscais:[{id:"invoice",status:"aprovada",pedidoId:"order",valorLiquido:100,pagamentos:[]}],
  medicoes:[{id:"measurement",valorPrevisto:100,recebimentos:[]}],historicoConc:[],
  configCompras:{toleranciaConferencia:{valor:0,percentual:0}}});
const pay=(data,tipo="pedido",extra={})=>registrarPagamentoEConciliar(data,{transacaoId:"bank",tipo,entidadeId:tipo==="pedido"?"order":tipo==="nota"?"invoice":"measurement",operador:actor,...extra});
const link=data=>vincularPagamentoExistente(data,{transacaoId:"bank",tipo:"nota",entidadeId:"invoice",pagamentoId:"real",operador:actor});

describe("integridade de pagamento e vínculo bancário",()=>{
  test.each(["cancelado","estornado","rascunho"])("recusa pedido %s sem gravar",status=>{
    const data=fixture();data.pedidos[0].status=status;
    expect(pay(data).resumo.ok).toBe(false);expect(pay(data).data).toBe(data);
  });
  test("não paga acima do saldo nem libera adiantamento sem justificativa",()=>{
    const data=fixture();data.transacoes[0].valor=-150;
    expect(pay(data).resumo.motivo).toMatch(/saldo/);
    data.transacoes[0].valor=-100;
    expect(pay(data).resumo.motivo).toMatch(/adiantamento/);
    expect(pay(data,"pedido",{adiantamento:true,motivoAdiantamento:"Sinal contratado",operador:{id:"x",role:"compras"}}).resumo.ok).toBe(false);
    const result=pay(data,"pedido",{adiantamento:true,motivoAdiantamento:"Sinal contratado"});
    expect(result.resumo.ok).toBe(true);
    expect(result.data.pedidos[0].pagamentos[0]).toMatchObject({valor:100,tipo:"adiantamento",motivoAdiantamento:"Sinal contratado"});
    expect(buildLegacyFinancialFacts(result.data).facts.find(item=>item.legacyId==="order").recognizedAmount).toBe(0);
  });
  test("exige aprovação da nota e respeita pagamentos anteriores",()=>{
    const data=fixture();data.notasFiscais[0].status="recebida";
    expect(pay(data,"nota").resumo.ok).toBe(false);
    data.notasFiscais[0].status="aprovada";data.notasFiscais[0].pagamentos=[{id:"old",valor:10}];
    expect(pay(data,"nota").resumo.motivo).toMatch(/saldo/);
  });
  test("não aceita recebimento acima da medição nem sinal bancário invertido",()=>{
    const data=fixture();data.transacoes[0].valor=150;
    expect(pay(data,"medicao").resumo.motivo).toMatch(/saldo/);
    data.transacoes[0].valor=-100;
    expect(pay(data,"medicao").resumo.motivo).toMatch(/direção/);
  });
  test.each(["amount","direction","cancelled","duplicate"])("recusa vínculo inválido: %s",kind=>{
    const data=fixture();data.notasFiscais[0].pagamentos=[{id:"real",valor:100,data:"2026-10-22"}];
    if(kind==="amount")data.notasFiscais[0].pagamentos[0].valor=10;
    if(kind==="direction")data.transacoes[0].valor=100;
    if(kind==="cancelled")data.notasFiscais[0].status="cancelada";
    if(kind==="duplicate")data.transacoes.push({id:"other",valor:-100,status:"conciliado",vinculo:{pagamentoId:"real"}});
    const result=link(data);expect(result.resumo.ok).toBe(false);expect(result.data).toBe(data);
  });
  test("vincula e desvincula ambos os espelhos preservando pagamento, caixa e DRE",()=>{
    const data=fixture();const real={id:"real",valor:100,data:"2026-10-22",conciliado:false};
    data.notasFiscais[0].pagamentos=[real];data.pedidos[0].pagamentos=[{...real}];
    const before=buildLegacyFinancialFacts(data);
    const linked=link(data);expect(linked.resumo.ok).toBe(true);
    for(const section of ["pedidos","notasFiscais"])expect(linked.data[section][0].pagamentos[0]).toMatchObject({id:"real",valor:100,data:real.data,transacaoId:"bank",conciliado:true});
    const undone=desfazerConciliacao(linked.data,"bank",actor,"Associação incorreta");
    expect(undone.resumo.ok).toBe(true);
    for(const section of ["pedidos","notasFiscais"])expect(undone.data[section][0].pagamentos).toEqual([{...real,transacaoId:null}]);
    expect(buildLegacyFinancialFacts(undone.data)).toEqual(before);
  });
});
