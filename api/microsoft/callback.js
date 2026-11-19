import {runWithCompany,requestedCompany} from '../../server/company-context.js';
import { configured, cookies, exchangeCode, rootItem, saveCentralSession, seal, setCookie, unseal } from "../../server/microsoft/graph.js";

async function handler(req,res){
  if(req.method&&req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
  try{
    if(!configured())throw new Error("Integração Microsoft não configurada.");
    const saved=unseal(cookies(req).arcd_ms_state);
    if(!req.query.code||!saved?.state||saved.state!==req.query.state)throw new Error("Retorno de autenticação inválido.");
    const token=await exchangeCode(req.query.code); const root=await rootItem(token.access_token);
    const session={companyId:saved.companyId||'arcd',refreshToken:token.refresh_token,accountRootId:root.id,connectedAt:new Date().toISOString()};
    await saveCentralSession(session); setCookie(res,"arcd_ms",seal(session));
    setCookie(res,"arcd_ms_state","",0);
    res.redirect("/?onedrive=connected");
  }catch(e){res.status(400).send(`Não foi possível conectar o OneDrive: ${String(e.message||e)}`);}
}

export default async function callback(req,res){
 const saved=unseal(cookies(req).arcd_ms_state);
 try{
   const companyId=requestedCompany({...req,query:{companyId:saved?.companyId||'arcd'}});
   return await runWithCompany(companyId,()=>handler(req,res));
 }catch{return res.status(400).send('Retorno de empresa inválido.');}
}
