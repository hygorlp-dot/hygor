import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { requiresFinancialOperationalPersistence } from "./operational-command-persistence.js";

const financialCommands=new Set([
  OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,
  OPERATIONAL_COMMAND.EQUIPMENT_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,
  OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,
]);

describe("persistência de comandos operacionais",()=>{
  it("não reconstrói o razão para alterações cadastrais da frota",()=>{
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,financialCommands)).toBe(false);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,financialCommands)).toBe(false);
  });

  it("mantém sincronização financeira para fatos de locação e manutenção",()=>{
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,financialCommands)).toBe(true);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,financialCommands)).toBe(true);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,financialCommands)).toBe(true);
    expect(requiresFinancialOperationalPersistence(OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,financialCommands)).toBe(true);
  });
});

