import { describe, expect, it } from "vitest";
import { construirFilaOperador, obrasDoDiarioNoDashboard } from "./operator-priorities.js";

const colors = { blue: "blue", orange: "orange", purple: "purple", red: "red", yellowD: "yellow", green: "green" };
const date = "2026-11-25";
const data = {
  obras: [
    { id: "a", name: "Obra Alfa", status: "active", engineerId: "eng" },
    { id: "b", name: "Obra Beta", status: "active", engineerId: "other" },
    { id: "c", name: "Obra encerrada", status: "done", engineerId: "eng" },
  ],
  employees: [{ id: "ea", obra: "a" }, { id: "eb", obra: "b" }],
  transacoes: [{ status: "pendente" }],
};

describe("fila de prioridades do Dashboard", () => {
  it("mantém obra, data, ordenação e abas autorizadas no recorte de Engenharia", () => {
    const user = { id: "eng", role: "engenheiro", obraId: "a" };
    const queue = construirFilaOperador(data, user, colors, date);
    expect(queue.map(item => item.id)).toEqual(["ponto-hoje", "rdo-hoje"]);
    for (const item of queue) {
      expect(item).toMatchObject({ obraId: "a", names: ["Obra Alfa"], date, quantidade: 1 });
    }
  });

  it("usa a atribuição de Engenharia e mantém o fallback para obras ativas", () => {
    expect(obrasDoDiarioNoDashboard(data, { id: "eng", role: "engenheiro" }).map(item => item.id)).toEqual(["a"]);
    expect(obrasDoDiarioNoDashboard(data, { id: "unknown", role: "engenheiro" }).map(item => item.id)).toEqual(["a","b"]);
    expect(construirFilaOperador(data, { id: "observer", role: "visualizador" }, colors, date)).toEqual([]);
  });
});
