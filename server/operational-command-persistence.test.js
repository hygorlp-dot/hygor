import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import {
  requiresFinancialOperationalPersistence,
  requiresLockedFinancialOperationalPersistence,
} from "./operational-command-persistence.js";

const financialCommands=new Set([
  OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,
  OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,
  OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,
]);

describe("persistência de comandos operacionais",()=>{
  it("não reconstrói o razão para fatos operacionais da frota",()=>{
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,financialCommands)).toBe(false);
  });

  it("mantém sincronização financeira para comandos que movimentam o razão",()=>{
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,financialCommands)).toBe(true);
  });

  it("serializa o comando financeiro quando FIN-003 e a conexão direta estão ativos",()=>{
    const options={engineEnforced:true,directConnection:true};
    expect(requiresLockedFinancialOperationalPersistence(
      OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED,financialCommands,options,
    )).toBe(true);
    expect(requiresLockedFinancialOperationalPersistence(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,financialCommands,options,
    )).toBe(false);
    expect(requiresLockedFinancialOperationalPersistence(
      OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED,financialCommands,
      {...options,engineEnforced:false},
    )).toBe(false);
  });
});
