import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("DATA-002 — estorno de movimento de estoque",()=>{
  const source=fs.readFileSync(path.join(process.cwd(),"src","LegacyApp.jsx"),"utf8");

  it("mantém o fato e exige motivo no lugar de removê-lo fisicamente",()=>{
    const block=source.slice(source.indexOf("const excluirMov ="),source.indexOf("//  Composição",source.indexOf("const excluirMov =")));
    expect(block).toContain('status:"estornado"');
    expect(block).toContain("motivoEstorno");
    expect(block).not.toContain("movEstoque: (data.movEstoque||[]).filter");
  });

  it("exclui movimentos estornados do saldo e das curvas ABC",()=>{
    const saldo=source.slice(source.indexOf("const calcSaldos ="),source.indexOf("const saldoDe ="));
    const abc=source.slice(source.indexOf("const calcCurvaABC ="),source.indexOf("// Curva ABC por COMPOSICAO"));
    expect(saldo).toContain("estornado");
    expect(abc).toContain("estornado");
  });
});
