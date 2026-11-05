import { ErroFiscal, exigir } from "./campos.js";

// URL e segredo são configuração de infraestrutura, nunca dados do request.
// Nenhuma requisição acontece sem configuração explícita.
export function criarServicosAssinaturaHttp({ ambiente = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!ambiente.PONTO_FISCAL_WORKER_URL) return undefined;
  let base;
  try { base = new URL(ambiente.PONTO_FISCAL_WORKER_URL); } catch { throw new ErroFiscal("URL_WORKER_FISCAL_INVALIDA"); }
  const local = ambiente.NODE_ENV !== "production" && ambiente.PONTO_FISCAL_WORKER_LOCAL === "1"
    && base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
  exigir(!base.username && !base.password && !base.search && !base.hash
    && (base.protocol === "https:" || local), "WORKER_FISCAL_EXIGE_HTTPS");
  exigir(typeof ambiente.PONTO_FISCAL_WORKER_TOKEN === "string" && ambiente.PONTO_FISCAL_WORKER_TOKEN.length >= 32, "SEGREDO_WORKER_FISCAL_AUSENTE");
  const chamar = async (route, payload) => {
    let response;
    try {
      response = await fetchImpl(new URL(base.pathname.replace(/\/$/, "") + route, base.origin), {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(40_000),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + ambiente.PONTO_FISCAL_WORKER_TOKEN },
        body: JSON.stringify(payload),
      });
      exigir(response.ok, "WORKER_FISCAL_REPROVOU_OPERACAO");
      const reader = response.body.getReader();
      const chunks = []; let total = 0;
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) break;
          total += value.length; exigir(total <= 30_000_000, "RESPOSTA_WORKER_EXCEDE_LIMITE"); chunks.push(value); }
      } finally { await reader.cancel().catch(() => {}); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      if (error instanceof ErroFiscal) throw error;
      throw new ErroFiscal("SERVICO_ASSINATURA_INDISPONIVEL");
    }
  };
  const bytes = result => {
    exigir(typeof result.base64 === "string" && result.base64.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(result.base64), "DOCUMENTO_WORKER_INVALIDO");
    return Buffer.from(result.base64, "base64");
  };
  return {
    recibos: (operacao, payload) => {
      exigir(["salvar", "obter", "acesso", "revogar", "contato", "consultar", "situacao"].includes(operacao), "OPERACAO_COMPROVANTE_INVALIDA");
      return chamar("/recibos/" + operacao, payload);
    },
    renderizarPdf: async model => bytes(await chamar("/renderizar", { fields: model.fields })),
    assinarEValidar: async ({ bytes: input, padrao, desenvolvedor }) => {
      const result = await chamar("/assinar", { base64: input.toString("base64"), padrao,
        desenvolvedor: { tipo: desenvolvedor.tipo, numero: desenvolvedor.numero } });
      return { bytes: bytes(result), verificacao: result.verificacao };
    },
  };
}
