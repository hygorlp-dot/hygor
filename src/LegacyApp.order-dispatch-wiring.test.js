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
