import {hashPortalPassword,normalizePortalEmail,validPortalPassword} from "./client-portal-auth.js";
import {buildClientPortalPublicationRows} from "./client-portal-publication.js";

const PROFILES=new Set(["owner","spouse","representative","financial","external_architect","observer"]);
export async function executeClientPortalAdmin({db,companyId,data,actor,body={}}) {
  if(actor?.role!=="admin")return {status:403,error:"Apenas administradores podem gerenciar acessos de clientes."};
  const operation=String(body.operation||"list"),projectId=String(body.obraId||"");
  if(!data.obras?.some(item=>String(item.id)===projectId))return {status:404,error:"Obra não encontrada."};
  if(actor.obraId&&String(actor.obraId)!==projectId)return {status:403,error:"Você não possui acesso a esta obra."};
  if(operation==="list"){
    const {data:memberships,error}=await db.from("client_portal_project_memberships")
      .select("id,portal_user_id,profile,active,client_portal_users!inner(email,phone,status,last_login_at)")
      .eq("company_id",companyId).eq("project_id",projectId).order("created_at",{ascending:false});
    if(error)throw error;
    return {status:200,ok:true,accesses:(memberships||[]).map(item=>{
      const client=Array.isArray(item.client_portal_users)?item.client_portal_users[0]:item.client_portal_users;
      return {id:item.id,userId:item.portal_user_id,profile:item.profile,active:item.active,email:client?.email||"",phone:client?.phone||"",status:client?.status||"",lastLoginAt:client?.last_login_at||""};
    })};
  }
  if(!["provision","revoke","publish","suspend","preview"].includes(operation))return {status:400,error:"Operação de portal inválida."};
  let values={};
  if(operation==="provision"){
    const email=normalizePortalEmail(body.email),password=String(body.password||""),profile=String(body.profile||"owner");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {status:400,error:"Informe um e-mail válido."};
    if(!validPortalPassword(password))return {status:400,error:"A senha inicial deve ter ao menos 12 caracteres, letras e números."};
    if(!PROFILES.has(profile))return {status:400,error:"Perfil de cliente inválido."};
    values={email,password_hash:hashPortalPassword(password),profile,phone:String(body.phone||"").trim()};
  }
  if(operation==="revoke"){
    if(!body.membershipId)return {status:400,error:"Informe o acesso que deseja revogar."};
    values={membership_id:String(body.membershipId)};
  }
  if(operation==="publish"||operation==="preview"){
    values={rows:buildClientPortalPublicationRows({data,projectId})};
    if(operation==="preview")return {status:200,ok:true,domains:Object.fromEntries([...new Set(values.rows.map(row=>row.domain))].map(domain=>[domain,values.rows.filter(row=>row.domain===domain).length]))};
  }
  const {error}=await db.rpc("client_portal_manage",{p_company_id:companyId,p_project_id:projectId,p_actor_id:String(actor.id),p_operation:operation,p_values:values});
  if(error)throw error;
  return {status:200,ok:true};
}
