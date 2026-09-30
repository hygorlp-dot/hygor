import { describe, expect, it } from "vitest";
import { entradasParaDetalheAnalitico } from "./abc-detail-entries.js";

// Recorte real do BA1-15 (30/09/2026): ARCD001 usa SINAPI 89408 e ORSE
// 12943/12719 como sub-composições; ARCD003 usa SINAPI 94965.
const proprias = [
  { codigo: "ARCD001", itens: [
    { codigo: "89408", fonte: "SINAPI", tipoItem: "COMPOSICAO", coeficiente: 1 },
    { codigo: "12943", fonte: "ORSE", tipoItem: "COMPOSICAO", coeficiente: 24 },
    { codigo: "12719", fonte: "ORSE", tipoItem: "COMPOSICAO", coeficiente: 8 },
    { codigo: "00001379", fonte: "SINAPI", tipoItem: "INSUMO", coeficiente: 3 },
  ] },
  { codigo: "ARCD003", itens: [{ codigo: "94965", fonte: "SINAPI", tipoItem: "COMPOSICAO", coeficiente: .02 }] },
  { codigo: "ARCD999", itens: [{ codigo: "11111", fonte: "SINAPI", tipoItem: "COMPOSICAO" }] },
];
const itens = [
  { tipo: "item", codigo: "ARCD001", fonte: "PRÓPRIA" },
  { tipo: "item", codigo: "ARCD003", fonte: "PRÓPRIA" },
  { tipo: "item", codigo: "91926", fonte: "SINAPI" },
  { tipo: "item", codigo: "91926", fonte: "SINAPI" },
  { tipo: "titulo", codigo: "X" },
  { tipo: "item", codigo: "C-1", fonte: "COTAÇÃO" },
];

describe("entradasParaDetalheAnalitico", () => {
  it("pede à base as sub-composições das composições próprias usadas", () => {
    const chaves = entradasParaDetalheAnalitico(itens, proprias).map(e => `${e.fonte}|${e.codigo}`);
    expect(chaves).toEqual(expect.arrayContaining(["SINAPI|89408", "ORSE|12943", "ORSE|12719", "SINAPI|94965", "SINAPI|91926"]));
  });

  it("não pede insumo, própria não usada, cotação, título nem código repetido", () => {
    const chaves = entradasParaDetalheAnalitico(itens, proprias).map(e => `${e.fonte}|${e.codigo}`);
    expect(chaves).not.toContain("SINAPI|00001379");
    expect(chaves).not.toContain("SINAPI|11111");
    expect(chaves.some(c => c.startsWith("PRÓPRIA|") || c.startsWith("COTAÇÃO|"))).toBe(false);
    expect(chaves.filter(c => c === "SINAPI|91926")).toHaveLength(1);
  });

  it("não quebra sem itens ou sem composições próprias", () => {
    expect(entradasParaDetalheAnalitico(undefined, undefined)).toEqual([]);
    expect(entradasParaDetalheAnalitico([{ tipo: "item", codigo: "1", fonte: "SINAPI" }], undefined)).toHaveLength(1);
  });
});
