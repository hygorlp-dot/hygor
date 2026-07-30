import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

// Cadastro, inativação e transferência apenas organizam a frota. Eles não
// reconhecem receita, custo, pagamento ou competência no razão. Sincronizar o
// motor financeiro inteiro nesses comandos aumentava muito o tempo de lock do
// blob e fazia o cadastro perder repetidamente a disputa com outros módulos.
const AUDIT_ONLY_EQUIPMENT_COMMANDS=new Set([
  OPERATIONAL_COMMAND.EQUIPMENT_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,
  OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,
]);

export const requiresFinancialOperationalPersistence=(commandType,financialCommands)=>
  financialCommands.has(commandType)&&!AUDIT_ONLY_EQUIPMENT_COMMANDS.has(commandType);

