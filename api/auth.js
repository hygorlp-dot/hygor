import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { compactProfiles, decodeAppData, encodeAppData } from "../server/data-codec.js";
import { applyPersistentAuthRateLimit, hashAppPin, verifyAppPin } from "../server/app-auth-security.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const DATA_KEY = "arced_ponto_v1";
const PROFILE_KEY = "arced_auth_profiles_v1";

const attempts = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 8;
const attemptKey = ({ userId } = {}, scope = "api") => `${scope}:${String(userId || "anonymous")}`;
const blocked = key => {
  const item=attempts.get(key);
  if(!item)return false;
  if(Date.now()-item.since>WINDOW_MS){attempts.delete(key);return false;}
  return item.count>=MAX_FAILURES;
};
const failure = key => {
  const item=attempts.get(key);
  if(!item||Date.now()-item.since>WINDOW_MS)attempts.set(key,{count:1,since:Date.now()});
  else item.count+=1;
};

// Autenticação comum às rotas auxiliares. Assim, consultas externas e IA
// ficam disponíveis para todo operador autenticado, sem transformar a função
// serverless em um endpoint público que possa consumir a cota da empresa.
export const authenticateAppContext = async ({ userId, pin, accessToken } = {}, {scope="api"} = {}) => {
  if (!URL || !SERVICE) return null;
  const key=attemptKey({userId},scope);
  if(!accessToken&&blocked(key))return null;
  const db = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const centralSubject=`pin:${String(userId||"anonymous")}`;
  if(!accessToken){
    const central=await applyPersistentAuthRateLimit(db,{company:COMPANY,subject:centralSubject,action:"status"});
    if(central?.blocked)return null;
  }
  const {data:profileRow,error:profileError}=await db.from("company_app_data")
    .select("value")
    .eq("company_id", COMPANY)
    .eq("key", PROFILE_KEY)
    .maybeSingle();
  if(profileError)return null;
  let payload=profileRow?.value||null;
  // Índices antigos não possuíam o hash do PIN nem as obras (usadas pelo
  // escopo de upload do OneDrive). Fazemos uma única leitura do blob legado
  // e regeneramos o índice; autenticações seguintes permanecem leves e não
  // descompactam toda a empresa.
  const indexedUser=(payload?.usuarios||[]).find(u=>u.id===userId);
  const needsFullPayload=!payload||!Array.isArray(payload?.obras)||(!accessToken&&userId&&pin&&!indexedUser?.pin);
  if(needsFullPayload){
    const {data,error}=await db.from("company_app_data")
      .select("value")
      .eq("company_id",COMPANY)
      .eq("key",DATA_KEY)
      .maybeSingle();
    if(error||!data)return null;
    const fullPayload=decodeAppData(data.value);
    payload=compactProfiles(fullPayload);
    const {error:indexError}=await db.from("company_app_data").upsert({
      company_id:COMPANY,key:PROFILE_KEY,value:payload,updated_at:new Date().toISOString(),
    },{onConflict:"company_id,key"});
    if(indexError)console.error("Não foi possível atualizar o índice de autenticação:",indexError.message);
  }
  if (accessToken) {
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (!authError && auth?.user) {
      const email = String(auth.user.email || "").toLowerCase();
      const linked = (payload?.usuarios || []).find(u =>
        u.active !== false &&
        (u.authUserId === auth.user.id || String(u.email || "").toLowerCase() === email));
      if (linked){attempts.delete(key);return {user:linked,payload};}
    }
  }

  const user = (payload?.usuarios || []).find(u => u.id === userId && u.active !== false);
  const verification=user&&pin?verifyAppPin(pin,user.pin):{ok:false,needsUpgrade:false};
  if (!verification.ok){
    failure(key);
    await applyPersistentAuthRateLimit(db,{company:COMPANY,subject:centralSubject,action:"failure"});
    return null;
  }
  attempts.delete(key);
  await applyPersistentAuthRateLimit(db,{company:COMPANY,subject:centralSubject,action:"success"});
  if(verification.needsUpgrade){
    const upgradedPin=hashAppPin(pin);
    const {data:fullRow}=await db.from("company_app_data").select("value,updated_at")
      .eq("company_id",COMPANY).eq("key",DATA_KEY).maybeSingle();
    if(fullRow){
      const full=decodeAppData(fullRow.value);
      const usuarios=(full.usuarios||[]).map(item=>item.id===user.id?{...item,pin:upgradedPin}:item);
      const next={...full,usuarios};
      const correlationId=crypto.randomUUID();
      const saved=await db.rpc("company_save_with_audit",{
        p_company_id:COMPANY,p_key:DATA_KEY,p_expected_updated_at:fullRow.updated_at,p_value:encodeAppData(next),
        p_actor_id:String(user.id),p_actor_name:String(user.nome||user.email||"Operador"),
        p_correlation_id:correlationId,p_action:"auth_pin_upgraded",
        p_before:{userId:user.id,algorithm:"sha256"},p_after:{userId:user.id,algorithm:"scrypt-v1"},
      });
      const result=Array.isArray(saved.data)?saved.data[0]:saved.data;
      if(!saved.error&&result?.applied){
        user.pin=upgradedPin;
        payload={...payload,usuarios:(payload.usuarios||[]).map(item=>item.id===user.id?{...item,pin:upgradedPin}:item)};
        await db.from("company_app_data").upsert({company_id:COMPANY,key:PROFILE_KEY,value:payload,updated_at:new Date().toISOString()},{onConflict:"company_id,key"});
      }
    }
  }
  return {user,payload};
};

export const authenticateAppUser = async (credentials = {}, options = {}) =>
  (await authenticateAppContext(credentials, options))?.user || null;
