import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { compactProfiles, decodeAppData } from "../server/data-codec.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const DATA_KEY = "arced_ponto_v1";
const PROFILE_KEY = "arced_auth_profiles_v1";

const sha256 = value => crypto.createHash("sha256").update(String(value || "")).digest("hex");
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
  if (!user || !pin){failure(key);return null;}
  const received = Buffer.from(sha256(pin));
  const expected = Buffer.from(String(user.pin || ""));
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)){failure(key);return null;}
  attempts.delete(key);
  return {user,payload};
};

export const authenticateAppUser = async (credentials = {}, options = {}) =>
  (await authenticateAppContext(credentials, options))?.user || null;
