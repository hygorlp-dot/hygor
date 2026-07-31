import {
  totalPedido,
  totalPagoPedido,
  saldoPagamentoPedido,
  statusPagamentoPedido,
  analisePreco,
  mapaGerencialCompras,
} from "./calculations";

describe("domínio de compras", () => {
  const pedido = {
    itens: [
      { qtd: 2, precoUnit: 30 },
      { qtd: 1, precoUnit: 40 },
    ],
    pagamentos: [
      { valor: 60, origem: "empresa" },
      { valor: 20, origem: "caixa_obra" },
    ],
  };

  test("mantém total, pagamentos parciais e saldo consistentes", () => {
    expect(totalPedido(pedido)).toBe(100);
    expect(totalPagoPedido(pedido)).toBe(80);
    expect(saldoPagamentoPedido(pedido)).toBe(20);
    expect(statusPagamentoPedido(pedido)).toBe("parcial");
  });

  test("ignora variações de estorno no saldo e nos indicadores gerenciais", () => {
    const comEstorno={
      ...pedido,id:"p-est",obraId:"o1",status:"enviado",
      pagamentos:[
        {valor:60,origem:"empresa",conciliado:true},
        {valor:40,origem:"caixa_obra",status:"ESTORNADA",conciliado:false},
      ],
    };
    expect(totalPagoPedido(comEstorno)).toBe(60);
    expect(saldoPagamentoPedido(comEstorno)).toBe(40);
    const mapa=mapaGerencialCompras({pedidos:[comEstorno]},["o1"],"2026-07-23");
    expect(mapa.origens).toMatchObject({empresa:60,caixa_obra:0});
    expect(mapa.semConciliacao).toHaveLength(0);
  });

  test("calcula preço médio ponderado pela quantidade", () => {
    const resultado = analisePreco([
      { preco: 20, qtd: 1 },
      { preco: 10, qtd: 9 },
    ]);
    expect(resultado.medio).toBe(11);
    expect(resultado.menor).toBe(10);
    expect(resultado.ultimo).toBe(20);
  });

  test("consolida riscos e cobertura do mapa gerencial", () => {
    const data = {
      obras: [{ id: "o1" }],
      fornecedores: [{ id: "f1", nome: "Fornecedor 1" }],
      solicitacoesCompra: [{ id: "s1", obraId: "o1", status: "enviada" }],
      cotacoes: [],
      pedidos: [{
        id: "p1", obraId: "o1", fornecedorId: "f1", status: "enviado",
        previsao: "2026-07-20", itens: [{ qtd: 2, precoUnit: 50, qtdRecebida: 0 }],
        pagamentos: [],
      }],
    };
    const mapa = mapaGerencialCompras(data, ["o1"], "2026-07-23");
    expect(mapa.totalComprometido).toBe(100);
    expect(mapa.totalPendente).toBe(100);
    expect(mapa.atrasados).toHaveLength(1);
    expect(mapa.coberturaCotacao).toBe(0);
    expect(mapa.alertas.some(a => a.nivel === "critico")).toBe(true);
  });
});
