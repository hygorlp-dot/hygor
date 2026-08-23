// scripts/seed-attendance-obra-rows.mjs
//
// Acelera, para uma empresa, o benefício da Fase 1.5 reduzida (22/08/2026,
// ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md e
// server/attendance-obra-routing.js): pré-cria uma linha própria por obra
// para `data.attendance`, dividindo de uma vez só o que hoje está inteiro
// na linha core ou na linha de Ponto (`arced_ponto_v1__ponto`).
//
// NÃO é um pré-requisito de correção: api/data.js já migra sozinho, célula
// por célula (funcionário+data), a cada novo attendance-upsert/
// attendance-batch-upsert - o que ainda não foi editado continua sendo lido
// corretamente da cópia legada (mergeAttendanceObjects, a linha de obra
// sempre vence quando existe). Rodar este script só faz a redução de
// contenção valer para o HISTÓRICO inteiro de uma vez, em vez de esperar
// cada célula ser tocada organicamente.
//
// Cada registro de attendance já carrega o próprio obraId resolvido
// (normalizeSubmittedRecord, server/attendance-command.js) - a obra de
// destino de cada (funcionário,data) vem do PRÓPRIO registro, não de uma
// nova resolução via data.employees/data.obras.
//
// Seguro rodar mais de uma vez: usa upsert com ignoreDuplicates, então uma
// linha de obra já existente (seja semeada por uma rodada anterior deste
// script, seja criada organicamente por uma escrita real mais nova) NUNCA é
// sobrescrita.
//
// Não remove `attendance` de nenhuma linha existente: a cópia legada
// continua onde estava, como fallback para qualquer obra cuja linha ainda
// não existir - peso morto aceitável em troca de não arriscar apagar dado.
//
// Rodar manualmente contra produção (mesmo padrão de split-rows:seed):
//
//   npm run attendance-obra-rows:seed
//
// Requer as mesmas variáveis de ambiente do resto do backend
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "@supabase/supabase-js";
import { decodeAppData, encodeAppData } from "../server/data-codec.js";
import { attendanceObraBucket, attendanceObraKey } from "../server/attendance-obra-routing.js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`seed-attendance-obra-rows: variáveis ausentes: ${missing.join(", ")}.`);
}

const CORE_KEY = "arced_ponto_v1";
const PONTO_KEY = `${CORE_KEY}__ponto`;

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Mesma prioridade de lerLinha(): a linha de Ponto (se existir) vence a
// cópia legada da core no mesmo funcionário+data.
const mergeAttendance = (...sources) => {
  const merged = {};
  for (const source of sources) {
    for (const [employeeId, days] of Object.entries(source || {})) {
      merged[employeeId] = { ...(merged[employeeId] || {}), ...days };
    }
  }
  return merged;
};

const { data: coreRows, error: listError } = await db
  .from("company_app_data")
  .select("company_id, value")
  .eq("key", CORE_KEY);
if (listError) throw listError;
if (!coreRows?.length) {
  process.stdout.write("seed-attendance-obra-rows: nenhuma linha core (arced_ponto_v1) encontrada - nada para semear.\n");
  process.exit(0);
}

for (const row of coreRows) {
  const companyId = row.company_id;
  const core = decodeAppData(row.value);

  const { data: pontoRow, error: pontoError } = await db
    .from("company_app_data")
    .select("value")
    .eq("company_id", companyId).eq("key", PONTO_KEY)
    .maybeSingle();
  if (pontoError) throw pontoError;
  const ponto = pontoRow ? decodeAppData(pontoRow.value) : null;

  const attendance = mergeAttendance(core.attendance, ponto?.attendance);

  const byBucket = new Map();
  for (const [employeeId, days] of Object.entries(attendance)) {
    for (const [date, record] of Object.entries(days || {})) {
      const bucket = attendanceObraBucket(record?.obraId);
      if (!byBucket.has(bucket)) byBucket.set(bucket, {});
      const slice = byBucket.get(bucket);
      slice[employeeId] = { ...(slice[employeeId] || {}), [date]: record };
    }
  }

  if (!byBucket.size) {
    process.stdout.write(`seed-attendance-obra-rows: ${companyId} não tem nenhum registro de attendance - nada para semear.\n`);
    continue;
  }

  for (const [bucket, slice] of byBucket) {
    const key = attendanceObraKey(PONTO_KEY, bucket === "sem_obra" ? "" : bucket);
    const { data: inserted, error } = await db
      .from("company_app_data")
      .upsert(
        { company_id: companyId, key, value: encodeAppData({ attendance: slice }), updated_at: new Date().toISOString(), updated_by: null },
        { onConflict: "company_id,key", ignoreDuplicates: true },
      )
      .select("key");
    if (error) throw error;
    const created = (inserted || []).length > 0;
    const employeeCount = Object.keys(slice).length;
    process.stdout.write(
      created
        ? `seed-attendance-obra-rows: ${companyId}/${key} criada (${employeeCount} funcionários com registros).\n`
        : `seed-attendance-obra-rows: ${companyId}/${key} já existia - não foi tocada.\n`,
    );
  }
}
process.stdout.write("seed-attendance-obra-rows: concluído.\n");
