// ═══════════════════════════════════════════════════════════════════

import { authenticateAppUser } from "./auth.js";
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

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const user = await authenticateAppUser(req.body || {});
  if (!user) return res.status(401).json({ error: "Sessão inválida." });

  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim(); // sem REACT_APP_ — server-side
  if (req.body?.action === "status") {
    return res.status(200).json({ ok: true, configured: !!apiKey, provider: "anthropic" });
  }
  if (!apiKey) {
    return res.status(503).json({
      error: "O Modo IA ainda não foi configurado no ambiente de produção.",
      code: "AI_NOT_CONFIGURED",
    });
  }

  try {
    const { messages, contexto, prompt, question, context, imagens, documentos } = req.body || {};
    const mensagensRecebidas = Array.isArray(messages) && messages.length
      ? messages
      : (prompt || question)
        ? [{ role: "user", content: String(prompt || question) }]
        : [];

    if (mensagensRecebidas.length === 0) {
      return res.status(400).json({ error: "Nenhuma mensagem recebida." });
    }

    // Teto simples de custo: histórico longo demais é cortado
    const historico = mensagensRecebidas.slice(-12).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? m.text ?? "").slice(0, 12000),
    }));
    const imagensValidas=(Array.isArray(imagens)?imagens:[]).slice(0,6).map(img=>{
      const match=String(img?.dataUrl||"").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      return match?{mediaType:match[1],data:match[2],legenda:String(img?.legenda||"").slice(0,300)}:null;
    }).filter(Boolean);
    const documentosValidos=(Array.isArray(documentos)?documentos:[]).slice(0,3).map(doc=>{
      const match=String(doc?.dataUrl||"").match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
      return match?{mediaType:match[1],data:match[2],nome:String(doc?.nome||"documento.pdf").slice(0,180)}:null;
    }).filter(Boolean);
    if(imagensValidas.length||documentosValidos.length){
      const ultima=historico.length-1;
      historico[ultima]={role:"user",content:[
        {type:"text",text:historico[ultima].content},
        ...imagensValidas.flatMap((img,index)=>[
          {type:"text",text:`Foto ${index+1}${img.legenda?` — legenda informada: ${img.legenda}`:""}`},
          {type:"image",source:{type:"base64",media_type:img.mediaType,data:img.data}},
        ]),
        ...documentosValidos.flatMap((doc,index)=>[
          {type:"text",text:`Documento PDF ${index+1} — ${doc.nome}`},
          {type:"document",source:{type:"base64",media_type:doc.mediaType,data:doc.data},title:doc.nome},
        ]),
      ]};
    }

    const system = [
      "Você é o assistente da ARCD Construtech, empresa de gestão de obras em Caruaru/PE.",
      "Responde em português do Brasil, de forma direta e técnica.",
      "Use SOMENTE os dados fornecidos no contexto. Se um número não estiver lá, diga que não tem o dado —",
      "nunca invente valores financeiros, medições ou custos.",
      (contexto || context) ? `\n\nDados atuais do sistema:\n${JSON.stringify(contexto || context).slice(0, 20000)}` : "",
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

    return res.status(200).json({ reply: texto, answer: texto });
  } catch (err) {
    console.error("Falha na rota /api/ai-agent:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
