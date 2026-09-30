import { describe, expect, it } from "vitest";
import { numeracaoEap } from "./export-hierarchy.js";

// Recorte real do BA1-15 (29/09/2026): PILARES/VIGAS/LAJES aparecem sob dois
// pavimentos diferentes e a etapa-mãe da cobertura vem depois das filhas no
// array de etapas do orçamento.
const etapas = [
  { id: "prelim", parentId: "" }, { id: "canteiro", parentId: "prelim" }, { id: "muros", parentId: "prelim" },
  { id: "sup1", parentId: "" }, { id: "pil1", parentId: "sup1" }, { id: "vig1", parentId: "sup1" },
  { id: "pilCob", parentId: "cob" }, { id: "vigCob", parentId: "cob" }, { id: "cob", parentId: "" },
];
const t = (id, etapaId) => ({ id, etapaId });

describe("numeracaoEap", () => {
  it("numera por nível e reinicia a contagem em cada etapa-mãe", () => {
    const tarefas = [t("a", "prelim"), t("b", "canteiro"), t("c", "muros"), t("d", "sup1"), t("e", "pil1"), t("f", "vig1"), t("g", "cob"), t("h", "pilCob"), t("i", "vigCob")];
    const eap = numeracaoEap(tarefas, etapas);
    expect(tarefas.map(x => eap.get(x.id).codigo)).toEqual(["1", "1.1", "1.2", "2", "2.1", "2.2", "3", "3.1", "3.2"]);
    expect(tarefas.map(x => eap.get(x.id).nivel)).toEqual([0, 1, 1, 0, 1, 1, 0, 1, 1]);
  });

  it("atividade avulsa (sem etapa) fica no primeiro nível", () => {
    const eap = numeracaoEap([t("a", "prelim"), t("b", "canteiro"), { id: "x" }], etapas);
    expect(eap.get("x")).toEqual({ nivel: 0, codigo: "2" });
  });

  it("subetapa cuja mãe não está no cronograma não inventa um nível vazio", () => {
    const eap = numeracaoEap([t("b", "canteiro"), t("c", "muros")], etapas);
    expect(eap.get("b")).toEqual({ nivel: 0, codigo: "1" });
    expect(eap.get("c")).toEqual({ nivel: 0, codigo: "2" });
  });

  it("não quebra sem tarefas ou sem etapas", () => {
    expect(numeracaoEap(undefined, undefined).size).toBe(0);
    expect(numeracaoEap([{ id: "x", etapaId: "sumiu" }], undefined).get("x")).toEqual({ nivel: 0, codigo: "1" });
  });
});
