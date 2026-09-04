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

const BOOKKEEPING_MARKER = "__attendanceBookkeeping";

// Achado de 04/09/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): ordenar
// as linhas por obra pelo `updated_at` FÍSICO da linha (a correção de
// 02/09/2026) não é suficiente - esse `updated_at` é da LINHA inteira,
// compartilhado por TODOS os funcionários/dias que moram nela. Uma
// gravação totalmente alheia (outro funcionário, outra data) na mesma
// obra "refresca" o timestamp da linha, fazendo um tombstone antigo (de
// uma célula que já migrou para outra obra há muito tempo) parecer mais
// recente do que o valor correto que está numa OUTRA linha. Sintoma real:
// um funcionário trocado de obra num dia, revisitado do zero num dia
// diferente, ou uma célula tocada por um lote junto de outra - a troca
// "some" da leitura sem nenhum motivo aparente.
//
// A correção definitiva é parar de depender do relógio da LINHA e passar
// a rastrear um relógio por CÉLULA: `withAttendanceSyncedAt` empacota um
// `attendance` com um mapa espelhado (`employeeId -> date -> ISO`)
// carimbado no momento em que aquele registro OU tombstone foi realmente
// escrito (o `now` do próprio comando, não `clock_timestamp()` do
// Postgres). `mergeAttendanceObjects` compara esse carimbo por célula
// quando os dois lados de um conflito o têm - só cai no comportamento
// antigo (última fonte processada vence) quando um dos lados não tem
// bookkeeping nenhum (a linha core/legado, ou uma célula gravada antes
// desta correção existir).
export const withAttendanceSyncedAt = (attendance, syncedAt) => ({
  [BOOKKEEPING_MARKER]: true,
  attendance: attendance || {},
  syncedAt: syncedAt || {},
});

// Mescla vários `attendance` ({employeeId:{date:record}}) em um só. Cada
// fonte pode ser um objeto de attendance cru (sem bookkeeping - tratado
// como se não tivesse timestamp algum para nenhuma célula, o mesmo
// comportamento de sempre) ou o resultado de `withAttendanceSyncedAt`.
// Quando os dois lados de um conflito no mesmo (employeeId,date) têm
// timestamp, o mais recente vence - não importa a ordem de processamento
// nem o updated_at físico de nenhuma linha. Sem timestamp de um dos
// lados, cai no comportamento histórico: a última fonte processada vence
// (usado para priorizar a linha própria de uma obra sobre a cópia legada
// que ainda pode sobrar na linha compartilhada de Ponto, para obras que
// ainda não ganharam linha própria, ou dados anteriores a esta correção).
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
  const mergedAt = {};
  // Por célula: de qual TIPO de fonte veio o valor que está vencendo agora -
  // "bookkeeping" (passou por withAttendanceSyncedAt, mesmo sem carimbo
  // nesta célula específica) ou "raw" (objeto cru, sem bookkeeping algum -
  // a linha core/legado, ou uma chamada antiga de teste). Ver a trava de
  // segurança de 04/09/2026 abaixo: ela só se aplica bookkeeping-vs-
  // bookkeeping, porque raw-vs-bookkeeping tem uma regra INTENCIONALMENTE
  // diferente (achado de 25/08/2026, mantido de propósito).
  const mergedKind = {};
  for (const source of sources) {
    const hasBookkeeping = source?.[BOOKKEEPING_MARKER] === true;
    const attendance = hasBookkeeping ? source.attendance : source;
    const syncedAt = hasBookkeeping ? source.syncedAt : null;
    for (const [employeeId, days] of Object.entries(attendance || {})) {
      const targetDays = { ...(merged[employeeId] || {}) };
      const targetAt = { ...(mergedAt[employeeId] || {}) };
      const targetKind = { ...(mergedKind[employeeId] || {}) };
      for (const [date, record] of Object.entries(days || {})) {
        const candidateAt = String(syncedAt?.[employeeId]?.[date] || "");
        const currentAt = String(targetAt[date] || "");
        const currentIsValue = date in targetDays; // vencedor atual é um valor real, não um tombstone
        const currentKind = targetKind[date]; // undefined na primeira vez que a célula aparece
        let candidateWins;
        if (candidateAt && currentAt) {
          if (candidateAt > currentAt) candidateWins = true;
          else if (candidateAt < currentAt) candidateWins = false;
          // Empate exato: uma troca de obra carimba as DUAS pontas (o
          // tombstone da obra antiga e o valor da obra nova) com o MESMO
          // `now` - por isso um valor real sempre vence um tombstone no
          // empate, nunca o contrário, independente de qual das duas linhas
          // o merge processa por último. Achado ao testar a própria
          // correção: sem esta regra, a ordem das linhas voltava a decidir
          // exatamente no caso mais comum (uma troca simples).
          else candidateWins = record != null || !currentIsValue;
        } else if (candidateAt) {
          candidateWins = true; // com carimbo sempre vence sem carimbo
        } else if (currentAt) {
          candidateWins = false; // sem carimbo nunca vence com carimbo
        } else if (hasBookkeeping && (currentKind === "bookkeeping" || currentKind === undefined)) {
          // Trava de segurança (04/09/2026, achada ao investigar o backfill
          // de dado legado): duas linhas por OBRA (ambas passaram por
          // withAttendanceSyncedAt) conflitam sem carimbo nenhum nesta
          // célula - sem informação real para desempatar, mas um tombstone
          // alheio nunca deveria conseguir apagar um valor real só por ter
          // sido processado por último (era exatamente isso que deixava um
          // funcionário "sumir" quando uma obra sem relação nenhuma ganhava
          // uma escrita nova). Mesma regra do empate exato acima: valor real
          // vence tombstone, incondicionalmente. Só quando os DOIS lados são
          // valores reais conflitantes é que a ordem ainda decide - caso
          // genuinamente ambíguo sem carimbo (por isso o backfill de
          // 04/09/2026 trata esses casos à parte, consultando uma fonte
          // externa de verdade). NÃO se aplica quando a célula já veio de
          // uma fonte raw (core/legado) - essa combinação preserva o
          // comportamento histórico abaixo, de propósito (achado de
          // 25/08/2026: uma limpeza precisa poder vencer a cópia legada).
          candidateWins = record != null || !currentIsValue;
        } else {
          candidateWins = true; // histórico: última fonte processada vence (raw envolvido de algum lado)
        }
        if (!candidateWins) continue;
        if (record == null) delete targetDays[date];
        else targetDays[date] = record;
        if (candidateAt) targetAt[date] = candidateAt;
        else delete targetAt[date];
        targetKind[date] = hasBookkeeping ? "bookkeeping" : "raw";
      }
      merged[employeeId] = targetDays;
      mergedAt[employeeId] = targetAt;
      mergedKind[employeeId] = targetKind;
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
// (employeeId,date) que estão em `entries`. `now` (o carimbo do próprio
// comando, não `clock_timestamp()`) é gravado por célula em
// `existingSyncedAt` para `mergeAttendanceObjects` comparar depois -
// ver o achado de 04/09/2026 no topo do arquivo.
export const applyEntriesToAttendance = (existingAttendance, entries, fullAttendanceAfter, now = "", existingSyncedAt = {}) => {
  let next = { ...(existingAttendance || {}) };
  let nextSynced = { ...(existingSyncedAt || {}) };
  for (const entry of entries || []) {
    const employeeId = String(entry?.employeeId || "");
    const date = String(entry?.date || "");
    if (!employeeId || !date) continue;
    const record = fullAttendanceAfter?.[employeeId]?.[date] || null;
    const days = { ...(next[employeeId] || {}) };
    days[date] = record;
    next[employeeId] = days;
    if (now) {
      const syncedDays = { ...(nextSynced[employeeId] || {}) };
      syncedDays[date] = now;
      nextSynced[employeeId] = syncedDays;
    }
  }
  return { attendance: next, syncedAt: nextSynced };
};

// Achado de 02/09/2026: uma troca de obra (P1-08 -> CA1-06, por exemplo)
// só grava na linha da obra NOVA (groupAttendanceEntriesByObra/
// applyEntriesToAttendance acima) - a cópia na linha da obra ANTIGA nunca
// era tocada, e sobrava como um "fantasma" ({status,obraId:antiga}) que
// mergeAttendanceObjects podia deixar VENCER a cópia nova ao reconstruir
// `attendance` na leitura. Sintoma real: trocar a obra do dia "não
// salvava" ou revertia sozinho depois de recarregar a tela. Agrupa,
// por obra ANTIGA distinta, os pares (employeeId,date) cujo `previousObraId`
// (server/attendance-command.js) aponta para uma obra diferente da nova.
export const groupObraDeparturesByBucket = entries => {
  const byBucket = new Map();
  for (const entry of entries || []) {
    if (entry?.previousObraId == null) continue;
    const previousBucket = attendanceObraBucket(entry.previousObraId);
    const nextBucket = attendanceObraBucket(entry?.obraId);
    if (previousBucket === nextBucket) continue;
    const employeeId = String(entry?.employeeId || "");
    const date = String(entry?.date || "");
    if (!employeeId || !date) continue;
    if (!byBucket.has(previousBucket)) byBucket.set(previousBucket, []);
    byBucket.get(previousBucket).push({ employeeId, date });
  }
  return byBucket;
};

// Apaga (tombstone: `record:null`) os pares (employeeId,date) informados
// na linha da obra ANTIGA - usado por groupObraDeparturesByBucket acima.
// Nunca lê `fullAttendanceAfter` (o valor lá é sempre o da obra NOVA):
// aqui a intenção é sempre apagar, nunca copiar o registro atual. `now`
// carimba o tombstone célula a célula, mesmo motivo de
// applyEntriesToAttendance acima.
export const tombstoneAttendanceEntries = (existingAttendance, pairs, now = "", existingSyncedAt = {}) => {
  let next = { ...(existingAttendance || {}) };
  let nextSynced = { ...(existingSyncedAt || {}) };
  for (const { employeeId, date } of pairs || []) {
    if (!employeeId || !date) continue;
    const days = { ...(next[employeeId] || {}) };
    days[date] = null;
    next[employeeId] = days;
    if (now) {
      const syncedDays = { ...(nextSynced[employeeId] || {}) };
      syncedDays[date] = now;
      nextSynced[employeeId] = syncedDays;
    }
  }
  return { attendance: next, syncedAt: nextSynced };
};
