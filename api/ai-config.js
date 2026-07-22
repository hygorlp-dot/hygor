import { authenticateAppUser } from "./auth.js";
import {
  DEFAULT_OPENAI_MODEL,
  loadOpenAIConfig,
  removeOpenAIConfig,
  saveOpenAIConfig,
} from "./ai-config-store.js";

const safeStatus = config => ({
  configured:!!config.apiKey,
  provider:"openai",
  model:config.model||DEFAULT_OPENAI_MODEL,
  source:config.source||"none",
  updatedAt:config.updatedAt||"",
  updatedBy:config.updatedBy||"",
});

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
  const user=await authenticateAppUser(req.body||{});
  if(!user)return res.status(401).json({error:"Sessão inválida."});
  const action=req.body?.action||"status";

  try{
    if(action==="status")return res.status(200).json({ok:true,...safeStatus(await loadOpenAIConfig())});
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});

    if(action==="configure"){
      const apiKey=String(req.body?.apiKey||"").trim();
      if(apiKey.length<20)return res.status(400).json({error:"Informe uma chave de projeto válida da OpenAI."});
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      let validation;
      try{
        validation=await fetch("https://api.openai.com/v1/responses",{
          method:"POST",
          headers:{Authorization:`Bearer ${apiKey}`,"content-type":"application/json"},
          body:JSON.stringify({model:DEFAULT_OPENAI_MODEL,input:"Responda apenas OK.",max_output_tokens:32,store:false}),
          signal:controller.signal,
        });
      }finally{clearTimeout(timeout);}
      if(validation.status===401)return res.status(400).json({error:"A OpenAI recusou a chave. Confira o valor da chave de projeto."});
      if(validation.status===429)return res.status(400).json({error:"A chave foi reconhecida, mas o projeto está sem saldo ou atingiu o limite de uso."});
      if(!validation.ok)return res.status(502).json({error:"Não foi possível validar a chave com a OpenAI agora."});
      const saved=await saveOpenAIConfig({apiKey,model:DEFAULT_OPENAI_MODEL,user});
      return res.status(200).json({ok:true,configured:true,provider:"openai",source:"admin",...saved});
    }

    if(action==="remove"){
      await removeOpenAIConfig();
      return res.status(200).json({ok:true,...safeStatus(await loadOpenAIConfig())});
    }
    return res.status(400).json({error:"Ação inválida."});
  }catch(error){
    console.error("Falha na configuração OpenAI:",error);
    return res.status(500).json({error:"Não foi possível atualizar a integração de IA."});
  }
}
