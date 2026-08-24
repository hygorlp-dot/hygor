import { describe, expect, it } from "vitest";
import { buildPurchaseRequestLiveRow } from "./purchase-request-live-write.js";

const record = (overrides = {}) => ({
  id: "req-1", numero: "SC-042", obraId: "obra-1", necessidade: "2026-09-01",
  prioridade: "urgente", observacao: "Falta material crítico", version: 3,
  itens: [{ id: "item-1", materialId: "mat-1", quantidade: 10 }],
  ...overrides,
});

describe("buildPurchaseRequestLiveRow", () => {
  it("mapeia os campos estruturados do registro do blob para a linha da tabela", () => {
    const row = buildPurchaseRequestLiveRow("arcd", record());
    expect(row).toMatchObject({
      company_id: "arcd", id: "req-1", request_number: "SC-042",
      project_id: "obra-1", needed_by: "2026-09-01", priority: "urgente",
      notes: "Falta material crítico", source_version: 3,
    });
  });

  it("preserva o registro completo (itens inclusive) dentro de payload", () => {
    const row = buildPurchaseRequestLiveRow("arcd", record());
    expect(row.payload.itens).toEqual([{ id: "item-1", materialId: "mat-1", quantidade: 10 }]);
  });

  it("não inclui created_at - upsert preserva a data de criação original numa edição", () => {
    const row = buildPurchaseRequestLiveRow("arcd", record());
    expect(row).not.toHaveProperty("created_at");
    expect(row).toHaveProperty("updated_at");
  });

  it("usa 'normal' como prioridade padrão e null para data inválida/ausente", () => {
    const row = buildPurchaseRequestLiveRow("arcd", record({ prioridade: "", necessidade: "" }));
    expect(row.priority).toBe("normal");
    expect(row.needed_by).toBeNull();
  });
});
