import { describe, expect, it } from "vitest";
import { mergeThreeWay } from "../../../server/three-way-merge.js";
import { buildSectionDelta, compactAuditSnapshots, expandSectionDelta } from "./section-delta.js";

const orc = (id, extra = {}) => ({ id, nome: id, itens: [{ id: `${id}-i`, quantidade: 1 }], ...extra });

describe("delta de seção (envio só do que mudou)", () => {
  const base = [orc("a"), orc("b"), orc("c", { versionStatus: "aprovado" })];

  it("manda só o alterado, o incluído e o removido", () => {
    const proximo = [orc("a", { nome: "A2" }), orc("c", { versionStatus: "aprovado" }), orc("d")];
    const delta = buildSectionDelta(base, proximo);
    expect(delta.changed.map(o => o.id)).toEqual(["a", "d"]);
    expect(delta.original.map(o => o.id)).toEqual(["a", "b"]);
    expect(delta.removed).toEqual(["b"]);
    expect(JSON.stringify(delta).length).toBeLessThan(JSON.stringify({ proximo, base }).length);
  });

  it("dá o mesmo resultado da mesclagem que o envio completo, inclusive com registros que só o servidor tem", () => {
    const proximo = [orc("a", { nome: "A2" }), orc("b"), orc("c", { versionStatus: "aprovado" }), orc("d")];
    const atual = [orc("a"), orc("b", { nome: "B mudado por outra pessoa" }), orc("c", { versionStatus: "aprovado" }), orc("x-outra-obra")];
    const completo = mergeThreeWay(base, proximo, atual);
    const { incoming, base: baseExpandida } = expandSectionDelta(buildSectionDelta(base, proximo), atual);
    expect(mergeThreeWay(baseExpandida, incoming, atual)).toEqual(completo);
  });

  it("remoção continua sendo remoção depois de expandir", () => {
    const { incoming, base: b } = expandSectionDelta(buildSectionDelta(base, [orc("a"), orc("c", { versionStatus: "aprovado" })]), base);
    expect(mergeThreeWay(b, incoming, base).map(o => o.id)).toEqual(["a", "c"]);
  });

  it("volta ao envio completo quando a ordem muda ou a lista não tem id", () => {
    expect(buildSectionDelta(base, [base[1], base[0], base[2]])).toBeNull();
    expect(buildSectionDelta([1, 2], [1, 2, 3])).toBeNull();
    expect(buildSectionDelta([{ id: "a" }, { id: "a" }], [{ id: "a" }])).toBeNull();
    expect(buildSectionDelta({ a: 1 }, { a: 2 })).toBeNull();
  });

  it("recusa delta malformado", () => {
    expect(expandSectionDelta({ changed: [{ nome: "sem id" }], original: [], removed: [] }, base)).toBeNull();
    expect(expandSectionDelta("x", base)).toBeNull();
  });

  it("auditoria guarda só os registros alterados e ainda mostra remoções", () => {
    const { before, after } = compactAuditSnapshots({ orcamentos: base, config: { a: 1 } }, { orcamentos: [orc("a", { nome: "A2" }), orc("c", { versionStatus: "aprovado" })], config: { a: 2 } });
    expect(before.orcamentos.map(o => o.id)).toEqual(["a", "b"]);
    expect(after.orcamentos.map(o => o.id)).toEqual(["a"]);
    expect(before.config).toEqual({ a: 1 });
    expect(after.config).toEqual({ a: 2 });
  });
});
