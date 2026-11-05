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
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_COMMERCIAL_OVERRIDDEN,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,
  OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_CANCELLED,
  OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,
]);

// Estoque (E1.1): a chegada de uma transferência entre obras e o estorno de
// movimento alteram a DRE gerencial (custo sai de uma obra e entra na outra),
// por isso passam pela proteção de competência fechada; mas não criam título,
// pagamento nem lançamento bancário no motor financeiro.
const AUDIT_ONLY_STOCK_COMMANDS=new Set([
  OPERATIONAL_COMMAND.TRANSFER_RECEIVED,
  OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED,
]);

export const requiresFinancialOperationalPersistence=(commandType,financialCommands)=>
  financialCommands.has(commandType)&&!AUDIT_ONLY_EQUIPMENT_COMMANDS.has(commandType)
    &&!AUDIT_ONLY_STOCK_COMMANDS.has(commandType);

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
