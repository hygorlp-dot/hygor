import { describe, expect, it } from "vitest";
import { buildPurchaseWorkspace, matchesPurchaseSearch, purchaseDeadline } from "./workspace";

const data = () => ({
  obras:[{id:"a",name:"Alameda"},{id:"b",name:"Outra obra"}],
  materiais:[{id:"m",descricao:"Cimento CP II"}],fornecedores:[{id:"f",nome:"Depósito Central"}],
  solicitacoesCompra:[
    {id:"r1",numero:"SC-1",obraId:"a",status:"enviada",necessidade:"2026-10-22",itens:[{descricaoRef:"Areia"}]},
    {id:"r2",numero:"SC-2",obraId:"a",status:"em_analise",aprovacaoInstanciaId:"apr",itens:[]},
    {id:"r3",numero:"SC-3",obraId:"a",status:"em_analise",itens:[]},
    {id:"r4",obraId:"b",status:"enviada",itens:[]},
    {id:"cancel",obraId:"a",status:"cancelada",itens:[]},
  ],
  instanciasAprovacao:[{id:"apr",status:"em_andamento",resultadosEtapas:[{status:"em_andamento",aprovadoresElegiveis:[{id:"u",nome:"Ana"}]}]}],
  cotacoes:[{id:"c1",numero:"COT-1",solicitacaoId:"r3",obraId:"a",materialId:"m",qtd:10,status:"aberta",propostas:[]}],
  pedidos:[
    {id:"draft",obraId:"a",status:"rascunho",itens:[{materialId:"m",qtd:10,precoUnit:5}]},
    {id:"unpaid",obraId:"a",status:"enviado",previsao:"2026-10-24",fornecedorId:"f",itens:[{materialId:"m",qtd:10,precoUnit:5,qtdRecebida:2}]},
    {id:"paid",obraId:"a",status:"enviado",previsao:"2026-10-20",pagamentos:[{valor:50}],itens:[{materialId:"m",qtd:10,precoUnit:5,qtdRecebida:0}]},
    {id:"done",obraId:"a",status:"recebido",itens:[{materialId:"m",qtd:10,precoUnit:5,qtdRecebida:10}]},
    {id:"cancelled",obraId:"a",status:"cancelado",itens:[]},
  ],
});

describe("fila operacional de compras", () => {
  it("mantém a obra, a aprovação e a cotação sem repetir solicitações já em cotação", () => {
    const result = buildPurchaseWorkspace(data(), ["a"], "2026-10-23");
    expect(result.counts).toEqual({solicitacoes:1,aprovacoes:1,cotacoes:1,pedidos:1,recebimentos:2});
    expect(result.rows.map(row=>row.id)).not.toContain("r3");
    expect(result.rows.every(row=>row.obra==="Alameda")).toBe(true);
    expect(result.rows.find(row=>row.id==="r2")).toMatchObject({stage:"aprovacoes",responsible:"Ana",action:"Ver aprovação"});
  });
  it("separa entrega de quitação e exclui pedidos cancelados ou inteiramente recebidos", () => {
    const result = buildPurchaseWorkspace(data(), ["a"], "2026-10-23");
    expect(result.rows.find(row=>row.id==="unpaid")).toMatchObject({stage:"recebimentos",total:50,detail:expect.stringContaining("Pagamento em aberto")});
    expect(result.rows.find(row=>row.id==="paid")).toMatchObject({stage:"recebimentos",detail:expect.stringContaining("Pago")});
    expect(result.rows.map(row=>row.id)).not.toEqual(expect.arrayContaining(["done","cancelled"]));
    expect(result.rows[0].id).toBe("paid");
    expect(result.overdue).toBe(2);
  });
  it("usa a remessa ainda não atendida para ordenar o prazo", () => {
    const state=data();
    state.pedidos[1].itens[0]={materialId:"m",qtd:10,precoUnit:5,qtdRecebida:4,remessas:[{data:"2026-10-10",qtd:4},{data:"2026-10-21",qtd:6}]};
    expect(buildPurchaseWorkspace(state,["a"],"2026-10-23").rows.find(row=>row.id==="unpaid").date).toBe("2026-10-21");
  });
  it("recalcula a fila após receber e não altera os registros originais", () => {
    const state=data();const before=JSON.stringify(state);
    buildPurchaseWorkspace(state,["a","b"],"2026-10-23");
    expect(JSON.stringify(state)).toBe(before);
    state.pedidos[1].itens[0].qtdRecebida=10;
    expect(buildPurchaseWorkspace(state,["a"],"2026-10-23").rows.map(row=>row.id)).not.toContain("unpaid");
  });
  it("não esconde solicitações bloqueadas ou reprovadas atrás de uma cotação", () => {
    const state=data();state.cotacoes[0].solicitacaoId="r2";state.instanciasAprovacao[0].status="reprovada";
    expect(buildPurchaseWorkspace(state,["a"],"2026-10-23").rows.find(row=>row.id==="r2")).toMatchObject({stage:"aprovacoes",detail:"Solicitação reprovada"});
  });
  it("aceita ausência de cadastros e escopo sem obras", () => {
    expect(buildPurchaseWorkspace({},[],"2026-10-23").rows).toEqual([]);
  });
});
describe("busca e prazo compreensíveis", () => {
  it("combina palavras em campos distintos, ignorando ordem e acento", () => {
    expect(matchesPurchaseSearch("central cimento", "Cimento CP II", "Depósito Central")).toBe(true);
    expect(matchesPurchaseSearch("alameda aco", "AÇO CA-50", "Alameda")).toBe(true);
    expect(matchesPurchaseSearch("cimento inexistente", "Cimento", "Central")).toBe(false);
    expect(matchesPurchaseSearch("  ", null)).toBe(true);
  });
  it("distingue ausência, atraso e proximidade sem depender do fuso do navegador", () => {
    expect(purchaseDeadline("", "2026-10-23")).toMatchObject({tone:"neutral"});
    expect(purchaseDeadline("2026-10-22", "2026-10-23")).toMatchObject({tone:"danger",rank:0});
    expect(purchaseDeadline("2026-10-23", "2026-10-23")).toMatchObject({label:"Vence hoje"});
    expect(purchaseDeadline("2026-10-26", "2026-10-23")).toMatchObject({tone:"warning"});
    expect(purchaseDeadline("2026-10-27", "2026-10-23")).toMatchObject({tone:"success"});
  });
});
