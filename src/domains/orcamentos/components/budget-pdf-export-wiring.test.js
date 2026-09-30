import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// Crítica Impeccable das exportações (30/09/2026): o PDF do orçamento tinha
// perdido símbolos numa conversão de codificação - a fórmula do BDI saía
// "(1 + L)  (1  I) ]  1" (sem ÷ e −), a área "260.36 m" e o custo "/m" (sem
// ²). Fórmula de BDI errada num documento entregue ao cliente é erro técnico,
// não só visual.
const source = readFileSync(resolve(process.cwd(), "src/domains/orcamentos/components/OrcamentoView.jsx"), "utf8");
const inicio = source.indexOf("const exportPDF = () => {");
const trecho = source.slice(inicio, source.indexOf("window.open(", inicio));

it("a fórmula do BDI no PDF mantém divisão e subtração (Acórdão 2622/2013)", () => {
  expect(inicio).toBeGreaterThan(0);
  expect(trecho).toContain("× (1 + DF) × (1 + L) ÷ (1 − I) ] − 1");
});

it("área e custo por área saem em metro quadrado", () => {
  expect(trecho).toContain('" m²"');
  expect(trecho).toContain("/m²</td>");
  expect(trecho).not.toMatch(/\/m<\/td>/);
});

it("o botão de impressão não flutua sobre o cabeçalho do documento", () => {
  expect(trecho).toContain('<div class="acoes"><button class="btn"');
  expect(trecho).not.toMatch(/\.btn\{position:fixed/);
  expect(trecho).toMatch(/@page\{size:A4 portrait/);
});
