import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const source=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
const saveFlow=source.slice(source.indexOf("const salvarSolicitacao=async"),source.indexOf("// Instância de aprovação vinculada"));

describe("persistência formal da solicitação de materiais",()=>{
  it("aguarda a confirmação remota antes de fechar o formulário",()=>{
    expect(saveFlow).toMatch(/const result=await dispatchCommand\(/);
    expect(saveFlow).toMatch(/PURCHASE_REQUEST_SAVED/);
    expect(saveFlow.indexOf("await dispatchCommand(")).toBeLessThan(saveFlow.indexOf("setSolModal(null)"));
  });

  it("mantém o formulário aberto quando a fila não confirma",()=>{
    expect(saveFlow).toMatch(/if\(!result\?\.ok\)[\s\S]*?return false/);
    expect(saveFlow).toMatch(/O servidor não confirmou a solicitação/);
  });

  it("não filtra linhas incompletas antes da validação",()=>{
    expect(saveFlow).not.toMatch(/itens\|\|\[\]\)\.filter/);
    expect(saveFlow).toMatch(/validatePurchaseRequest\(f\)/);
  });

  it("registra a formalização com autor e horário",()=>{
    expect(saveFlow).toMatch(/formalizadoEm/);
    expect(saveFlow).toMatch(/formalizadoPorId/);
    expect(saveFlow).toMatch(/formalizadoPor/);
  });

  it("preserva o vínculo do item com o insumo ao normalizar a base",()=>{
    expect(source).toMatch(/materialId:i\.materialId\|\|"",referenciaId:i\.referenciaId/);
    expect(source).toMatch(/solicitacaoOrigemId:x\.solicitacaoOrigemId\|\|""/);
  });
  it("preserva a versão do fornecedor para permitir novas edições após recarga",()=>{
    expect(source).toMatch(/fornecedores:[\s\S]*?version:\s+Number\(x\.version \|\| 0\)/);
  });
  it("preserva a versão e a origem do insumo após recarga",()=>{
    expect(source).toMatch(/materiais:[\s\S]*?version:\s+Number\(x\.version\|\|0\)/);
    expect(source).toContain("OPERATIONAL_COMMAND.MATERIAL_SAVED");
    expect(source).toContain("OPERATIONAL_COMMAND.SUPPLIER_SAVED");
  });
});
