import {currentCompany, isolationEnabled} from '../company-context.js';
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { authenticateAppContext } from "../../server/app-auth.js";
import { decodeAppData } from '../data-codec.js';
import {assertDriveItemInCompanyRoot,driveItemFromGraphPath} from './company-drive-scope.js';
import {personalRootReference,sameRootReference} from './company-root-reference.js';

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const companyRootUrl=()=>isolationEnabled()?process.env[`ONEDRIVE_ROOT_FOLDER_URL_${currentCompany().toUpperCase()}`]:process.env.ONEDRIVE_ROOT_FOLDER_URL;
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
const AUTH_KEY="onedrive_auth_v1";
export const SCOPES = "openid profile offline_access User.Read Files.ReadWrite";

const key = () => crypto.createHash("sha256").update(String(CLIENT_SECRET || "")).digest();
export const seal = value => { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url"); };
export const unseal = value => { try { const raw = Buffer.from(value, "base64url"); const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12)); decipher.setAuthTag(raw.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")); } catch { return null; } };
export const cookies = req => Object.fromEntries(String(req.headers.cookie || "").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))];}));
export const setCookie = (res, name, value, maxAge = 60 * 60 * 24 * 90) => res.setHeader("Set-Cookie", [...(Array.isArray(res.getHeader("Set-Cookie"))?res.getHeader("Set-Cookie"):res.getHeader("Set-Cookie")?[res.getHeader("Set-Cookie")]:[]),`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`]);
export const saveCentralSession = async session => {
  if(!db)throw new Error("Persistência central do OneDrive não configurada.");
  const {error}=await db.from("company_app_data").upsert({
    company_id:currentCompany(),key:AUTH_KEY,value:{sealed:seal({...session,companyId:currentCompany()})},
    updated_at:new Date().toISOString(),
  },{onConflict:"company_id,key"});
  if(error)throw new Error(`Não foi possível persistir a sessão central do OneDrive: ${error.message}`);
  const confirmed=await loadCentralSession();
  if(!confirmed?.refreshToken){
    throw new Error("A sessão central do OneDrive não pôde ser confirmada após a gravação.");
  }
};
const loadCentralSession = async () => {
  if(!db)return null;
  const {data,error}=await db.from("company_app_data").select("value")
    .eq("company_id",currentCompany()).eq("key",AUTH_KEY).maybeSingle();
  if(error)throw new Error(`Não foi possível carregar a sessão central do OneDrive: ${error.message}`);
  const session=unseal(data?.value?.sealed);
  return !isolationEnabled()||session?.companyId===currentCompany()?session:null;
};
export const verifyAppUser = async (userId,pin,accessToken) => !db ? null : authenticateAppContext({userId,pin,accessToken},{scope:"onedrive"});
export const loadFileAccessData = async ({includeNativeWorkspaces=false}={}) => {
  if(!db)throw Object.assign(new Error('Armazenamento indisponível.'),{status:503});
  const {data,error}=await db.from('company_app_data').select('value').eq('company_id',currentCompany()).eq('key','arced_ponto_v1').maybeSingle();
  if(error||!data)throw Object.assign(new Error('Não foi possível conferir as permissões dos arquivos.'),{status:503});
  const payload=decodeAppData(data.value);
  if(isolationEnabled()&&includeNativeWorkspaces){
    const native=await db.from('core_projects').select('id,payload').eq('company_id',currentCompany());
    if(native.error)throw Object.assign(new Error('Não foi possível conferir os arquivos históricos da empresa.'),{status:503});
    const appIds=new Set((payload.obras||[]).map(work=>String(work.id)));
    payload.nativeFileWorkspaces=(native.data||[]).filter(row=>!appIds.has(String(row.id))&&row.payload?.oneDriveDriveId&&row.payload?.oneDriveFolderId).map(row=>({id:String(row.id),oneDriveDriveId:row.payload.oneDriveDriveId,oneDriveFolderId:row.payload.oneDriveFolderId}));
  }
  return payload;
};
export const fileSignature=(driveId,itemId)=>crypto.createHmac("sha256",String(CLIENT_SECRET)).update(isolationEnabled()?`${currentCompany()}:${driveId}:${itemId}`:`${driveId}:${itemId}`).digest("base64url");
export const configured = () => !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI && companyRootUrl());
export const authConfig = () => ({ CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, AUTHORITY, ROOT_URL:companyRootUrl() });
export const exchangeCode = async code => { const body = new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,code,redirect_uri:REDIRECT_URI,grant_type:"authorization_code",scope:SCOPES}); const r = await fetch(`${AUTHORITY}/token`, {method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body}); const j = await r.json(); if(!r.ok) throw new Error(j.error_description || "Falha ao autorizar Microsoft."); return j; };
export const refresh = async req => { if(isolationEnabled()&&!configured())throw Object.assign(new Error('Configure a conexão e a pasta OneDrive desta empresa antes de continuar.'),{status:503}); const cookieSession=unseal(cookies(req).arcd_ms); const session = (!isolationEnabled()||cookieSession?.companyId===currentCompany()?cookieSession:null) || await loadCentralSession(); if (!session?.refreshToken) throw Object.assign(new Error("OneDrive não conectado."), {status:401}); const body = new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,refresh_token:session.refreshToken,grant_type:"refresh_token",scope:SCOPES}); const r=await fetch(`${AUTHORITY}/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body}); const j=await r.json(); if(!r.ok) throw Object.assign(new Error(j.error_description||"Conexão Microsoft expirada."),{status:401}); const next={...session,refreshToken:j.refresh_token||session.refreshToken}; await saveCentralSession(next); return {accessToken:j.access_token, session:next}; };
const rawGraph = async (token,path,options={}) => { const r=await fetch(`${GRAPH}${path}`,{...options,headers:{authorization:`Bearer ${token}`,...(options.headers||{})}}); if(!r.ok){const j=await r.json().catch(()=>({}));throw Object.assign(new Error(j.error?.message||`Microsoft Graph: ${r.status}`),{status:r.status,code:j.error?.code});} return r; };
export const graph = async (token,path,options={}) => {
  if(isolationEnabled()){
    const item=driveItemFromGraphPath(path);
    if(item)await assertDriveItemInCompanyRoot({...item,root:await rootItem(token),readParent:async id=>(await rawGraph(token,`/drives/${encodeURIComponent(item.driveId)}/items/${encodeURIComponent(id)}?$select=id,parentReference`)).json()});
  }
  return rawGraph(token,path,options);
};
const shareToken = url => `u!${Buffer.from(url).toString("base64url")}`;
export const rootItem = async token => {
  const url=companyRootUrl();
  if(isolationEnabled()&&(!url||sameRootReference(url,process.env[`ONEDRIVE_ROOT_FOLDER_URL_${currentCompany()==='arcd'?'MRC':'ARCD'}`])))throw Object.assign(new Error('A empresa precisa de uma pasta OneDrive própria e conferida.'),{status:503});
  const reference=personalRootReference(url);
  if(reference){
    const root=await (await rawGraph(token,`/drives/${encodeURIComponent(reference.driveId)}/items/${encodeURIComponent(reference.itemId)}?$select=id,name,folder,parentReference,webUrl,remoteItem`)).json();
    if(root.id!==reference.itemId||root.parentReference?.driveId!==reference.driveId||!root.folder||root.remoteItem)throw Object.assign(new Error('A raiz OneDrive não corresponde à pasta configurada.'),{status:503});
    return root;
  }
  return (await rawGraph(token,`/shares/${shareToken(url)}/driveItem`)).json();
};
export const safeName = value => String(value||"Obra").replace(/["*:<>?/\\|]/g,"-").replace(/\s+/g," ").trim().slice(0,120)||"Obra";
export const getOrCreateFolder = async (token, driveId, parentId, name) => { const wanted=safeName(name); const list=await (await graph(token,`/drives/${driveId}/items/${parentId}/children?$select=id,name,webUrl,folder`)).json(); const found=(list.value||[]).find(x=>x.folder&&x.name.toLocaleLowerCase("pt-BR")===wanted.toLocaleLowerCase("pt-BR")); if(found)return found; return (await graph(token,`/drives/${driveId}/items/${parentId}/children`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:wanted,folder:{},"@microsoft.graph.conflictBehavior":"rename"})})).json(); };
const ensureFolders = async (token,driveId,parentId,names) => { const list=await (await graph(token,`/drives/${driveId}/items/${parentId}/children?$select=id,name,webUrl,folder`)).json(); const existing=(list.value||[]).filter(x=>x.folder); const folders={}; for(const rawName of names){ const name=safeName(rawName); const found=existing.find(x=>x.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR")); folders[rawName]=found||(await graph(token,`/drives/${driveId}/items/${parentId}/children`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,folder:{},"@microsoft.graph.conflictBehavior":"rename"})}).then(r=>r.json())); } return {folders,children:list.value||[]}; };
export const workspace = async (token, obraName, knownRoot = null, knownWorkspace = null) => { const root=knownRoot||await rootItem(token); const driveId=root.parentReference.driveId; let obra=null; if(knownWorkspace?.folderId&&knownWorkspace?.driveId===driveId){ try{obra=await (await graph(token,`/drives/${driveId}/items/${encodeURIComponent(knownWorkspace.folderId)}?$select=id,name,webUrl,folder`)).json();} catch{obra=null;} } if(!obra?.folder)obra=await getOrCreateFolder(token,driveId,root.id,obraName); const names=["01 - Contratos","02 - Projetos","03 - Documentos","04 - Diário de Obras","05 - Fotos","06 - Capa da Obra","07 - Conferências Técnicas","08 - Financeiro e Fiscal","09 - Compras e Suprimentos","11 - Outros"]; const {folders}=await ensureFolders(token,driveId,obra.id,names); const licenciamento=await getOrCreateFolder(token,driveId,folders["03 - Documentos"].id,"Licenciamento"); return {driveId,folderId:obra.id,webUrl:obra.webUrl,folders:{...Object.fromEntries(Object.entries(folders).map(([k,v])=>[k,v.id])),"03 - Documentos/Licenciamento":licenciamento.id}}; };
