import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { clientPortalPermissions } from "./client-portal-policy.js";
import { PORTAL_SESSION_COOKIE, hashPortalSessionToken, parseCookies } from "./client-portal-auth.js";

const COMPANY = process.env.COMPANY_ID || "arcd";
const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const attempts = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export const portalUnavailable = res => res.status(503).json({ error:"O Portal do Cliente está em preparação. Solicite acesso à equipe ARCD." });
export const requestIp = req => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
export const hashIdentifier = value => crypto.createHash("sha256").update(`${COMPANY}:${String(value || "")}`).digest("hex");
export const secureCookie = () => process.env.NODE_ENV === "production";

export function portalDb() {
  if (!URL || !SERVICE) return null;
  return createClient(URL, SERVICE, { auth:{ persistSession:false, autoRefreshToken:false } });
}

function attemptState(key) {
  const state=attempts.get(key);
  if (!state || Date.now()-state.since>WINDOW_MS) { attempts.delete(key); return null; }
  return state;
}
export function loginBlocked(key) { return (attemptState(key)?.count || 0) >= MAX_ATTEMPTS; }
export function registerLoginFailure(key) { const current=attemptState(key); attempts.set(key,{since:current?.since || Date.now(),count:(current?.count || 0)+1}); }
export function clearLoginFailures(key) { attempts.delete(key); }

export async function auditPortalEvent(db, { userId=null, projectId=null, eventType, correlationId=crypto.randomUUID(), metadata={} } = {}) {
  const { error } = await db.from("client_portal_audit_events").insert({ company_id:COMPANY, portal_user_id:userId, project_id:projectId, event_type:eventType, correlation_id:correlationId, metadata });
  if (error) throw error;
  return correlationId;
}

export async function readPortalSession(req, db = portalDb()) {
  if (!db) return null;
  const token=parseCookies(req.headers.cookie || "")[PORTAL_SESSION_COOKIE];
  if (!token) return null;
  const tokenHash=hashPortalSessionToken(token);
  const { data: session, error } = await db.from("client_portal_sessions")
    .select("id,portal_user_id,expires_at,revoked_at,client_portal_users!inner(id,email,status)")
    .eq("company_id",COMPANY).eq("token_hash",tokenHash).maybeSingle();
  if (error || !session || session.revoked_at || new Date(session.expires_at).getTime()<=Date.now() || session.client_portal_users?.status!=="active") return null;
  const { data: memberships, error: membershipError } = await db.from("client_portal_project_memberships")
    .select("project_id,profile,grants,revokes").eq("company_id",COMPANY).eq("portal_user_id",session.portal_user_id).eq("active",true);
  if (membershipError) throw membershipError;
  const projects=(memberships || []).map(item => ({
    projectId:String(item.project_id), profile:String(item.profile),
    permissions:clientPortalPermissions({ profile:item.profile, grant:item.grants, revoke:item.revokes }),
  }));
  if (!projects.length) return null;
  return { tokenHash, sessionId:session.id, user:{id:session.client_portal_users.id,email:session.client_portal_users.email}, projects };
}

export function noStore(res) { res.setHeader("Cache-Control","private, no-store, max-age=0"); return res; }
export function genericAuthFailure(res) { return noStore(res).status(401).json({ error:"E-mail ou senha inválidos." }); }
export { COMPANY };
