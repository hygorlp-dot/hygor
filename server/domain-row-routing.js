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
// escrevendo o mesmo campo por fora via update()/save-sections.
//
// RDO (`data.rdos`) foi cogitado e inicialmente DESCARTADO desta lista
// (20/08/2026) porque `LegacyApp.jsx` ainda gravava `rdos` via update()
// legado em paralelo ao comando FIELD_REPORT_CHANGED - separar a linha sem
// migrar esse caminho primeiro criaria um split-brain. Esse caminho legado
// foi migrado (duplicarRdo agora usa dispatchCommand) e reverificado em
// 21/08/2026: `executarSalvarRDO`/`excluirRdo` só chamam `update()` dentro
// de `if(!dispatchCommand){...}`, e o único ponto de renderização de
// `<ObraDetalhe>` (LegacyApp.jsx, dentro de `<App>`) sempre passa
// `dispatchCommand={dispatchOperationalCommand}` - o fallback é código
// morto. RDO entra na lista com a mesma garantia dos demais domínios.
export const DOMAIN_ROW = Object.freeze({
  CORE: "core",
  PONTO: "ponto",
  LOOKAHEAD: "lookahead",
  CONFIG: "config",
  EQUIPAMENTOS: "equipamentos",
  RDO: "rdo",
});

// Comandos de cronograma de curto prazo (Lookahead) - só 4, definidos
// inline em operational-commands.js (não têm um _TYPES exportado próprio).
const LOOKAHEAD_COMMAND_TYPES = new Set([
  OPERATIONAL_COMMAND.LOOKAHEAD_CREATED,
  OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,
  OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,
  OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED,
]);

// Comandos de Diário de Obra (RDO) - 3, definidos inline em
// operational-commands.js (sem _TYPES exportado próprio, mesmo padrão do
// Lookahead acima).
const RDO_COMMAND_TYPES = new Set([
  OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,
  OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,
  OPERATIONAL_COMMAND.FIELD_REPORT_REOPENED,
]);

// Classifica um OPERATIONAL_COMMAND para a linha que ele deve ler/gravar.
// Qualquer comando fora destas listas cai em CORE - comportamento atual,
// sem nenhuma mudança (a classificação é aditiva, nunca reduz o que já
// existe).
export const rowForOperationalCommand = commandType => {
  if (LOOKAHEAD_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.LOOKAHEAD;
  if (COMPANY_CONFIG_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.CONFIG;
  if (EQUIPMENT_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.EQUIPAMENTOS;
  if (RDO_COMMAND_TYPES.has(commandType)) return DOMAIN_ROW.RDO;
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
//  - RDO: só data.rdos (operational-commands.js:564-616,
//    FIELD_REPORT_CHANGED/CANCELLED/REOPENED).
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
  [DOMAIN_ROW.RDO]: ["rdos", SHARED_RECEIPTS_FIELD],
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

// Exportado para o caminho travado (api/data.js: executarMutacaoEmpresaBloqueada)
// reconstruir a visão mesclada usando o valor recém-travado de UM domínio
// sem precisar reimplementar a lista aqui.
export const SPLITTABLE_DOMAINS = [DOMAIN_ROW.PONTO, DOMAIN_ROW.LOOKAHEAD, DOMAIN_ROW.CONFIG, DOMAIN_ROW.EQUIPAMENTOS, DOMAIN_ROW.RDO];

// Remove de `data` (já mesclado, com os campos das 4 linhas separadas
// dentro) os campos de todo domínio cuja linha própria JÁ EXISTE
// (`rowVersions[domain] != null`) - usado para gravar a linha core sem
// duplicar nela o que já mora em outra linha.
//
// Um domínio cuja linha ainda não existe (rowVersions[domain] == null,
// migração de semeadura ainda não rodou) é DELIBERADAMENTE preservado: a
// própria core é, temporariamente, onde esse domínio precisa continuar
// sendo gravado (ver linhaEfetivaParaEscrita em api/data.js) - removê-lo
// perderia o dado, já que ele não está persistido em nenhum outro lugar
// ainda. `keepDomain` nunca é removido, mesmo que sua linha já exista -
// usado quando ESSE é o domínio de fato sendo gravado nesta chamada
// específica (ex.: Ponto caindo de volta para a core só nesta gravação).
//
// data.operationalCommandReceipts nunca é removido - é o razão de
// idempotência compartilhado, e comandos "core" (EMPLOYEE_SAVED,
// FIELD_REPORT_*...) também passam pelo mesmo `duplicate(data,
// idempotencyKey)` em operational-commands.js:195, precisando da própria
// cópia persistida na core.
//
// Achado de 21/08/2026, ao investigar por que salvar um funcionário
// (EMPLOYEE_SAVED, comando "core") ficou levando ~25s mesmo depois da
// separação de linhas: como `applyOperationalCommand` recebe e devolve o
// `data` INTEIRO mesclado (precisa disso para comandos que leem campo de
// outro domínio, ex. Produção lendo `employees`), o `resultData` de um
// comando core carregava também uma cópia inteira de
// Equipamentos/Ponto/Lookahead/Config vinda da mesclagem de leitura -
// e essa cópia inteira estava sendo reenviada e regravada (com gzip) na
// linha core a cada comando core, sem necessidade nenhuma (o dado já está
// persistido, correto e atualizado nas próprias linhas separadas).
export const coreFieldsOnly = (data, rowVersions = {}, keepDomain = null) => {
  const excludedFields = new Set(
    SPLITTABLE_DOMAINS
      .filter(domain => domain !== keepDomain && rowVersions[domain] != null)
      .flatMap(domain => DOMAIN_FIELDS[domain] || [])
      .filter(field => field !== SHARED_RECEIPTS_FIELD),
  );
  const result = {};
  Object.keys(data || {}).forEach(key => {
    if (excludedFields.has(key)) return;
    result[key] = data[key];
  });
  return result;
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
  for (const domain of [DOMAIN_ROW.PONTO, DOMAIN_ROW.LOOKAHEAD, DOMAIN_ROW.CONFIG, DOMAIN_ROW.EQUIPAMENTOS, DOMAIN_ROW.RDO]) {
    const rowPayload = rowPayloadsByDomain[domain];
    if (!rowPayload || typeof rowPayload !== "object") continue;
    if (Array.isArray(rowPayload[SHARED_RECEIPTS_FIELD])) receiptCopies.push(rowPayload[SHARED_RECEIPTS_FIELD]);
    merged = { ...merged, ...rowPayload };
  }
  if (receiptCopies.length) merged[SHARED_RECEIPTS_FIELD] = mergeSharedReceipts(receiptCopies);
  return merged;
};
