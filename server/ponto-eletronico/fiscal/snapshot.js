import { exigir } from "./campos.js";
const MAX = 100_000, PAGE = 500;
// Key order is unique and pagination never interprets a capped page as the end.
async function todas(db, table, companyId, filter, key) {
  const result = [];
  for (;;) {
    let q = db.from(table).select("*").eq("company_id", companyId);
    q = filter(q).order(key, { ascending: true }).range(result.length, result.length + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    exigir(Array.isArray(data), "LEITURA_INVALIDA", table);
    if (!data.length) return result;
    result.push(...data);
    exigir(result.length <= MAX, "EXTRACAO_EXCEDE_LIMITE", table);
  }
}
async function um(db, table, companyId, estabId) {
  const { data, error } = await db.from(table).select("*").eq("company_id", companyId).eq(table === "ponto_estabelecimentos" ? "id" : "estabelecimento_id", estabId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function capturarSnapshotFiscal({ db, companyId, estabelecimentoId, config = null }) {
  exigir(typeof companyId === "string" && companyId.trim(), "EMPRESA_AUSENTE");
  exigir(typeof estabelecimentoId === "string" && /^[a-f0-9-]{36}$/i.test(estabelecimentoId), "ESTABELECIMENTO_INVALIDO");
  const estabelecimento = await um(db, "ponto_estabelecimentos", companyId, estabelecimentoId);
  exigir(estabelecimento, "ESTABELECIMENTO_INEXISTENTE");
  const before = await um(db, "ponto_arp_contadores", companyId, estabelecimentoId);
  const scope = q => q.eq("estabelecimento_id", estabelecimentoId);
  const devicesBefore = await todas(db, "ponto_dispositivos", companyId, scope, "id");
  const registros = await todas(db, "ponto_arp_registros", companyId, scope, "nsr");
  const eventos = await todas(db, "ponto_eventos", companyId, scope, "event_id");
  const obras = await todas(db, "ponto_estabelecimento_obras", companyId, scope, "obra_id");
  const legados = obras.length ? await todas(db, "ponto_marcacoes", companyId, q => q.in("obra_id", obras.map(o => o.obra_id)), "id") : [];
  const devicesAfter = await todas(db, "ponto_dispositivos", companyId, scope, "id");
  const legacyAfter = obras.length ? await todas(db, "ponto_marcacoes", companyId, q => q.in("obra_id", obras.map(o => o.obra_id)), "id") : [];
  const estabAfter = await um(db, "ponto_estabelecimentos", companyId, estabelecimentoId);
  const after = await um(db, "ponto_arp_contadores", companyId, estabelecimentoId);
  const deviceTip = d => JSON.stringify(d.map(x => [x.id, x.ultima_sequencia_local, x.ultimo_hash_local, x.ultimo_nsr]));
  const completo = JSON.stringify(before) === JSON.stringify(after) && deviceTip(devicesBefore) === deviceTip(devicesAfter)
    && JSON.stringify(estabelecimento) === JSON.stringify(estabAfter) && JSON.stringify(legados) === JSON.stringify(legacyAfter);
  return { versao: 1, companyId, estabelecimento, contador: before, dispositivos: devicesBefore, eventos, registros, obras, legados, config, completo };
}
