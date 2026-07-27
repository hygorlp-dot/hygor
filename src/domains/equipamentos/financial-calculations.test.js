import { describe, expect, it } from "vitest";
import {
  calcEquipCustoObra,
  calcEquipFaturamentoEmpresa,
  calcEquipamentosMes,
} from "./calculations.js";

describe("motor financeiro de equipamentos", () => {
  const data = {
    equipamentos:[
      { id:"e1", nome:"Betoneira", tarifas:{ dia:100 } },
      { id:"e2", nome:"Andaime", proprietarioId:"f1", tarifas:{ dia:80 }, tarifasCusto:{ dia:50 } },
    ],
    locacoesEquip:[
      { equipamentoId:"e1", obraId:"o1", inicio:"2026-07-01", fim:"2026-07-02", valorDiaria:100 },
      { equipamentoId:"e2", obraId:"o1", inicio:"2026-07-01", fim:"2026-07-02", valorDiaria:80 },
    ],
    manutencoesEquip:[
      { equipamentoId:"e1", data:"2026-07-10", custo:20, pagoPor:"empresa" },
    ],
  };

  it("consolida faturamento, custo do dono e manutenção", () => {
    const report = calcEquipamentosMes(data, "2026-07");
    expect(report.total).toMatchObject({
      receita:360,
      custoDono:100,
      manut:20,
      custo:120,
      lucro:240,
    });
    expect(calcEquipFaturamentoEmpresa(data, "2026-07")).toMatchObject({
      receita:360,
      custoDono:100,
      manut:20,
      lucro:240,
      receitaProprios:200,
      receitaTerceiros:160,
    });
  });

  it("calcula custo da obra no recorte informado", () => {
    expect(calcEquipCustoObra(data, "o1", "2026-07", "2026-07-02", "2026-07-02")).toBe(180);
  });
});
