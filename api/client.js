import {currentCompany, withCompanyContext, isolationEnabled} from '../server/company-context.js';
import {buildClientAdministrationTeam,clientTeamMonth} from '../server/client-portal-team.js';
import crypto from "node:crypto";
import { clearPortalSessionCookie, createPortalSessionCookie, createPortalSessionToken, hashPortalPassword, validPortalPassword, hashPortalSessionToken, normalizePortalEmail, parseCookies, PORTAL_SESSION_COOKIE, verifyPortalPassword } from "../server/client-portal-auth.js";
import { isPortalRecordVisible, projectClientPortalData } from "../server/client-portal-projection.js";
import { auditPortalEvent, clearLoginFailures, genericAuthFailure, hashIdentifier, loginBlocked, noStore, portalDb, portalUnavailable, readPortalSession, registerLoginFailure, requestIp, secureCookie } from "../server/client-portal-runtime.js";
import {readClientPortalSource} from "../server/client-portal-source.js";
import {buildClientPortalPublicationRows} from "../server/client-portal-publication.js";
import {buildClientFinancialRows} from "../server/client-portal-financial.js";
import {buildClientStatement} from '../server/client-portal-statement.js';
import {buildClientContractPosition} from "../server/client-portal-contract.js";
import {refresh,graph} from "../server/microsoft/graph.js";
import {resolvePublishedCompanyFile} from '../server/company-files.js';
import {COMPANY_FILE_BUCKET,companyFileReference} from '../src/domains/arquivos/company-file-reference.js';

const DOMAINS = Object.freeze({
  weekly_update:"weeklyUpdates", timeline:"timeline", media:"media", decision:"decisions",
  change_order:"changeOrders", financial_summary:"financialSummaries", measurement:"measurements",
  payment:"clientPayments", cash_summary:"projectCashSummaries", cash_movement:"projectCashMovements",
  invoice:"clientInvoices", purchase_order:"clientPurchaseOrders", quotation:"clientQuotations",
  document:"documents", message:"messages", team:"team", support:"support",
  cost_summary:"costSummaries",stage_budget:"stageBudgets",
  daily_report:"dailyReports",contract_position:"contractPositions",
  administration_team:"administrationTeam",
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
    const { data:user, error } = await db.from("client_portal_users").select("id,email,password_hash,status").eq("company_id",currentCompany()).eq("email",email).maybeSingle();
    if (error) throw error;
    if (!user || user.status!=="active" || !verifyPortalPassword(password,user.password_hash)) { registerLoginFailure(key); return genericAuthFailure(res); }
    const token=createPortalSessionToken(), tokenHash=hashPortalSessionToken(token), now=new Date(), expiresAt=new Date(now.getTime()+12*60*60*1000).toISOString(), correlationId=crypto.randomUUID();
    const { data:session, error:sessionError } = await db.from("client_portal_sessions").insert({company_id:currentCompany(),portal_user_id:user.id,token_hash:tokenHash,ip_hash:hashIdentifier(requestIp(req)),expires_at:expiresAt}).select("id").single();
    if (sessionError) throw sessionError;
    try {
      const {error:updateError}=await db.from("client_portal_users").update({last_login_at:now.toISOString(),updated_at:now.toISOString()}).eq("company_id",currentCompany()).eq("id",user.id);
      if(updateError)throw updateError;
      await auditPortalEvent(db,{userId:user.id,eventType:"portal_login",correlationId,metadata:{}});
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
    const {error:updateError}=await db.from("client_portal_sessions").update({last_seen_at:new Date().toISOString()}).eq("company_id",currentCompany()).eq("id",active.sessionId);
    if(updateError)throw updateError;
    const ids=active.projects.map(project=>project.projectId);
    const {data:summaries,error:summaryError}=await db.from("client_portal_publications").select("project_id,payload").eq("company_id",currentCompany()).eq("domain","project_summary").eq("status","published").in("project_id",ids).order("published_at",{ascending:false});
    if(summaryError)throw summaryError;
    const names=new Map();
    for(const summary of summaries||[])if(!names.has(summary.project_id))names.set(summary.project_id,summary.payload?.name);
    const reference=await auditPortalEvent(db,{userId:active.user.id,eventType:"portal_session_viewed",metadata:{}});
    return noStore(res).status(200).json({user:active.user,projects:active.projects.map(project=>({...project,name:names.get(project.projectId)||"Obra aguardando publicação"})),reference});
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
      const { data:active }=await db.from("client_portal_sessions").select("id,portal_user_id").eq("company_id",currentCompany()).eq("token_hash",hashPortalSessionToken(token)).maybeSingle();
      if (active) {
        const {error}=await db.from("client_portal_sessions").update({revoked_at:new Date().toISOString()}).eq("company_id",currentCompany()).eq("id",active.id);
        if(error)throw error;
        await auditPortalEvent(db,{userId:active.portal_user_id,eventType:"portal_logout",metadata:{ipPresent:Boolean(requestIp(req))}});
      }
    }
  } catch (error) { console.error("client portal logout failed",error?.message);return noStore(res).status(503).json({error:"Não foi possível encerrar sua sessão. Tente sair novamente."}); }
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
    const user={id:active.user.id,profile:membership.profile,projectIds:[projectId],permissions:Object.entries(membership.permissions).filter(([,enabled])=>enabled).map(([capability])=>capability)};
    const rows=await publishedPortalRows(db,projectId,user,membership.permissions,{month:req.query?.month});
    const summary=rows.find(row=>row.domain==="project_summary");
    if (!summary) return noStore(res).status(404).json({error:"Ainda não há um resumo publicado para esta obra."});
    const sourceData={};
    for (const row of rows) { const key=DOMAINS[row.domain]; if (key) (sourceData[key] ||= []).push(recordFromPublication(row,projectId)); }
    const portal=projectClientPortalData({user,permissions:membership.permissions,project:{...(summary.payload || {}),id:projectId,portal:summary.payload || {}},sourceData});
    const reference=await auditPortalEvent(db,{userId:user.id,projectId,eventType:"project_opened",metadata:{domainCount:Object.keys(sourceData).length}});
    return noStore(res).status(200).json({portal,reference});
  } catch (error) {
    console.error("client portal dashboard failed",error?.message);
    return noStore(res).status(error.status||503).json({error:error.status===400?"Escolha um mês válido até o mês atual.":error.status===404?"A publicação desta obra está indisponível. Fale com a equipe responsável.":"Não foi possível carregar a obra agora. Tente novamente mais tarde."});
  }
}

/** Uma única função reduz a superfície de deploy Hobby sem mudar as URLs públicas. */
async function handler(req, res) {
  if(isolationEnabled()){
    const json=res.json.bind(res);
    const scopeLinks=value=>{
      if(typeof value==='string'&&value.startsWith('/api/client/')){
        const url=new URL(value,'http://local');url.searchParams.set('companyId',currentCompany());
        return url.pathname+url.search+url.hash;
      }
      if(Array.isArray(value))return value.map(scopeLinks);
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,scopeLinks(item)]));
      return value;
    };
    res.json=value=>json(scopeLinks(value));
  }
  return handleClientPortal(req,res,portalDb());
}
export async function handleClientPortal(req,res,db){
  noStore(res);
  if(req.method!=="GET"&&req.headers.origin){
    let origin;
    try{origin=new URL(req.headers.origin).host;}catch{return res.status(403).json({error:"Origem do pedido inválida."});}
    if(origin!==req.headers.host)return res.status(403).json({error:"Origem do pedido inválida."});
  }
  if (!db) return portalUnavailable(res);
  const route=routeParts(req);
  if (route[0]==="auth" && route[1]==="login") return login(req,res,db);
  if (route[0]==="auth" && route[1]==="session") return session(req,res,db);
  if (route[0]==="auth" && route[1]==="logout") return logout(req,res,db);
  if (route[0]==="auth" && route[1]==="password") return changePassword(req,res,db);
  if (route[0]==="projects" && route[2]==="dashboard" && route[1]) return dashboard(req,res,db,route[1]);
  if (route[0]==="projects" && route[2]==="statement" && route.length===3) return statement(req,res,db,route[1]);
  if (route[0]==="projects" && route[2]==="files" && route.length===5) return invoiceFile(req,res,db,route[1],route[3],route[4]);
  if (route[0]==="projects" && route[2]==="media" && route.length===4) return mediaFile(req,res,db,route[1],route[3]);
  if (route[0]==="projects" && route[2]==="documents" && route.length===4) return publishedDocument(req,res,db,route[1],route[3]);
  return noStore(res).status(404).json({error:"Rota do Portal do Cliente não encontrada."});
}

async function statement(req,res,db,projectId){
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
 try{
  const active=await readPortalSession(req,db),membership=active?.projects.find(item=>item.projectId===projectId);
  if(!active)return res.status(401).json({error:'Entre no portal para baixar a prestação de contas.'});
  if(!membership?.permissions.downloadDocuments||!membership.permissions.viewCosts)return res.status(403).json({error:'Este acesso não permite baixar a prestação de contas.'});
  const user={id:active.user.id,profile:membership.profile,projectIds:[projectId],permissions:Object.entries(membership.permissions).filter(([,enabled])=>enabled).map(([capability])=>capability)};
  const rows=await publishedPortalRows(db,projectId,user,membership.permissions,{month:req.query?.month});
  const summary=rows.find(row=>row.domain==='project_summary');if(!summary)throw Object.assign(new Error('Publicação indisponível.'),{status:404});
  const sourceData={};for(const row of rows){const key=DOMAINS[row.domain];if(key)(sourceData[key]||=[]).push(recordFromPublication(row,projectId));}
  const portal=projectClientPortalData({user,permissions:membership.permissions,project:{...summary.payload,id:projectId,portal:summary.payload},sourceData});
  if(!portal.costSummaries?.[0]?.available)throw Object.assign(new Error('Os custos estão em conferência ou não foram liberados.'),{status:403});
  const {data,canonical}=await readClientPortalSource(db,currentCompany());
  const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const report=buildClientStatement({data,portal,projectId,asOf,month:req.query?.month,canonicalEvents:canonical.events,permissions:membership.permissions});
  await auditPortalEvent(db,{userId:user.id,projectId,eventType:'statement_downloaded',metadata:{month:report.month,format:req.query?.format||'pdf'}});
  if(req.query?.format==='json')return res.json({statement:report});
  const {createClientStatementPdf,createStatementEmail}=await import('../server/client-portal-statement-pdf.js');
  const pdf=await createClientStatementPdf(report);
  const email=req.query?.format==='email';res.setHeader('Content-Type',email?'message/rfc822':'application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="prestacao-contas-${report.month}.${email?'eml':'pdf'}"`);
  res.setHeader('X-Content-Type-Options','nosniff');return res.end(email?createStatementEmail(report,active.user.email,pdf):pdf);
 }catch(error){console.error('client statement failed',error.status||'unavailable');return res.status(error.status||503).json({error:error.status?error.message:'Não foi possível preparar a prestação de contas. Tente novamente.'});}
}

async function publishedPortalRows(db,projectId,user,permissions,{month}={}){
  const publications=[];
  for(let offset=0;;offset+=1000){
    const {data,error}=await db.from("client_portal_publications").select("id,domain,status,visibility,visible_to_profiles,visible_to_user_ids,payload,published_at").eq("company_id",currentCompany()).eq("project_id",projectId).eq("status","published").order("id").range(offset,offset+999);
    if(error)throw error;
    publications.push(...(data||[]));
    if((data||[]).length<1000)break;
  }
  let rows=publications.filter(row=>isPortalRecordVisible(recordFromPublication(row,projectId),user));
  if(!rows.some(row=>row.domain==="project_summary"))return rows;
  const policy=rows.find(row=>row.domain==="publication_policy")?.payload;
  if(!policy)return rows;
  const requested={
    publicarAdministracaoEquipe:policy.publicarAdministracaoEquipe&&permissions.viewAdministrationTeam,
    publicarCustos:policy.publicarCustos&&permissions.viewCosts,
    publicarOrcamentoEtapas:policy.publicarOrcamentoEtapas&&permissions.viewStageBudget,
    publicarCaixaObra:policy.publicarCaixaObra&&permissions.viewProjectCash,
    publicarNotasFiscais:policy.publicarNotasFiscais&&permissions.viewProcurement,
    publicarCompras:policy.publicarCompras&&permissions.viewProcurement,
    publicarDiarios:policy.publicarDiarios&&(permissions.viewWeeklyUpdates||permissions.viewMedia),
    publicarFotos:policy.publicarDiarios&&permissions.viewMedia,
    publicarFinanceiro:policy.publicarFinanceiro&&permissions.viewFinancial,
    publicarCronograma:policy.publicarCronograma&&permissions.viewProgress,
  };
  const {data,canonical}=await readClientPortalSource(db,currentCompany(),{financial:Boolean(requested.publicarCustos||requested.publicarOrcamentoEtapas||requested.publicarAdministracaoEquipe)});
  const obra=data.obras?.find(item=>String(item.id)===projectId);
  if(!obra||obra.portalCliente?.ativo!==true)throw Object.assign(new Error("Publicação suspensa"),{status:404});
  const current=obra.portalCliente;
  if(current.publicarDocumentos!==true)rows=rows.filter(row=>row.domain!=='document');
  if(current.publicarCotacoes!==true)rows=rows.filter(row=>row.domain!=='quotation');
  for(const key of Object.keys(requested)){
    const enabled=key==='publicarDiarios'||key==='publicarFotos'?current.publicarFotos!==false:key==='publicarCronograma'?current.publicarCronograma!==false:current[key]===true;
    requested[key]=Boolean(requested[key]&&enabled);
  }
  const liveData={...data,obras:data.obras.map(item=>String(item.id)===projectId?{...item,portalCliente:{...item.portalCliente,...requested}}:item)};
  const now=new Date().toISOString();
  const asOf=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bahia",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
  const domains=new Set(["cash_summary","cash_movement","invoice","purchase_order","daily_report","media","weekly_update","contract_position","financial_summary","measurement","payment","change_order","cost_summary","stage_budget","timeline","administration_team"]);
  if(requested.publicarCronograma){domains.add("project_summary");domains.add("timeline");}
  const liveRows=buildClientPortalPublicationRows({data:liveData,projectId,publishedAt:now}).filter(row=>domains.has(row.domain));
  if(requested.publicarAdministracaoEquipe)liveRows.push(buildClientAdministrationTeam({data,projectId,asOf,month:clientTeamMonth(month,asOf),canonicalEvents:canonical.events,issues:canonical.issues}));
  if(requested.publicarFinanceiro)liveRows.push(buildClientContractPosition({data,projectId,asOf}));
  if(requested.publicarCustos||requested.publicarOrcamentoEtapas){
    const financial=buildClientFinancialRows({data,projectId,asOf,canonicalEvents:canonical.events,issues:canonical.issues});
    if(requested.publicarCustos)liveRows.push(...financial.filter(row=>row.domain==="cost_summary"));
    if(requested.publicarOrcamentoEtapas)liveRows.push(...financial.filter(row=>row.domain==="stage_budget"));
  }
  rows=rows.filter(row=>!domains.has(row.domain));
  return [...rows,...liveRows.map(row=>({...row,status:"published",visibility:"project_users",published_at:now}))];
}

async function invoiceFile(req,res,db,projectId,invoiceId,documentId){
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
  try{
    const active=await readPortalSession(req,db);
    if(!active)return res.status(401).json({error:"Sua sessão terminou. Entre novamente."});
    const membership=active.projects.find(item=>item.projectId===projectId);
    if(!membership?.permissions.viewProcurement||!membership.permissions.downloadDocuments)return res.status(403).json({error:"Seu acesso não permite abrir este documento."});
    const user={id:active.user.id,profile:membership.profile};
    const rows=await publishedPortalRows(db,projectId,user,membership.permissions);
    const invoice=rows.find(row=>row.domain==="invoice"&&row.payload?.id===invoiceId);
    const document=invoice?.payload?.documents?.find(item=>item.id===documentId);
    if(!document?.reference)return res.status(404).json({error:"Anexo indisponível para este acesso."});
    const {driveId,itemId}=document.reference;
    const {accessToken}=await refresh({headers:{cookie:""}});
    const file=await (await graph(accessToken,`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,@microsoft.graph.downloadUrl`)).json();
    const url=file["@microsoft.graph.downloadUrl"];
    if(!url||!url.startsWith("https://"))return res.status(404).json({error:"O original da nota não está disponível."});
    await auditPortalEvent(db,{userId:user.id,projectId,eventType:"invoice_document_opened",metadata:{invoiceId,documentId}});
    res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Location",url);
    return res.status(302).end();
  }catch(error){console.error("client portal file failed",error?.message);return res.status(error.status||503).json({error:"Não foi possível abrir o anexo. Tente novamente ou fale com a equipe."});}
}

async function mediaFile(req,res,db,projectId,mediaId){
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
  try{
    const active=await readPortalSession(req,db);
    if(!active)return res.status(401).json({error:"Sua sessão terminou. Entre novamente."});
    const membership=active.projects.find(item=>item.projectId===projectId);
    if(!membership?.permissions.viewMedia)return res.status(403).json({error:"Seu acesso não permite consultar esta foto."});
    const user={id:active.user.id,profile:membership.profile};
    // Mídia vem da revisão editorial; não precisa carregar finanças.
    const rows=await publishedPortalRows(db,projectId,user,{viewMedia:true});
    const photo=rows.find(row=>row.domain==="media"&&row.payload?.id===mediaId)?.payload;
    if(!photo?.reference)return res.status(404).json({error:"Foto indisponível para este acesso."});
    if(photo.reference.bucket===COMPANY_FILE_BUCKET){
      const result=await resolvePublishedCompanyFile({reference:companyFileReference(photo.reference.name),companyId:currentCompany(),projectId,storage:db.storage});
      if(result.status!==200)return res.status(result.status).json({error:result.body.error});
      res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Location',result.body.url);return res.status(302).end();
    }
    const {driveId,itemId}=photo.reference;
    const {accessToken}=await refresh({headers:{cookie:""}});
    const file=await (await graph(accessToken,`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,@microsoft.graph.downloadUrl`)).json();
    const url=file["@microsoft.graph.downloadUrl"];
    if(!url?.startsWith("https://"))return res.status(404).json({error:"Foto original indisponível."});
    res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Location",url);return res.status(302).end();
  }catch(error){console.error("client portal media failed",error?.message);return res.status(503).json({error:"Não foi possível abrir a foto."});}
}

async function changePassword(req,res,db){
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
  try{
    const active=await readPortalSession(req,db);
    if(!active)return res.status(401).json({error:"Sua sessão terminou. Entre novamente."});
    const key=hashIdentifier(`password:${active.user.id}:${requestIp(req)}`);
    if(loginBlocked(key))return genericAuthFailure(res);
    const password=String(req.body?.password||""),currentPassword=String(req.body?.currentPassword||"");
    if(!validPortalPassword(password))return res.status(400).json({error:"Use ao menos 12 caracteres, com letras e números."});
    const {data:user,error}=await db.from("client_portal_users").select("password_hash").eq("company_id",currentCompany()).eq("id",active.user.id).maybeSingle();
    if(error)throw error;
    if(!user||!verifyPortalPassword(currentPassword,user.password_hash)){
      registerLoginFailure(key);return res.status(401).json({error:"A senha atual não confere."});
    }
    const {data:changed,error:changeError}=await db.rpc("client_portal_change_password",{p_company_id:currentCompany(),p_user_id:active.user.id,p_expected_hash:user.password_hash,p_password_hash:hashPortalPassword(password)});
    if(changeError)throw changeError;
    if(changed!==true)return res.status(409).json({error:"O acesso foi alterado. Entre novamente e confira sua senha."});
    clearLoginFailures(key);
    res.setHeader("Set-Cookie",clearPortalSessionCookie({secure:secureCookie()}));
    return res.status(200).json({ok:true});
  }catch(error){console.error("client portal password failed",error?.message);return res.status(503).json({error:"Não foi possível alterar a senha. Tente novamente."});}
}

async function publishedDocument(req,res,db,projectId,documentId){
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
  try{
    const active=await readPortalSession(req,db);
    if(!active)return res.status(401).json({error:"Sua sessão terminou. Entre novamente."});
    const membership=active.projects.find(item=>item.projectId===projectId);
    if(!membership?.permissions.downloadDocuments)return res.status(403).json({error:"Seu acesso não permite abrir este documento."});
    const user={id:active.user.id,profile:membership.profile};
    const rows=await publishedPortalRows(db,projectId,user,{});
    const document=rows.find(row=>row.domain==="document"&&row.payload?.id===documentId)?.payload;
    if(!document?.reference)return res.status(404).json({error:"Documento não liberado para este acesso."});
    const {driveId,itemId}=document.reference;
    const {accessToken}=await refresh({headers:{cookie:""}});
    const file=await (await graph(accessToken,`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,@microsoft.graph.downloadUrl`)).json();
    const url=file["@microsoft.graph.downloadUrl"];
    if(!url?.startsWith("https://"))return res.status(404).json({error:"Original indisponível."});
    await auditPortalEvent(db,{userId:user.id,projectId,eventType:"published_document_opened",metadata:{documentId}});
    res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Location",url);return res.status(302).end();
  }catch(error){console.error("client portal document failed",error?.message);return res.status(503).json({error:"Não foi possível abrir o documento."});}
}

export default withCompanyContext(handler);
