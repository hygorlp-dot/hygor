import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Nota: calcSaldos/saldoDe/baixarPorComposicao e o comando de estorno de
// movimento de estoque foram extraídos para src/domains/estoque/ (Onda 1 do
// raio-X, 25/08/2026) - este teste passou a checar os arquivos novos em vez
// de LegacyApp.jsx, mas o invariante que ele protege é o mesmo de sempre.
// A própria tela de Estoque foi extraída para
// src/domains/estoque/components/EstoqueView.jsx na Onda 7 (26/08/2026).
describe("DATA-002 — estorno de movimento de estoque",()=>{
  const legacySource=fs.readFileSync(path.join(process.cwd(),"src","LegacyApp.jsx"),"utf8");
  const estoqueViewSource=fs.readFileSync(path.join(process.cwd(),"src","domains","estoque","components","EstoqueView.jsx"),"utf8");
  const commandsSource=fs.readFileSync(path.join(process.cwd(),"src","domains","estoque","commands.js"),"utf8");
  const calculationsSource=fs.readFileSync(path.join(process.cwd(),"src","domains","estoque","calculations.js"),"utf8");

  it("a tela exige motivo e delega o estorno ao comando, sem filtrar o registro localmente",()=>{
    const block=estoqueViewSource.slice(estoqueViewSource.indexOf("const excluirMov ="),estoqueViewSource.indexOf("//  Composição",estoqueViewSource.indexOf("const excluirMov =")));
    expect(block).toContain("Motivo do estorno do movimento de estoque");
    expect(block).toContain("STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED");
    expect(block).not.toContain("movEstoque: (data.movEstoque||[]).filter");
  });

  it("o comando mantém o fato e exige motivo no lugar de removê-lo fisicamente",()=>{
    const block=commandsSource.slice(commandsSource.indexOf("STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED)"),commandsSource.indexOf("command.payload?.composition ||"));
    expect(block).toContain('status: "estornado"');
    expect(block).toContain("motivoEstorno");
    expect(block).not.toContain(".filter(item => item.id !==");
  });

  it("exclui movimentos estornados do saldo",()=>{
    expect(calculationsSource).toContain("inactiveStatus");
    expect(calculationsSource.slice(calculationsSource.indexOf("export const calcSaldos"))).toContain("inactiveStatus");
  });

  it("exclui movimentos estornados das curvas ABC (calcCurvaABC/calcCurvaABCServicos, ainda em LegacyApp.jsx)",()=>{
    const abc=legacySource.slice(legacySource.indexOf("const calcCurvaABC ="),legacySource.indexOf("// Curva ABC por COMPOSICAO"));
    expect(abc).toContain("estornado");
  });
});
