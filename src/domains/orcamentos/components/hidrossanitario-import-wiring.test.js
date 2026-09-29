import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// Bug real (referência ARCD-Q59NWI, 29/09/2026): a pré-visualização do PDF
// hidrossanitário lia pdfPreviewCompleto.avisos (estado da importação
// ESTRUTURAL), que é zerado ao importar um hidrossanitário - a tela quebrava
// assim que o PDF era lido. Linha colada do bloco estrutural em cd99dfe.
const source = readFileSync(resolve(process.cwd(), "src/domains/orcamentos/components/OrcamentoView.jsx"), "utf8");
const start = source.indexOf('disciplinaMemoria==="hidrossanitario" && (() => {');
const section = source.slice(start, source.indexOf("})()}", start));

it("a seção hidrossanitária não lê o estado da importação estrutural", () => {
  expect(start).toBeGreaterThan(0);
  expect(section).toContain("pdfPreviewHidrossanitario");
  expect(section).not.toMatch(/pdfPreviewCompleto|pdfPreviewQuantitativos|pdfImportTargets/);
});
