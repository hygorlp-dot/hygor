import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lê como texto (não importa os módulos) pelo mesmo motivo de
// LegacyApp.dre-wiring.test.js: LegacyApp.jsx é grande demais e carrega
// efeitos colaterais para importar num teste de contrato.
const legacySource = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
const primitivesSource = readFileSync(resolve(process.cwd(), "src/design-system/tokens/primitives.css"), "utf8");

const extractLegacyColor = key => {
  const match = legacySource.match(new RegExp(`\\b${key}:\\s*"(#[0-9A-Fa-f]{6})"`));
  if (!match) throw new Error(`Não achei C.${key} em src/LegacyApp.jsx - o objeto C mudou de formato?`);
  return match[1].toLowerCase();
};

const extractToken = name => {
  const match = primitivesSource.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6});`));
  if (!match) throw new Error(`Não achei --${name} em primitives.css - o token foi renomeado?`);
  return match[1].toLowerCase();
};

// Paridade confirmada em 17/08/2026 (ver docs/ROADMAP_DESIGN.md, Fase 1).
// C continua sendo hex literal de propósito - centenas de usos concatenam
// um sufixo hex de opacidade (`${C.blue}0D`), o que quebraria se C
// referenciasse var(--token) diretamente. Este teste é a garantia de que
// os VALORES continuam batendo, já que a REFERÊNCIA não é compartilhada.
describe("paridade de cor entre C (legado) e os tokens do design-system", () => {
  const paresQueDevemBater = [
    ["bg", "arcd-gray-50"],
    ["surface", "arcd-gray-0"],
    ["border", "arcd-gray-200"],
    ["line", "arcd-gray-200"],
    ["yellow", "arcd-gold-400"],
    ["yellowD", "arcd-gold-600"],
    ["yellowDim", "arcd-gold-300"],
    ["text", "arcd-gray-900"],
    ["muted", "arcd-gray-600"],
    ["subtle", "arcd-gray-800"],
    ["green", "arcd-green-500"],
    ["red", "arcd-red-500"],
    ["blue", "arcd-blue-500"],
    ["orange", "arcd-orange-500"],
    ["purple", "arcd-purple-500"],
  ];

  it.each(paresQueDevemBater)("C.%s bate com --%s", (chaveLegado, tokenDesignSystem) => {
    expect(extractLegacyColor(chaveLegado)).toBe(extractToken(tokenDesignSystem));
  });

  // Divergências conhecidas e não resolvidas (decisão de marca pendente,
  // não mecânica - ver docs/ROADMAP_DESIGN.md, Fase 1, item 3). Este teste
  // não falha nelas de propósito: falharia todo dia até alguém decidir.
  // Serve só de documentação executável - se algum dia baterem, o teste
  // acima de paresQueDevemBater é o lugar certo para movê-las.
  it("card2/ivory e gray-100 são uma divergência conhecida, não um bug novo", () => {
    expect(extractLegacyColor("card2")).toBe("#ededed");
    expect(extractToken("arcd-gray-100")).toBe("#e8e8e8");
  });
});
