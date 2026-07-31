import { describe, expect, it } from "vitest";
import { canManageAttendanceWorkforce, resolveAttendanceObraId, resolveHistoricalEmployeeObraId } from "./permissions";

describe("escopo operacional do ponto", () => {
  it("usa a obra selecionada quando o trabalhador está emprestado", () => {
    expect(resolveAttendanceObraId({
      record: null,
      selectedObraId: "obra-destino",
      employeeObraId: "obra-lotacao",
    })).toBe("obra-destino");
  });

  it("a obra explicitamente selecionada prevalece sobre a lotação anterior", () => {
    expect(resolveAttendanceObraId({
      record: { status:"P", obraId:"obra-historica" },
      selectedObraId: "obra-atual",
      employeeObraId: "obra-lotacao",
    })).toBe("obra-atual");
  });

  it("preserva a obra gravada quando não há seleção explícita", () => {
    expect(resolveAttendanceObraId({
      record: { status:"P", obraId:"obra-historica" },
      selectedObraId: "all",
      employeeObraId: "obra-lotacao",
    })).toBe("obra-historica");
  });

  it("reconstrói a lotação histórica sem mover o passado após transferência",()=>{
    const employee={id:"e-1",obra:"obra-nova"};
    const historical=resolveHistoricalEmployeeObraId({
      employee,date:"2026-07-10",obras:[{id:"obra-antiga",name:"Obra antiga"}],
      transferEvents:[{type:"transfer",empId:"e-1",date:"2026-07-20",fromId:"obra-antiga",toId:"obra-nova"}],
    });
    expect(historical).toBe("obra-antiga");
    expect(resolveAttendanceObraId({historicalObraId:historical,employeeObraId:employee.obra})).toBe("obra-antiga");
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
