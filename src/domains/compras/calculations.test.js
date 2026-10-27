import {
  totalPedido,
  totalPagoPedido,
  saldoPagamentoPedido,
  statusPagamentoPedido,
  analisePreco,
  mapaGerencialCompras,
  proximoNumeroPedido,
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

  test("o último preço é o da compra mais recente, em qualquer ordem da lista", () => {
    const antiga = { data: "2026-01-12", preco: 10, qtd: 10 };
    const recente = { data: "2026-06-12", preco: 20, qtd: 10 };
    expect(analisePreco([recente, antiga]).ultimo).toBe(20);
    expect(analisePreco([antiga, recente]).ultimo).toBe(20);
    expect(analisePreco([antiga, recente]).variacao).toBe(100);
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

describe("numeração de pedido de compra",()=>{
  it("usa o maior número existente e não repete quando a contagem fica para trás",()=>{
    expect(proximoNumeroPedido([])).toBe("PC-0001");
    // Antes: 2 pedidos -> PC-0003, que já existia e o servidor recusava.
    expect(proximoNumeroPedido([{numero:"PC-0001"},{numero:"PC-0003"}])).toBe("PC-0004");
    expect(proximoNumeroPedido([{numero:"PC-0002"},{numero:"NF 55"},{numero:"pc-0009"}])).toBe("PC-0010");
    expect(proximoNumeroPedido([{numero:"X"},{numero:"Y"}])).toBe("PC-0003");
  });
});

describe("recebimento independente do pagamento (C1.2)",()=>{
  it("pedido enviado e não pago entra na fila de recebimentos",()=>{
    const data={pedidos:[
      {id:"p-1",obraId:"o-1",status:"enviado",previsao:"",itens:[{qtd:10,precoUnit:5,qtdRecebida:0}],pagamentos:[]},
      {id:"p-2",obraId:"o-1",status:"enviado",previsao:"",itens:[{qtd:1,precoUnit:5,qtdRecebida:1}],pagamentos:[]},
      {id:"p-3",obraId:"o-1",status:"rascunho",itens:[{qtd:1,precoUnit:5,qtdRecebida:0}],pagamentos:[]},
    ]};
    expect(mapaGerencialCompras(data,["o-1"],"2026-10-22").fila.recebimentos).toBe(1);
  });
});

