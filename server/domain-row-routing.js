import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { EQUIPMENT_COMMAND_TYPES } from "../src/domains/equipamentos/commands.js";
import { COMPANY_CONFIG_COMMAND_TYPES } from "../src/domains/config/company-config-commands.js";

// Cada "linha separada" abaixo é a mesma tabela company_app_data, só com uma
// chave própria (mesmo padrão já usado por PROFILE_KEY e pelo arquivo de
// ponto por quinzena, `${KEY}__arq__<id>`) - não é uma tabela nova. Isso
// elimina a contenção de escrita entre domínios que hoje disputam a MESMA
// linha (achado de 20/08/2026: EMPLOYEE_SAVED via CAS disputando com
// ATTENDANCE_COMMANDS, ambos gravando company_app_data/key=arced_ponto_v1).
//
// Verificado por grep exaustivo antes de incluir aqui (ver
// docs/AUDITORIA_... e a investigação da sessão): cada domínio listado só é
// gravado pelo próprio pipeline de comando - nenhum tem uma tela ainda
// escrevendo o mesmo campo por fora via update()/save-sections. RDO
// (`data.rdos`) foi cogitado e DESCARTADO desta lista porque
// `LegacyApp.jsx` (função salvarRDO) ainda grava `rdos` via update() legado
// em paralelo ao comando FIELD_REPORT_CHANGED - separar a linha sem migrar
// esse caminho primeiro criaria um split-brain (duas linhas achando que são
// donas do mesmo campo).
export const DOMAIN_ROW = Object.freeze({
  CORE: "core",
  PONTO: "ponto",
  LOOKAHEAD: "lookahead",
  CONFIG: "config",
  EQUIPAMENTOS: "equipamentos",
});

// Comandos de cronograma de curto prazo (Lookahead) - só 4, definidos
// inline em operational-commands.js (não têm um _TYPES exportado próprio).
const LOOKAHEAD_COMMAND_TYPES = new Set([
  OPERATIONAL_COMMAND.LOOKAHEAD_CREATED,
  OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,
  OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,
  OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED,
]);

// Classifica um OPERATIONAL_COMMAND para a linha que ele deve ler/gravar.
// Qualquer comando fora destas 3 listas cai em CORE - comportamento atual,
// sem nenhuma mudança (a classificação é aditiva, nunca reduz o que já
// existe).
export const rowForOperationalCommand = commandType => {
  if (LOOKAHEAD_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.LOOKAHEAD;
  if (COMPANY_CONFIG_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.CONFIG;
  if (EQUIPMENT_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.EQUIPAMENTOS;
  return DOMAIN_ROW.CORE;
};

// ATTENDANCE_COMMAND não passa por OPERATIONAL_COMMAND - é um pipeline
// próprio (server/attendance-command.js) chamado direto pelo handler.
// Todo comando desse conjunto vai para a linha de Ponto.
export const rowForAttendanceCommand = () => DOMAIN_ROW.PONTO;

// Campos de nível superior de `data` que pertencem a cada linha separada,
// levantados por leitura direta de cada módulo (não é uma lista de
// intenção - cada campo aqui foi confirmado como escrito pelo domínio
// correspondente via grep em 20/08/2026):
//  - Ponto: server/attendance-command.js (applyValidatedPatch/applyLock/
//    applyUnlockRequest/appendReceipt).
//  - Lookahead: só data.lookaheadWindows (operational-commands.js:497-521).
//  - Config: só data.config (company-config-commands.js).
//  - Equipamentos: src/domains/equipamentos/commands.js + registry.js -
//    inclui os 3 campos do cadastro físico migrado
//    (equipmentRegistryMigration/Revision/History) e equipmentModels
//    (usado só por migrateLegacyEquipmentRegistry, registry.js:171).
// data.operationalCommandReceipts é o razão de idempotência COMPARTILHADO
// por todo comando que passa por applyOperationalCommand
// (operational-commands.js:126-137,195,200...) - Lookahead/Config/
// Equipamentos escrevem nele mesmo sendo domínios "próprios" nos outros
// campos. Por isso ele entra em CADA UM desses 3 domínios (cada linha
// acumula sua própria cópia) E precisa de uma mesclagem por união, não por
// sobrescrita simples - ver mergeDomainRows abaixo. Ponto NÃO usa este
// campo (attendance-command.js tem o próprio attendanceOperationReceipts,
// exclusivo do pipeline de ATTENDANCE_COMMAND, sem overlap).
const SHARED_RECEIPTS_FIELD = "operationalCommandReceipts";

export const DOMAIN_FIELDS = Object.freeze({
  [DOMAIN_ROW.PONTO]: [
    "attendance", "attendanceLocks", "unlockRequests",
    "dailyCheckDate", "attendanceOperationReceipts",
  ],
  [DOMAIN_ROW.LOOKAHEAD]: ["lookaheadWindows", SHARED_RECEIPTS_FIELD],
  [DOMAIN_ROW.CONFIG]: ["config", SHARED_RECEIPTS_FIELD],
  [DOMAIN_ROW.EQUIPAMENTOS]: [
    "equipamentos", "equipmentLots", "equipmentModels", "equipmentUnits",
    "equipmentUnavailability", "locacoesEquip", "manutencoesEquip",
    "proprietariosEquip", "rentalChargeItems", "rentalInvoices",
    "rentalInvoiceReceipts", "transferenciasEquip",
    "equipmentRegistryMigration", "equipmentRegistryRevision",
    "equipmentRegistryHistory", SHARED_RECEIPTS_FIELD,
  ],
});

// Extrai, de um `data` já mesclado, só os campos de uma linha específica -
// usado para gravar só a fatia que mudou, sem reescrever o resto do blob
// mesclado (que fisicamente mora em outra linha).
export const pickDomainFields = (data, domain) => {
  const fields = DOMAIN_FIELDS[domain] || [];
  const picked = {};
  fields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(data || {}, field)) {
      picked[field] = data[field];
    }
  });
  return picked;
};

// Une várias cópias do razão de idempotência compartilhado (uma por linha
// que o escreve) por idempotencyKey, mantendo o registro com appliedAt mais
// recente em caso de colisão, e trunca no mesmo limite (2000) que
// operational-commands.js já usa. Sem isso, mesclar por sobrescrita simples
// faria a linha mesclada por último "vencer" e apagar o histórico de
// idempotência das outras - quebrando a proteção contra reenvio duplicado
// de Lookahead/Config quando Equipamentos (mesclado por último) também
// tivesse gravado depois.
const mergeSharedReceipts = arrays => {
  const byKey = new Map();
  arrays.flat().filter(Boolean).forEach(item => {
    const key = item.idempotencyKey ?? JSON.stringify(item);
    const existing = byKey.get(key);
    if (!existing || String(item.appliedAt || "") >= String(existing.appliedAt || "")) {
      byKey.set(key, item);
    }
  });
  return [...byKey.values()].slice(-2000);
};

// Mescla a linha core com as linhas separadas já decodificadas (ausentes =
// {} = nenhuma contribuição, cai no valor que já estava na core - seguro
// para rodar antes da migração de semeadura existir). Ordem de aplicação
// não importa para os campos exclusivos de cada domínio (não há overlap,
// ver o comentário no topo do arquivo); só o campo compartilhado precisa de
// tratamento especial via mergeSharedReceipts.
export const mergeDomainRows = (corePayload, rowPayloadsByDomain = {}) => {
  let merged = { ...(corePayload || {}) };
  const receiptCopies = Array.isArray(merged[SHARED_RECEIPTS_FIELD]) ? [merged[SHARED_RECEIPTS_FIELD]] : [];
  for (const domain of [DOMAIN_ROW.PONTO, DOMAIN_ROW.LOOKAHEAD, DOMAIN_ROW.CONFIG, DOMAIN_ROW.EQUIPAMENTOS]) {
    const rowPayload = rowPayloadsByDomain[domain];
    if (!rowPayload || typeof rowPayload !== "object") continue;
    if (Array.isArray(rowPayload[SHARED_RECEIPTS_FIELD])) receiptCopies.push(rowPayload[SHARED_RECEIPTS_FIELD]);
    merged = { ...merged, ...rowPayload };
  }
  if (receiptCopies.length) merged[SHARED_RECEIPTS_FIELD] = mergeSharedReceipts(receiptCopies);
  return merged;
};
