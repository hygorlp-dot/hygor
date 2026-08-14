import {describe,expect,it} from "vitest";
import {buildDreProjectionRows} from "./dre-projection.js";

// Regressão: `yearsInData` usava uma regex com barra invertida duplicada
// (`/^(20\\d{2})-\\d{2}/`), que nunca casa com uma data real. Isso fazia a
// materialização integral do DRE (usada na sincronização/homologação da
// sombra financeira) ignorar todo ano anterior ao ano corrente, mesmo
// havendo pedidos, medições, despesas ou ponto lançados em anos passados.
describe("buildDreProjectionRows — cobertura de anos anteriores", () => {
  it("inclui competências de um ano anterior quando há pedidos datados nele", () => {
    const previousYear = new Date().getFullYear() - 1;
    const data = {
      obras: [],
      pedidos: [
        {id: "p1", obraId: "obra-1", status: "aprovado", data: `${previousYear}-03-10`, valor: 1000},
      ],
    };
    const rows = buildDreProjectionRows(data);
    const hasPreviousYearRow = rows.some(row => row.year === previousYear);
    expect(hasPreviousYearRow).toBe(true);
  });
});
