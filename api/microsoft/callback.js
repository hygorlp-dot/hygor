import { configured, cookies, exchangeCode, rootItem, saveCentralSession, seal, setCookie, unseal } from "../../server/microsoft/graph.js";

export default async function handler(req,res){
  try{
    if(!configured())throw new Error("Integração Microsoft não configurada.");
    const saved=unseal(cookies(req).arcd_ms_state);
    if(!req.query.code||!saved?.state||saved.state!==req.query.state)throw new Error("Retorno de autenticação inválido.");
    const token=await exchangeCode(req.query.code); const root=await rootItem(token.access_token);
    const session={refreshToken:token.refresh_token,accountRootId:root.id,connectedAt:new Date().toISOString()};
    await saveCentralSession(session); setCookie(res,"arcd_ms",seal(session));
    setCookie(res,"arcd_ms_state","",0);
    res.redirect("/?onedrive=connected");
  }catch(e){res.status(400).send(`Não foi possível conectar o OneDrive: ${String(e.message||e)}`);}
}
