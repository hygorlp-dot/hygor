import { describe, it, expect } from "vitest";
import { employeesForAttendanceScope, attendanceScopeCounts } from "./attendance-scope.js";
const employees = [
  { id: "a", name: "Admin", workArea: "administrativo", obra: "" },
  { id: "b", name: "Campo sem obra", workArea: "campo", obra: "" },
  { id: "c", name: "Obra", workArea: "campo", obra: "obra1" },
  { id: "d", name: "Desligado", workArea: "administrativo", active: false },
];
describe("escopo da gestão de pontos", () => {
  it("não confunde administrativo com campo sem obra", () => {
    expect(employeesForAttendanceScope(employees, "administrativo").map(e => e.id)).toEqual(["a"]);
    expect(employeesForAttendanceScope(employees, "obras").map(e => e.id)).toEqual(["b", "c"]);
  });
  it("filtra obra sem perder equipe global", () => {
    expect(employeesForAttendanceScope(employees, "obras", "obra1").map(e => e.id)).toEqual(["c"]);
    expect(attendanceScopeCounts(employees)).toEqual({ obras: 2, administrativo: 1 });
  });
});
