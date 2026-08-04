import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

// Os comandos de equipamento registram fatos operacionais auditáveis no blob.
// Locação e manutenção alimentam a projeção gerencial do DRE por competência,
// mas não liquidam título, não movimentam banco e não geram lançamento no razão
// canônico. Portanto nenhum deles deve reconstruir o snapshot financeiro
// transacional durante o clique. A projeção financeira os consome depois que a
// gravação operacional curta foi confirmada.
const AUDIT_ONLY_EQUIPMENT_COMMANDS=new Set([
  OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED,
  OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED,
  OPERATIONAL_COMMAND.EQUIPMENT_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,
  OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,
]);

export const requiresFinancialOperationalPersistence=(commandType,financialCommands)=>
  financialCommands.has(commandType)&&!AUDIT_ONLY_EQUIPMENT_COMMANDS.has(commandType);

// Com FIN-003 ativo, o comando financeiro precisa reler o blob somente depois
// de obter o bloqueio da linha. Isso elimina a janela entre `lerLinha()` e a
// RPC financeira em que ponto, conciliação ou outro operador podiam tornar
// seis tentativas consecutivas obsoletas.
export const requiresLockedFinancialOperationalPersistence=(
  commandType,
  financialCommands,
  {engineEnforced=false,directConnection=false}={},
)=>
  engineEnforced
  && directConnection
  && requiresFinancialOperationalPersistence(commandType,financialCommands);
