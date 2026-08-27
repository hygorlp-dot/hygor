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
//
// Achado de 25/08/2026: uma fonte posterior só "vence" enquanto ela tiver
// uma CHAVE para aquele (employeeId,date) - uma limpeza de status (P/M/F ->
// sem registro) que vira `delete days[date]` na linha de obra deixa de
// existir como chave, então o spread `{...merged[employeeId], ...days}` não
// tinha como apagar o valor antigo que a cópia legada ainda carregava:
// a marcação "ressuscitava" sozinha no próximo carregamento da tela,
// mesmo sem nenhum clique novo. `applyEntriesToAttendance` agora grava um
// tombstone (`record: null`) em vez de apagar a chave - aqui, esse
// tombstone precisa vencer explicitamente qualquer valor de uma fonte
// anterior (e não sobrar como `null` no resultado, que os consumidores
// nunca esperam ver).
export const mergeAttendanceObjects = (...sources) => {
  const merged = {};
  for (const source of sources) {
    for (const [employeeId, days] of Object.entries(source || {})) {
      const target = { ...(merged[employeeId] || {}) };
      for (const [date, record] of Object.entries(days || {})) {
        if (record == null) delete target[date];
        else target[date] = record;
      }
      merged[employeeId] = target;
    }
  }
  for (const employeeId of Object.keys(merged)) {
    if (!Object.keys(merged[employeeId]).length) delete merged[employeeId];
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
//
// Achado de 25/08/2026: uma exclusão (status limpo) grava um tombstone
// (`record: null`), não mais `delete days[date]`. Apagar a chave fazia essa
// (employeeId,date) voltar a não ter opinião nenhuma NESTA linha de obra -
// e mergeAttendanceObjects, ao ler, deixava a cópia antiga que ainda sobra
// na linha compartilhada de Ponto "vencer" de volta, porque uma fonte
// posterior só sobrescreve chaves que ela realmente tem. O tombstone
// preserva a intenção de exclusão nesta linha para sempre vencer aquele
// fallback (mergeAttendanceObjects apaga o tombstone do resultado final -
// nenhum consumidor chega a ver `null`).
export const applyEntriesToAttendance = (existingAttendance, entries, fullAttendanceAfter) => {
  let next = { ...(existingAttendance || {}) };
  for (const entry of entries || []) {
    const employeeId = String(entry?.employeeId || "");
    const date = String(entry?.date || "");
    if (!employeeId || !date) continue;
    const record = fullAttendanceAfter?.[employeeId]?.[date] || null;
    const days = { ...(next[employeeId] || {}) };
    days[date] = record;
    next[employeeId] = days;
  }
  return next;
};
