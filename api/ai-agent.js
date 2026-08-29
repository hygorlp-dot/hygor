import { authenticateAppUser } from "./auth.js";
import { createClient } from "@supabase/supabase-js";
import { buildDailyBrief } from "../server/daily-brief.js";
import { decryptAiSecret, encryptAiSecret } from "../server/ai-secret.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const CONFIG_KEY = "arced_ai_config_gemini_v1";
const CUB_CACHE_KEY = "arced_cub_pe_cache_v1";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY || "";

const MODULE_POLICIES = {
  geral: "Atue como copiloto operacional. Relacione a resposta ao setor e à obra, deixe explícitas as pendências e termine com a próxima ação recomendada.",
  compras: "Atue como analista de suprimentos. Em documentos, confira fornecedor, itens, valores, pedido, recebimento, forma de pagamento e obra. O nome original do arquivo é uma evidência importante para identificar a obra. Nunca confirme compra nem lançamento sem revisão humana.",
  financeiro: "Atue como analista financeiro de obras. Em documentos, confira competência, vencimento, fornecedor, valores, retenções, rateio e obra. O nome original do arquivo é uma evidência importante para identificar a obra. Sinalize divergências e não dê como certa uma classificação fiscal ou contábil sem revisão humana.",
  dre: "Atue como CFO experiente de uma construtora. Analise DRE da empresa e de cada obra, distinguindo competência, faturamento, caixa, custos diretos, despesas operacionais, mão de obra, produtividade e margem. Compare a evolução mensal, questione dimensionamento de equipe somente com evidências, dê um veredicto executivo e priorize decisões verificáveis com impacto, prazo e indicador. Não trate ausência de faturamento como prejuízo contratual definitivo sem verificar competência e estágio da obra.",
  diario: "Atue como engenheiro de campo revisando um RDO. Separe fatos visíveis, informações declaradas e inferências. Relacione fotos, serviços, equipes, clima, planejamento, riscos e pendências, sempre exigindo validação do engenheiro.",
  orcamento: "Atue como engenheiro orçamentista sênior e colaborativo. Revise escopo, quantitativos, composições, interfaces, cotações, BDI e itens ausentes. Produza achados curtos, verificáveis e acionáveis; não invente preço, projeto, obrigação contratual ou norma. Quando faltar evidência, formule uma pergunta de escopo.",
  planejamento: "Atue como planejador de obras. Verifique sequência executiva, dependências, restrições, caminho crítico, recursos, suprimentos, marcos, folgas e coerência com orçamento e avanço real. Diferencie sugestão de alteração confirmada.",
  administracao: "Atue como auditor administrativo. Resuma alterações, autoria, riscos, exclusões, padrões anormais e ações que exigem decisão do administrador, preservando rastreabilidade.",
  conferencia: "Atue como engenheiro de qualidade. Relacione inconformidades ao serviço, evidência, impacto, responsável, prazo e critério de aceite. Não declare conformidade sem evidência suficiente.",
  qualidade: "Atue como especialista em FVS/FVM. Trabalhe com critérios auditáveis, evidências, responsável, resultado, rastreabilidade e tratamento de não conformidade.",
  comercial: "Atue como analista comercial de construção. Considere cliente, necessidade, escopo, proposta, riscos, próximos passos e histórico, sem prometer prazo ou preço não confirmado.",
  rh: "Atue como analista de operações e pessoas. Considere lotação, ponto, capacidade, pendências e responsabilidades, sem inferir dados pessoais não fornecidos.",
};
const normalizeModule = value => {
  const key=String(value||"geral").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");
  const aliases={compras:"compras",financeiro:"financeiro",dre:"dre",dreempresa:"dre",controladoria:"dre",diario:"diario",diariodeobra:"diario",rdo:"diario",orcamento:"orcamento",planejamento:"planejamento",administracao:"administracao",admin:"administracao",conferencia:"conferencia",qualidade:"qualidade",comercial:"comercial",rh:"rh",recursoshumanos:"rh"};
  return aliases[key]||"geral";
};

const database = () => createClient(URL, SERVICE, {
  auth: { persistSession:false, autoRefreshToken:false },
});

// Achado de 24/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção
// "Investigação da integração com o agente de IA"): a única checagem de
// limite aqui era para tentativas de PIN incorretas (herdada de
// authenticateAppContext) - nenhuma proteção contra um usuário já
// autenticado gerando custo real no Gemini repetidamente (loop de
// interface, script, ou uso descuidado). Limite simples em memória, mesmo
// padrão já usado em api/auth.js para tentativas de PIN (Map por
// instância, não persistente entre instâncias serverless "frias") - não é
// defesa contra um atacante deliberado com múltiplas instâncias, mas cobre
// o risco real (uso repetido acidental de um usuário já autenticado).
// Só se aplica ao caminho que efetivamente chama o Gemini (chat/análise) -
// status/configure/remove/daily-brief não custam nada em cota de API.
const AI_RATE_WINDOW_MS = 5 * 60 * 1000;
const AI_RATE_MAX_REQUESTS = 20;
const aiRequestLog = new Map();
const aiRateLimited = userId => {
  const key = String(userId || "anonymous");
  const now = Date.now();
  const timestamps = (aiRequestLog.get(key) || []).filter(at => now - at < AI_RATE_WINDOW_MS);
  if (timestamps.length >= AI_RATE_MAX_REQUESTS) {
    aiRequestLog.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  aiRequestLog.set(key, timestamps);
  return false;
};
const encrypt = plainText => encryptAiSecret(plainText,{
  secret:AI_ENCRYPTION_KEY||SERVICE,company:COMPANY,
  keyVersion:AI_ENCRYPTION_KEY?"ai-v1":"service-v1",
});
const decrypt = value => decryptAiSecret(value,{
  primarySecret:AI_ENCRYPTION_KEY,legacySecret:SERVICE,company:COMPANY,
});
const loadConfig = async () => {
  if(!URL||!SERVICE)return {apiKey:"",model:DEFAULT_MODEL,source:"none"};
  const {data,error}=await database().from("company_app_data").select("value,updated_at")
    .eq("company_id",COMPANY).eq("key",CONFIG_KEY).maybeSingle();
  let value=data?.value;
  if(typeof value==="string"){try{value=JSON.parse(value);}catch{value=null;}}
  if(!error&&value?.encryptedKey){
    try{
      const opened=decrypt(value);
      if(AI_ENCRYPTION_KEY&&opened.source!=="ai-v1"){
        const migrated={...value,...encrypt(opened.plainText)};
        const {error:migrationError}=await database().from("company_app_data").update({
          value:migrated,updated_at:new Date().toISOString(),
        }).eq("company_id",COMPANY).eq("key",CONFIG_KEY);
        if(migrationError)console.error("Não foi possível migrar a criptografia da configuração Gemini:",migrationError.message);
      }
      return {apiKey:opened.plainText,model:value.model||DEFAULT_MODEL,source:"admin",updatedAt:data.updated_at||value.updatedAt||"",updatedBy:value.updatedBy||"",validationStatus:value.validationStatus||"unknown",validationMessage:value.validationMessage||""};
    }
    catch(decryptError){console.error("Não foi possível abrir a configuração do Gemini:",decryptError?.message);}
  }
  const environmentKey=String(process.env.GEMINI_API_KEY||"").trim();
  return {apiKey:environmentKey,model:DEFAULT_MODEL,source:environmentKey?"environment":"none",validationStatus:environmentKey?"unknown":""};
};
const saveConfig = async ({apiKey,user,validationStatus="ready",validationMessage=""}) => {
  const agora=new Date().toISOString();
  const value={provider:"gemini",model:DEFAULT_MODEL,...encrypt(apiKey),updatedAt:agora,updatedBy:user?.nome||user?.id||"Administrador",validationStatus,validationMessage};
  // `usuarios[].id` é um identificador curto criado pelo ArcD, enquanto a
  // coluna histórica updated_by pode ser UUID em instalações antigas. O nome
  // do administrador já fica no valor criptografado; só enviamos à coluna o
  // authUserId quando ele realmente possui o formato aceito pelo banco.
  const authUserId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(user?.authUserId||""))?user.authUserId:null;
  const {error}=await database().from("company_app_data").upsert({company_id:COMPANY,key:CONFIG_KEY,value,updated_at:agora,updated_by:authUserId},{onConflict:"company_id,key"});
  if(error)throw error;
  return {model:DEFAULT_MODEL,updatedAt:agora,updatedBy:value.updatedBy,validationStatus,validationMessage};
};
const removeConfig = async () => {
  const {error}=await database().from("company_app_data").delete().eq("company_id",COMPANY).eq("key",CONFIG_KEY);
  if(error)throw error;
};
// Cache do CUB-PE (achado de 25/08/2026: raspar o site do Sinduscon-PE a
// cada carregamento do Dashboard é trabalho repetido - o índice só muda
// quando um mês novo é publicado). buildDailyBrief decide se o cache está
// fresco o suficiente para usar; aqui só lemos/gravamos. Nunca lança - uma
// falha de cache não pode derrubar o daily-brief, só faz cair no
// comportamento de sempre raspar de novo.
const lerCubCache = async () => {
  if(!URL||!SERVICE)return null;
  const {data,error}=await database().from("company_app_data").select("value")
    .eq("company_id",COMPANY).eq("key",CUB_CACHE_KEY).maybeSingle();
  if(error||!data?.value?.dados)return null;
  return data.value;
};
const gravarCubCache = async dados => {
  if(!URL||!SERVICE)return;
  const agora=new Date().toISOString();
  const {error}=await database().from("company_app_data").upsert(
    {company_id:COMPANY,key:CUB_CACHE_KEY,value:{dados,atualizadoEm:agora},updated_at:agora,updated_by:null},
    {onConflict:"company_id,key"},
  );
  if(error)console.error("Não foi possível gravar o cache do CUB-PE:",error.message);
};
const safeStatus = config => ({configured:!!config.apiKey,provider:"gemini",model:config.model||DEFAULT_MODEL,source:config.source||"none",updatedAt:config.updatedAt||"",updatedBy:config.updatedBy||"",validationStatus:config.validationStatus||"unknown",validationMessage:config.validationMessage||""});
const geminiRequest = (apiKey,model,body,signal) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
  method:"POST",
  headers:{"content-type":"application/json","x-goog-api-key":apiKey},
  body:JSON.stringify(body),signal,
});
const providerErrorFrom = body => body?.error||{};
const providerMessageFrom = body => String(providerErrorFrom(body)?.message||"").trim();
const isInvalidKey = (status,message) => [401,403].includes(status)||(status===400&&/api key|api_key_invalid|key not valid|permission denied/i.test(message));

// Todas as telas usam esta única ponte autenticada. A chave Gemini fica
// criptografada no servidor e nunca é devolvida ao navegador.
export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido."});
  const user=await authenticateAppUser(req.body||{},{scope:"ai-agent"});
  if(!user)return res.status(401).json({error:"Sessão inválida."});

  if(req.body?.action==="daily-brief"){
    const brief=await buildDailyBrief({cubCache:{ler:lerCubCache,gravar:gravarCubCache}});
    res.setHeader("Cache-Control","private, max-age=900");
    return res.status(200).json(brief);
  }

  const aiConfig=await loadConfig();

  // Motor de associação item→composição (28/08/2026, pedido do usuário):
  // dado um item extraído do projeto (hoje só Hidrossanitário) e uma lista
  // de candidatos JÁ pesquisados nas bases SINAPI/ORSE reais (nunca
  // inventados aqui - a IA só ESCOLHE entre o que o cliente já buscou),
  // devolve a composição mais adequada, com justificativa, ou marca
  // pendência quando ambíguo/sem correspondência técnica. Só propõe -
  // nada disto grava no orçamento sozinho, quem aplica é o operador.
  if(req.body?.action==="budget-match"){
    if(aiRateLimited(user.id))return res.status(429).json({error:"Muitas solicitações de IA em pouco tempo. Aguarde alguns minutos e tente novamente.",code:"AI_RATE_LIMIT_LOCAL"});
    const apiKeyMatch=aiConfig.apiKey;
    if(!apiKeyMatch)return res.status(503).json({error:"O Modo IA ainda não foi configurado pelo administrador.",code:"AI_NOT_CONFIGURED"});
    const itens=(Array.isArray(req.body?.itens)?req.body.itens:[]).slice(0,300).map(it=>({
      id:String(it?.id||""),descricao:String(it?.descricao||"").slice(0,300),
      quantidade:Number(it?.quantidade||0),unidade:String(it?.unidade||"").slice(0,20),
      tabela:String(it?.tabela||"").slice(0,80),
    })).filter(it=>it.id&&it.descricao);
    const candidatos=(Array.isArray(req.body?.candidatos)?req.body.candidatos:[]).slice(0,600).map(c=>({
      fonte:String(c?.fonte||"").slice(0,10),codigo:String(c?.codigo||"").slice(0,20),
      descricao:String(c?.descricao||"").slice(0,300),unidade:String(c?.unidade||"").slice(0,20),
      precoUnit:Number(c?.precoUnit||0),
    })).filter(c=>c.codigo&&c.descricao);
    if(!itens.length)return res.status(400).json({error:"Nenhum item para associar."});
    if(!candidatos.length)return res.status(400).json({error:"Nenhum candidato de composição para escolher - pesquise nas bases SINAPI/ORSE vinculadas primeiro."});
    const systemMatch=[
      "Você é um engenheiro orçamentista sênior especializado em instalações prediais.",
      "Sua função é escolher, para cada item de projeto recebido, a composição de custo (SINAPI ou ORSE) mais adequada tecnicamente, ESCOLHENDO SOMENTE entre os candidatos fornecidos - nunca invente código, descrição, preço ou unidade que não esteja na lista de candidatos.",
      "Regras obrigatórias: (1) nunca associe um item de um sistema (água fria, esgoto, pluvial) a uma composição de outro sistema; (2) nunca associe um diâmetro/dimensão claramente diferente do item, salvo equivalência técnica óbvia; (3) prefira composição a insumo isolado quando o objetivo for serviço executado; (4) se dois candidatos forem tecnicamente equivalentes, prefira o de fonte SINAPI; (5) se nenhum candidato for tecnicamente adequado, ou se dois candidatos forem plausíveis sem uma diferença clara, marque status \"pendente\" em vez de escolher às cegas; (6) a justificativa deve citar o critério técnico usado (sistema, material, diâmetro, unidade), nunca uma frase vaga como 'parece compatível'.",
      "Responda em português do Brasil.",
    ].join(" ");
    const instrucao=`Itens do projeto (JSON):\n${JSON.stringify(itens)}\n\nCandidatos disponíveis nas bases (JSON, escolha só entre estes):\n${JSON.stringify(candidatos)}\n\nPara cada item, devolva um objeto no array "matches" com: itemId (o id recebido), status ("associado" ou "pendente"), fonte e codigo (copiados EXATAMENTE de um candidato, só quando status="associado"), confianca (0 a 1), justificativa (uma frase técnica curta).`;
    const schemaMatch={type:"OBJECT",properties:{matches:{type:"ARRAY",items:{type:"OBJECT",properties:{
      itemId:{type:"STRING"},status:{type:"STRING",enum:["associado","pendente"]},
      fonte:{type:"STRING"},codigo:{type:"STRING"},confianca:{type:"NUMBER"},justificativa:{type:"STRING"},
    },required:["itemId","status","confianca","justificativa"]}}},required:["matches"]};
    const controllerMatch=new AbortController(),timeoutMatch=setTimeout(()=>controllerMatch.abort(),55000);
    let responseMatch;
    try{
      responseMatch=await geminiRequest(apiKeyMatch,aiConfig.model,{
        systemInstruction:{parts:[{text:systemMatch}]},
        contents:[{role:"user",parts:[{text:instrucao}]}],
        generationConfig:{maxOutputTokens:12000,temperature:0.05,responseMimeType:"application/json",responseSchema:schemaMatch},
      },controllerMatch.signal);
    }catch(error){
      clearTimeout(timeoutMatch);
      if(error?.name==="AbortError")return res.status(504).json({error:"A associação demorou além do limite. Tente com menos itens de uma vez."});
      throw error;
    }
    clearTimeout(timeoutMatch);
    if(!responseMatch.ok){
      const bodyErr=await responseMatch.json().catch(()=>({})),providerMessage=providerMessageFrom(bodyErr);
      if(isInvalidKey(responseMatch.status,providerMessage))return res.status(502).json({error:"A autenticação do Gemini precisa ser atualizada pelo administrador.",code:"AI_AUTH_INVALID"});
      if(responseMatch.status===429)return res.status(429).json({error:"A cota gratuita ou o limite temporário do Gemini foi atingido. Tente novamente mais tarde.",code:"AI_RATE_LIMIT"});
      return res.status(502).json({error:"O serviço Gemini não respondeu.",code:"AI_PROVIDER_ERROR"});
    }
    const bodyMatch=await responseMatch.json();
    const textoMatch=(bodyMatch.candidates?.[0]?.content?.parts||[]).map(part=>part.text||"").join("").trim();
    let resultado;
    try{resultado=JSON.parse(textoMatch);}
    catch{return res.status(422).json({error:"A IA não devolveu um JSON válido. Tente novamente com menos itens.",code:"AI_INVALID_JSON"});}
    const candidatosPorChave=new Map(candidatos.map(c=>[`${c.fonte}::${c.codigo}`,c]));
    const matches=(Array.isArray(resultado?.matches)?resultado.matches:[]).map(m=>{
      const chave=`${m.fonte}::${m.codigo}`;
      const candidato=m.status==="associado"?candidatosPorChave.get(chave):null;
      // Se a IA "escolheu" um código que não está na lista de candidatos (ou
      // devolveu status associado sem um candidato real por trás), a
      // resposta é tratada como pendente - nunca como uma composição válida
      // inventada (Princípio "não inventar" do pedido original).
      return candidato
        ? {itemId:m.itemId,status:"associado",fonte:candidato.fonte,codigo:candidato.codigo,descricao:candidato.descricao,unidade:candidato.unidade,precoUnit:candidato.precoUnit,confianca:Number(m.confianca||0),justificativa:String(m.justificativa||"").slice(0,400)}
        : {itemId:m.itemId,status:"pendente",confianca:Number(m.confianca||0),justificativa:String(m.justificativa||"Nenhum candidato tecnicamente adequado.").slice(0,400)};
    });
    return res.status(200).json({ok:true,matches});
  }

  if(req.body?.action==="status")return res.status(200).json({ok:true,...safeStatus(aiConfig)});
  if(req.body?.action==="configure"){
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});
    const newApiKey=String(req.body?.apiKey||"").trim();
    if(newApiKey.length<20)return res.status(400).json({error:"Informe uma chave de API válida do Gemini."});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    let validation;
    try{
      validation=await geminiRequest(newApiKey,DEFAULT_MODEL,{contents:[{role:"user",parts:[{text:"Responda apenas OK."}]}],generationConfig:{maxOutputTokens:24,temperature:0}},controller.signal);
    }catch(error){
      if(error?.name==="AbortError")return res.status(504).json({error:"O Gemini demorou para responder. Tente validar novamente."});
      throw error;
    }finally{clearTimeout(timeout);}
    const body=await validation.json().catch(()=>({}));
    const providerError=providerErrorFrom(body),providerMessage=providerMessageFrom(body);
    if(isInvalidKey(validation.status,providerMessage))return res.status(400).json({error:"O Google recusou a chave. Confira se você copiou o valor completo da chave da API Gemini.",errorCode:providerError.status||"API_KEY_INVALID"});
    if(validation.status===429){
      const warning="Chave Gemini salva, mas a cota gratuita ou o limite temporário da API foi atingido.";
      let saved;
      try{saved=await saveConfig({apiKey:newApiKey,user,validationStatus:"rate_limit",validationMessage:warning});}
      catch(error){console.error("Gemini validado, mas não foi possível salvar a configuração:",error);return res.status(500).json({error:"A chave foi reconhecida pelo Google, mas não foi possível salvá-la no banco do ArcD."});}
      return res.status(200).json({ok:true,configured:true,operational:false,provider:"gemini",source:"admin",warning,errorCode:providerError.status||"RESOURCE_EXHAUSTED",...saved});
    }
    if(!validation.ok){
      const detalhe=providerMessage.slice(0,300);
      return res.status(400).json({error:detalhe?`O Gemini recusou o teste: ${detalhe}`:"Não foi possível validar a chave com o Gemini agora.",errorCode:providerError.status||"validation_failed"});
    }
    let saved;
    try{saved=await saveConfig({apiKey:newApiKey,user});}
    catch(error){console.error("Gemini validado, mas não foi possível salvar a configuração:",error);return res.status(500).json({error:"A chave foi validada pelo Google, mas não foi possível salvá-la no banco do ArcD."});}
    return res.status(200).json({ok:true,configured:true,operational:true,provider:"gemini",source:"admin",...saved});
  }
  if(req.body?.action==="remove"){
    if(user.role!=="admin")return res.status(403).json({error:"Somente o administrador pode configurar a IA."});
    await removeConfig();
    return res.status(200).json({ok:true,...safeStatus(await loadConfig())});
  }

  const apiKey=aiConfig.apiKey;
  if(!apiKey)return res.status(503).json({error:"O Modo IA ainda não foi configurado pelo administrador.",code:"AI_NOT_CONFIGURED"});
  if(aiRateLimited(user.id))return res.status(429).json({
    error:"Muitas solicitações de IA em pouco tempo. Aguarde alguns minutos e tente novamente.",
    code:"AI_RATE_LIMIT_LOCAL",
  });

  try{
    const {messages,contexto,prompt,question,context,imagens,documentos,modulo}=req.body||{};
    const moduloAtivo=normalizeModule(modulo||contexto?.modulo||context?.modulo);
    const recebidas=Array.isArray(messages)&&messages.length?messages:(prompt||question)?[{role:"user",content:String(prompt||question)}]:[];
    if(!recebidas.length)return res.status(400).json({error:"Nenhuma mensagem recebida."});
    const historico=recebidas.slice(-12).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:String(m.content??m.text??"").slice(0,12000)}]}));
    const imagensValidas=(Array.isArray(imagens)?imagens:[]).slice(0,6).map(img=>{const match=String(img?.dataUrl||"").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);return match?{mediaType:match[1],data:match[2],legenda:String(img?.legenda||"").slice(0,300)}:null;}).filter(Boolean);
    const documentosValidos=(Array.isArray(documentos)?documentos:[]).slice(0,3).map(doc=>{const match=String(doc?.dataUrl||"").match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/);return match?{mediaType:match[1],data:match[2],nome:String(doc?.nome||"documento.pdf").slice(0,180)}:null;}).filter(Boolean);
    if(imagensValidas.length||documentosValidos.length){
      let ultima=[...historico].map((item,index)=>({item,index})).reverse().find(({item})=>item.role==="user")?.index;
      if(ultima===undefined){historico.push({role:"user",parts:[{text:"Analise os anexos enviados."}]});ultima=historico.length-1;}
      historico[ultima].parts.push(...imagensValidas.flatMap((img,index)=>[{text:`Foto ${index+1}${img.legenda?` — nome/legenda original (também pode identificar a obra): ${img.legenda}`:""}`},{inlineData:{mimeType:img.mediaType,data:img.data}}]),...documentosValidos.flatMap((doc,index)=>[{text:`Documento PDF ${index+1}. Nome original do arquivo, que deve ser tratado como evidência para identificar a obra: ${doc.nome}`},{inlineData:{mimeType:doc.mediaType,data:doc.data}}]));
    }
    const system=[
      "Você é o assistente corporativo da ARCD Construtech, empresa de gestão de obras em Caruaru/PE.",
      `Módulo ativo: ${moduloAtivo}. ${MODULE_POLICIES[moduloAtivo]}`,
      "Responda em português do Brasil como um especialista humano e colaborativo: explique brevemente o motivo, indique a incerteza e proponha a próxima ação.",
      "Use SOMENTE os dados fornecidos no contexto e nos anexos. Se um número não estiver disponível, diga que não tem o dado; nunca invente valores financeiros, medições, custos, pessoas, obras ou códigos.",
      "Quando precisar identificar uma obra, escolha somente um ID presente na lista recebida. Compare primeiro o nome original do arquivo e depois o conteúdo do documento. Se houver ambiguidade, devolva o campo vazio e explique a dúvida.",
      (contexto||context)?`\n\nDados atuais do sistema:\n${JSON.stringify(contexto||context).slice(0,24000)}`:"",
    ].join(" ");
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),55000);
    let response;
    const temperatura=["compras","financeiro","dre","orcamento","planejamento"].includes(moduloAtivo)?0.12:0.22;
    const maxOutputTokens=moduloAtivo==="dre"?5200:2200;
    try{response=await geminiRequest(apiKey,aiConfig.model,{systemInstruction:{parts:[{text:system}]},contents:historico,generationConfig:{maxOutputTokens,temperature:temperatura}},controller.signal);}
    finally{clearTimeout(timeout);}
    if(!response.ok){
      const body=await response.json().catch(()=>({})),providerError=providerErrorFrom(body),providerMessage=providerMessageFrom(body);
      console.error("Gemini respondeu erro:",response.status,providerMessage.slice(0,500));
      if(isInvalidKey(response.status,providerMessage))return res.status(502).json({error:"A autenticação do Gemini precisa ser atualizada pelo administrador.",code:"AI_AUTH_INVALID"});
      if(response.status===429)return res.status(429).json({error:"A cota gratuita ou o limite temporário do Gemini foi atingido. Tente novamente mais tarde.",code:"AI_RATE_LIMIT"});
      if(response.status===400&&/model.*not found|not supported/i.test(providerMessage))return res.status(502).json({error:"O modelo Gemini configurado não está disponível para esta chave. Atualize o modelo no ambiente.",code:"AI_MODEL_UNAVAILABLE"});
      return res.status(502).json({error:"O serviço Gemini não respondeu.",code:providerError.status||"AI_PROVIDER_ERROR"});
    }
    const body=await response.json();
    const texto=(body.candidates?.[0]?.content?.parts||[]).map(part=>part.text||"").join("\n").trim();
    if(!texto){
      const motivo=body.promptFeedback?.blockReason||body.candidates?.[0]?.finishReason||"sem conteúdo";
      return res.status(422).json({error:`O Gemini não gerou uma resposta (${motivo}). Revise os anexos e tente novamente.`,code:"AI_EMPTY_RESPONSE"});
    }
    return res.status(200).json({reply:texto,answer:texto,modulo:moduloAtivo});
  }catch(error){
    console.error("Falha na rota /api/ai-agent:",error);
    if(error?.name==="AbortError")return res.status(504).json({error:"A análise demorou além do limite. Reduza os anexos e tente novamente."});
    return res.status(500).json({error:"Erro interno."});
  }
}
