import { describe, expect, it } from "vitest";
import { avaliacaoFornecedor, explicacaoNotaFornecedor, textoNotaFornecedor } from "./supplier-rating.js";

const hoje="2026-10-23";
const remessa=(id,data,recebido)=>({id,materialId:"m",qtd:10,qtdRecebida:recebido?10:0,previsao:data,
  recebimentos:recebido?[{data:recebido,qtd:10}]:[]});
// Exemplo do docs/compras-avaliacao-fornecedor.md.
const data=()=>({
  fornecedores:[{id:"f-1"},{id:"f-2"}],
  pedidos:[
    {id:"p-1",fornecedorId:"f-1",status:"recebido",data:"2026-09-01",itens:[remessa("a","2026-09-10","2026-09-09"),remessa("b","2026-09-15","2026-09-15")]},
    {id:"p-2",fornecedorId:"f-1",status:"recebido",data:"2026-09-20",itens:[remessa("c","2026-10-01","2026-10-01")]},
    {id:"p-3",fornecedorId:"f-1",status:"enviado",data:"2026-10-01",itens:[remessa("d","2026-10-10",null)]},
    {id:"p-4",fornecedorId:"f-1",status:"cancelado",data:"2026-10-05",itens:[remessa("e","2026-12-01",null)]},
    {id:"p-7",fornecedorId:"f-1",status:"recebido",data:"2026-10-15",itens:[]},
    // Fora da janela de 12 meses e rascunho não contam.
    {id:"p-5",fornecedorId:"f-1",status:"cancelado",data:"2025-09-01",itens:[]},
    {id:"p-6",fornecedorId:"f-1",status:"rascunho",data:"2026-10-20",itens:[]},
  ],
  notasFiscais:[
    {id:"n-1",fornecedorId:"f-1",emissao:"2026-09-10",divergencias:[]},
    {id:"n-2",fornecedorId:"f-1",emissao:"2026-10-02",divergencias:["Nota acima do recebido"]},
    {id:"n-3",fornecedorId:"f-1",emissao:"2026-10-02",status:"cancelada",divergencias:["x"]},
  ],
});

describe("avaliação de fornecedor (C2.3)",()=>{
  it("pondera pontualidade, notas e cancelamentos dos últimos 12 meses",()=>{
    const av=avaliacaoFornecedor(data(),"f-1",hoje);
    expect(av.criterios.pontualidade).toEqual({nota:7.5,positivos:3,total:4});
    expect(av.criterios.notas).toEqual({nota:5,positivos:1,total:2});
    expect(av.criterios.cancelamentos).toEqual({nota:8,positivos:4,total:5});
    expect(av.nota).toBe(6.9);
    expect(textoNotaFornecedor(av)).toBe("6,9");
    expect(explicacaoNotaFornecedor(av)).toBe("Prazo 7,5 (3/4 remessas no prazo) · Notas 5,0 (1/2 sem divergência) · Cancelamentos 8,0 (4/5 pedidos mantidos)");
  });

  it("nota rejeitada ou estornada não entra na avaliação, como no razão",()=>{
    const extra=status=>({id:`n-${status}`,fornecedorId:"f-1",emissao:"2026-10-02",status,divergencias:["x"]});
    const dados=data();
    dados.notasFiscais=[...dados.notasFiscais,extra("rejeitada"),extra("rejeitado"),extra("estornado")];
    expect(avaliacaoFornecedor(dados,"f-1",hoje).criterios.notas).toEqual({nota:5,positivos:1,total:2});
  });

  it("redistribui os pesos quando falta um critério e não dá nota sem histórico",()=>{
    const semNotas={...data(),notasFiscais:[]};
    // (7,5 × 0,5 + 8 × 0,2) ÷ 0,7 = 7,64
    expect(avaliacaoFornecedor(semNotas,"f-1",hoje).nota).toBe(7.6);
    const vazio=avaliacaoFornecedor(data(),"f-2",hoje);
    expect(vazio.nota).toBeNull();
    expect(textoNotaFornecedor(vazio)).toBe("sem histórico");
  });

  it("remessa vencida e não entregue derruba a pontualidade",()=>{
    const d=data();
    d.pedidos[2].itens[0].previsao="2026-11-30";
    expect(avaliacaoFornecedor(d,"f-1",hoje).criterios.pontualidade).toEqual({nota:10,positivos:3,total:3});
  });
});
