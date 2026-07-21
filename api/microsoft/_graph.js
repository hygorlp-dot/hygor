import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const ROOT_URL = process.env.ONEDRIVE_ROOT_FOLDER_URL;
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
const COMPANY=process.env.COMPANY_ID||"arcd", DATA_KEY="arced_ponto_v1", AUTH_KEY="onedrive_auth_v1";
export const SCOPES = "openid profile offline_access User.Read Files.ReadWrite";

const key = () => crypto.createHash("sha256").update(String(CLIENT_SECRET || "")).digest();
export const seal = value => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
};
export const unseal = value => {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
  } catch { return null; }
};
export const cookies = req => Object.fromEntries(String(req.headers.cookie || "").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))];}));
export const setCookie = (res, name, value, maxAge = 60 * 60 * 24 * 90) =>
  res.setHeader("Set-Cookie", [...(Array.isArray(res.getHeader("Set-Cookie"))?res.getHeader("Set-Cookie"):res.getHeader("Set-Cookie")?[res.getHeader("Set-Cookie")]:[]),`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`]);

export const saveCentralSession = async session => {
  if(!db)return; await db.from("company_app_data").upsert({company_id:COMPANY,key:AUTH_KEY,value:{sealed:seal(session)},updated_at:new Date().toISOString()},{onConflict:"company_id,key"});
};
const loadCentralSession = async () => {
  if(!db)return null; const {data}=await db.from("company_app_data").select("value").eq("company_id",COMPANY).eq("key",AUTH_KEY).maybeSingle(); return unseal(data?.value?.sealed);
};
export const verifyAppUser = async (userId,pin) => {
  if(!db)return false; const {data}=await db.from("company_app_data").select("value").eq("company_id",COMPANY).eq("key",DATA_KEY).maybeSingle();
  const payload=typeof data?.value==="string"?JSON.parse(data.value):data?.value; const user=(payload?.usuarios||[]).find(u=>u.id===userId&&u.active!==false); if(!user)return false;
  const a=Buffer.from(crypto.createHash("sha256").update(String(pin)).digest("hex")),b=Buffer.from(String(user.pin||"")); return a.length===b.length&&crypto.timingSafeEqual(a,b);
};
export const fileSignature=(driveId,itemId)=>crypto.createHmac("sha256",String(CLIENT_SECRET)).update(`${driveId}:${itemId}`).digest("base64url");

export const configured = () => !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI && ROOT_URL);
export const authConfig = () => ({ CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, AUTHORITY, ROOT_URL });

export const exchangeCode = async code => {
  const body = new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,code,redirect_uri:REDIRECT_URI,grant_type:"authorization_code",scope:SCOPES});
  const r = await fetch(`${AUTHORITY}/token`, {method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const j = await r.json(); if(!r.ok) throw new Error(j.error_description || "Falha ao autorizar Microsoft."); return j;
};
export const refresh = async req => {
  const session = unseal(cookies(req).arcd_ms) || await loadCentralSession();
  if (!session?.refreshToken) throw Object.assign(new Error("OneDrive não conectado."), {status:401});
  const body = new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,refresh_token:session.refreshToken,grant_type:"refresh_token",scope:SCOPES});
  const r=await fetch(`${AUTHORITY}/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const j=await r.json(); if(!r.ok) throw Object.assign(new Error(j.error_description||"Conexão Microsoft expirada."),{status:401});
  const next={...session,refreshToken:j.refresh_token||session.refreshToken}; await saveCentralSession(next);
  return {accessToken:j.access_token, session:next};
};
export const graph = async (token, path, options={}) => {
  const r=await fetch(`${GRAPH}${path}`,{...options,headers:{authorization:`Bearer ${token}`,...(options.headers||{})}});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error?.message||`Microsoft Graph: ${r.status}`);} return r;
};
const shareToken = url => `u!${Buffer.from(url).toString("base64url")}`;
export const rootItem = async token => (await graph(token,`/shares/${shareToken(ROOT_URL)}/driveItem`)).json();
export const safeName = value => String(value||"Obra").replace(/["*:<>?/\\|]/g,"-").replace(/\s+/g," ").trim().slice(0,120)||"Obra";
export const getOrCreateFolder = async (token, driveId, parentId, name) => {
  const wanted=safeName(name);
  const list=await (await graph(token,`/drives/${driveId}/items/${parentId}/children?$select=id,name,webUrl,folder`)).json();
  const found=(list.value||[]).find(x=>x.folder&&x.name.toLocaleLowerCase("pt-BR")===wanted.toLocaleLowerCase("pt-BR"));
  if(found)return found;
  return (await graph(token,`/drives/${driveId}/items/${parentId}/children`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:wanted,folder:{},"@microsoft.graph.conflictBehavior":"rename"})})).json();
};
export const workspace = async (token, obraName) => {
  const root=await rootItem(token); const driveId=root.parentReference.driveId;
  const obra=await getOrCreateFolder(token,driveId,root.id,obraName);
  const names=["01 - Contratos","02 - Projetos","03 - Documentos","04 - Diário de Obras","05 - Fotos","06 - Capa da Obra","07 - Conferências Técnicas"];
  const folders={}; for(const name of names){folders[name]=await getOrCreateFolder(token,driveId,obra.id,name);}
  return {driveId,folderId:obra.id,webUrl:obra.webUrl,folders:Object.fromEntries(Object.entries(folders).map(([k,v])=>[k,v.id]))};
};
