import { describe, expect, it } from "vitest";
import {
  daysUntil,
  THIRD_PARTY_KANBAN_COLUMNS,
  thirdPartyKanbanColumn,
} from "./workflow";

describe("fluxo de terceirizados", () => {
  it("mantém a sequência operacional do contrato", () => {
    expect(THIRD_PARTY_KANBAN_COLUMNS.map(column => column.v)).toEqual([
      "contratado",
      "andamento",
      "pausado",
      "concluido",
    ]);
  });

  it("usa andamento como estado seguro para valor legado desconhecido", () => {
    expect(thirdPartyKanbanColumn("concluido").l).toBe("Concluído");
    expect(thirdPartyKanbanColumn("estado-antigo").v).toBe("andamento");
  });

  it("calcula vencimento por dia civil e sinaliza datas inválidas", () => {
    const now = new Date("2026-07-31T15:00:00-03:00");

    expect(daysUntil("2026-08-01", now)).toBe(1);
    expect(daysUntil("2026-07-30", now)).toBe(-1);
    expect(daysUntil("", now)).toBeNull();
    expect(daysUntil("data-invalida", now)).toBeNull();
  });
});
