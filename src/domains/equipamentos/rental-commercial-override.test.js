import { describe, expect, it } from "vitest";
import {
  applyEquipmentCommand,
  equipmentCommandObraId,
  EQUIPMENT_COMMAND,
} from "./commands.js";
import { RENTAL_COMMAND_ROLES } from "./rental-command-roles.js";

const baseData = () => ({
  obras: [{ id: "O1", name: "Obra 1" }],
  equipamentos: [{
    id: "E1", ativo: true, version: 4,
    tarifas: { dia: 20, semana: 100, quinzena: 180, mes: 350 },
    tarifasCusto: { dia: 10, semana: 50, quinzena: 90, mes: 170 },
  }],
  locacoesEquip: [{
    id: "L1", equipamentoId: "E1", obraId: "O1", inicio: "2026-09-01", fim: "2026-09-30",
    quantidade: 1, version: 2, status: "encerrada", lifecycleState: "closed",
    tarifas: { dia: 20, semana: 100, quinzena: 180, mes: 350 },
    tarifasCusto: { dia: 10, semana: 50, quinzena: 90, mes: 170 },
    descontoPct: 0, descontoValor: 49,
    commercialSnapshot: {
      tarifas: { dia: 20, semana: 100, quinzena: 180, mes: 350 },
      tarifasCusto: { dia: 10, semana: 50, quinzena: 90, mes: 170 },
      descontoPct: 0, descontoValor: 49, regraTarifaria: "best_combination",
      negociadoEm: "2026-10-02T12:00:00.000Z", negociadoPorId: "u2", negociadoPor: "Daniel Santos",
      origemTabela: "negociada", versaoTabela: 4,
    },
    operationalHistory: [{ id: "h1", type: "EQUIPMENT_RENTAL_CREATED" }],
  }],
  rentalChargeItems: [],
  rentalInvoices: [],
  rentalInvoiceReceipts: [],
});

const command = overrides => ({
  type: EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_COMMERCIAL_OVERRIDDEN,
  idempotencyKey: "override-commercial-0001",
  expectedVersion: 2,
  actorId: "admin-1",
  actorName: "Administrador",
  payload: {
    rentalId: "L1",
    commercial: {
      tarifas: { dia: 25, semana: 120, quinzena: 210, mes: 400 },
      tarifasCusto: { dia: 10, semana: 50, quinzena: 90, mes: 170 },
      regraTarifaria: "best_combination",
      descontoPct: 5,
      descontoValor: 20,
    },
  },
  ...overrides,
});

describe("sobrescrita administrativa das condições comerciais", () => {
  it("é um comando exclusivo do admin e mantém o escopo da obra", () => {
    expect(RENTAL_COMMAND_ROLES[EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_COMMERCIAL_OVERRIDDEN]).toEqual(["admin"]);
    expect(equipmentCommandObraId(baseData(), command())).toBe("O1");
  });

  it("substitui o snapshot vigente sem criar histórico comercial", () => {
    const data = baseData();
    const history = data.locacoesEquip[0].operationalHistory;
    const result = applyEquipmentCommand(data, command(), "2026-10-05T15:00:00.000Z");
    expect(result.ok).toBe(true);
    const rental = result.data.locacoesEquip[0];
    expect(rental.commercialSnapshot.tarifas.mes).toBe(400);
    expect(rental.commercialSnapshot.descontoPct).toBe(5);
    expect(rental.commercialSnapshot.descontoValor).toBe(20);
    expect(rental.commercialSnapshot.negociadoPor).toBe("Administrador");
    expect(rental.version).toBe(3);
    expect(rental.updatedAt).toBe("2026-10-05T15:00:00.000Z");
    expect(rental.operationalHistory).toEqual(history);
  });

  it("em equipamento de terceiro o snapshot de repasse espelha a tarifa da locação", () => {
    const data = baseData();
    data.equipamentos[0].proprietarioId = "P1";
    const result = applyEquipmentCommand(data, command(), "2026-10-05T15:00:00.000Z");
    expect(result.ok).toBe(true);
    const snapshot = result.data.locacoesEquip[0].commercialSnapshot;
    expect(snapshot.tarifas.mes).toBe(400);
    expect(snapshot.tarifasCusto).toEqual(snapshot.tarifas);
  });

  it("bloqueia a substituição silenciosa depois de medição", () => {
    const data = baseData();
    data.rentalChargeItems = [{ id: "C1", rentalId: "L1", status: "open" }];
    const result = applyEquipmentCommand(data, command(), "2026-10-05T15:00:00.000Z");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/medição|linha de cobrança/i);
    expect(data.locacoesEquip[0].commercialSnapshot.tarifas.mes).toBe(350);
  });

  it("bloqueia a substituição silenciosa depois de fatura", () => {
    const data = baseData();
    data.rentalInvoices = [{ id: "F1", rentalId: "L1", status: "issued" }];
    const result = applyEquipmentCommand(data, command(), "2026-10-05T15:00:00.000Z");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/fatura/i);
  });

  it("respeita versão esperada para evitar sobrescrita concorrente", () => {
    const result = applyEquipmentCommand(baseData(), command({ expectedVersion: 1 }), "2026-10-05T15:00:00.000Z");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/alterad[oa] por outra pessoa/i);
  });
});
