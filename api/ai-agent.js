import { authenticateAppUser } from "./auth.js";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const CONFIG_KEY = "arced_ai_config_v1";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

const database = () => createClient(URL, SERVICE, {
  auth: { persistSession:false, autoRefreshToken:false },
});

const encryptionKey = () => crypto.createHash("sha256")
  .update(`${SERVICE}:${COMPANY}:arcd-openai-config`)
  .digest();

const encrypt = plainText => {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(plainText,"utf8"),cipher.final()]);
  return {
    encryptedKey:encrypted.toString("base64"),
    iv:iv.toString("base64"),
    tag:cipher.getAuthTag().toString("base64"),
  };
};

const decrypt = value => {
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(value.iv,"base64"));
  decipher.setAuthTag(Buffer.from(value.tag,"base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.encryptedKey,"base64")),
    decipher.final(),
  ]).toString("utf8");
};

const loadOpenAIConfig = async () => {
  if (!URL || !SERVICE) return { apiKey:"", model:DEFAULT_OPENAI_MODEL, source:"none" };
  const {data,error}=await database().from("company_app_data")
    .select("value,updated_at")
    .eq("company_id",COMPANY).eq("key",CONFIG_KEY).maybeSingle();
  let value=data?.value;
  if(typeof value==="string"){try{value=JSON.parse(value);}catch{value=null;}}
  if (!error && value?.encryptedKey) {
    try {
      return {
        apiKey:decrypt(value),
        model:value.model||DEFAULT_OPENAI_MODEL,
        source:"admin",
        updatedAt:data.updated_at||value.updatedAt||"",
        updatedBy:value.updatedBy||"",
      };
    } catch (decryptError) {
      console.error("Não foi possível abrir a configuração da IA:",decryptError?.message);
    }
  }
  const environmentKey=String(process.env.OPENAI_API_KEY||"").trim();
  return {apiKey:environmentKey,model:DEFAULT_OPENAI_MODEL,source:environmentKey?"environment":"none"};
};

const saveOpenAIConfig = async ({apiKey,user}) => {
  const agora=new Date().toISOString();
  const value={
    provider:"openai",
    model:DEFAULT_OPENAI_MODEL,
    ...encrypt(apiKey),
    updatedAt:agora,
    updatedBy:user?.nome||user?.id||"Administrador",
  };
  const {error}=await database().from("company_app_data").upsert({
    company_id:COMPANY,key:CONFIG_KEY,value,updated_at:agora,updated_by:user?.id||null,
  },{onConflict:"company_id,key"});
  if(error)throw error;
  return {model:DEFAULT_OPENAI_MODEL,updatedAt:agora,updatedBy:value.updatedBy};
};

const removeOpenAIConfig = async () => {
  const {error}=await database().from("company_app_data")
    .delete().eq("company_id",COMPANY).eq("key",CONFIG_KEY);
  if(error)throw error;
};

const safeStatus = config => ({
  configured:!!config.apiKey,
  provider:"openai",
  model:config.model||DEFAULT_OPENAI_MODEL,
  source:config.source||"none",
  updatedAt:config.updatedAt||"",
  updatedBy:config.updatedBy||"",
});

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
    return res.status(200).json({ok:true,...safeStatus(aiConfig)});
  }
  if (req.body?.action === "configure") {
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});
    const newApiKey=String(req.body?.apiKey||"").trim();
    if(newApiKey.length<20)return res.status(400).json({error:"Informe uma chave de projeto válida da OpenAI."});
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    let validation;
    try{
      validation=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{Authorization:`Bearer ${newApiKey}`,"content-type":"application/json"},
        body:JSON.stringify({model:DEFAULT_OPENAI_MODEL,input:"Responda apenas OK.",max_output_tokens:32,store:false}),
        signal:controller.signal,
      });
    }finally{clearTimeout(timeout);}
    if(validation.status===401)return res.status(400).json({error:"A OpenAI recusou a chave. Confira o valor da chave de projeto."});
    if(validation.status===429)return res.status(400).json({error:"A chave foi reconhecida, mas o projeto está sem saldo ou atingiu o limite de uso."});
    if(!validation.ok)return res.status(502).json({error:"Não foi possível validar a chave com a OpenAI agora."});
    const saved=await saveOpenAIConfig({apiKey:newApiKey,user});
    return res.status(200).json({ok:true,configured:true,provider:"openai",source:"admin",...saved});
  }
  if (req.body?.action === "remove") {
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});
    await removeOpenAIConfig();
    return res.status(200).json({ok:true,...safeStatus(await loadOpenAIConfig())});
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
