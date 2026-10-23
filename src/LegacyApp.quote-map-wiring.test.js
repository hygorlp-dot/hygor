import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const compras=readFileSync(`${process.cwd()}/src/domains/compras/components/ComprasView.jsx`,"utf8");
const legacy=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
const trecho=(source,inicio,fim)=>source.slice(source.indexOf(inicio),source.indexOf(fim,source.indexOf(inicio)));

describe("tela do mapa de cotação (C1.3)",()=>{
  it("cotação salva itens e preço por item de cada fornecedor",()=>{
    const salvar=trecho(compras,"const salvarCotacao = async","const excluirCotacao=");
    expect(salvar).toMatch(/itens:itens\.map\(i=>\(\{id:i\.id,materialId:i\.materialId/);
    expect(salvar).toMatch(/precos:Object\.fromEntries/);
    expect(salvar).not.toMatch(/precoUnit: Number\(p\.precoUnit\)/);
  });

  it("a solicitação inteira vira uma cotação só",()=>{
    const abrir=trecho(compras,"const abrirCotacaoDaSolicitacao=","const salvarPedido = async");
    expect(abrir).toMatch(/const origem=item\?\[item\]:\(sol\.itens\|\|\[\]\)/);
    expect(compras).toMatch(/COTAR TODOS OS ITENS/);
    const mover=trecho(compras,"const moverCardKanban=","const comprasAbas=");
    expect(mover).toMatch(/abrirCotacaoDaSolicitacao\(card\.registro\);/);
  });

  it("a decisão é por item e gera os pedidos pelo comando do servidor",()=>{
    const decidir=trecho(compras,"const decidirCotacao = async","const moverCardKanban=");
    expect(decidir).toMatch(/type:OPERATIONAL_COMMAND\.QUOTE_MAP_DECIDED/);
    expect(decidir).toMatch(/avaliarEscolhasCotacao\(cot,escolhas,justificativas\)/);
    expect(compras).not.toMatch(/PURCHASE_ORDER_CREATED_FROM_QUOTE/);
    expect(compras).toMatch(/escolhaPrecisaJustificativa\(l,sel\)/);
  });

  it("o carregamento preserva o preço por item das propostas",()=>{
    expect(legacy).toMatch(/precos:\{\.\.\.p\.precos\}/);
  });
});

describe("nota do fornecedor no mapa de cotação (C2.3)",()=>{
  it("o cabeçalho de cada fornecedor e a decisão por item mostram a nota",()=>{
    expect(compras).toMatch(/avaliacoesFornecedores\(data, today\(\)\)/);
    expect(compras).toMatch(/Nota \{textoNotaFornecedor\(av\)\}/);
    expect(compras).toMatch(/nota \$\{textoNotaFornecedor\(avaliacaoForn\.get/);
  });
});
