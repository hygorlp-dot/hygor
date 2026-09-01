// ═══════════════════════════════════════════════════════════════════
// src/api.js — substitui o supabase.js no frontend
//
// Repare no que NÃO tem aqui: nenhuma URL de banco, nenhuma chave, nenhum
// import do @supabase/supabase-js. O navegador não sabe onde fica o banco,
// e é assim que tem que ser.
//
// Tudo passa por /api/data, que roda no servidor e guarda a chave forte.
// A credencial do usuário é o PIN — conferido lá, não aqui.
// ═══════════════════════════════════════════════════════════════════

const ROTA = "/api/data";

// Guardado só em memória (não em localStorage): fechou a aba, tem que
// digitar o PIN de novo. Se ficasse no disco, quem pegasse o celular
// destravado entrava sem PIN.
let sessao = { userId: null, pin: null, accessToken: null, refreshToken: null, sessionId: null };
try { sessao={...sessao,...JSON.parse(sessionStorage.getItem("arcd_auth_session")||"{}")}; } catch (_) {}
let ultimoUpdatedAt = null;
let renovacaoEmCurso = null;
let presenceAuthBlocked = false;

const novaSessaoId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const abrirSessao = (userId, pin) => {
  sessao = { userId, pin, accessToken:null,refreshToken:null,sessionId: novaSessaoId() };
  presenceAuthBlocked=false;
};

const abrirSessaoEmail=(userId,accessToken,refreshToken)=>{
  sessao={userId,pin:null,accessToken,refreshToken,sessionId:novaSessaoId()};
  presenceAuthBlocked=false;
  try{sessionStorage.setItem("arcd_auth_session",JSON.stringify(sessao));}catch(_){}
};

const credenciais=()=>({userId:sessao.userId,pin:sessao.pin,accessToken:sessao.accessToken});

// O conteúdo do JWT é usado somente para saber se vale a pena renová-lo antes
// de baixar o dataset. A autorização real continua sendo feita pelo Supabase
// no servidor; isto evita iniciar uma carga grande com um token já vencido.
const tokenExpiraEmBreve = (token, margemSegundos=30) => {
  try {
    const parte=String(token||"").split(".")[1];
    if(!parte)return true;
    const base64=parte.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(parte.length/4)*4,"=");
    const exp=Number(JSON.parse(atob(base64))?.exp||0);
    return !exp || exp*1000 <= Date.now()+margemSegundos*1000;
  } catch (_) { return true; }
};

const renovarSessaoEmail = async () => {
  if(!sessao.refreshToken)return false;
  if(renovacaoEmCurso)return renovacaoEmCurso;
  renovacaoEmCurso=(async()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(ROTA,{
        method:"POST",signal:controller.signal,
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"auth-refresh",refreshToken:sessao.refreshToken}),
      });
      const refreshed=await response.json().catch(()=>({}));
      if(!response.ok||!refreshed.accessToken)return false;
      sessao={...sessao,accessToken:refreshed.accessToken,refreshToken:refreshed.refreshToken||sessao.refreshToken};
      presenceAuthBlocked=false;
      try{sessionStorage.setItem("arcd_auth_session",JSON.stringify(sessao));}catch(_){}
      return true;
    }catch{return false;}
    finally{window.clearTimeout(timer);}
  })();
  try{return await renovacaoEmCurso;}
  finally{renovacaoEmCurso=null;}
};

const fecharSessao = () => {
  sessao = { userId: null, pin: null, accessToken:null,refreshToken:null,sessionId:null };
  presenceAuthBlocked=false;
  try{sessionStorage.removeItem("arcd_auth_session");}catch(_){}
  ultimoUpdatedAt = null;
};

export const temSessao = () => {
  return !!sessao.userId && (!!sessao.pin || !!sessao.accessToken);
};

const chamar = async (body) => {
  const requisitar = async payload => {
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),45000);
    try {
      return await fetch(ROTA, {
        method: "POST", signal:controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } finally { window.clearTimeout(timer); }
  };
  let r;
  try { r=await requisitar(body); }
  catch(error) {
    return { status:0, error:error?.name==="AbortError"
      ? "O servidor demorou mais de 45 segundos para responder. Verifique a conexão e tente novamente."
      : "Não foi possível conectar ao servidor." };
  }
  if(r.status===401&&sessao.refreshToken&&!String(body.action||"").startsWith("auth-")){
    if(await renovarSessaoEmail()) {
      try { r=await requisitar({...body,accessToken:sessao.accessToken}); }
      catch(error) { return {status:0,error:error?.name==="AbortError"?"O servidor demorou mais de 45 segundos para responder. Tente novamente.":"Não foi possível conectar ao servidor."}; }
    }
  }
  const json = await r.json().catch(() => ({}));
  const retryAfterHeader=Number(r.headers?.get?.("retry-after")||0);
  return {
    status:r.status,...json,
    retryAfter:Number((json.retryAfter??json.retry_after_seconds??retryAfterHeader)||0),
  };
};

// Rotas serverless que também precisam reconhecer o operador. Centralizar
// aqui evita que cada tela esqueça o PIN/token e garante renovação da sessão
// de e-mail antes de repetir a requisição.
const chamarRotaAutenticada = async (rota, payload = {}) => {
  if (!temSessao()) return { ok:false, status:401, error:"Sessão encerrada." };
  if(sessao.accessToken&&sessao.refreshToken&&tokenExpiraEmBreve(sessao.accessToken)){
    await renovarSessaoEmail();
  }
  const executar = async () => {
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(rota,{
        method:"POST",signal:controller.signal,
        headers:{"content-type":"application/json"},
        body:JSON.stringify({...credenciais(),...payload}),
      });
      return {response};
    }catch(error){
      return {error:error?.name==="AbortError"
        ?"O servidor demorou mais de 45 segundos para responder."
        :"Não foi possível conectar ao servidor."};
    }finally{window.clearTimeout(timer);}
  };
  let tentativa=await executar();
  if(!tentativa.response)return {ok:false,status:0,error:tentativa.error};
  let response=tentativa.response;
  if (response.status === 401 && sessao.refreshToken) {
    if(await renovarSessaoEmail()){
      tentativa=await executar();
      if(!tentativa.response)return {ok:false,status:0,error:tentativa.error};
      response=tentativa.response;
    }
  }
  const json=await response.json().catch(()=>({}));
  return { ok:response.ok, status:response.status, ...json };
};

export const chamarIA = payload => chamarRotaAutenticada("/api/ai-agent", payload);
export const verificarStatusIA = () => chamarRotaAutenticada("/api/ai-agent", { action:"status" });
export const configurarGemini = apiKey => chamarRotaAutenticada("/api/ai-agent", { action:"configure", apiKey });
export const removerConfiguracaoIA = () => chamarRotaAutenticada("/api/ai-agent", { action:"remove" });
export const consultarCNPJReceita = cnpj => chamarRotaAutenticada("/api/cnpj", { cnpj });
export const buscarResumoDiario = () => chamarRotaAutenticada("/api/ai-agent", { action:"daily-brief" });
export const executarComandoFinanceiro = command => chamar({ action:"financial-command", ...credenciais(), command });
export const executarComandoOperacional = command => chamar({ action:"operational-command", ...credenciais(), command });
export const executarComandoConciliacao = command => chamar({ action:"reconciliation-command", ...credenciais(), command });
export const executarComandoPonto = command => chamar({ ...credenciais(), ...command });
export const consultarSombraFinanceira = () => chamar({ action:"financial-shadow-report", ...credenciais() });
// CORE-001 (Fase 2, cadastro em modo sombra) - até 01/09/2026 esta ação só
// era consultada por scripts/check-core-registry-shadow-status.mjs; ver
// NucleoRelacionalAdmin.jsx (docs/BLUEPRINT_CONCORRENCIA_TRAVA.md) para o
// primeiro consumidor real dentro do app.
export const consultarNucleoRelacionalSombra = () => chamar({ action:"core-registry-report", ...credenciais() });
export const prepararSombraFinanceira = () => chamar({ action:"financial-shadow-migrate", ...credenciais() });
export const sincronizarSombraFinanceira = () => chamar({ action:"financial-shadow-sync", ...credenciais() });
export const consultarDreCanonico = ({year,month,period="mes",obraId=""}) =>
  chamar({ action:"financial-dre-report", ...credenciais(), year, month, period, obraId });
export const consultarDreEmpresaCanonico = ({year,month}) =>
  chamar({ action:"financial-company-dre-report", ...credenciais(), year, month, period:"mes" });
export const gerenciarAcessoPortalCliente = payload =>
  chamar({ action:"client-portal-admin", ...credenciais(), ...payload });

// ── Tela de login: quem existe? ────────────────────────────────────
// Devolve só nome e papel. O hash do PIN nunca sai do servidor.
export const listarPerfis = async () => {
  const r = await chamar({ action: "profiles" });
  if (r.status !== 200) return { usuarios: [], precisaSetup: false, erro: r.error || "Não foi possível carregar o acesso ao banco." };
  return { usuarios: r.usuarios || [], precisaSetup: !!r.precisaSetup };
};

// ── Primeiro acesso ────────────────────────────────────────────────
export const criarPrimeiroAdmin = async (payload) => {
  const r = await chamar({ action: "setup", payload });
  if (r.status !== 200) return { ok: false, erro: r.error };
  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, data: r.data };
};

// ── Entrar (o PIN é conferido no servidor) ─────────────────────────
export const entrarComPin = async (userId, pin) => {
  const r = await chamar({ action: "load", userId, pin });

  if (r.status === 429) return { ok: false, erro: r.error || "Muitas tentativas." };
  if (r.status === 401) return { ok: false, erro: "PIN incorreto." };
  if (r.status !== 200)  return { ok: false, erro: r.error || "Falha ao entrar." };
  if (!r.data || !r.usuario?.id) {
    return { ok:false, erro:"O servidor devolveu uma resposta de autenticação inválida. Tente novamente." };
  }

  abrirSessao(userId, pin);
  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, data: r.data, usuario: r.usuario };
};

export const entrarComEmail = async (email,password) => {
  const r=await chamar({action:"auth-login",email,password});
  if(r.status!==200)return{ok:false,erro:r.error||"E-mail ou senha inválidos."};
  if(!r.data||!r.usuario?.id||!r.accessToken){
    return{ok:false,erro:"O servidor devolveu uma resposta de autenticação inválida. Tente novamente."};
  }
  abrirSessaoEmail(r.usuario.id,r.accessToken,r.refreshToken);
  ultimoUpdatedAt=r.updatedAt||null;
  return{ok:true,data:r.data,usuario:r.usuario};
};

export const restaurarSessaoEmail=async()=>{
  if(!sessao.accessToken)return{ok:false};
  if(tokenExpiraEmBreve(sessao.accessToken)&&!await renovarSessaoEmail())return{ok:false};
  const r=await chamar({action:"load",...credenciais()});
  if(r.status!==200)return{ok:false};
  ultimoUpdatedAt=r.updatedAt||null;
  return{ok:true,data:r.data,usuario:r.usuario};
};

// ── Recarregar ─────────────────────────────────────────────────────
const loadData = async () => {
  if (!temSessao()) return null;
  const r = await chamar({ action: "load", ...credenciais() });
  if (r.status !== 200) return null;
  ultimoUpdatedAt = r.updatedAt || null;
  return r.data;
};

// ── Salvar ─────────────────────────────────────────────────────────
export const saveDataDetailed = async (payload,basePayload=null) => {
  if (!temSessao()) return { ok: false, conflict: false, reason: "Sessão encerrada." };
  // Ponto e auditoria possuem comandos autoritativos próprios. Excluí-los
  // daqui impede que um snapshot antigo substitua lançamentos ou histórico.
  const commandOnlyKeys=new Set([
    "attendance","attendanceLocks","unlockRequests","dailyCheckDate",
    "attendanceOperationReceipts","operationalCommandReceipts","changeLog",
  ]);
  const safePayload=Object.fromEntries(Object.entries(payload||{}).filter(([key])=>!commandOnlyKeys.has(key)));
  const safeBase=basePayload
    ?Object.fromEntries(Object.entries(basePayload||{}).filter(([key])=>!commandOnlyKeys.has(key)))
    :null;

  // Depois da primeira carga existe uma base confirmada. Nesse caso enviamos
  // apenas as coleções de primeiro nível que realmente mudaram. Isso reduz o
  // corpo da requisição, evita reenviar fotos/metadados de módulos intocados e
  // permite ao servidor combinar usuários trabalhando em setores diferentes.
  const chaves = safeBase
    ? [...new Set([...Object.keys(safeBase),...Object.keys(safePayload)])]
        .filter(k => JSON.stringify(safeBase?.[k]) !== JSON.stringify(safePayload?.[k]))
    : [];
  const porSecoes = !!safeBase && chaves.length > 0;
  if (safeBase && !chaves.length) return { ok:true, conflict:false, unchanged:true, updatedAt:ultimoUpdatedAt };
  const sections = porSecoes ? Object.fromEntries(chaves.map(k=>[k,safePayload[k]])) : undefined;
  const baseSections = porSecoes ? Object.fromEntries(chaves.map(k=>[k,safeBase[k]])) : undefined;

  const r = await chamar(porSecoes ? {
    action:"save-sections",...credenciais(),sections,baseSections,
    expectedUpdatedAt:ultimoUpdatedAt,
  } : {
    action:"save",...credenciais(),payload:safePayload,basePayload:safeBase,
    expectedUpdatedAt:ultimoUpdatedAt,
  });

  if (r.status === 409 && r.conflict) {
    const detalhe = {
      ok: false, conflict: true,
      reason: r.reason,
      currentData: r.currentData,
      currentUpdatedAt: r.currentUpdatedAt,
      rejectedPayload: safePayload,     // o que VOCÊ fez não se perde
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("arcd:data-conflict", { detail: detalhe }));
    }
    return detalhe;
  }

  if (r.status !== 200) return {
    ok:false,
    conflict:false,
    status:r.status,
    code:r.code || "",
    retryAfter:Number(r.retryAfter||0),
    reason:r.error || "Falha ao salvar.",
  };

  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, conflict: false, merged:!!r.merged, data:r.data, savedSections:r.savedSections||chaves, updatedAt: ultimoUpdatedAt };
};

export const provisionarContaEmail=async(targetUserId,password)=>{
  const r=await chamar({action:"auth-provision",...credenciais(),targetUserId,password});
  if(r.status!==200)return{ok:false,erro:r.error||"Falha ao ativar a conta."};
  ultimoUpdatedAt=r.updatedAt||ultimoUpdatedAt;
  return{ok:true,data:r.data,updatedAt:r.updatedAt};
};

export const definirPinOperador=async(targetUserId,newPin)=>{
  const r=await chamar({action:"auth-pin-set",...credenciais(),targetUserId,newPin});
  if(r.status!==200)return{ok:false,erro:r.error||"Não foi possível definir o PIN."};
  ultimoUpdatedAt=r.updatedAt||ultimoUpdatedAt;
  return{ok:true,data:r.data,updatedAt:r.updatedAt};
};

// Depois de um conflito: adota a versão do servidor como base
export const adoptServerVersion = (updatedAt) => { ultimoUpdatedAt = updatedAt || null; };

export const loadDataWithMeta = async () => {
  const data = await loadData();
  return { data, updatedAt: ultimoUpdatedAt };
};

export const logout = fecharSessao;

// ── Presença on-line ───────────────────────────────────────────────
// Cada aba usa um sessionId próprio e grava em uma linha separada do dataset.
const chamarPresenca = async (action, extra = {}, keepalive = false) => {
  if (!temSessao()) return { ok: false, erro: "Sessão encerrada." };
  if(presenceAuthBlocked)return {
    ok:false,status:401,erro:"A presença on-line aguardará a renovação da sessão.",suspended:true,
  };
  const payload={action,sessionId:sessao.sessionId,...extra};
  if(keepalive){
    try{
      const response=await fetch("/api/presence",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({...credenciais(),...payload}),
        keepalive:true,
      });
      if(response.status===401)presenceAuthBlocked=true;
      const json=await response.json().catch(()=>({}));
      return {ok:response.ok,status:response.status,erro:json.error,...json};
    }catch{
      return {ok:false,status:0,erro:"Não foi possível atualizar a presença."};
    }
  }
  const result=await chamarRotaAutenticada("/api/presence",payload);
  if(result.status===401)presenceAuthBlocked=true;
  if(result.ok)presenceAuthBlocked=false;
  return {...result,erro:result.error};
};

const descricaoDispositivo = () => {
  if (typeof navigator === "undefined") return "Dispositivo";
  const ua = navigator.userAgent || "";
  const tipo = /tablet|ipad/i.test(ua) ? "Tablet" : /mobile|android|iphone/i.test(ua) ? "Celular" : "Computador";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${tipo} · ${navegador}`;
};

export const registrarPresenca = tab => chamarPresenca("heartbeat", {
  tab: tab || "home",
  device: descricaoDispositivo(),
});

export const encerrarPresenca = (keepalive = false) => chamarPresenca("offline", {}, keepalive);

export const listarPresencas = async () => {
  const r = await chamarPresenca("list");
  if (!r.ok) return { ok: false, erro: r.erro, presencas: [] };
  return { ok: true, presencas: r.presencas || [], serverTime: r.serverTime };
};

// ── Chat interno da empresa e ranking (ajustes manuais) ─────────────
// Dividem o endpoint /api/presence (dispatch por "action") em vez de cada um
// ganhar seu próprio arquivo - o Hobby plan do Vercel tem um teto de 12
// Serverless Functions por deployment.
const novaOperacaoId=()=>globalThis.crypto?.randomUUID?.()
  || `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const enviarMensagemChat = (texto, { mentions = [], attachment = null } = {}) => chamarRotaAutenticada("/api/presence", {
  action:"chat-send",text:texto,mentions,attachment,operationId:novaOperacaoId(),
});
export const listarMensagensChat = () => chamarRotaAutenticada("/api/presence", { action: "chat-list" });
// Anexo de chat: sobe pro Storage num caminho próprio ("chat/"), sem exigir
// obra (o chat é da empresa toda) e aceitando mais tipos que a foto do diário.
export const subirAnexoChat = async ({ dataUrl, ext }) => {
  if (!temSessao()) return { ok: false, error: "Sem sessão." };
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...credenciais(), dataUrl, ext, folder: "chat" }),
  });
  const j = await r.json().catch(() => ({ error: "Falha no upload." }));
  return { ok: r.ok && j.ok !== false && !j.error, ...j };
};
export const apagarMensagemChat = messageId => chamarRotaAutenticada("/api/presence", { action: "chat-delete", messageId });
export const silenciarUsuarioChat = targetUserId => chamarRotaAutenticada("/api/presence", { action: "chat-mute", targetUserId });
export const dessilenciarUsuarioChat = targetUserId => chamarRotaAutenticada("/api/presence", { action: "chat-unmute", targetUserId });

export const listarAjustesRanking = () => chamarRotaAutenticada("/api/presence", { action: "ranking-list" });
export const adicionarAjusteRanking = (targetUserId, pontos, motivo) =>
  chamarRotaAutenticada("/api/presence", {
    action:"ranking-add",targetUserId,pontos,motivo,operationId:novaOperacaoId(),
  });
export const removerAjusteRanking = adjustmentId => chamarRotaAutenticada("/api/presence", { action: "ranking-remove", adjustmentId });

// ── Quinzenas arquivadas ──────────────────────────────────────────
// Quinzena finalizada e paga sai do JSON principal e vira linha propria no
// banco. As acoes que ALTERAM o principal (arquivar/restaurar) devolvem o
// dataset novo + carimbo, que o app adota como base (sem re-salvar).
export const arquivarQuinzena = async (archive) => {
  if (!temSessao()) return { ok: false, erro: "Sessão encerrada." };
  const r = await chamar({ action: "archive-quinzena", ...credenciais(), archive });
  if (r.status !== 200) return { ok: false, erro: r.error || "Falha ao arquivar." };
  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, data: r.data, updatedAt: r.updatedAt, meta: r.meta };
};

export const restaurarQuinzena = async (quinzenaId) => {
  if (!temSessao()) return { ok: false, erro: "Sessão encerrada." };
  const r = await chamar({ action: "restore-quinzena", ...credenciais(), quinzenaId });
  if (r.status !== 200) return { ok: false, erro: r.error || "Falha ao restaurar." };
  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, data: r.data, updatedAt: r.updatedAt, devolvidos: r.devolvidos, mantidos: r.mantidos };
};

export const carregarQuinzenaArquivada = async (quinzenaId) => {
  if (!temSessao()) return { ok: false, erro: "Sessão encerrada." };
  const r = await chamar({ action: "load-quinzena-archive", ...credenciais(), quinzenaId });
  if (r.status !== 200) return { ok: false, erro: r.error || "Falha ao carregar o arquivo." };
  return { ok: true, arquivo: r.arquivo, updatedAt: r.updatedAt };
};

// ── Bases de referência do orçamento ─────────────────────────────
// SINAPI é persistido em lotes; ORSE guarda a competência e pesquisa a
// base pública oficial pelo servidor. O PIN nunca sai deste módulo.
const chamarReferencias = async (action, payload = {}) => {
  if (!temSessao()) return { ok: false, error: "Sessão encerrada." };
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),60000);
  let r;
  try { r=await fetch("/api/references", {
    method: "POST", signal:controller.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...credenciais(), ...payload }),
  }); } catch(error) {
    return {ok:false,status:0,error:error?.name==="AbortError"?"A importação não recebeu resposta em 60 segundos. Verifique a conexão e tente novamente.":"Não foi possível falar com o servidor de referências."};
  } finally { window.clearTimeout(timer); }
  const json = await r.json().catch(() => ({}));
  if (!r.ok && !json.error) {
    json.error = r.status === 404
      ? "A rota /api/references não foi publicada no servidor."
      : `Falha na base de referência (HTTP ${r.status}).`;
  }
  return { ok: r.ok, status: r.status, ...json };
};

export const listarBasesReferencia = async () => chamarReferencias("list");
export const iniciarBaseReferencia = async meta => chamarReferencias("begin", { meta });
export const enviarLoteReferencia = async (baseId, items) => chamarReferencias("chunk", { baseId, items });
export const enviarLoteInsumosReferencia = async (baseId, items) => chamarReferencias("input-chunk", { baseId, items });
export const enviarLoteComponentesReferencia = async (baseId, items) => chamarReferencias("component-chunk", { baseId, items });
export const finalizarBaseReferencia = async baseId => chamarReferencias("finish", { baseId });
export const pesquisarBasesReferencia = async (referenceIds, query) => chamarReferencias("search", { referenceIds, query });
export const pesquisarInsumosReferencia = async (referenceIds, query, itemType = "TODOS") =>
  chamarReferencias("search-inputs", { referenceIds, query, itemType });
export const resolverCodigosReferencia = async (referenceIds, entries) => chamarReferencias("resolve", { referenceIds, entries });
export const detalharComposicoesReferencia = async (referenceIds, entries) => chamarReferencias("composition-details", { referenceIds, entries });
export const removerBaseReferencia = async baseId => chamarReferencias("delete", { baseId });

// ── Sobe foto do diário de obra ───────────────────────────────────
// A foto já vem comprimida do cliente. Reutiliza o PIN da sessão em memória.
export const subirFoto = async ({ dataUrl, obraId, ext }) => {
  if (!temSessao()) return { error: "Sem sessão." };
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...credenciais(), dataUrl, obraId, ext }),
  });
  return await r.json().catch(() => ({ error: "Falha no upload." }));
};

// ── OneDrive / Microsoft Graph ────────────────────────────────────
export const conectarOneDrive = async () => {
  if (!temSessao()) return {ok:false,error:"Sessão encerrada."};
  const r=await fetch("/api/microsoft/connect",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(credenciais())});
  const j=await r.json().catch(()=>({})); if(r.ok&&j.url)window.location.href=j.url; return {ok:r.ok,...j};
};
const chamarOneDrive = async (action, payload = {}) => {
  if (!temSessao()) return { ok:false, error:"Sessão encerrada." };
  const r = await fetch("/api/microsoft/onedrive", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...credenciais(), ...payload }),
  });
  const json = await r.json().catch(() => ({}));
  return { ok:r.ok, status:r.status, ...json };
};
export const statusOneDrive = () => chamarOneDrive("status");
export const criarEstruturaOneDrive = obraName => chamarOneDrive("create-workspace", { obraName });
export const sincronizarEstruturasOneDrive = obras => chamarOneDrive("sync-workspaces", { obras });
export const criarPastaOneDrive = payload => chamarOneDrive("create-folder", payload);
export const listarPastaOneDrive = payload => chamarOneDrive("list-folder", payload);
export const enviarArquivoOneDrive = payload => chamarOneDrive("upload", payload);
export const obterLinkArquivoOneDrive = payload => chamarOneDrive("file-link", payload);
