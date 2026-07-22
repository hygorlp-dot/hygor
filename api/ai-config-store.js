import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const CONFIG_KEY = "arced_ai_config_v1";
export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

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

export const loadOpenAIConfig = async () => {
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

export const saveOpenAIConfig = async ({apiKey,model=DEFAULT_OPENAI_MODEL,user}) => {
  const agora=new Date().toISOString();
  const value={
    provider:"openai",
    model,
    ...encrypt(apiKey),
    updatedAt:agora,
    updatedBy:user?.nome||user?.id||"Administrador",
  };
  const {error}=await database().from("company_app_data").upsert({
    company_id:COMPANY,key:CONFIG_KEY,value,updated_at:agora,updated_by:user?.id||null,
  },{onConflict:"company_id,key"});
  if(error)throw error;
  return {model,updatedAt:agora,updatedBy:value.updatedBy};
};

export const removeOpenAIConfig = async () => {
  const {error}=await database().from("company_app_data")
    .delete().eq("company_id",COMPANY).eq("key",CONFIG_KEY);
  if(error)throw error;
};
