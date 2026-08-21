import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import {
  DOMAIN_FIELDS,
  DOMAIN_ROW,
  mergeDomainRows,
  pickDomainFields,
  rowForAttendanceCommand,
  rowForOperationalCommand,
} from "./domain-row-routing.js";

describe("rowForOperationalCommand", () => {
  it("classifica os 4 comandos de lookahead na própria linha", () => {
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.LOOKAHEAD_CREATED)).toBe(DOMAIN_ROW.LOOKAHEAD);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED)).toBe(DOMAIN_ROW.LOOKAHEAD);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED)).toBe(DOMAIN_ROW.LOOKAHEAD);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED)).toBe(DOMAIN_ROW.LOOKAHEAD);
  });

  it("classifica a configuração da empresa na própria linha", () => {
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED)).toBe(DOMAIN_ROW.CONFIG);
  });

  it("classifica todo comando de equipamentos na própria linha", () => {
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.EQUIPMENT_SAVED)).toBe(DOMAIN_ROW.EQUIPAMENTOS);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED)).toBe(DOMAIN_ROW.EQUIPAMENTOS);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED)).toBe(DOMAIN_ROW.EQUIPAMENTOS);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED)).toBe(DOMAIN_ROW.EQUIPAMENTOS);
  });

  it("mantém tudo o mais na linha core, sem exceção - inclui RH e RDO deliberadamente", () => {
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.EMPLOYEE_SAVED)).toBe(DOMAIN_ROW.CORE);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED)).toBe(DOMAIN_ROW.CORE);
    expect(rowForOperationalCommand(OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED)).toBe(DOMAIN_ROW.CORE);
    expect(rowForOperationalCommand("COMANDO_INEXISTENTE")).toBe(DOMAIN_ROW.CORE);
  });
});

describe("rowForAttendanceCommand", () => {
  it("sempre aponta para a linha de ponto", () => {
    expect(rowForAttendanceCommand()).toBe(DOMAIN_ROW.PONTO);
  });
});

describe("pickDomainFields", () => {
  it("extrai só os campos de ponto, ignorando o resto do blob mesclado", () => {
    const data = {
      employees: [{ id: "e1" }],
      attendance: { e1: { "2026-08-20": { status: "P" } } },
      attendanceLocks: { "obra1__2026-08-20": { locked: true } },
      unlockRequests: [{ id: "r1" }],
      dailyCheckDate: "2026-08-20",
      attendanceOperationReceipts: [{ operationId: "op1" }],
      config: { companyName: "ARCD" },
    };
    expect(pickDomainFields(data, DOMAIN_ROW.PONTO)).toEqual({
      attendance: data.attendance,
      attendanceLocks: data.attendanceLocks,
      unlockRequests: data.unlockRequests,
      dailyCheckDate: data.dailyCheckDate,
      attendanceOperationReceipts: data.attendanceOperationReceipts,
    });
  });

  it("não inclui um campo do domínio que não existe no objeto de origem", () => {
    const data = { lookaheadWindows: [{ id: "l1" }] };
    expect(pickDomainFields(data, DOMAIN_ROW.CONFIG)).toEqual({});
  });

  it("extrai os 16 campos de equipamentos (inclui o razão de idempotência compartilhado), e nada de obras/transacoes (referências externas)", () => {
    const data = {
      obras: [{ id: "o1" }],
      transacoes: [{ id: "t1" }],
      equipamentos: [{ id: "eq1" }],
      equipmentLots: [], equipmentModels: [], equipmentUnits: [],
      equipmentUnavailability: [], locacoesEquip: [], manutencoesEquip: [],
      proprietariosEquip: [], rentalChargeItems: [], rentalInvoices: [],
      rentalInvoiceReceipts: [], transferenciasEquip: [],
      equipmentRegistryMigration: { version: 1 }, equipmentRegistryRevision: 2,
      equipmentRegistryHistory: [], operationalCommandReceipts: [],
    };
    const picked = pickDomainFields(data, DOMAIN_ROW.EQUIPAMENTOS);
    expect(Object.keys(picked).sort()).toEqual(DOMAIN_FIELDS[DOMAIN_ROW.EQUIPAMENTOS].slice().sort());
    expect(picked).not.toHaveProperty("obras");
    expect(picked).not.toHaveProperty("transacoes");
  });

  it("devolve objeto vazio para um domínio desconhecido", () => {
    expect(pickDomainFields({ a: 1 }, "inexistente")).toEqual({});
  });
});

describe("mergeDomainRows", () => {
  it("mescla campos exclusivos de cada linha sem overlap", () => {
    const core = { employees: [{ id: "e1" }], config: { companyName: "old" } };
    const merged = mergeDomainRows(core, {
      [DOMAIN_ROW.LOOKAHEAD]: { lookaheadWindows: [{ id: "l1" }] },
      [DOMAIN_ROW.CONFIG]: { config: { companyName: "ARCD" } },
      [DOMAIN_ROW.EQUIPAMENTOS]: { equipamentos: [{ id: "eq1" }] },
    });
    expect(merged.employees).toEqual([{ id: "e1" }]);
    expect(merged.lookaheadWindows).toEqual([{ id: "l1" }]);
    expect(merged.config).toEqual({ companyName: "ARCD" });
    expect(merged.equipamentos).toEqual([{ id: "eq1" }]);
  });

  it("cai no valor da core quando uma linha separada ainda não existe (pré-migração)", () => {
    const core = { lookaheadWindows: [{ id: "l1-legado" }] };
    const merged = mergeDomainRows(core, {});
    expect(merged.lookaheadWindows).toEqual([{ id: "l1-legado" }]);
  });

  it("une o razão de idempotência de Lookahead/Config/Equipamentos por união, não por sobrescrita", () => {
    const core = { operationalCommandReceipts: [{ idempotencyKey: "core-1", appliedAt: "2026-01-01" }] };
    const merged = mergeDomainRows(core, {
      [DOMAIN_ROW.LOOKAHEAD]: { operationalCommandReceipts: [{ idempotencyKey: "lookahead-1", appliedAt: "2026-02-01" }] },
      [DOMAIN_ROW.CONFIG]: { operationalCommandReceipts: [{ idempotencyKey: "config-1", appliedAt: "2026-03-01" }] },
      [DOMAIN_ROW.EQUIPAMENTOS]: { operationalCommandReceipts: [{ idempotencyKey: "equip-1", appliedAt: "2026-04-01" }] },
    });
    const keys = merged.operationalCommandReceipts.map(item => item.idempotencyKey).sort();
    expect(keys).toEqual(["config-1", "core-1", "equip-1", "lookahead-1"]);
  });

  it("mantém o registro com appliedAt mais recente quando a mesma idempotencyKey aparece em duas linhas", () => {
    const core = { operationalCommandReceipts: [{ idempotencyKey: "dup", appliedAt: "2026-01-01" }] };
    const merged = mergeDomainRows(core, {
      [DOMAIN_ROW.EQUIPAMENTOS]: { operationalCommandReceipts: [{ idempotencyKey: "dup", appliedAt: "2026-06-01" }] },
    });
    expect(merged.operationalCommandReceipts).toHaveLength(1);
    expect(merged.operationalCommandReceipts[0].appliedAt).toBe("2026-06-01");
  });

  it("não mexe no razão compartilhado quando nenhuma linha o contém", () => {
    const merged = mergeDomainRows({ employees: [] }, { [DOMAIN_ROW.PONTO]: { attendance: {} } });
    expect(merged.operationalCommandReceipts).toBeUndefined();
  });
});
