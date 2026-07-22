// ===================================================================
// /api/references - bases pesquisáveis do orçamento
//
// SINAPI: itens normalizados no Supabase, enviados em lotes pelo navegador.
// ORSE: a competência fica no Supabase e a pesquisa consulta a página oficial
// do ORSE pelo servidor. O arquivo .ORSE é um pacote proprietário do ORSE 2
// para SQL Server e não pode ser lido diretamente no navegador.
// ===================================================================

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { decodeAppData } from "../server/data-codec.js";
import {
  normalizeText,
  parsePriceBR,
  decodeHtml,
  textFromHtml,
  decodeOrseResponse,
} from "./utils.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY = "arced_ponto_v1";
const ORSE_URL = "https://orse.cehop.se.gov.br";

// Constants: limites de segurança e performance
const LIMITS = {
  COMPOSITION_INITIAL: 40,
  COMPOSITION_VISITED_MAX: 160,
  COMPOSITION_DEPTH_MAX: 8,
  REFERENCE_IDS_MAX: 8,
  ENTRIES_MAX: 25,
  BATCH_SIZE: 8,
  PROMISE_TIMEOUT_MS: 10000,
  INPUTS_DISPLAY_MAX: 60,
  COMPOSITIONS_DISPLAY_MAX: 60,
  TOTAL_RESULTS_MAX: 100,
  TEXT_LENGTH_MAX: 120,
  QUERY_TERMS_MAX: 6,
  ITEM_RESULTS_MAX: 45,
  FINAL_RESULTS_MAX: 80,
  ITEM_BATCH_FINAL_MAX: 150,
};

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

/** Helper: executa Promise.allSettled com timeout */
const promiseAllWithTimeout = (promises, timeoutMs = LIMITS.PROMISE_TIMEOUT_MS) => {
  return Promise.race([
    Promise.allSettled(promises),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout em requisição")), timeoutMs)
    ),
  ]);
};

/** Valida PIN do usuário com timing-safe comparison */
const conferirPin = async (userId, pin, accessToken) => {
  const { data, error } = await db
    .from("company_app_data")
    .select("value")
    .eq("company_id", COMPANY)
    .eq("key", KEY)
    .maybeSingle();
  if (error || !data) return null;
  try {
    const payload = decodeAppData(data.value);
    if(accessToken){const {data:auth,error:authError}=await db.auth.getUser(accessToken);if(!authError&&auth?.user){const email=String(auth.user.email||"").toLowerCase();const linked=(payload?.usuarios||[]).find(u=>u.active!==false&&(u.authUserId===auth.user.id||String(u.email||"").toLowerCase()===email));if(linked)return linked;}}
    const user = (payload?.usuarios || []).find(item => item.id === userId && item.active !== false);
    if (!user) return null;
    const actual = Buffer.from(sha256(pin));
    const expected = Buffer.from(String(user.pin || ""));
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    return user;
  } catch (err) {
    console.error("Erro em conferirPin:", err);
    return null;
  }
};

const parseOrseRows = (html, competence) => {
  const out = [];
  const seen = new Set();
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html))) {
    const row = match[1];
    if (!/composicao\.asp\?/i.test(row) || !/CorpoTabela/i.test(row)) continue;
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cell;
    while ((cell = cellRegex.exec(row))) cells.push(textFromHtml(cell[1]));
    if (cells.length < 4 || !/^\d+\s*\/\s*ORSE$/i.test(cells[0])) continue;
    const code = cells[0].replace(/\s*\/\s*ORSE/i, "").replace(/^0+(?=\d)/, "");
    if (!code || seen.has(code)) continue;
    const href = row.match(/href=["']([^"']*composicao\.asp\?[^"']+)["']/i)?.[1] || "";
    const price = parsePriceBR(cells[3]);
    if (!cells[1] || price <= 0) continue;
    seen.add(code);
    out.push({
      fonte: "ORSE",
      codigo: code,
      descricao: cells[1],
      unidade: cells[2] || "UN",
      precoDes: price,
      precoNao: price,
      dataBase: competence,
      detailUrl: href ? `${ORSE_URL}/${decodeHtml(href).replace(/^\//, "")}` : "",
    });
  }
  return out;
};

const parseOrseInputRows = (html, competence) => {
  const out = [];
  const seen = new Set();
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = rowRegex.exec(html))) {
    const row = match[1];
    if (!/CorpoTabela/i.test(row)) continue;
    
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cell;
    
    while ((cell = cellRegex.exec(row))) {
      cells.push(textFromHtml(cell[1]));
    }
    
    if (cells.length < 4 || !/^\d+\s*\/\s*(ORSE|SINAPI)$/i.test(cells[0])) continue;
    
    const fonte = (cells[0].match(/\/(ORSE|SINAPI)/i)?.[1] || "ORSE").toUpperCase();
    const codigo = cells[0].replace(/\s*\/\s*(ORSE|SINAPI)/i, "").replace(/^0+(?=\d)/, "");
    const preco = parsePriceBR(cells[3]);
    const key = `${fonte}:${codigo}`;
    
    if (!codigo || !cells[1] || !(preco > 0) || seen.has(key)) continue;
    
    seen.add(key);
    out.push({
      fonte,
      codigo,
      descricao: cells[1],
      unidade: cells[2] || "UN",
      precoDes: preco,
      precoNao: preco,
      dataBase: competence,
      uf: fonte === "ORSE" ? "SE" : "",
      tipoItem: "INSUMO",
    });
  }
  
  return out;
};

const fetchOrseByCode = async (code, competence) => {
  const [year, month] = competence.split("-").map(Number);
  const cleanCode = String(code).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!cleanCode) return [];
  const detailUrl = `${ORSE_URL}/composicao.asp?font_sg_fonte=ORSE&serv_nr_codigo=${encodeURIComponent(cleanCode)}&peri_nr_ano=${year}&peri_nr_mes=${month}&peri_nr_ordem=1`;
  const response = await fetch(detailUrl, { headers: { accept: "text/html" } });
  if (!response.ok) throw new Error(`ORSE respondeu ${response.status}`);
  const html = await decodeOrseResponse(response);

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html))) {
    const text = textFromHtml(rowMatch[1]);
    if (!new RegExp(`^0*${cleanCode}\\s*\\/\\s*ORSE`, "i").test(text)) continue;
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cell;
    while ((cell = cellRegex.exec(rowMatch[1]))) cells.push(textFromHtml(cell[1]));
    if (cells.length >= 3) rows.push(cells);
  }
  if (!rows.length) return [];

  const totalAt = html.search(/Valor\s+Total/i);
  let price = 0;
  if (totalAt >= 0) {
    // A primeira linha numérica depois do cabeçalho "Valor Total" é a
    // linha de totais. Não podemos usar o último número da página, pois
    // depois dela vem a relação detalhada de insumos.
    const totalsHtml = html.slice(totalAt, totalAt + 2500);
    const totalRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let totalRow;
    while ((totalRow = totalRowRegex.exec(totalsHtml))) {
      const values = [];
      const totalCellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let totalCell;
      while ((totalCell = totalCellRegex.exec(totalRow[1]))) {
        const value = textFromHtml(totalCell[1]);
        if (/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(value)) values.push(value);
      }
      if (values.length >= 6) {
        price = parsePriceBR(values[values.length - 1]);
        break;
      }
    }
  }
  if (price <= 0) return [];

  const cells = rows[0];
  return [{
    fonte: "ORSE",
    codigo: cleanCode,
    descricao: cells[1] || `Composição ORSE ${cleanCode}`,
    unidade: cells[2] || "UN",
    precoDes: price,
    precoNao: price,
    dataBase: competence,
    detailUrl,
  }];
};

// Extrai as linhas analíticas da página oficial do ORSE. A página muda
// pequenas marcações entre competências; por isso a leitura usa conteúdo das
// células e não posições CSS. Linhas sem código, coeficiente ou descrição são
// descartadas.
const parseOrseCompositionRows = (html, compositionCode, competence) => {
  const items = [];
  const seen = new Set();
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html))) {
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cell;
    while ((cell = cellRegex.exec(rowMatch[1]))) cells.push(textFromHtml(cell[1]));
    if (cells.length < 4) continue;
    const codeIndex = cells.findIndex(value => /^\d{1,12}(?:\s*\/\s*(?:ORSE|SINAPI))?$/i.test(value));
    if (codeIndex < 0) continue;
    const itemCode = cells[codeIndex].replace(/\s*\/.*$/i, "").replace(/^0+(?=\d)/, "");
    if (!itemCode || itemCode === String(compositionCode).replace(/^0+(?=\d)/, "")) continue;
    const description = cells.slice(codeIndex + 1).find(value => value.length > 12 && /[A-Za-zÀ-ÿ]/.test(value)) || "";
    if (!description) continue;
    const unit = cells.find((value, index) => index > codeIndex && /^[A-Z0-9²³/.-]{1,10}$/i.test(value) && !/^\d+(?:[.,]\d+)?$/.test(value)) || "UN";
    const unitIndex = cells.indexOf(unit);
    const numericAfterUnit = cells.slice(Math.max(unitIndex + 1, codeIndex + 1))
      .map(value => parsePriceBR(value)).filter(value => value > 0);
    const coefficient = numericAfterUnit[0] || 0;
    const unitPrice = numericAfterUnit.length > 1 ? numericAfterUnit[numericAfterUnit.length - 2] : 0;
    if (!(coefficient > 0)) continue;
    const joined = normalizeText(cells.join(" "));
    const itemType = /composicao|servico|serviço/.test(joined) && !/mao de obra|mão de obra/.test(joined) ? "COMPOSICAO" : "INSUMO";
    const key = `${itemType}:${itemCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      fonte:"ORSE", compositionCode:String(compositionCode), itemType, itemCode,
      descricao:description, unidade:unit, coeficiente:coefficient,
      precoUnit:unitPrice, dataBase:competence,
    });
  }
  return items;
};

const fetchOrseCompositionDetails = async (code, competence) => {
  const [year, month] = competence.split("-").map(Number);
  const cleanCode = String(code).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!cleanCode) return [];
  const detailUrl = `${ORSE_URL}/composicao.asp?font_sg_fonte=ORSE&serv_nr_codigo=${encodeURIComponent(cleanCode)}&peri_nr_ano=${year}&peri_nr_mes=${month}&peri_nr_ordem=1`;
  const response = await fetch(detailUrl, { headers:{ accept:"text/html" } });
  if (!response.ok) throw new Error(`ORSE respondeu ${response.status}`);
  return parseOrseCompositionRows(await decodeOrseResponse(response), cleanCode, competence);
};

const expandOrseCompositionDetails = async (codes, competence) => {
  const result = [];
  const visited = new Set();
  let frontier = [...new Set(codes)].slice(0, LIMITS.COMPOSITION_INITIAL);
  
  for (let depth = 0; depth < LIMITS.COMPOSITION_DEPTH_MAX && frontier.length && visited.size < LIMITS.COMPOSITION_VISITED_MAX; depth++) {
    const pending = frontier
      .filter(code => !visited.has(code))
      .slice(0, LIMITS.COMPOSITION_VISITED_MAX - visited.size);
    
    pending.forEach(code => visited.add(code));
    
    const next = [];
    
    for (let i = 0; i < pending.length; i += LIMITS.BATCH_SIZE) {
      const batch = pending.slice(i, i + LIMITS.BATCH_SIZE);
      try {
        const settled = await promiseAllWithTimeout(
          batch.map(code => fetchOrseCompositionDetails(code, competence))
        );
      
        settled
          .filter(item => item.status === "fulfilled")
          .forEach(item => {
            (item.value || []).forEach(row => {
              result.push(row);
              if (row.itemType === "COMPOSICAO" && !visited.has(row.itemCode)) {
                next.push(row.itemCode);
              }
            });
          });
      } catch (err) {
        console.error("Timeout em composições:", err);
        // Continua com próximas batchs
      }
    }
    
    frontier = [...new Set(next)];
  }
  
  return result;
};

const searchOfficialOrse = async (term, competence) => {
  if (/^\d{1,8}$/.test(term.trim())) return fetchOrseByCode(term, competence);
  const [year, month] = competence.split("-").map(Number);
  const body = new URLSearchParams({
    sltFonte: "ORSE",
    sltPeriodo: `${year}-${month}-1`,
    sltGrupoServico: "0",
    rdbCriterio: "2",
    txtDescricao: term.trim().slice(0, 120),
    Submit: "Consultar",
  });
  const response = await fetch(`${ORSE_URL}/servicosargumento.asp?tarefa=consultar`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
    },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`ORSE respondeu ${response.status}`);
  return parseOrseRows(await decodeOrseResponse(response), competence);
};

const searchOfficialOrseInputs = async (term, competence) => {
  const [year, month] = competence.split("-").map(Number);
  const body = new URLSearchParams({
    sltFOnte: "ORSE",
    sltPeriodo: `${year}-${month}-1`,
    sltGrupoInsumo: "0",
    rdbCriterio: "1",
    txtDescricao: term.trim().slice(0, 120),
    Submit: "Consultar",
  });
  
  const response = await fetch(`${ORSE_URL}/insumosargumento.asp?tarefa=consultar`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
    },
    body: body.toString(),
  });
  
  if (!response.ok) throw new Error(`ORSE respondeu ${response.status}`);
  
  return parseOrseInputRows(await decodeOrseResponse(response), competence);
};

/** Mapeia base de dados para formato de saída */
const mapBase = item => ({
  id: item.id,
  fonte: item.source,
  dataBase: item.competence,
  uf: item.uf || "",
  desonerado: item.desonerado,
  arquivo: item.file_name || "",
  hash: item.file_hash || "",
  modo: item.mode,
  status: item.status,
  total: Number(item.item_count || 0),
  criadoEm: item.created_at,
});

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

/**
 * Handler principal: list, search-inputs, search-compositions, composition-details
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  if (!URL || !SERVICE) return res.status(503).json({ error: "Banco não configurado no servidor." });

  const { action, userId, pin, accessToken } = req.body || {};
  try {
    const user = await conferirPin(userId, pin, accessToken);
    if (!user) return res.status(401).json({ error: "PIN inválido." });

    if (action === "list") {
      const { data, error } = await db
        .from("budget_reference_bases")
        .select("*")
        .eq("company_id", COMPANY)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ bases: (data || []).map(mapBase) });
    }

    if (action === "begin") {
      const meta = req.body?.meta || {};
      const source = String(meta.fonte || "").toUpperCase();
      const competence = String(meta.dataBase || "");
      if (!['SINAPI', 'ORSE'].includes(source)) return res.status(400).json({ error: "Fonte inválida." });
      if (!/^\d{4}-\d{2}$/.test(competence)) return res.status(400).json({ error: "Data-base inválida." });
      const uf = source === "SINAPI" ? String(meta.uf || "").toUpperCase() : null;
      if (source === "SINAPI" && !/^[A-Z]{2}$/.test(uf)) return res.status(400).json({ error: "UF inválida." });

      const row = {
        company_id: COMPANY,
        source,
        competence,
        uf,
        desonerado: source === "SINAPI" ? meta.desonerado !== false : null,
        file_name: String(meta.arquivo || "").slice(0, 240),
        file_hash: String(meta.hash || "").slice(0, 128),
        mode: source === "ORSE" ? "official" : "uploaded",
        status: source === "ORSE" ? "ready" : "processing",
        item_count: 0,
        created_by: user.id || null,
      };
      const { data, error } = await db.from("budget_reference_bases").insert(row).select("*").single();
      if (error) throw error;
      return res.status(200).json({ base: mapBase(data) });
    }

    if (action === "chunk") {
      const baseId = String(req.body?.baseId || "");
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
      if (!baseId || !items.length) return res.status(400).json({ error: "Lote vazio." });
      const { data: base, error: baseError } = await db
        .from("budget_reference_bases")
        .select("id, source")
        .eq("id", baseId)
        .eq("company_id", COMPANY)
        .maybeSingle();
      if (baseError || !base) return res.status(404).json({ error: "Base não encontrada." });
      if (base.source !== "SINAPI") return res.status(400).json({ error: "Somente bases SINAPI recebem lotes." });

      const rows = items.map(item => {
        const code = String(item.codigo || "").replace(/\.0$/, "").trim();
        const description = String(item.descricao || "").trim();
        return {
          base_id: baseId,
          company_id: COMPANY,
          source: "SINAPI",
          code,
          description,
          unit: String(item.unidade || "UN").trim().slice(0, 30),
          price_des: Math.max(0, Number(item.precoDes || 0)),
          price_not: Math.max(0, Number(item.precoNao || 0)),
          search_text: normalizeText(`${code} ${description}`),
          detail_url: null,
        };
      }).filter(item => item.code && item.description && (item.price_des > 0 || item.price_not > 0));
      if (!rows.length) return res.status(400).json({ error: "Nenhuma composição válida no lote." });
      const { error } = await db
        .from("budget_reference_items")
        .upsert(rows, { onConflict: "base_id,source,code" });
      if (error) throw error;
      return res.status(200).json({ ok: true, recebidos: rows.length });
    }

    if (action === "input-chunk") {
      const baseId = String(req.body?.baseId || "");
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
      if (!baseId || !items.length) return res.status(400).json({ error: "Lote de insumos vazio." });
      
      const { data: base, error: baseError } = await db
        .from("budget_reference_bases")
        .select("id, source")
        .eq("id", baseId)
        .eq("company_id", COMPANY)
        .maybeSingle();
      
      if (baseError || !base) return res.status(404).json({ error: "Base não encontrada." });
      if (base.source !== "SINAPI") return res.status(400).json({ error: "Somente bases SINAPI recebem insumos enviados." });
      
      const rows = items.map(item => {
        const code = String(item.codigo || "").replace(/\.0$/, "").trim();
        const description = String(item.descricao || "").trim();
        return {
          base_id: baseId,
          company_id: COMPANY,
          source: "SINAPI",
          code,
          description,
          unit: String(item.unidade || "UN").trim().slice(0, 30),
          classification: String(item.classificacao || "").trim().slice(0, 80),
          price_des: Math.max(0, Number(item.precoDes || 0)),
          price_not: Math.max(0, Number(item.precoNao || 0)),
          search_text: normalizeText(`${code} ${description} ${item.classificacao || ""}`),
        };
      }).filter(item => item.code && item.description && (item.price_des > 0 || item.price_not > 0));
      
      if (!rows.length) return res.status(400).json({ error: "Nenhum insumo válido no lote." });
      
      const { error } = await db
        .from("budget_reference_inputs")
        .upsert(rows, { onConflict: "base_id,source,code" });
      
      if (error) throw error;
      return res.status(200).json({ ok: true, recebidos: rows.length });
    }

    if (action === "component-chunk") {
      const baseId = String(req.body?.baseId || "");
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
      if (!baseId || !items.length) return res.status(400).json({ error: "Lote analítico vazio." });
      
      const { data: base, error: baseError } = await db
        .from("budget_reference_bases")
        .select("id, source")
        .eq("id", baseId)
        .eq("company_id", COMPANY)
        .maybeSingle();
      
      if (baseError || !base) return res.status(404).json({ error: "Base não encontrada." });
      if (base.source !== "SINAPI") return res.status(400).json({ error: "Somente bases SINAPI recebem relações analíticas." });
      
      const rows = items.map(item => ({
        base_id: baseId,
        company_id: COMPANY,
        source: "SINAPI",
        composition_code: String(item.compositionCode || "").replace(/\.0$/, "").trim(),
        item_type: String(item.itemType || "").toUpperCase() === "COMPOSICAO" ? "COMPOSICAO" : "INSUMO",
        item_code: String(item.itemCode || "").replace(/\.0$/, "").trim(),
        description: String(item.descricao || "").trim(),
        unit: String(item.unidade || "UN").trim().slice(0, 30),
        coefficient: Math.max(0, Number(item.coeficiente || 0)),
        situation: String(item.situacao || "").trim().slice(0, 80),
      })).filter(item => item.composition_code && item.item_code && item.description && item.coefficient > 0);
      
      if (!rows.length) return res.status(400).json({ error: "Nenhuma relação analítica válida no lote." });
      
      const { error } = await db
        .from("budget_reference_components")
        .upsert(rows, { onConflict: "base_id,source,composition_code,item_type,item_code" });
      
      if (error) throw error;
      return res.status(200).json({ ok: true, recebidos: rows.length });
    }

    if (action === "finish") {
      const baseId = String(req.body?.baseId || "");
      const { count, error: countError } = await db
        .from("budget_reference_items")
        .select("id", { count: "exact", head: true })
        .eq("base_id", baseId)
        .eq("company_id", COMPANY);
      if (countError) throw countError;
      const { data, error } = await db
        .from("budget_reference_bases")
        .update({ status: "ready", item_count: count || 0 })
        .eq("id", baseId)
        .eq("company_id", COMPANY)
        .select("*")
        .maybeSingle();
      if (error || !data) throw error || new Error("Base não encontrada.");
      return res.status(200).json({ base: mapBase(data) });
    }

    if (action === "resolve") {
      const referenceIds = [...new Set((req.body?.referenceIds || []).map(String))].slice(0, LIMITS.REFERENCE_IDS_MAX);
      const entries = (Array.isArray(req.body?.entries) ? req.body.entries : []).slice(0, LIMITS.ENTRIES_MAX).map(entry => ({
        codigo: String(entry?.codigo || "").trim().replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i, "").replace(/\.0$/, "").replace(/^0+(?=\d)/, ""),
        fonte: String(entry?.fonte || "").trim().toUpperCase(),
      })).filter(entry => entry.codigo);
      if (!referenceIds.length || !entries.length) return res.status(200).json({ items: [] });

      const { data: bases, error: basesError } = await db
        .from("budget_reference_bases").select("*")
        .eq("company_id", COMPANY).in("id", referenceIds).eq("status", "ready");
      if (basesError) throw basesError;
      const baseById = new Map((bases || []).map(base => [base.id, base]));

      const sinapiIds = (bases || []).filter(base => base.source === "SINAPI").map(base => base.id);
      const sinapiCodes = [...new Set(entries.filter(entry => entry.fonte !== "ORSE").map(entry => entry.codigo))];
      let sinapiItems = [];
      if (sinapiIds.length && sinapiCodes.length) {
        const { data, error } = await db.from("budget_reference_items")
          .select("base_id,source,code,description,unit,price_des,price_not,detail_url")
          .eq("company_id", COMPANY).in("base_id", sinapiIds).in("code", sinapiCodes).limit(300);
        if (error) throw error;
        sinapiItems = (data || []).map(item => ({
          fonte:item.source, codigo:item.code, descricao:item.description, unidade:item.unit,
          precoDes:Number(item.price_des || 0), precoNao:Number(item.price_not || 0),
          dataBase:baseById.get(item.base_id)?.competence || "",
          uf:baseById.get(item.base_id)?.uf || "", detailUrl:item.detail_url || "",
        }));
      }

      const orseBases = (bases || []).filter(base => base.source === "ORSE");
      const orseCodes = [...new Set(entries.filter(entry => entry.fonte !== "SINAPI").map(entry => entry.codigo))];
      let orseItems = [], warning = "";
      if (orseBases.length && orseCodes.length) {
        try {
          const settled = await promiseAllWithTimeout(orseBases.flatMap(base =>
            orseCodes.map(code => fetchOrseByCode(code, base.competence))));
          orseItems = settled.filter(result => result.status === "fulfilled").flatMap(result => result.value || []);
          if (settled.some(result => result.status === "rejected")) warning = "Alguns códigos ORSE não puderam ser consultados agora.";
        } catch (err) {
          console.error("Timeout em busca ORSE:", err);
          warning = "Timeout ao consultar ORSE.";
        }
      }

      const seen = new Set();
      const items = [...sinapiItems, ...orseItems].filter(item => {
        const key = `${item.fonte}:${item.dataBase}:${item.codigo}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      return res.status(200).json({ items, warning });
    }

    if (action === "search-inputs") {
      const referenceIds = [...new Set((req.body?.referenceIds || []).map(String))].slice(0, LIMITS.REFERENCE_IDS_MAX);
      const term = String(req.body?.query || "").trim().slice(0, LIMITS.TEXT_LENGTH_MAX);
      const itemType = ["INSUMO", "COMPOSICAO"].includes(String(req.body?.itemType || "").toUpperCase())
        ? String(req.body.itemType).toUpperCase() : "TODOS";
      const buscarInsumos = itemType !== "COMPOSICAO";
      const buscarComposicoes = itemType !== "INSUMO";
      
      if (!referenceIds.length || term.length < 2) {
        return res.status(200).json({ items: [] });
      }
      
      const { data: bases, error: basesError } = await db
        .from("budget_reference_bases")
        .select("*")
        .eq("company_id", COMPANY)
        .in("id", referenceIds)
        .eq("status", "ready");
      
      if (basesError) throw basesError;
      
      const baseById = new Map((bases || []).map(base => [base.id, base]));
      const sinapiIds = (bases || [])
        .filter(base => base.source === "SINAPI")
        .map(base => base.id);
      const terms = normalizeText(term).split(/\s+/).filter(Boolean).slice(0, LIMITS.QUERY_TERMS_MAX);
      
      let inputs = [], compositions = [];
      
      if (sinapiIds.length && buscarInsumos) {
        let inputQuery = db.from("budget_reference_inputs")
          .select("base_id, source, code, description, unit, classification, price_des, price_not")
          .eq("company_id", COMPANY)
          .in("base_id", sinapiIds);
        
        terms.forEach(piece => {
          inputQuery = inputQuery.ilike("search_text", `%${piece}%`);
        });
        
        const { data, error } = await inputQuery.limit(60);
        if (error) throw error;
        
        inputs = (data || []).map(item => ({
          fonte: item.source,
          codigo: item.code,
          descricao: item.description,
          unidade: item.unit,
          classificacao: item.classification || "",
          precoDes: Number(item.price_des || 0),
          precoNao: Number(item.price_not || 0),
          dataBase: baseById.get(item.base_id)?.competence || "",
          uf: baseById.get(item.base_id)?.uf || "",
          tipoItem: "INSUMO",
        }));
      }
      
      if (sinapiIds.length && buscarComposicoes) {
        let compQuery = db.from("budget_reference_items")
          .select("base_id, source, code, description, unit, price_des, price_not")
          .eq("company_id", COMPANY)
          .in("base_id", sinapiIds);
        
        terms.forEach(piece => {
          compQuery = compQuery.ilike("search_text", `%${piece}%`);
        });
        
        const { data: compData, error: compError } = await compQuery.limit(25);
        if (compError) throw compError;
        
        compositions = (compData || []).map(item => ({
          fonte: item.source,
          codigo: item.code,
          descricao: item.description,
          unidade: item.unit,
          precoDes: Number(item.price_des || 0),
          precoNao: Number(item.price_not || 0),
          dataBase: baseById.get(item.base_id)?.competence || "",
          uf: baseById.get(item.base_id)?.uf || "",
          tipoItem: "COMPOSICAO",
        }));
      }
      
      let orse = [], warning = "";
      const orseBases = (bases || []).filter(base => base.source === "ORSE");
      
      if (orseBases.length) {
        try {
          const [inputGroups, compositionGroups] = await Promise.all([
            buscarInsumos
              ? Promise.all(orseBases.map(base => searchOfficialOrseInputs(term, base.competence)))
              : Promise.resolve([]),
            buscarComposicoes
              ? Promise.all(orseBases.map(base => searchOfficialOrse(term, base.competence)))
              : Promise.resolve([]),
          ]);
          
          orse = [
            ...inputGroups.flat().slice(0, LIMITS.INPUTS_DISPLAY_MAX).map(item => ({ ...item, tipoItem: "INSUMO" })),
            ...compositionGroups.flat().slice(0, LIMITS.COMPOSITIONS_DISPLAY_MAX).map(item => ({ ...item, tipoItem: "COMPOSICAO" })),
          ];
        } catch (error) {
          warning = "A consulta de itens ORSE está temporariamente indisponível.";
        }
      }
      
      return res.status(200).json({
        items: [...inputs, ...compositions, ...orse].slice(0, LIMITS.TOTAL_RESULTS_MAX),
        warning,
      });
    }

    if (action === "composition-details") {
      const referenceIds = [...new Set((req.body?.referenceIds || []).map(String))].slice(0, LIMITS.REFERENCE_IDS_MAX);
      const entries = (Array.isArray(req.body?.entries) ? req.body.entries : [])
        .slice(0, LIMITS.ITEM_BATCH_FINAL_MAX)
        .map(entry => ({
          codigo: String(entry?.codigo || "")
            .trim()
            .replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i, "")
            .replace(/\.0$/, "")
            .replace(/^0+(?=\d)/, ""),
          fonte: String(entry?.fonte || "").trim().toUpperCase(),
        }))
        .filter(entry => entry.codigo);
      
      if (!referenceIds.length || !entries.length) {
        return res.status(200).json({ components: [] });
      }
      
      const { data: bases, error: basesError } = await db
        .from("budget_reference_bases")
        .select("*")
        .eq("company_id", COMPANY)
        .in("id", referenceIds)
        .eq("status", "ready");
      
      if (basesError) throw basesError;
      
      const sinapiIds = (bases || [])
        .filter(base => base.source === "SINAPI")
        .map(base => base.id);
      const baseById = new Map((bases || []).map(base => [base.id, base]));
      const initialSinapi = [...new Set(entries
        .filter(entry => entry.fonte !== "ORSE")
        .map(entry => entry.codigo))];
      
      const relations = [];
      const visited = new Set();
      let frontier = sinapiIds.length ? initialSinapi : [];
      
      for (let depth = 0; depth < 12 && frontier.length; depth++) {
        const pending = frontier.filter(code => !visited.has(code));
        if (!pending.length) break;
        
        pending.forEach(code => visited.add(code));
        const next = [];
        
        for (let i = 0; i < pending.length; i += 180) {
          const { data, error } = await db
            .from("budget_reference_components")
            .select("base_id, source, composition_code, item_type, item_code, description, unit, coefficient, situation")
            .eq("company_id", COMPANY)
            .in("base_id", sinapiIds)
            .in("composition_code", pending.slice(i, i + 180))
            .limit(10000);
          
          if (error) throw error;
          
          (data || []).forEach(row => {
            relations.push(row);
            if (row.item_type === "COMPOSICAO" && !visited.has(row.item_code)) {
              next.push(row.item_code);
            }
          });
        }
        
        frontier = [...new Set(next)];
      }
      
      // Fetch input prices
      const inputCodes = [...new Set(relations
        .filter(row => row.item_type === "INSUMO")
        .map(row => row.item_code))];
      const inputMap = new Map();
      
      for (let i = 0; i < inputCodes.length; i += 180) {
        const { data, error } = await db
          .from("budget_reference_inputs")
          .select("base_id, code, price_des, price_not, classification")
          .eq("company_id", COMPANY)
          .in("base_id", sinapiIds)
          .in("code", inputCodes.slice(i, i + 180))
          .limit(10000);
        
        if (error) throw error;
        
        (data || []).forEach(row =>
          inputMap.set(`${row.base_id}|${row.code}`, row)
        );
      }
      
      // Fetch composition prices
      const nestedCodes = [...new Set(relations
        .filter(row => row.item_type === "COMPOSICAO")
        .map(row => row.item_code))];
      const compositionPriceMap = new Map();
      
      for (let i = 0; i < nestedCodes.length; i += 180) {
        const { data, error } = await db
          .from("budget_reference_items")
          .select("base_id, code, price_des, price_not")
          .eq("company_id", COMPANY)
          .in("base_id", sinapiIds)
          .in("code", nestedCodes.slice(i, i + 180))
          .limit(10000);
        
        if (error) throw error;
        
        (data || []).forEach(row =>
          compositionPriceMap.set(`${row.base_id}|${row.code}`, row)
        );
      }
      
      const sinapiComponents = relations.map(row => {
        const price = row.item_type === "COMPOSICAO"
          ? compositionPriceMap.get(`${row.base_id}|${row.item_code}`)
          : inputMap.get(`${row.base_id}|${row.item_code}`);
        const base = baseById.get(row.base_id);
        
        return {
          fonte: "SINAPI",
          compositionCode: row.composition_code,
          itemType: row.item_type,
          itemCode: row.item_code,
          descricao: row.description,
          unidade: row.unit,
          coeficiente: Number(row.coefficient || 0),
          situacao: row.situation || "",
          classificacao: price?.classification || "",
          precoDes: Number(price?.price_des || 0),
          precoNao: Number(price?.price_not || 0),
          dataBase: base?.competence || "",
          uf: base?.uf || "",
        };
      });
      
      const orseBases = (bases || []).filter(base => base.source === "ORSE");
      const orseCodes = [...new Set(entries
        .filter(entry => entry.fonte !== "SINAPI")
        .map(entry => entry.codigo))]
        .slice(0, LIMITS.COMPOSITION_INITIAL);
      
      let orseComponents = [], warning = "";
      
      if (orseBases.length && orseCodes.length) {
        try {
          const settled = await promiseAllWithTimeout(
            orseBases.map(base => expandOrseCompositionDetails(orseCodes, base.competence))
          );
        
        orseComponents = settled
          .filter(result => result.status === "fulfilled")
          .flatMap(result => result.value || []);
        
        if (settled.some(result => result.status === "rejected")) {
          warning = "Algumas composições ORSE não puderam ser detalhadas agora.";
        }
      } catch (err) {
        console.error("Timeout em composições ORSE:", err);
        warning = "Timeout ao detalhar composições ORSE.";
      }
      }
      
      return res.status(200).json({
        components: [...sinapiComponents, ...orseComponents],
        warning,
      });
    }

    if (action === "search") {
      const referenceIds = [...new Set((req.body?.referenceIds || []).map(String))].slice(0, LIMITS.REFERENCE_IDS_MAX);
      const term = String(req.body?.query || "").trim().slice(0, LIMITS.TEXT_LENGTH_MAX);
      if (!referenceIds.length || !term) return res.status(200).json({ items: [] });

      const { data: bases, error: basesError } = await db
        .from("budget_reference_bases")
        .select("*")
        .eq("company_id", COMPANY)
        .in("id", referenceIds)
        .eq("status", "ready");
      if (basesError) throw basesError;

      const sinapiIds = (bases || []).filter(base => base.source === "SINAPI").map(base => base.id);
      let sinapiItems = [];
      if (sinapiIds.length) {
        let query = db
          .from("budget_reference_items")
          .select("base_id,source,code,description,unit,price_des,price_not,detail_url")
          .eq("company_id", COMPANY)
          .in("base_id", sinapiIds);
        const terms = normalizeText(term).split(/\s+/).filter(Boolean).slice(0, LIMITS.QUERY_TERMS_MAX);
        terms.forEach(piece => { query = query.ilike("search_text", `%${piece}%`); });
        const { data, error } = await query.limit(60);
        if (error) throw error;
        const baseById = new Map((bases || []).map(base => [base.id, base]));
        sinapiItems = (data || []).map(item => ({
          fonte: item.source,
          codigo: item.code,
          descricao: item.description,
          unidade: item.unit,
          precoDes: Number(item.price_des || 0),
          precoNao: Number(item.price_not || 0),
          dataBase: baseById.get(item.base_id)?.competence || "",
          uf: baseById.get(item.base_id)?.uf || "",
          detailUrl: item.detail_url || "",
        }));
      }

      const orseBases = (bases || []).filter(base => base.source === "ORSE");
      let orseItems = [];
      let orseWarning = "";
      if (orseBases.length) {
        try {
          const groups = await Promise.all(orseBases.map(base => searchOfficialOrse(term, base.competence)));
          const seen = new Set();
          orseItems = groups.flat().filter(item => {
            const key = `${item.dataBase}:${item.codigo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, LIMITS.ITEM_RESULTS_MAX);
        } catch (error) {
          console.error("Falha na consulta oficial ORSE:", error);
          orseWarning = "A consulta oficial do ORSE está temporariamente indisponível.";
        }
      }

      return res.status(200).json({ items: [...sinapiItems, ...orseItems].slice(0, LIMITS.FINAL_RESULTS_MAX), warning: orseWarning });
    }

    if (action === "delete") {
      const baseId = String(req.body?.baseId || "");
      const { error } = await db
        .from("budget_reference_bases")
        .delete()
        .eq("id", baseId)
        .eq("company_id", COMPANY);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Ação desconhecida." });
  } catch (error) {
    console.error("Falha em /api/references:", error);
    const message = String(error?.message || "");
    if (/budget_reference_/i.test(message) && /does not exist|schema cache/i.test(message)) {
      return res.status(503).json({
        error: "Estrutura analítica ausente no Supabase. Execute MIGRACAO_REFERENCIAS_ANALITICAS.sql no SQL Editor, publique novamente esta API e reenvie a base SINAPI."
      });
    }
    return res.status(500).json({ error: "Falha ao acessar as bases de referência." });
  }
}
