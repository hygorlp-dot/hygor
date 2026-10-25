// Adapta Request/Response ao contrato req/res da API existente. Não autentica
// usuários nem aparelhos: essa responsabilidade continua em api/data.js.
const MAX_BODY_BYTES = 4_500_000;
const json = (body, status, headers) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
});

async function readBody(request) {
  if (!request.body) return undefined;
  const reader = request.body.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!length) return undefined;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_BODY");
  return body;
}

export function criarAdaptadorHttp({ handler, confirmarAmbiente, origensPermitidas = [], ntpDisponivel = true }) {
  return async request => {
    const headers = { "Cache-Control": "no-store" };
    const origin = request.headers.get("origin");
    if (origin && !origensPermitidas.includes(origin)) return json({ error: "Origem não permitida." }, 403, headers);
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers.Vary = "Origin";
      headers["Access-Control-Allow-Headers"] = "authorization, content-type";
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    let body;
    try { body = await readBody(request); }
    catch (error) { return json({ error: "Pedido inválido." }, error.message === "BODY_TOO_LARGE" ? 413 : 400, headers); }
    let environment;
    try { environment = await confirmarAmbiente(); } catch { environment = null; }
    if (environment?.ambiente !== "homologacao") return json({ ok: false, code: "AMBIENTE_NAO_CONFIRMADO", error: "Banco de homologação não confirmado." }, 503, headers);
    if (body?.ambienteApp && body.ambienteApp !== "homologacao") return json({ ok: false, code: "AMBIENTE_INCOMPATIVEL", error: "Confira o ambiente do aplicativo." }, 409, headers);
    const url = new URL(request.url);
    const action = body?.action || url.searchParams.get("action");
    // O artefato Edge não leva SQL de manutenção. Schema é versionado e
    // aplicado à homologação pelo procedimento próprio, nunca por este build.
    if (action === "financial-shadow-migrate") return json({ error: "Migrações são aplicadas pelo procedimento de homologação." }, 403, headers);
    if (action === "setup") return json({ error: "O acesso inicial da homologação é preparado pelo responsável pelo teste." }, 403, headers);
    if (action === "ponto-tempo-verificar" && !ntpDisponivel) return json({ ok: false, code: "NTP_INDISPONIVEL", error: "Este servidor não oferece consulta NTP por UDP. A hora permanece não verificada." }, 501, headers);
    const req = { method: request.method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers), query: Object.fromEntries(url.searchParams), body };
    let status = 200, response;
    const res = {
      status(value) { status = value; return res; },
      setHeader(key, value) { headers[key] = String(value); return res; },
      json(value) { response = json(value, status, headers); return response; },
      send(value) { response = new Response(value, { status, headers }); return response; },
      end() { response = new Response(null, { status, headers }); return response; },
    };
    try {
      const result = await handler(req, res);
      return response || (result instanceof Response ? result : json({ error: "Resposta indisponível." }, 500, headers));
    } catch {
      // Não envia mensagens de driver, SQL nem configuração para o cliente.
      return json({ error: "Não foi possível concluir o pedido." }, 500, headers);
    }
  };
}
