// ═══════════════════════════════════════════════════════════════════
// /api/ai-agent — rota serverless do Vercel
//
// O App.jsx já chama esta rota (linha ~6741) em vez de falar direto com
// a Anthropic. Só que ela não existia no projeto — por isso o Agente IA
// sempre caía no fallback de análise local.
//
// O ponto central: a ANTHROPIC_API_KEY fica AQUI, no servidor. Ela NÃO
// leva o prefixo REACT_APP_ — se levasse, o Vercel a embutiria no bundle
// JavaScript e qualquer pessoa leria a chave no DevTools e gastaria seus
// créditos. É exatamente isso que o SETUP.md antigo mandava fazer.
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;   // sem REACT_APP_ — server-side
  if (!apiKey) {
    return res.status(503).json({
      error: "ANTHROPIC_API_KEY não configurada no Vercel.",
    });
  }

  try {
    const { messages, contexto } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Nenhuma mensagem recebida." });
    }

    // Teto simples de custo: histórico longo demais é cortado
    const historico = messages.slice(-12).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 8000),
    }));

    const system = [
      "Você é o assistente da ARCD Construtech, empresa de gestão de obras em Caruaru/PE.",
      "Responde em português do Brasil, de forma direta e técnica.",
      "Use SOMENTE os dados fornecidos no contexto. Se um número não estiver lá, diga que não tem o dado —",
      "nunca invente valores financeiros, medições ou custos.",
      contexto ? `\n\nDados atuais do sistema:\n${JSON.stringify(contexto).slice(0, 20000)}` : "",
    ].join(" ");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system,
        messages: historico,
      }),
    });

    if (!r.ok) {
      const detalhe = await r.text();
      console.error("Anthropic respondeu erro:", r.status, detalhe);
      // Não vaza o corpo do erro para o cliente — pode conter dados da conta
      return res.status(502).json({ error: "O serviço de IA não respondeu." });
    }

    const data = await r.json();
    const texto = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ reply: texto });
  } catch (err) {
    console.error("Falha na rota /api/ai-agent:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
