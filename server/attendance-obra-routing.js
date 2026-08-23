// Fase 1.5 reduzida (22/08/2026, docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): só
// `data.attendance` é particionado por obra - `attendanceLocks`/
// `unlockRequests`/`dailyCheckDate`/`attendanceOperationReceipts` continuam
// numa única linha compartilhada (DOMAIN_ROW.PONTO), porque
// `attendance-daily-check` não tem conceito de obra e
// `attendance-unlock-approve`/`-reject` não carregam `obraId` no payload -
// forçar esses comandos a escolher uma partição não é natural ao negócio.
// Só `attendance-upsert`/`attendance-batch-upsert` tocam `attendance`, e
// cada registro já carrega seu próprio `obraId` resolvido
// (`normalizeSubmittedRecord`, server/attendance-command.js) - as funções
// aqui não precisam re-resolver obra, só agrupar pelo que já veio pronto.

export const NO_OBRA_BUCKET = "sem_obra";

// Funcionários sem obra (Administrativo, Sem lotação) gravam registros com
// obraId="" (server/attendance-command.js:115) - viram um "balde" próprio,
// não ficam de fora da partição.
export const attendanceObraBucket = obraId => String(obraId || "") || NO_OBRA_BUCKET;

export const attendanceObraKey = (baseKey, obraId) => `${baseKey}__obra__${attendanceObraBucket(obraId)}`;

export const attendanceObraKeyPrefix = baseKey => `${baseKey}__obra__`;

export const obraBucketFromKey = (baseKey, key) => String(key || "").slice(attendanceObraKeyPrefix(baseKey).length);

// Mescla vários `attendance` ({employeeId:{date:record}}) em um só. Fontes
// posteriores vencem em caso de conflito no mesmo (employeeId,date) - usado
// para priorizar a linha própria de uma obra (mais nova, autoritativa)
// sobre a cópia legada que ainda pode sobrar na linha compartilhada de
// Ponto, para obras que ainda não ganharam linha própria.
export const mergeAttendanceObjects = (...sources) => {
  const merged = {};
  for (const source of sources) {
    for (const [employeeId, days] of Object.entries(source || {})) {
      merged[employeeId] = { ...(merged[employeeId] || {}), ...days };
    }
  }
  return merged;
};

// Agrupa as entradas de `result.attendance` (cada uma já com `.obraId`
// resolvido) por obra - usado para decidir em quais linhas físicas gravar
// depois de applyAttendanceCommand rodar. A ordem de inserção é preservada
// (Map), mas não importa para quem consome.
export const groupAttendanceEntriesByObra = entries => {
  const byBucket = new Map();
  for (const entry of entries || []) {
    const bucket = attendanceObraBucket(entry?.obraId);
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(entry);
  }
  return byBucket;
};

// Aplica um lote de mudanças (uma obra por vez) sobre o `attendance`
// existente de UMA linha - `fullAttendanceAfter` é o `data.attendance`
// completo já calculado por applyAttendanceCommand (fonte da verdade do
// valor final de cada registro, inclusive ausência = exclusão). Não
// precisa saber nada sobre as OUTRAS obras: só toca os pares
// (employeeId,date) que estão em `entries`.
export const applyEntriesToAttendance = (existingAttendance, entries, fullAttendanceAfter) => {
  let next = { ...(existingAttendance || {}) };
  for (const entry of entries || []) {
    const employeeId = String(entry?.employeeId || "");
    const date = String(entry?.date || "");
    if (!employeeId || !date) continue;
    const record = fullAttendanceAfter?.[employeeId]?.[date] || null;
    const days = { ...(next[employeeId] || {}) };
    if (record) days[date] = record;
    else delete days[date];
    if (Object.keys(days).length) next[employeeId] = days;
    else delete next[employeeId];
  }
  return next;
};
