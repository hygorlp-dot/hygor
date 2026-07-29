import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "src", "LegacyApp.jsx"), "utf8");

describe("vínculo de Compras com orçamento", () => {
  test("solicitação resolve a baseline ou o rascunho da obra selecionada", () => {
    expect(source).toContain("const contextoOrcamento=getPlanningBudget(data,form.obraId);");
    expect(source).toContain("const orcObra=contextoOrcamento.budget;");
    expect(source).toContain('contextoOrcamento.source==="rascunho"');
  });

  test("pedidos e cotações usam o mesmo contexto operacional do orçamento", () => {
    expect(source).toContain("()=>getPlanningBudget(data,obraAtual)");
    expect(source).toContain("() => niveisUmOrcamento(contextoOrcamentoCompra.budget)");
  });
});
