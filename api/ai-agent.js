import { authenticateAppUser } from "./auth.js";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const CONFIG_KEY = "arced_ai_config_gemini_v1";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const database = () => createClient(URL, SERVICE, {
  auth: { persistSession:false, autoRefreshToken:false },
});
const encryptionKey = () => crypto.createHash("sha256")
  .update(`${SERVICE}:${COMPANY}:arcd-gemini-config`).digest();
const encrypt = plainText => {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(plainText,"utf8"),cipher.final()]);
  return {encryptedKey:encrypted.toString("base64"),iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64")};
};
const decrypt = value => {
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(value.iv,"base64"));
  decipher.setAuthTag(Buffer.from(value.tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.encryptedKey,"base64")),decipher.final()]).toString("utf8");
};
const loadConfig = async () => {
  if(!URL||!SERVICE)return {apiKey:"",model:DEFAULT_MODEL,source:"none"};
  const {data,error}=await database().from("company_app_data").select("value,updated_at")
    .eq("company_id",COMPANY).eq("key",CONFIG_KEY).maybeSingle();
  let value=data?.value;
  if(typeof value==="string"){try{value=JSON.parse(value);}catch{value=null;}}
  if(!error&&value?.encryptedKey){
    try{return {apiKey:decrypt(value),model:value.model||DEFAULT_MODEL,source:"admin",updatedAt:data.updated_at||value.updatedAt||"",updatedBy:value.updatedBy||"",validationStatus:value.validationStatus||"unknown",validationMessage:value.validationMessage||""};}
    catch(decryptError){console.error("Não foi possível abrir a configuração do Gemini:",decryptError?.message);}
  }
  const environmentKey=String(process.env.GEMINI_API_KEY||"").trim();
  return {apiKey:environmentKey,model:DEFAULT_MODEL,source:environmentKey?"environment":"none",validationStatus:environmentKey?"unknown":""};
};
const saveConfig = async ({apiKey,user,validationStatus="ready",validationMessage=""}) => {
  const agora=new Date().toISOString();
  const value={provider:"gemini",model:DEFAULT_MODEL,...encrypt(apiKey),updatedAt:agora,updatedBy:user?.nome||user?.id||"Administrador",validationStatus,validationMessage};
  const {error}=await database().from("company_app_data").upsert({company_id:COMPANY,key:CONFIG_KEY,value,updated_at:agora,updated_by:user?.id||null},{onConflict:"company_id,key"});
  if(error)throw error;
  return {model:DEFAULT_MODEL,updatedAt:agora,updatedBy:value.updatedBy,validationStatus,validationMessage};
};
const removeConfig = async () => {
  const {error}=await database().from("company_app_data").delete().eq("company_id",COMPANY).eq("key",CONFIG_KEY);
  if(error)throw error;
};
const safeStatus = config => ({configured:!!config.apiKey,provider:"gemini",model:config.model||DEFAULT_MODEL,source:config.source||"none",updatedAt:config.updatedAt||"",updatedBy:config.updatedBy||"",validationStatus:config.validationStatus||"unknown",validationMessage:config.validationMessage||""});
const geminiRequest = (apiKey,model,body,signal) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
  method:"POST",
  headers:{"content-type":"application/json","x-goog-api-key":apiKey},
  body:JSON.stringify(body),signal,
});
const providerErrorFrom = body => body?.error||{};
const providerMessageFrom = body => String(providerErrorFrom(body)?.message||"").trim();
const isInvalidKey = (status,message) => [401,403].includes(status)||(status===400&&/api key|api_key_invalid|key not valid|permission denied/i.test(message));

// Todas as telas usam esta única ponte autenticada. A chave Gemini fica
// criptografada no servidor e nunca é devolvida ao navegador.
export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
  const user=await authenticateAppUser(req.body||{});
  if(!user)return res.status(401).json({error:"Sessão inválida."});

  const aiConfig=await loadConfig();
  if(req.body?.action==="status")return res.status(200).json({ok:true,...safeStatus(aiConfig)});
  if(req.body?.action==="configure"){
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});
    const newApiKey=String(req.body?.apiKey||"").trim();
    if(newApiKey.length<20)return res.status(400).json({error:"Informe uma chave de API válida do Gemini."});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    let validation;
    try{
      validation=await geminiRequest(newApiKey,DEFAULT_MODEL,{contents:[{role:"user",parts:[{text:"Responda apenas OK."}]}],generationConfig:{maxOutputTokens:24,temperature:0}},controller.signal);
    }catch(error){
      if(error?.name==="AbortError")return res.status(504).json({error:"O Gemini demorou para responder. Tente validar novamente."});
      throw error;
    }finally{clearTimeout(timeout);}
    const body=await validation.json().catch(()=>({}));
    const providerError=providerErrorFrom(body),providerMessage=providerMessageFrom(body);
    if(isInvalidKey(validation.status,providerMessage))return res.status(400).json({error:"O Google recusou a chave. Confira se você copiou o valor completo da chave da API Gemini.",errorCode:providerError.status||"API_KEY_INVALID"});
    if(validation.status===429){
      const warning="Chave Gemini salva, mas a cota gratuita ou o limite temporário da API foi atingido.";
      const saved=await saveConfig({apiKey:newApiKey,user,validationStatus:"rate_limit",validationMessage:warning});
      return res.status(200).json({ok:true,configured:true,operational:false,provider:"gemini",source:"admin",warning,errorCode:providerError.status||"RESOURCE_EXHAUSTED",...saved});
    }
    if(!validation.ok){
      const detalhe=providerMessage.slice(0,300);
      return res.status(400).json({error:detalhe?`O Gemini recusou o teste: ${detalhe}`:"Não foi possível validar a chave com o Gemini agora.",errorCode:providerError.status||"validation_failed"});
    }
    const saved=await saveConfig({apiKey:newApiKey,user});
    return res.status(200).json({ok:true,configured:true,operational:true,provider:"gemini",source:"admin",...saved});
  }
  if(req.body?.action==="remove"){
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});
    await removeConfig();
    return res.status(200).json({ok:true,...safeStatus(await loadConfig())});
  }

  const apiKey=aiConfig.apiKey;
  if(!apiKey)return res.status(503).json({error:"O Modo IA ainda não foi configurado pelo administrador.",code:"AI_NOT_CONFIGURED"});

  try{
    const {messages,contexto,prompt,question,context,imagens,documentos}=req.body||{};
    const recebidas=Array.isArray(messages)&&messages.length?messages:(prompt||question)?[{role:"user",content:String(prompt||question)}]:[];
    if(!recebidas.length)return res.status(400).json({error:"Nenhuma mensagem recebida."});
    const historico=recebidas.slice(-12).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:String(m.content??m.text??"").slice(0,12000)}]}));
    const imagensValidas=(Array.isArray(imagens)?imagens:[]).slice(0,6).map(img=>{const match=String(img?.dataUrl||"").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);return match?{mediaType:match[1],data:match[2],legenda:String(img?.legenda||"").slice(0,300)}:null;}).filter(Boolean);
    const documentosValidos=(Array.isArray(documentos)?documentos:[]).slice(0,3).map(doc=>{const match=String(doc?.dataUrl||"").match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/);return match?{mediaType:match[1],data:match[2],nome:String(doc?.nome||"documento.pdf").slice(0,180)}:null;}).filter(Boolean);
    if(imagensValidas.length||documentosValidos.length){
      let ultima=[...historico].map((item,index)=>({item,index})).reverse().find(({item})=>item.role==="user")?.index;
      if(ultima===undefined){historico.push({role:"user",parts:[{text:"Analise os anexos enviados."}]});ultima=historico.length-1;}
      historico[ultima].parts.push(...imagensValidas.flatMap((img,index)=>[{text:`Foto ${index+1}${img.legenda?` — legenda informada: ${img.legenda}`:""}`},{inlineData:{mimeType:img.mediaType,data:img.data}}]),...documentosValidos.flatMap((doc,index)=>[{text:`Documento PDF ${index+1} — ${doc.nome}`},{inlineData:{mimeType:doc.mediaType,data:doc.data}}]));
    }
    const system=["Você é o assistente da ARCD Construtech, empresa de gestão de obras em Caruaru/PE.","Responda em português do Brasil, de forma direta e técnica.","Use SOMENTE os dados fornecidos no contexto. Se um número não estiver lá, diga que não tem o dado —","nunca invente valores financeiros, medições ou custos.",(contexto||context)?`\n\nDados atuais do sistema:\n${JSON.stringify(contexto||context).slice(0,20000)}`:""].join(" ");
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),55000);
    let response;
    try{response=await geminiRequest(apiKey,aiConfig.model,{systemInstruction:{parts:[{text:system}]},contents:historico,generationConfig:{maxOutputTokens:1800,temperature:0.25}},controller.signal);}
    finally{clearTimeout(timeout);}
    if(!response.ok){
      const body=await response.json().catch(()=>({})),providerError=providerErrorFrom(body),providerMessage=providerMessageFrom(body);
      console.error("Gemini respondeu erro:",response.status,providerMessage.slice(0,500));
      if(isInvalidKey(response.status,providerMessage))return res.status(502).json({error:"A autenticação do Gemini precisa ser atualizada pelo administrador.",code:"AI_AUTH_INVALID"});
      if(response.status===429)return res.status(429).json({error:"A cota gratuita ou o limite temporário do Gemini foi atingido. Tente novamente mais tarde.",code:"AI_RATE_LIMIT"});
      if(response.status===400&&/model.*not found|not supported/i.test(providerMessage))return res.status(502).json({error:"O modelo Gemini configurado não está disponível para esta chave. Atualize o modelo no ambiente.",code:"AI_MODEL_UNAVAILABLE"});
      return res.status(502).json({error:"O serviço Gemini não respondeu.",code:providerError.status||"AI_PROVIDER_ERROR"});
    }
    const body=await response.json();
    const texto=(body.candidates?.[0]?.content?.parts||[]).map(part=>part.text||"").join("\n").trim();
    if(!texto){
      const motivo=body.promptFeedback?.blockReason||body.candidates?.[0]?.finishReason||"sem conteúdo";
      return res.status(422).json({error:`O Gemini não gerou uma resposta (${motivo}). Revise os anexos e tente novamente.`,code:"AI_EMPTY_RESPONSE"});
    }
    return res.status(200).json({reply:texto,answer:texto});
  }catch(error){
    console.error("Falha na rota /api/ai-agent:",error);
    if(error?.name==="AbortError")return res.status(504).json({error:"A análise demorou além do limite. Reduza os anexos e tente novamente."});
    return res.status(500).json({error:"Erro interno."});
  }
}
