import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calcCurvaABC, calcCurvaABCServicos } from "./domains/estoque/calculations";

// Nota: calcSaldos/saldoDe/baixarPorComposicao e o comando de estorno de
// movimento de estoque foram extraídos para src/domains/estoque/ (Onda 1 do
// raio-X, 25/08/2026) - este teste passou a checar os arquivos novos em vez
// de LegacyApp.jsx, mas o invariante que ele protege é o mesmo de sempre.
// A própria tela de Estoque foi extraída para
// src/domains/estoque/components/EstoqueView.jsx na Onda 7 (26/08/2026).
describe("DATA-002 — estorno de movimento de estoque",()=>{
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

  // As curvas ABC saíram de LegacyApp.jsx para domains/estoque/calculations.js
  // em 29/09/2026: EstoqueView (extraída em 26/08) as chamava sem importar.
  it("exclui movimentos estornados das curvas ABC",()=>{
    const movs=[
      {tipo:"consumo",materialId:"cim",qtd:10,valorUnit:30,servicoId:"alv",data:"2026-09-01",descricao:"x"},
      {tipo:"consumo",materialId:"cim",qtd:99,valorUnit:30,servicoId:"alv",status:"estornado"},
      {tipo:"consumo",materialId:"are",qtd:5,valorUnit:10,status:"cancelado"},
    ];
    expect(calcCurvaABC(movs,[{id:"cim",descricao:"Cimento"}])).toEqual([{id:"cim",valor:300,nome:"Cimento",pctAcum:100,classe:"C"}]);
    expect(calcCurvaABCServicos(movs,[{id:"alv",nome:"Alvenaria"}]).map(x=>[x.nome,x.valor,x.execucoes])).toEqual([["Alvenaria",300,1]]);
  });
});
