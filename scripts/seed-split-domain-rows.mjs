// scripts/seed-split-domain-rows.mjs
//
// Ativa, para uma empresa, o benefício de api/data.js gravar Ponto/
// Lookahead/Config/Equipamentos em linhas próprias em vez de uma só
// (achado de 20/08/2026: EMPLOYEE_SAVED disputando a mesma linha
// company_app_data com ATTENDANCE_COMMANDS - ver
// server/domain-row-routing.js para a classificação completa).
//
// NÃO é um pré-requisito bloqueante para o deploy: enquanto este script não
// roda, api/data.js detecta a linha ausente e cai de volta a gravar a linha
// core inteira - exatamente o comportamento de hoje, sem quebrar nada. Rodar
// este script é o que faz a contenção cruzada parar (o motivo desta rodada),
// mas o deploy do código é seguro com ou sem ele já ter rodado.
//
// Este script cria as 4 linhas separadas, uma por empresa já existente na
// tabela, semeadas com uma CÓPIA dos campos correspondentes que hoje moram
// na linha core (key=arced_ponto_v1). É seguro rodar mais de uma vez:
// usa upsert com ignoreDuplicates, então uma linha já semeada (ou já em uso
// real, com escritas mais novas que quando este script rodou pela primeira
// vez) NUNCA é sobrescrita - só linhas ainda inexistentes são criadas.
//
// Não remove nada da linha core: os campos migrados continuam lá, sem uso
// (a mesclagem em lerLinha() sempre prioriza a linha separada quando ela
// existe), o que é peso morto aceitável no blob em troca de não arriscar
// apagar dado por engano.
//
// Rodar manualmente contra produção (mesmo padrão de
// scripts/apply-financial-shadow.mjs e scripts/apply-core-registry-shadow.mjs
// - migration de dado, não de schema, roda à parte do build):
//
//   npm run split-rows:seed
//
// Requer as mesmas variáveis de ambiente do resto do backend
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "@supabase/supabase-js";
import { decodeAppData, encodeAppData } from "../server/data-codec.js";
import { DOMAIN_ROW, DOMAIN_FIELDS, pickDomainFields } from "../server/domain-row-routing.js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`seed-split-domain-rows: variáveis ausentes: ${missing.join(", ")}.`);
}

const CORE_KEY = "arced_ponto_v1";
const SPLIT_ROW_KEYS = {
  [DOMAIN_ROW.PONTO]: `${CORE_KEY}__ponto`,
  [DOMAIN_ROW.LOOKAHEAD]: `${CORE_KEY}__lookahead`,
  [DOMAIN_ROW.CONFIG]: `${CORE_KEY}__config`,
  [DOMAIN_ROW.EQUIPAMENTOS]: `${CORE_KEY}__equipamentos`,
};

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: coreRows, error: listError } = await db
  .from("company_app_data")
  .select("company_id, value")
  .eq("key", CORE_KEY);
if (listError) throw listError;
if (!coreRows?.length) {
  process.stdout.write("seed-split-domain-rows: nenhuma linha core (arced_ponto_v1) encontrada - nada para semear.\n");
  process.exit(0);
}

for (const row of coreRows) {
  const companyId = row.company_id;
  const core = decodeAppData(row.value);
  for (const [domain, key] of Object.entries(SPLIT_ROW_KEYS)) {
    const seedValue = pickDomainFields(core, domain);
    const { data: inserted, error } = await db
      .from("company_app_data")
      .upsert(
        { company_id: companyId, key, value: encodeAppData(seedValue), updated_at: new Date().toISOString(), updated_by: null },
        { onConflict: "company_id,key", ignoreDuplicates: true },
      )
      .select("key");
    if (error) throw error;
    const created = (inserted || []).length > 0;
    const fieldCount = DOMAIN_FIELDS[domain]?.length || 0;
    process.stdout.write(
      created
        ? `seed-split-domain-rows: ${companyId}/${key} criada (${fieldCount} campos possíveis, semeada da linha core).\n`
        : `seed-split-domain-rows: ${companyId}/${key} já existia - não foi tocada.\n`,
    );
  }
}
process.stdout.write("seed-split-domain-rows: concluído.\n");
