// scripts/backfill-conciliacao-contraparte-pix.mjs
//
// Reprocessa retroativamente as transações bancárias PENDENTES já
// importadas antes da consolidação de parseOFX de 25/08/2026 (ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Melhoria: extrair
// contraparte da descrição do PIX"): até essa data, transações do Banco
// Inter nunca ganhavam contraparteNome, porque o parser em uso real
// (dentro de LegacyApp.jsx) só lia a tag <NAME> - inexistente nesse banco -
// sem o fallback que hoje existe em extrairContraparteDescricaoPix.
//
// Este script NÃO conciliação nada, NÃO cria lançamento nenhum e NÃO
// toca em transações que já tenham status diferente de "pendente" (já
// conciliadas ou ignoradas ficam como estão) nem em transações que já
// tenham contraparteNome preenchido (nunca sobrescreve um valor
// existente - mesma garantia de segurança de extrairContraparteDescricaoPix
// em si). Só PREENCHE um campo hoje vazio, usando exatamente a mesma
// extração já testada e em produção desde o commit 9fa3ec8.
//
// Por padrão roda em modo --dry-run (só lê e relata, não grava nada).
// Passar --apply para gravar de verdade contra produção.
//
//   npm run conciliacao:backfill-contraparte-pix          # dry-run
//   npm run conciliacao:backfill-contraparte-pix -- --apply  # grava
//
// Requer as mesmas variáveis de ambiente do resto do backend
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMPANY_ID opcional).

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { decodeAppData, encodeAppData } from "../server/data-codec.js";
import { DOMAIN_ROW, coreFieldsOnly } from "../server/domain-row-routing.js";
import { extrairContraparteDescricaoPix } from "../src/domains/conciliacao/calculations.js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`backfill-conciliacao-contraparte-pix: variáveis ausentes: ${missing.join(", ")}.`);
}

const APPLY = process.argv.includes("--apply");
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY = "arced_ponto_v1";
const SPLIT_ROW_KEYS = {
  [DOMAIN_ROW.PONTO]: `${KEY}__ponto`,
  [DOMAIN_ROW.LOOKAHEAD]: `${KEY}__lookahead`,
  [DOMAIN_ROW.CONFIG]: `${KEY}__config`,
  [DOMAIN_ROW.EQUIPAMENTOS]: `${KEY}__equipamentos`,
  [DOMAIN_ROW.RDO]: `${KEY}__rdo`,
};
const MAX_ATTEMPTS = 5;

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Mesmo padrão de mascaramento usado nesta rodada para investigar produção
// sem expor dado pessoal em texto claro (nome do funcionário/terceiro).
const mascararNome = nome => String(nome || "").replace(/[A-Za-zÀ-ÿ]/g, (c, i) => (i === 0 ? c : "*"));

const lerLinhaCore = async () => {
  const [{ data, error }, { data: splitRows, error: splitError }] = await Promise.all([
    db.from("company_app_data").select("value, updated_at")
      .eq("company_id", COMPANY).eq("key", KEY).maybeSingle(),
    db.from("company_app_data").select("key, updated_at")
      .eq("company_id", COMPANY).in("key", Object.values(SPLIT_ROW_KEYS)),
  ]);
  if (error) throw error;
  if (splitError) throw splitError;
  if (!data) return null;
  const rowVersions = { [DOMAIN_ROW.CORE]: data.updated_at || null };
  for (const [domain, key] of Object.entries(SPLIT_ROW_KEYS)) {
    rowVersions[domain] = (splitRows || []).find(row => row.key === key)?.updated_at || null;
  }
  return { payload: decodeAppData(data.value), updatedAt: data.updated_at || null, rowVersions };
};

const calcularCandidatos = transacoes => {
  const candidatos = [];
  for (const tr of transacoes || []) {
    if (tr.status !== "pendente") continue;
    if (String(tr.contraparteNome || "").trim()) continue;
    const descricao = tr.descricao || tr.descricaoOriginal || "";
    const extraido = extrairContraparteDescricaoPix(descricao);
    if (extraido) candidatos.push({ id: tr.id, descricao, extraido });
  }
  return candidatos;
};

const aplicarCandidatos = (transacoes, candidatos) => {
  const porId = new Map(candidatos.map(c => [c.id, c.extraido]));
  return (transacoes || []).map(tr => (porId.has(tr.id) ? { ...tr, contraparteNome: porId.get(tr.id) } : tr));
};

let attempt = 0;
let relatorioImpresso = false;
while (attempt < MAX_ATTEMPTS) {
  attempt += 1;
  const linha = await lerLinhaCore();
  if (!linha) {
    process.stdout.write("backfill-conciliacao-contraparte-pix: nenhuma linha core encontrada - nada para fazer.\n");
    process.exit(0);
  }
  const transacoes = linha.payload?.transacoes || [];
  const pendentes = transacoes.filter(tr => tr.status === "pendente");
  const candidatos = calcularCandidatos(transacoes);

  if (!relatorioImpresso) {
    process.stdout.write(`backfill-conciliacao-contraparte-pix: ${transacoes.length} transações no total, ${pendentes.length} pendentes.\n`);
    process.stdout.write(`backfill-conciliacao-contraparte-pix: ${candidatos.length} pendentes sem contraparteNome onde a descrição permite extrair um nome.\n`);
    for (const c of candidatos.slice(0, 10)) {
      process.stdout.write(`  amostra: "${c.descricao}" -> "${mascararNome(c.extraido)}"\n`);
    }
    if (candidatos.length > 10) process.stdout.write(`  ... e mais ${candidatos.length - 10}.\n`);
    relatorioImpresso = true;
  }

  if (!candidatos.length) {
    process.stdout.write("backfill-conciliacao-contraparte-pix: nada para atualizar.\n");
    process.exit(0);
  }

  if (!APPLY) {
    process.stdout.write("backfill-conciliacao-contraparte-pix: modo dry-run (padrão) - nada foi gravado. Rode com --apply para gravar.\n");
    process.exit(0);
  }

  const novoPayload = { ...linha.payload, transacoes: aplicarCandidatos(transacoes, candidatos) };
  const persistido = coreFieldsOnly(novoPayload, linha.rowVersions, null);
  const before = { transacoes: candidatos.map(c => ({ id: c.id, contraparteNome: "" })) };
  const after = { transacoes: candidatos.map(c => ({ id: c.id, contraparteNome: c.extraido })) };

  const { data, error } = await db.rpc("company_save_with_audit", {
    p_company_id: COMPANY, p_key: KEY, p_expected_updated_at: linha.updatedAt, p_value: encodeAppData(persistido),
    p_actor_id: "system", p_actor_name: "Backfill contraparteNome PIX (retroativo, 25/08/2026)",
    p_correlation_id: crypto.randomUUID(), p_action: "RECONCILIATION_BACKFILL_CONTRAPARTE_PIX",
    p_before: before, p_after: after,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.applied) {
    process.stdout.write(`backfill-conciliacao-contraparte-pix: gravado com sucesso - ${candidatos.length} transações atualizadas (tentativa ${attempt}).\n`);
    process.exit(0);
  }
  process.stdout.write(`backfill-conciliacao-contraparte-pix: linha mudou durante a leitura (outra gravação concorrente) - relendo (tentativa ${attempt}/${MAX_ATTEMPTS}).\n`);
}
throw new Error("backfill-conciliacao-contraparte-pix: não foi possível gravar após concorrência repetida - rode de novo.");
