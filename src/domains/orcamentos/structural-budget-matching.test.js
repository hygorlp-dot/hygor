import { describe, expect, it } from "vitest";
import { compatibleStructuralItem, memoryBudgetItems, structuralOrigin, structuralService } from "./structural-budget-matching";

describe("destinos dos quantitativos estruturais", () => {
  it.each([
    ["CONCRETAGEM DE LAJES EM SISTEMA DE FÔRMAS MANUSEÁVEIS, COM CONCRETO USINADO", "concreto"],
    ["ESCAVAÇÃO MECANIZADA PARA COLOCAÇÃO DE FÔRMAS", "escavacao"],
    ["REATERRO MECANIZADO DE VALA", "reaterro"],
    ["CONCRETO MAGRO PARA LASTRO", "magro"],
    ["MONTAGEM E DESMONTAGEM DE FÔRMA DE PILARES", "forma"],
    ["FABRICAÇÃO DE FÔRMA PARA VIGAS", "forma"],
    ["MONTAGEM E DESMONTAGEM DE FÔRMA DE VIGA, ESCORAMENTO COM GARFO DE MADEIRA, PÉ-DIREITO SIMPLES, EM CHAPA DE MADEIRA", "forma"],
    ["ESCORAMENTO DE FÔRMAS DE LAJE", "escoramento"],
    ["ARMAÇÃO DE PILAR UTILIZANDO AÇO CA-50 DE 10 MM", "aco"],
    ["TELA SOLDADA NERVURADA Q-92", "aco"],
  ])("classifica o serviço principal de %s", (description, expected) => {
    expect(structuralService(description)).toBe(expected);
  });
  it("não mistura serviços da mesma unidade nem converte lastro de área para volume", () => {
    const row = { key: "concreto", unit: "m³" };
    expect(compatibleStructuralItem(row, { descricao: "Concretagem de sapata", unidade: "M3" })).toBe(true);
    for (const descricao of ["Escavação", "Reaterro", "Concreto magro para lastro", "Escoramento de fôrmas"]) {
      expect(compatibleStructuralItem(row, { descricao, unidade: "M3" })).toBe(false);
    }
    expect(compatibleStructuralItem({ key: "magro", unit: "m²" }, { descricao: "Concreto magro para lastro", unidade: "M3" })).toBe(false);
    expect(compatibleStructuralItem({ key: "aco-10", unit: "kg" }, { descricao: "Armação de pilares", unidade: "KG" })).toBe(true);
  });
  it("identifica pavimento, elemento e hierarquia do destino", () => {
    expect(structuralOrigin("fundacao")).toEqual({ floor: "Fundação", element: "Sapatas" });
    expect(structuralOrigin("pavimento1-pilares")).toEqual({ floor: "1º pavimento", element: "Pilares" });
    expect(structuralOrigin("reservatorio-laje")).toEqual({ floor: "Reservatório", element: "Laje" });
    const items = memoryBudgetItems({ etapas: [{ id: "floor", nome: "Cobertura" }, { id: "element", nome: "Vigas", parentId: "floor" }], itens: [{ id: "i", etapaId: "element", descricao: "Concretagem" }] });
    expect(items[0].stagePath).toBe("Cobertura › Vigas");
    expect(items[0].codigoItem).toBe("1.1.1");
  });
});
