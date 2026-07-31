import crypto from "node:crypto";
import { clearPortalSessionCookie, createPortalSessionCookie, createPortalSessionToken, hashPortalSessionToken, normalizePortalEmail, parseCookies, PORTAL_SESSION_COOKIE, verifyPortalPassword } from "../server/client-portal-auth.js";
import { isPortalRecordVisible, projectClientPortalData } from "../server/client-portal-projection.js";
import { COMPANY, auditPortalEvent, clearLoginFailures, genericAuthFailure, hashIdentifier, loginBlocked, noStore, portalDb, portalUnavailable, readPortalSession, registerLoginFailure, requestIp, secureCookie } from "../server/client-portal-runtime.js";

const DOMAINS = Object.freeze({
  weekly_update:"weeklyUpdates", timeline:"timeline", media:"media", decision:"decisions",
  change_order:"changeOrders", financial_summary:"financialSummaries", measurement:"measurements",
  payment:"clientPayments", cash_summary:"projectCashSummaries", cash_movement:"projectCashMovements",
  invoice:"clientInvoices", purchase_order:"clientPurchaseOrders", quotation:"clientQuotations",
  document:"documents", message:"messages", team:"team", support:"support",
});
const array = value => Array.isArray(value) ? value : [];
const routeParts = req => {
  const route=req.query?.route;
  if(Array.isArray(route))return route.map(part=>String(part)).filter(Boolean);
  return String(route || "").split("/").filter(Boolean);
};
const recordFromPublication = (row, projectId) => ({
  ...(row.payload || {}), obraId:projectId, status:row.status,
  clientStatus:row.payload?.clientStatus || row.payload?.status || "",
  visibility:row.visibility,
  visibleToProfiles:array(row.visible_to_profiles), visibleToUserIds:array(row.visible_to_user_ids),
});

async function login(req, res, db) {
  if (req.method !== "POST") return noStore(res).status(405).json({ error:"Método não permitido." });
  const email=normalizePortalEmail(req.body?.email);
  const password=String(req.body?.password || "");
  const key=hashIdentifier(`${requestIp(req)}:${email}`);
  if (!email || !password || loginBlocked(key)) { registerLoginFailure(key); return genericAuthFailure(res); }
  try {
    const { data:user, error } = await db.from("client_portal_users").select("id,email,password_hash,status").eq("company_id",COMPANY).eq("email",email).maybeSingle();
    if (error) throw error;
    if (!user || user.status!=="active" || !verifyPortalPassword(password,user.password_hash)) { registerLoginFailure(key); return genericAuthFailure(res); }
    const token=createPortalSessionToken(), tokenHash=hashPortalSessionToken(token), now=new Date(), expiresAt=new Date(now.getTime()+12*60*60*1000).toISOString(), correlationId=crypto.randomUUID();
    const { data:session, error:sessionError } = await db.from("client_portal_sessions").insert({company_id:COMPANY,portal_user_id:user.id,token_hash:tokenHash,ip_hash:hashIdentifier(requestIp(req)),expires_at:expiresAt}).select("id").single();
    if (sessionError) throw sessionError;
    try {
      await Promise.all([
        db.from("client_portal_users").update({last_login_at:now.toISOString(),updated_at:now.toISOString()}).eq("id",user.id),
        auditPortalEvent(db,{userId:user.id,eventType:"portal_login",correlationId,metadata:{}}),
      ]);
    } catch (auditError) {
      await db.from("client_portal_sessions").update({revoked_at:new Date().toISOString()}).eq("id",session.id);
      throw auditError;
    }
    clearLoginFailures(key);
    res.setHeader("Set-Cookie",createPortalSessionCookie(token,{secure:secureCookie()}));
    return noStore(res).status(200).json({ok:true,reference:correlationId});
  } catch (error) {
    console.error("client portal login failed",error?.message);
    return noStore(res).status(503).json({error:"Não foi possível concluir o acesso agora. Tente novamente mais tarde."});
  }
}

async function session(req, res, db) {
  if (req.method !== "GET") return noStore(res).status(405).json({ error:"Método não permitido." });
  try {
    const active=await readPortalSession(req,db);
    if (!active) return noStore(res).status(401).json({error:"Sessão do portal inválida ou expirada."});
    await db.from("client_portal_sessions").update({last_seen_at:new Date().toISOString()}).eq("id",active.sessionId);
    const reference=await auditPortalEvent(db,{userId:active.user.id,eventType:"portal_session_viewed",metadata:{}});
    return noStore(res).status(200).json({user:active.user,projects:active.projects,reference});
  } catch (error) {
    console.error("client portal session failed",error?.message);
    return noStore(res).status(503).json({error:"Não foi possível validar sua sessão agora."});
  }
}

async function logout(req, res, db) {
  if (req.method !== "POST") return noStore(res).status(405).json({ error:"Método não permitido." });
  const token=parseCookies(req.headers.cookie || "")[PORTAL_SESSION_COOKIE];
  try {
    if (token) {
      const { data:active }=await db.from("client_portal_sessions").select("id,portal_user_id").eq("company_id",COMPANY).eq("token_hash",hashPortalSessionToken(token)).maybeSingle();
      if (active) {
        await db.from("client_portal_sessions").update({revoked_at:new Date().toISOString()}).eq("id",active.id);
        await auditPortalEvent(db,{userId:active.portal_user_id,eventType:"portal_logout",metadata:{ipPresent:Boolean(requestIp(req))}});
      }
    }
  } catch (error) { console.error("client portal logout failed",error?.message); }
  res.setHeader("Set-Cookie",clearPortalSessionCookie({secure:secureCookie()}));
  return noStore(res).status(204).end();
}

async function dashboard(req, res, db, projectId) {
  if (req.method !== "GET") return noStore(res).status(405).json({error:"Método não permitido."});
  try {
    const active=await readPortalSession(req,db);
    if (!active) return noStore(res).status(401).json({error:"Sessão do portal inválida ou expirada."});
    const membership=active.projects.find(item=>item.projectId===projectId);
    if (!membership) return noStore(res).status(403).json({error:"Você não possui acesso a esta obra."});
    const { data:publications, error }=await db.from("client_portal_publications").select("domain,status,visibility,visible_to_profiles,visible_to_user_ids,payload,published_at").eq("company_id",COMPANY).eq("project_id",projectId).eq("status","published").order("published_at",{ascending:false}).range(0,499);
    if (error) throw error;
    const user={id:active.user.id,profile:membership.profile,projectIds:[projectId],permissions:Object.entries(membership.permissions).filter(([,enabled])=>enabled).map(([capability])=>capability)};
    const rows=(publications || []).filter(row=>isPortalRecordVisible(recordFromPublication(row,projectId),user));
    const summary=rows.find(row=>row.domain==="project_summary");
    if (!summary) return noStore(res).status(404).json({error:"Ainda não há um resumo publicado para esta obra."});
    const sourceData={};
    for (const row of rows) { const key=DOMAINS[row.domain]; if (key) (sourceData[key] ||= []).push(recordFromPublication(row,projectId)); }
    const portal=projectClientPortalData({user,permissions:membership.permissions,project:{id:projectId,...(summary.payload || {})},sourceData});
    const reference=await auditPortalEvent(db,{userId:user.id,projectId,eventType:"project_opened",metadata:{domainCount:Object.keys(sourceData).length}});
    return noStore(res).status(200).json({portal,reference});
  } catch (error) {
    console.error("client portal dashboard failed",error?.message);
    return noStore(res).status(503).json({error:"Não foi possível carregar a obra agora. Tente novamente mais tarde."});
  }
}

/** Uma única função reduz a superfície de deploy Hobby sem mudar as URLs públicas. */
export default async function handler(req, res) {
  const db=portalDb();
  if (!db) return portalUnavailable(res);
  const route=routeParts(req);
  if (route[0]==="auth" && route[1]==="login") return login(req,res,db);
  if (route[0]==="auth" && route[1]==="session") return session(req,res,db);
  if (route[0]==="auth" && route[1]==="logout") return logout(req,res,db);
  if (route[0]==="projects" && route[2]==="dashboard" && route[1]) return dashboard(req,res,db,route[1]);
  return noStore(res).status(404).json({error:"Rota do Portal do Cliente não encontrada."});
}
