import {summarizeArchivedCosts} from "../../server/archived-costs";
import {findScopedWork} from "../../server/onedrive-scope";
import {validatePurchaseChanges} from "../../server/permission-policies";
import {canManagePurchases} from "../domains/compras/permissions";

describe("integração financeira do ponto arquivado", () => {
  test("recompõe mão de obra e benefícios por obra sem confiar no cliente", () => {
    const result = summarizeArchivedCosts({
      employeesSnapshot: [{
        id: "e1", obra: "o1", dailyRate: 100, vtDaily: 10, vrDaily: 20,
        startDate: "2026-07-01",
      }],
      attendance: {
        e1: {
          "2026-07-10": {status: "P", obraId: "o1"},
          "2026-07-11": {status: "M", obraId: "o2"},
          "2026-06-20": {status: "P", obraId: "o1"},
        },
      },
    });
    expect(result.byDate["2026-07-10"].o1).toEqual({laborCost: 100, benefitCost: 30});
    expect(result.byDate["2026-07-11"].o2).toEqual({laborCost: 50, benefitCost: 15});
    expect(result.byDate["2026-06-20"]).toBeUndefined();
  });
});

describe("integração de permissões financeiras e documentos", () => {
  const orders = [{id: "p1", obraId: "o1"}, {id: "p2", obraId: "o2"}];

  test("admin, Compras e Financeiro podem excluir compra; demais perfis não", () => {
    expect(canManagePurchases("admin")).toBe(true);
    expect(canManagePurchases("compras")).toBe(true);
    expect(canManagePurchases("financeiro")).toBe(true);
    expect(validatePurchaseChanges({role: "engenheiro"}, orders, [orders[1]])).toMatch(/permissão/);
  });

  test("usuário restrito não exclui compra nem acessa OneDrive de outra obra", () => {
    const user = {role: "financeiro", obraId: "o1"};
    expect(validatePurchaseChanges(user, orders, [orders[0]])).toMatch(/outra obra/);
    const context = {
      user,
      payload: {obras: [
        {id: "o1", name: "Obra 1", oneDriveDriveId: "d1"},
        {id: "o2", name: "Obra 2", oneDriveDriveId: "d2"},
      ]},
    };
    expect(findScopedWork(context, {driveId: "d1"})?.id).toBe("o1");
    expect(findScopedWork(context, {driveId: "d2"})).toBeNull();
  });
});
