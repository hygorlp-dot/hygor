import { describe, expect, it } from "vitest";
import { canManageAttendanceWorkforce, resolveAttendanceObraId } from "./permissions";

describe("escopo operacional do ponto", () => {
  it("usa a obra selecionada quando o trabalhador está emprestado", () => {
    expect(resolveAttendanceObraId({
      record: null,
      selectedObraId: "obra-destino",
      employeeObraId: "obra-lotacao",
    })).toBe("obra-destino");
  });

  it("preserva a obra gravada no apontamento histórico", () => {
    expect(resolveAttendanceObraId({
      record: { status:"P", obraId:"obra-historica" },
      selectedObraId: "obra-atual",
      employeeObraId: "obra-lotacao",
    })).toBe("obra-historica");
  });

  it("usa a lotação somente na visão de todas as obras", () => {
    expect(resolveAttendanceObraId({
      selectedObraId: "all",
      employeeObraId: "obra-lotacao",
    })).toBe("obra-lotacao");
  });

  it("não oferece movimentação cadastral ao engenheiro de campo", () => {
    expect(canManageAttendanceWorkforce("engenheiro")).toBe(false);
    expect(canManageAttendanceWorkforce("rh")).toBe(true);
    expect(canManageAttendanceWorkforce("admin")).toBe(true);
  });
});
