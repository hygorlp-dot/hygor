import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// Bug real (29/09/2026): "Aprovar e adotar baseline" no editor do orçamento
// respondia sempre "Orçamento não encontrado". O botão usava
// onClick={aprovarEAdotarBaseline} e o evento do clique chegava como
// budgetId - o valor padrão do parâmetro (selOrc) só vale para undefined.
const source = readFileSync(resolve(process.cwd(), "src/domains/orcamentos/components/OrcamentoView.jsx"), "utf8");

it("nenhum botão entrega o evento do clique como id do orçamento a aprovar", () => {
  expect(source).toContain("aprovarEAdotarBaseline(orc.id)");
  expect(source).not.toMatch(/onClick=\{aprovarEAdotarBaseline\}/);
});

it("a aprovação só usa o parâmetro quando ele é um id de verdade", () => {
  expect(source).toMatch(/typeof budgetId==="string"&&budgetId\?budgetId:selOrc/);
});
