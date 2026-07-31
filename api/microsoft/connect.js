import crypto from "crypto";
import { authConfig, configured, SCOPES, seal, setCookie, verifyAppUser } from "../../server/microsoft/graph.js";

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
  if(!configured())return res.status(500).json({error:"Integração Microsoft não configurada na Vercel."});
  const appUser=await verifyAppUser(req.body?.userId,req.body?.pin,req.body?.accessToken);
  if(!appUser)return res.status(401).json({error:"Sessão do aplicativo inválida."});
  if(appUser.role!=="admin")return res.status(403).json({error:"Apenas administradores podem conectar o OneDrive."});
  const state=crypto.randomBytes(24).toString("hex"); setCookie(res,"arcd_ms_state",seal({state}),600);
  const {CLIENT_ID,REDIRECT_URI,AUTHORITY}=authConfig();
  const q=new URLSearchParams({client_id:CLIENT_ID,response_type:"code",redirect_uri:REDIRECT_URI,response_mode:"query",scope:SCOPES,state,prompt:"select_account"});
  res.json({url:`${AUTHORITY}/authorize?${q}`});
}
