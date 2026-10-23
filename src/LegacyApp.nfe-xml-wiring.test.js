import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const legacy=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
const trecho=(inicio,fim)=>legacy.slice(legacy.indexOf(inicio),legacy.indexOf(fim,legacy.indexOf(inicio)));

describe("Central Fiscal importa o XML da NF-e (C3.1)",()=>{
  it("lê o XML no navegador, acha o fornecedor pelo CNPJ e sugere o pedido",()=>{
    const importar=trecho("const importarXmlNfe=async","const salvar=async");
    expect(importar).toMatch(/lerXmlNfe\(await file\.text\(\)\)/);
    expect(importar).toMatch(/fornecedorPorDocumento\(data\.fornecedores,nota\.documentoFornecedor\)/);
    expect(importar).toMatch(/sugerirPedidosParaNota\(data,/);
    expect(importar).toMatch(/itensNota:ligarItensAoPedido\(/);
    expect(importar).not.toMatch(/console\./);
  });
  it("mostra os itens com vínculo editável e as divergências",()=>{
    expect(legacy).toMatch(/Importar XML da NF-e \(preenche a nota e confere com o pedido\)/);
    expect(legacy).toMatch(/divergenciasDoItem\(it,itemPed\)/);
  });
});
