// Somente despacho HTTP da homologação. Cada handler original conserva a
// autenticação e as permissões; nenhuma chave de IA é configurada aqui.
export function criarRoteadorHomologacao({ data, upload, presence, dailyBrief }) {
  return (req, res) => {
    const path = req.url.split("?")[0].replace(/\/$/, "");
    const base = ["/functions/v1/ponto-api-homologacao", "/ponto-api-homologacao", "/api"]
      .find(prefix => path === prefix || path.startsWith(prefix + "/"));
    const route = (base ? path.slice(base.length) : path) || "/data";
    if (route === "/data") return data(req, res);
    if (route === "/upload") return upload(req, res);
    if (route === "/presence") return presence(req, res);
    if (route === "/ai-agent") {
      // daily-brief usa clima/RSS/CUB públicos e retorna antes de carregar a
      // configuração Gemini. As demais ações não chegam sequer ao import.
      if (req.body?.action !== "daily-brief") return res.status(503).json({
        ok: false, code: "AI_DISABLED_HOMOLOGACAO",
        error: "A IA externa está desativada nesta simulação gratuita.",
      });
      return dailyBrief(req, res);
    }
    return res.status(404).json({ error: "Rota não encontrada." });
  };
}
