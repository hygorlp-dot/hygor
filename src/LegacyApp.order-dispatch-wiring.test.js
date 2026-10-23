import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const compras=readFileSync(`${process.cwd()}/src/domains/compras/components/ComprasView.jsx`,"utf8");
const trecho=(inicio,fim)=>compras.slice(compras.indexOf(inicio),compras.indexOf(fim,compras.indexOf(inicio)));

describe("tela de envio do pedido ao fornecedor (C2.5)",()=>{
  it("envio e aceite passam pelos comandos do servidor",()=>{
    expect(trecho("const registrarEnvioPedido=async","const imprimirPedido=")).toMatch(/type:OPERATIONAL_COMMAND\.PURCHASE_ORDER_SENT_TO_SUPPLIER/);
    expect(trecho("const salvarAceitePedido=async","const moverCardKanban=")).toMatch(/type:OPERATIONAL_COMMAND\.PURCHASE_ORDER_SUPPLIER_ACCEPTED/);
  });
  it("oferece WhatsApp, e-mail e PDF, e mostra o aceite no pedido",()=>{
    expect(compras).toMatch(/linkWhatsApp\(forn\.telefone,texto\)/);
    expect(compras).toMatch(/linkEmailPedido\(forn\.email,assunto,texto\)/);
    expect(compras).toMatch(/Imprimir \/ PDF/);
    expect(compras).toMatch(/ACEITO · \{p\.aceiteFornecedor\.nome\}/);
    expect(compras).toMatch(/const podeEnviarPedido=\["admin","compras"\]\.includes/);
  });
});

describe("link de aceite do fornecedor (C2.5)",()=>{
  const app=readFileSync(`${process.cwd()}/src/App.jsx`,"utf8");
  const pagina=readFileSync(`${process.cwd()}/src/supplier-acceptance/SupplierAcceptancePage.jsx`,"utf8");
  const vercel=JSON.parse(readFileSync(`${process.cwd()}/vercel.json`,"utf8"));
  it("a tela gera o link pelo servidor e o leva na mensagem",()=>{
    expect(compras).toMatch(/const result=await gerarLinkAceitePedido\(p\.id\)/);
    expect(compras).toMatch(/\/aceite-pedido#\$\{result\.token\}/);
    expect(compras).toMatch(/conteudoEnvioPedido\(p,link\?\.url\|\|""\)/);
  });
  it("a página pública lê o código só do fragmento da URL e fala só com /api",()=>{
    expect(app).toMatch(/window\.location\.pathname === "\/aceite-pedido"/);
    expect(vercel.rewrites).toContainEqual({source:"/aceite-pedido",destination:"/index.html"});
    expect(pagina).toMatch(/window\.location\.hash/);
    expect(pagina).not.toMatch(/location\.search/);
    expect(pagina).toMatch(/action:"pedido-aceite-ver"/);
    expect(pagina).toMatch(/action:"pedido-aceite-confirmar"/);
    expect(pagina).not.toMatch(/LegacyApp/);
  });
});
