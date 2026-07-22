import { authenticateAppUser } from "./auth.js";
import { loadOpenAIConfig } from "./ai-config-store.js";

// ═══════════════════════════════════════════════════════════════════
// /api/ai-agent — rota serverless do Vercel
//
// Todas as telas usam esta única ponte autenticada. A chave OpenAI é lida do
// cofre configurado pelo administrador (ou do ambiente como contingência) e
// nunca é devolvida ao navegador.
// ═══════════════════════════════════════════════════════════════════

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const user = await authenticateAppUser(req.body || {});
  if (!user) return res.status(401).json({ error: "Sessão inválida." });

  const aiConfig=await loadOpenAIConfig();
  const apiKey=aiConfig.apiKey;
  if (req.body?.action === "status") {
    return res.status(200).json({ok:true,configured:!!apiKey,provider:"openai",model:aiConfig.model,source:aiConfig.source});
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
      return match?{dataUrl:String(img.dataUrl),legenda:String(img?.legenda||"").slice(0,300)}:null;
    }).filter(Boolean);
    const documentosValidos=(Array.isArray(documentos)?documentos:[]).slice(0,3).map(doc=>{
      const match=String(doc?.dataUrl||"").match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
      return match?{dataUrl:String(doc.dataUrl),nome:String(doc?.nome||"documento.pdf").slice(0,180)}:null;
    }).filter(Boolean);

    const system = [
      "Você é o assistente da ARCD Construtech, empresa de gestão de obras em Caruaru/PE.",
      "Responde em português do Brasil, de forma direta e técnica.",
      "Use SOMENTE os dados fornecidos no contexto. Se um número não estiver lá, diga que não tem o dado —",
      "nunca invente valores financeiros, medições ou custos.",
      (contexto || context) ? `\n\nDados atuais do sistema:\n${JSON.stringify(contexto || context).slice(0, 20000)}` : "",
    ].join(" ");

    const conversa=historico.map(m=>`${m.role==="assistant"?"Assistente":"Operador"}: ${m.content}`).join("\n\n");
    const content=[
      {type:"input_text",text:conversa},
      ...imagensValidas.flatMap((img,index)=>[
        {type:"input_text",text:`Foto ${index+1}${img.legenda?` — legenda informada: ${img.legenda}`:""}`},
        {type:"input_image",image_url:img.dataUrl,detail:"auto"},
      ]),
      ...documentosValidos.flatMap((doc,index)=>[
        {type:"input_text",text:`Documento PDF ${index+1} — ${doc.nome}`},
        {type:"input_file",filename:doc.nome,file_data:doc.dataUrl,detail:"high"},
      ]),
    ];

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization:`Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:aiConfig.model,
        instructions:system,
        input:[{role:"user",content}],
        max_output_tokens:1500,
        store:false,
      }),
    });

    if (!r.ok) {
      const detalhe=await r.text();
      console.error("OpenAI respondeu erro:",r.status,detalhe.slice(0,800));
      if(r.status===401)return res.status(502).json({error:"A autenticação OpenAI precisa ser atualizada pelo administrador.",code:"AI_AUTH_INVALID"});
      if(r.status===429)return res.status(429).json({error:"O limite ou saldo da OpenAI foi atingido. Tente novamente mais tarde.",code:"AI_RATE_LIMIT"});
      return res.status(502).json({ error: "O serviço de IA não respondeu." });
    }

    const data = await r.json();
    const texto = String(data.output_text||"").trim() || (data.output||[])
      .flatMap(item=>item.content||[])
      .filter(item=>item.type==="output_text")
      .map(item=>item.text||"")
      .join("\n")
      .trim();

    return res.status(200).json({ reply: texto, answer: texto });
  } catch (err) {
    console.error("Falha na rota /api/ai-agent:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
