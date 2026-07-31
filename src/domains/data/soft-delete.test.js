import { describe, expect, it } from "vitest";
import { cancelRecord } from "./soft-delete";

describe("cancelRecord", () => {
  it("preserva o registro e acrescenta uma trilha de cancelamento auditável", () => {
    const original = { id: "terc-1", valor: 3500, status: "ativo" };

    const result = cancelRecord(
      original,
      "  contrato encerrado  ",
      { id: "admin-1", nome: "Administrador" },
      undefined,
      { now: () => "2026-07-31T12:00:00.000Z" },
    );

    expect(result).toEqual({
      id: "terc-1",
      valor: 3500,
      status: "cancelado",
      motivoCancelamento: "contrato encerrado",
      canceladoEm: "2026-07-31T12:00:00.000Z",
      canceladoPorId: "admin-1",
      canceladoPor: "Administrador",
    });
    expect(original).toEqual({ id: "terc-1", valor: 3500, status: "ativo" });
  });

  it("aceita um estado de reversão explícito e usuário ausente", () => {
    const result = cancelRecord(
      { id: "pag-1" },
      null,
      null,
      "estornado",
      { now: () => "2026-07-31T13:00:00.000Z" },
    );

    expect(result).toMatchObject({
      id: "pag-1",
      status: "estornado",
      motivoCancelamento: "",
      canceladoPorId: "",
      canceladoPor: "",
    });
  });
});
