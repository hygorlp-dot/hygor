// ═══════════════════════════════════════════════════════════════════
// /api/data — a única porta de entrada para o banco
//
// POR QUE ISTO EXISTE
//
// Sem o login do Supabase, a alternativa "óbvia" seria o navegador falar
// direto com o banco usando a anon key. Só que a anon key está no bundle
// JavaScript — é pública. Qualquer pessoa abre o DevTools em
// pontosarcd.vercel.app, copia, e baixa CPF, PIX, salário e contrato de
// todo mundo. Nenhuma trava no App.jsx impede isso, porque o atacante nem
// usa o seu app: fala direto com o Supabase.
//
// A saída é o navegador NUNCA tocar no banco. Ele fala com esta função, que
// roda no servidor do Vercel e guarda a SERVICE_ROLE_KEY — chave que nunca
// chega ao navegador.
//
// E o PIN, que antes era só uma tela, vira credencial de verdade: é
// conferido AQUI, no servidor. Sem PIN válido, esta função não devolve dado.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { compactProfiles, decodeAppData, encodeAppData, isEncodedAppData } from "../server/data-codec.js";
import { normalizeArchivedCosts, summarizeArchivedCosts } from "../server/archived-costs.js";
import { validatePurchaseChanges } from "../server/permission-policies.js";
import { backupKeyFromEnv, createBackupBundle, verifyBackupBundle } from "../server/backup.js";
import { projectDataForUser, publicUser } from "../server/data-projection.js";
import { authorizeSectionChanges, validateNoPhysicalDeletes } from "../server/section-authorizations.js";
import { buildLegacyFinancialFacts, compareDreProjectionRows, compareFinancialScopes, summarizeCanonicalFinancialRows, summarizeLegacyFinancialFacts } from "../server/financial-shadow.js";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { getOrCreateFolder, graph, refresh, rootItem } from "./microsoft/_graph.js";

const URL     = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;   // sem REACT_APP_ — server-side
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY     = "arced_ponto_v1";
const PROFILE_KEY = "arced_auth_profiles_v1";
// Ativação somente após executar a migração canônica e concluir a comparação
// em sombra. Evita quebrar instalações legadas durante a transição.
const FINANCIAL_ENGINE_ENFORCE = process.env.FINANCIAL_ENGINE_ENFORCE === "true";
const FINANCIAL_LEGACY_SECTIONS = new Set([
  "payments","medicoes","outrasDesp","despesasEmpresa","caixaObra","transacoes",
  "notasFiscais","pedidos","pagsTerceiros","medicoesTerc","pagamentosFolha",
  "titulosFolha","reconciliationLinks","rescisoes","comercial",
  "attendance","employees","archivedLaborCosts","config","obras",
  "equipamentos","locacoesEquip","manutencoesEquip",
]);
const FINANCIAL_COMMANDS = new Set(["CREATE_FINANCIAL_TITLE","REGISTER_SETTLEMENT","REVERSE_SETTLEMENT","CLOSE_ACCOUNTING_PERIOD"]);
const FINANCIAL_COMMAND_ROLES = {
  CREATE_FINANCIAL_TITLE:["admin","financeiro"], REGISTER_SETTLEMENT:["admin","financeiro"],
  REVERSE_SETTLEMENT:["admin","financeiro"], CLOSE_ACCOUNTING_PERIOD:["admin"],
};
const OPERATIONAL_COMMAND_ROLES = {
  [OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED]:["admin","compras","financeiro"],
};
const BACKUP_FOLDER="00 - Backups ARCD";
const cronAutorizado=req=>!!process.env.CRON_SECRET&&req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`;

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const listarLinhasBackup=async()=>{
  const rows=[];let from=0;
  while(true){const {data,error}=await db.from("company_app_data").select("key,value,updated_at").eq("company_id",COMPANY).range(from,from+999);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)break;from+=1000;}
  return rows.filter(row=>row.key!=="onedrive_auth_v1");
};
const pastaBackup=async token=>{const root=await rootItem(token),driveId=root.parentReference.driveId;return{driveId,folder:await getOrCreateFolder(token,driveId,root.id,BACKUP_FOLDER)};};
const enviarBufferBackup=async(token,driveId,parentId,name,buffer,contentType)=>{
  const session=await (await graph(token,`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(name)}:/createUploadSession`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({item:{"@microsoft.graph.conflictBehavior":"fail",name}})})).json();
  const chunkSize=5*320*1024;
  for(let start=0;start<buffer.length;start+=chunkSize){const end=Math.min(buffer.length,start+chunkSize)-1;const r=await fetch(session.uploadUrl,{method:"PUT",headers:{"Content-Length":String(end-start+1),"Content-Range":`bytes ${start}-${end}/${buffer.length}`,"Content-Type":contentType},body:buffer.subarray(start,end+1)});if(!r.ok&&r.status!==202)throw new Error(`Falha ao enviar backup ao OneDrive (${r.status}).`);}
};
const criarBackupOneDrive=async(req,actor)=>{
  const key=backupKeyFromEnv(process.env.BACKUP_ENCRYPTION_KEY),{accessToken}=await refresh(req),{driveId,folder}=await pastaBackup(accessToken),now=new Date().toISOString(),name=`arcd-${now.replace(/[:.]/g,"-")}.arcdbackup`;
  const bundle=createBackupBundle({companyId:COMPANY,rows:await listarLinhasBackup(),now,key});const manifest={...bundle.manifest,actor,encryptedFile:name,bytes:bundle.body.length,excludedKeys:["onedrive_auth_v1"]};
  await enviarBufferBackup(accessToken,driveId,folder.id,name,bundle.body,"application/octet-stream");
  await enviarBufferBackup(accessToken,driveId,folder.id,`${name}.manifest.json`,Buffer.from(JSON.stringify(manifest,null,2)),"application/json");
  return{ok:true,name,recordCount:manifest.recordCount,sha256:manifest.sha256,bytes:manifest.bytes,createdAt:now};
};
const verificarBackupOneDrive=async req=>{
  const key=backupKeyFromEnv(process.env.BACKUP_ENCRYPTION_KEY),{accessToken}=await refresh(req),{driveId,folder}=await pastaBackup(accessToken);
  const children=(await (await graph(accessToken,`/drives/${driveId}/items/${folder.id}/children?$select=id,name,lastModifiedDateTime,size,file`)).json()).value||[];
  const manifestItem=children.filter(item=>item.file&&item.name.endsWith(".arcdbackup.manifest.json")).sort((a,b)=>String(b.lastModifiedDateTime).localeCompare(String(a.lastModifiedDateTime)))[0];if(!manifestItem)throw Object.assign(new Error("Nenhum backup encontrado no OneDrive."),{status:404});
  const read=async item=>Buffer.from(await (await graph(accessToken,`/drives/${driveId}/items/${item.id}/content`,{redirect:"follow"})).arrayBuffer());const manifest=JSON.parse((await read(manifestItem)).toString("utf8")),backup=children.find(item=>item.name===manifest.encryptedFile);if(!backup)throw new Error("Arquivo criptografado correspondente não encontrado.");
  return{...verifyBackupBundle({body:await read(backup),key,manifest}),name:backup.name,bytes:Number(backup.size||manifest.bytes||0)};
};

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

const listarTabelaFinanceira = async (table, columns) => {
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await db.from(table).select(columns).eq("company_id",COMPANY).range(from,from+999);
    if(error)throw error;
    rows.push(...(data||[]));
    if((data||[]).length<1000)break;
  }
  return rows;
};

const relatorioSombraFinanceira = async atual => {
  const snapshot=buildLegacyFinancialFacts(atual);
  const legado=summarizeLegacyFinancialFacts(snapshot);
  const [titles,settlements,events,links,qualityCases,runs]=await Promise.all([
    listarTabelaFinanceira("financial_titles","id,obra_id,direction,status,metadata"),
    listarTabelaFinanceira("settlements","id,title_id,amount,status,metadata"),
    listarTabelaFinanceira("financial_events","id,event_type,source_id,payload"),
    listarTabelaFinanceira("reconciliation_links","id,status"),
    listarTabelaFinanceira("data_quality_cases","id,status,category,details"),
    listarTabelaFinanceira("financial_shadow_runs","id,created_at,result"),
  ]);
  const canonico=summarizeCanonicalFinancialRows({titles,settlements,events});
  const divergencias=compareFinancialScopes(legado,canonico);
  const divergenciasDRE=compareDreProjectionRows(snapshot.dreSnapshots,events);
  const lastRun=[...runs].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;
  return {
    ok:true,modo:"sombra",engineEnforced:FINANCIAL_ENGINE_ENFORCE,
    legado,canonico,divergencias,divergenciasDRE,
    prontoParaAtivar:divergencias.length===0&&divergenciasDRE.length===0&&snapshot.facts.length>0,
    contagens:{fatosLegados:snapshot.facts.length,transacoesLegadas:snapshot.bankTransactions.length,
      titulos:titles.length,liquidacoes:settlements.filter(row=>row.status==="active").length,
      vinculosConciliacao:links.filter(row=>row.status==="active").length,
      projecoesDRE:snapshot.dreSnapshots.length,divergenciasDRE:divergenciasDRE.length,
      divergenciasAbertas:qualityCases.filter(row=>row.status==="open"&&row.category==="financial_shadow_divergence").length},
    ultimaCarga:lastRun,
  };
};

// O ponto arquivado sai do dataset principal, mas seu custo não pode sair do
// DRE. O resumo abaixo é pequeno, não contém dados pessoais e conserva a
// competência e a obra de cada lançamento.
const anexarCustosArquivados = async payload => {
  const marcadores = payload?.quinzenasArquivadas || {};
  const ids = Object.keys(marcadores);
  if (!ids.length) return { ...payload, archivedLaborCosts: {} };
  // Nunca confia no cache que voltou do navegador: cada leitura recompõe os
  // custos diretamente dos arquivos imutáveis mantidos no servidor.
  const existentes = {};
  const keys = ids.map(qid => `${KEY}__arq__${qid}`);
  const { data: linhas, error } = await db.from("company_app_data")
    .select("key,value").eq("company_id", COMPANY).in("key", keys);
  if (error) throw error;
  for (const linha of linhas || []) {
    const qid = String(linha.key || "").slice(`${KEY}__arq__`.length);
    // Recalcula sempre a partir da fonte arquivada. Um resumo persistido por
    // versões antigas nunca é tratado como verdade financeira.
    existentes[qid] = normalizeArchivedCosts(summarizeArchivedCosts(linha.value));
  }
  return { ...payload, archivedLaborCosts: existentes };
};

// Dois carimbos de tempo apontam para o mesmo instante?
// Compara o VALOR, não o texto: "…Z" (JS) e "…+00:00" (Postgres) são o mesmo
// momento escrito de duas formas.
const mesmoInstante = (a, b) => {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return false;
  return ta === tb;
};

// ── Freio contra força bruta ───────────────────────────────────────
// Um PIN de 4 dígitos tem 10.000 combinações — um script testa tudo em
// minutos se deixarmos. Aqui a memória é por instância (serverless recicla),
// então é um freio, não um cofre. O que realmente protege é PIN de 6 dígitos.
const tentativas = new Map();
const LIMITE = 8;
const JANELA = 5 * 60 * 1000;

const bloqueado = (ip) => {
  const t = tentativas.get(ip);
  if (!t) return false;
  if (Date.now() - t.desde > JANELA) { tentativas.delete(ip); return false; }
  return t.n >= LIMITE;
};

const registrarFalha = (ip) => {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.desde > JANELA) tentativas.set(ip, { n: 1, desde: Date.now() });
  else t.n += 1;
};

const lerLinha = async () => {
  const { data, error } = await db
    .from("company_app_data")
    .select("value, updated_at")
    .eq("company_id", COMPANY)
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { payload: null, updatedAt: null };
  const payload = decodeAppData(data.value);
  // Migração transparente: preserva o mesmo updated_at para não criar um
  // falso conflito nos navegadores que já estavam editando. Se outra gravação
  // vencer durante a migração, a condição impede qualquer sobrescrita.
  if(!isEncodedAppData(data.value)){
    const encoded=encodeAppData(payload);
    if(isEncodedAppData(encoded)){
      const migrated=await db.from("company_app_data").update({value:encoded})
        .eq("company_id",COMPANY).eq("key",KEY).eq("updated_at",data.updated_at);
      if(migrated.error)console.error("Não foi possível compactar o dataset:",migrated.error.message);
    }
  }
  return { payload, updatedAt: data.updated_at || null };
};

const salvarIndicePerfis = async payload => {
  const agora=new Date().toISOString(),value=compactProfiles(payload);
  const {error}=await db.from("company_app_data").upsert({company_id:COMPANY,key:PROFILE_KEY,value,updated_at:agora,updated_by:null},{onConflict:"company_id,key"});
  if(error)console.error("Não foi possível atualizar o índice de login:",error.message);
};

const lerIndicePerfis = async () => {
  const {data,error}=await db.from("company_app_data").select("value").eq("company_id",COMPANY).eq("key",PROFILE_KEY).maybeSingle();
  if(error)throw error;
  return data?.value||null;
};

// DATA-001: a RPC atualiza o blob e insere o evento append-only na mesma
// transação PostgreSQL. `before`/`after` recebem somente as seções alteradas,
// evitando duplicar um blob inteiro no histórico a cada pequena edição.
const salvarComAuditoria = async ({ expectedUpdatedAt, value, actor, action, before, after }) => {
  const correlationId=crypto.randomUUID();
  const {data,error}=await db.rpc("company_save_with_audit",{
    p_company_id:COMPANY,p_key:KEY,p_expected_updated_at:expectedUpdatedAt,p_value:encodeAppData(value),
    p_actor_id:String(actor?.id||"system"),p_actor_name:String(actor?.nome||actor?.email||"Sistema"),
    p_correlation_id:correlationId,p_action:action,p_before:before||{},p_after:after||{},
  });
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  return { applied:!!result?.applied, updatedAt:result?.updated_at||null, correlationId };
};

const salvarFinanceiroComAuditoria = async ({ expectedUpdatedAt, value, actor, action, before, after }) => {
  if(!process.env.POSTGRES_URL_NON_POOLING)throw new Error("A conexão transacional do motor financeiro não está configurada.");
  const correlationId=crypto.randomUUID();
  const sql=postgres(process.env.POSTGRES_URL_NON_POOLING,{ssl:"require",max:1,connect_timeout:20,idle_timeout:5});
  try{
    const snapshot=buildLegacyFinancialFacts(value);
    const [result]=await sql`
      select * from financial_save_with_sync(
        ${COMPANY},${KEY},${expectedUpdatedAt},${sql.json(encodeAppData(value))},
        ${String(actor?.id||"system")},${String(actor?.nome||actor?.email||"Sistema")},
        ${correlationId},${action},${sql.json(before||{})},${sql.json(after||{})},${sql.json(snapshot)}
      )
    `;
    return {
      applied:!!result?.applied,updatedAt:result?.updated_at||null,
      correlationId,syncResult:result?.sync_result||{},
    };
  }finally{await sql.end({timeout:2});}
};

// Confere o PIN contra o hash guardado no próprio dataset
const conferirPin = (payload, userId, pin) => {
  const u = (payload?.usuarios || []).find(x => x.id === userId && x.active !== false);
  if (!u) return null;
  // Comparação em tempo constante: comparar strings com === vaza, pelo tempo
  // de resposta, quantos caracteres iniciais bateram.
  const a = Buffer.from(sha256(pin));
  const b = Buffer.from(String(u.pin || ""));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return u;
};

const encontrarUsuarioAuth = (payload, authUser) => {
  if (!authUser) return null;
  const email = String(authUser.email || "").trim().toLowerCase();
  return (payload?.usuarios || []).find(u => u.active !== false &&
    (u.authUserId === authUser.id || String(u.email || "").trim().toLowerCase() === email)) || null;
};

const igual = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const objeto = value => value && typeof value === "object" && !Array.isArray(value);
const mesclarTresVias = (base, recebido, atual) => {
  if (igual(recebido, base)) return atual;
  if (igual(atual, base)) return recebido;
  if (Array.isArray(recebido) && Array.isArray(atual) && Array.isArray(base)) {
    const identificavel = [...base,...recebido,...atual].every(x => objeto(x) && x.id != null);
    if (!identificavel) return recebido;
    const bm=new Map(base.map(x=>[String(x.id),x])), rm=new Map(recebido.map(x=>[String(x.id),x])), am=new Map(atual.map(x=>[String(x.id),x]));
    const ordem=[...atual.map(x=>String(x.id)),...recebido.map(x=>String(x.id))].filter((id,i,a)=>a.indexOf(id)===i);
    return ordem.flatMap(id => {
      const b=bm.get(id), r=rm.get(id), a=am.get(id);
      if (b && !r) return igual(a,b)?[]:(a?[a]:[]);
      if (!r) return a?[a]:[];
      if (!a) return [r];
      return [mesclarTresVias(b,r,a)];
    });
  }
  if (objeto(recebido) && objeto(atual)) {
    const out={};
    const keys=new Set([...Object.keys(base||{}),...Object.keys(atual),...Object.keys(recebido)]);
    keys.forEach(k=>{out[k]=mesclarTresVias(base?.[k],recebido[k],atual[k]);});
    return out;
  }
  return recebido;
};

// A Conferência tem segregação de função: o vistoriador registra e julga;
// quem recebeu o ajuste apenas anexa a própria evidência. A validação precisa
// acontecer no servidor, pois esconder botões no React não impede uma chamada
// manual à API.
const compactarPermissao = value => {
  if(Array.isArray(value))return value.map(compactarPermissao);
  if(!objeto(value))return value;
  const out={};
  Object.entries(value).forEach(([key,item])=>{
    if(item===undefined||item===""||(Array.isArray(item)&&item.length===0))return;
    out[key]=compactarPermissao(item);
  });
  return out;
};
const igualPermissao=(a,b)=>JSON.stringify(compactarPermissao(a))===JSON.stringify(compactarPermissao(b));
const validarExclusaoObras=(usuario,anterior=[],proximo=[])=>{
  if(usuario?.role==="admin")return "";
  if(!Array.isArray(anterior)||!Array.isArray(proximo))return "Formato de obras inválido.";
  const idsDepois=new Set(proximo.map(obra=>String(obra?.id||"")).filter(Boolean));
  const removida=anterior.some(obra=>obra?.id&&!idsDepois.has(String(obra.id)));
  return removida?"Somente o administrador pode excluir uma obra.":"";
};
const validarAlteracoesConferencias=(usuario,anterior=[],proximo=[],autoritativo=[],obras=[])=>{
  if(usuario?.role==="admin")return "";
  if(!Array.isArray(anterior)||!Array.isArray(proximo))return "Formato de conferências inválido.";
  const antes=new Map(anterior.map(c=>[String(c.id),c]));
  const depois=new Map(proximo.map(c=>[String(c.id),c]));
  const atual=new Map((autoritativo||[]).map(c=>[String(c.id),c]));
  const adicionadas=[...depois.entries()].filter(([id])=>!antes.has(id));
  const removidas=[...antes.keys()].filter(id=>!depois.has(id));
  if(removidas.length)return "Somente o administrador pode excluir uma vistoria.";
  for(const [,nova] of adicionadas){
    if(usuario?.role!=="engenheiro_auditor")return "Somente o administrador ou o engenheiro auditor pode criar uma vistoria.";
    const obra=(obras||[]).find(o=>String(o.id)===String(nova?.obraId));
    const estaNoEscopo=!usuario.obraId||String(usuario.obraId)===String(obra?.id);
    if(!obra||!estaNoEscopo)return "Esta obra não está disponível no escopo do engenheiro auditor.";
    if(String(nova?.responsavelId)!==String(usuario.id)||String(nova?.responsavel||"").trim()!==String(usuario.nome||"").trim())return "A nova vistoria deve ser registrada automaticamente em nome do engenheiro auditor conectado.";
    if((nova?.pendencias||[]).length)return "Crie a vistoria primeiro; as pendências devem ser registradas dentro dela.";
  }

  for(const [id,nova] of depois){
    const antiga=antes.get(id);
    if(!antiga)continue;
    if(igualPermissao(antiga,nova))continue;
    const vigente=atual.get(id)||antiga;
    if(usuario?.role==="engenheiro_auditor"&&vigente?.responsavelId===usuario?.id){
      const imutaveis=["id","obraId","codigo","responsavelId","responsavel","criadoEm"];
      if(imutaveis.some(k=>!igualPermissao(antiga?.[k],nova?.[k])))return "O responsável pela vistoria não pode alterar a autoria ou o vínculo da conferência.";
      continue;
    }

    if(usuario?.role!=="engenheiro")return "Somente o engenheiro auditor responsável ou o administrador pode alterar esta vistoria.";

    const topoAntigo={...antiga},topoNovo={...nova};
    delete topoAntigo.pendencias;delete topoNovo.pendencias;
    delete topoAntigo.atualizadoEm;delete topoNovo.atualizadoEm;
    if(!igualPermissao(topoAntigo,topoNovo))return "O responsável pelo ajuste possui acesso somente para enviar a foto da correção.";
    const pendAntes=new Map((antiga?.pendencias||[]).map(p=>[String(p.id),p]));
    const pendDepois=new Map((nova?.pendencias||[]).map(p=>[String(p.id),p]));
    if([...pendDepois.keys()].some(pid=>!pendAntes.has(pid))||[...pendAntes.keys()].some(pid=>!pendDepois.has(pid)))return "O responsável pelo ajuste não pode criar ou excluir pendências.";
    for(const [pid,pendNova] of pendDepois){
      const pendAntiga=pendAntes.get(pid);
      if(igualPermissao(pendAntiga,pendNova))continue;
      const pendVigente=(vigente?.pendencias||[]).find(p=>String(p.id)===pid)||pendAntiga;
      if(pendVigente?.responsavelAjusteId!==usuario?.id)return "Você não pode alterar uma pendência atribuída a outro responsável.";
      if(pendAntiga?.status==="resolvida")return "Uma pendência conforme não aceita nova evidência sem reabertura pelo vistoriador.";
      const camposPermitidos=new Set(["status","fotos","validacaoStatus","validacaoObservacao","validadoPorId","validadoPor","validadoEm","resolvidoEm"]);
      const campos=new Set([...Object.keys(pendAntiga||{}),...Object.keys(pendNova||{})]);
      if([...campos].some(k=>!camposPermitidos.has(k)&&!igualPermissao(pendAntiga?.[k],pendNova?.[k])))return "O responsável pelo ajuste não pode editar os dados da pendência.";
      const fotosAntes=pendAntiga?.fotos||[],fotosDepois=pendNova?.fotos||[];
      if(fotosDepois.length<=fotosAntes.length)return "Envie uma nova foto para registrar a correção.";
      for(let i=0;i<fotosAntes.length;i++){
        const a={...fotosAntes[i]},b={...fotosDepois[i]};delete a.id;delete b.id;
        if(!igualPermissao(a,b))return "As evidências anteriores não podem ser alteradas ou removidas.";
      }
      const adicionadas=fotosDepois.slice(fotosAntes.length);
      if(adicionadas.some(f=>f.tipo!=="ajuste"||f.enviadoPorId!==usuario.id||!/^https:\/\//i.test(String(f.url||""))))return "A nova evidência deve ser a foto de correção enviada pelo próprio responsável.";
      if(pendNova.status!=="aguardando_validacao"||pendNova.validacaoStatus||pendNova.validadoEm||pendNova.resolvidoEm)return "Depois da foto, a pendência deve aguardar a validação do vistoriador.";
    }
  }
  return "";
};

export default async function handler(req, res) {
  if (!URL || !SERVICE) {
    return res.status(503).json({ error: "Banco não configurado no servidor." });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "desconhecido";
  const { action=req.query?.action, userId, pin, accessToken, payload, expectedUpdatedAt, basePayload, sections, baseSections } = req.body || {};

  try {
    if(action==="backup-create"&&cronAutorizado(req))return res.status(200).json(await criarBackupOneDrive(req,"system:vercel-cron"));
    if(action==="backup-verify"&&cronAutorizado(req))return res.status(200).json(await verificarBackupOneDrive(req));
    if (action === "client-portal") {
      const { payload: p } = await lerLinha();
      const obraId = String(req.body?.obraId || "");
      const token = String(req.body?.token || "");
      const obra = (p?.obras || []).find(o => String(o.id) === obraId);
      const portal = obra?.portalCliente || {};
      const tokenValido = token && portal.token && token.length === String(portal.token).length &&
        crypto.timingSafeEqual(Buffer.from(token), Buffer.from(String(portal.token)));
      if (!obra || !portal.ativo || !tokenValido) {
        return res.status(404).json({ error: "Portal indisponível ou link inválido." });
      }

      const rdos = (p?.rdos || []).filter(r => r.obraId === obraId && r.status === "concluido")
        .sort((a,b) => String(b.data||"").localeCompare(String(a.data||""))).slice(0, 12);
      const fotos = portal.publicarFotos === false ? [] : rdos.flatMap(r => (r.fotos || [])
        .filter(f => f.publicarCliente !== false).map(f => ({ url:f.url || "", legenda:f.legenda || "", data:r.data, rdoCodigo:r.codigo })))
        .filter(f => f.url).slice(0, 24);
      const plano = (p?.planos || []).find(x => x.obraId === obraId);
      const tarefas = (plano?.tarefas || []).filter(t => !t.titulo).map(t => ({
        id:t.id, nome:t.nome || t.descricao || "Etapa", inicio:t.inicio || "", fim:t.fim || "",
        progresso:Math.max(0,Math.min(100,Number(t.progresso || 0))),
      }));
      const progresso = tarefas.length ? Math.round(tarefas.reduce((s,t)=>s+t.progresso,0)/tarefas.length) : 0;
      const medicoes = portal.publicarFinanceiro ? (p?.medicoes || []).filter(m => m.obraId === obraId).map(m => ({
        id:m.id, descricao:m.descricao || m.competencia || "Medição", competencia:m.competencia || "",
        valorPrevisto:Number(m.valorPrevisto || 0), valorRecebido:Number(m.valorRecebido || 0), recebido:!!m.recebido,
      })) : [];
      const documentos = portal.publicarDocumentos === false ? [] : (obra.documentosOneDrive || [])
        .filter(d => d.publicarCliente === true).map(d => ({ id:d.id, nome:d.nome || "Documento", url:d.url || "" }));
      const atualizacoes = (p?.changeLog || []).filter(e => e.obraId === obraId)
        .slice(-20).reverse().map(e => ({ id:e.id, at:e.at || e.date || "", mensagem:e.message || "Atualização da obra", responsavel:e.operador || "Equipe ArcD" }));
      return res.status(200).json({ portal:{
        obra:{ id:obra.id, nome:obra.name, status:obra.status, capaUrl:obra.capaUrl || "", cliente:obra.cliente || "", engenheiro:obra.engineer || "", endereco:obra.address || "", inicio:obra.contractStart || obra.startDate || "", terminoPrevisto:obra.contractEnd || "" },
        mensagem:portal.mensagem || "Acompanhe aqui a evolução da sua obra.", progresso,
        cronograma:portal.publicarCronograma === false ? [] : tarefas.slice(0,30),
        diarios:rdos.map(r => ({ id:r.id, codigo:r.codigo, data:r.data, descricao:r.descricao || "", clima:r.clima || {}, fotos:(r.fotos||[]).filter(f=>f.publicarCliente!==false).length })),
        fotos, medicoes, documentos, atualizacoes,
        atualizadoEm:portal.atualizadoEm || "",
      }});
    }

    if (action === "auth-login") {
      const email=String(req.body?.email||"").trim().toLowerCase();
      const password=String(req.body?.password||"");
      const {data:auth,error}=await db.auth.signInWithPassword({email,password});
      if(error||!auth?.session)return res.status(401).json({error:"E-mail ou senha inválidos."});
      const {payload:p,updatedAt}=await lerLinha();
      // signInWithPassword já devolve um usuário autenticado pelo Supabase.
      // Consultá-lo novamente com getUser adicionava uma viagem de rede inteira
      // ao login sem aumentar a segurança desta mesma requisição.
      const usuario=encontrarUsuarioAuth(p,auth.user||auth.session.user);
      if(!usuario)return res.status(403).json({error:"Conta sem vínculo com um operador ativo do ArcD."});
      const completo=await anexarCustosArquivados(p);
      return res.status(200).json({data:projectDataForUser(completo,usuario),updatedAt,usuario:publicUser(usuario),accessToken:auth.session.access_token,refreshToken:auth.session.refresh_token});
    }

    if (action === "auth-refresh") {
      const {data:auth,error}=await db.auth.refreshSession({refresh_token:String(req.body?.refreshToken||"")});
      if(error||!auth?.session)return res.status(401).json({error:"Sessão expirada."});
      return res.status(200).json({accessToken:auth.session.access_token,refreshToken:auth.session.refresh_token});
    }

    // ── 1. Lista de perfis (tela de login) ─────────────────────────
    // Não exige PIN — é o que a tela precisa ANTES de alguém digitar.
    // Devolve só nome e papel. O hash do PIN nunca sai daqui.
    if (action === "profiles") {
      let indice=await lerIndicePerfis();
      if(!indice){const {payload:p}=await lerLinha();indice=compactProfiles(p);await salvarIndicePerfis(p);}
      const usuarios = (indice?.usuarios || [])
        .filter(u => u.active !== false)
        .map(u => ({ id: u.id, nome: u.nome, role: u.role }));
      return res.status(200).json({ usuarios, precisaSetup: usuarios.length === 0 });
    }

    // ── 2. Primeiro acesso: cria o admin inicial ───────────────────
    //
    // ATENÇÃO — este trecho já teve um bug que destruía dados.
    //
    // A versão errada fazia `value = payload`, ou seja, gravava por cima da
    // linha o dataset VAZIO que o navegador manda (só com o admin recém-criado).
    // Se a empresa já tivesse obras, funcionários e pontos lançados, mas ainda
    // nenhum usuário com PIN, o "Primeiro acesso" apagaria TUDO.
    //
    // Agora o admin é MESCLADO no que já existe. A base atual é a verdade;
    // o cliente só contribui com o usuário. Nenhum outro campo é tocado.
    if (action === "setup") {
      const { payload: existente } = await lerLinha();

      if ((existente?.usuarios || []).length > 0) {
        return res.status(409).json({ error: "Já existe usuário. Setup encerrado." });
      }

      const novoUsuario = (payload?.usuarios || [])[0];
      if (!novoUsuario?.id || !novoUsuario?.pin) {
        return res.status(400).json({ error: "Dados do administrador incompletos." });
      }

      // Se já há dados, PRESERVA tudo e só acrescenta o usuário.
      // Se a linha está vazia/inexistente, aí sim usa o payload como base.
      const temDados = existente && Object.keys(existente).length > 0;
      const base = temDados
        ? { ...existente, usuarios: [novoUsuario] }
        : { ...(payload || {}), usuarios: [novoUsuario] };

      const agora = new Date().toISOString();

      if (!existente) {
        await db.from("company_app_data")
          .insert({ company_id: COMPANY, key: KEY, value: encodeAppData(base), updated_at: agora });
      } else {
        await db.from("company_app_data")
          .update({ value: encodeAppData(base), updated_at: agora })
          .eq("company_id", COMPANY).eq("key", KEY);
      }
      await salvarIndicePerfis(base);

      const novo = await lerLinha();
      return res.status(200).json({ data: novo.payload, updatedAt: novo.updatedAt });
    }

    // ── Daqui pra baixo, sessão individual ou PIN de transição ─────
    if (bloqueado(ip)) {
      return res.status(429).json({ error: "Muitas tentativas. Aguarde 5 minutos." });
    }

    // A leitura do dataset e a validação do token não dependem uma da outra.
    // Em sessões por e-mail, fazê-las em paralelo reduz o tempo até o dashboard
    // ao maior dos dois tempos, em vez de somar as duas esperas de rede.
    const [linha,tokenAuth] = await Promise.all([
      lerLinha(),
      accessToken ? db.auth.getUser(accessToken) : Promise.resolve({data:null,error:null}),
    ]);
    const { payload: atual, updatedAt } = linha;
    const usuario = (!tokenAuth.error&&tokenAuth.data?.user?encontrarUsuarioAuth(atual,tokenAuth.data.user):null) || conferirPin(atual, userId, pin);

    if (!usuario) {
      registrarFalha(ip);
      return res.status(401).json({ error: "Sessão inválida ou PIN incorreto." });
    }

    if (action === "auth-provision") {
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores podem ativar contas."});
      const alvo=(atual.usuarios||[]).find(u=>u.id===req.body?.targetUserId);
      const email=String(alvo?.email||"").trim().toLowerCase(), password=String(req.body?.password||"");
      if(!alvo||!email)return res.status(400).json({error:"Cadastre um e-mail válido para o operador."});
      if(password.length<8)return res.status(400).json({error:"A senha temporária deve ter ao menos 8 caracteres."});
      let authId=alvo.authUserId||"";
      if(authId){
        const {error}=await db.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{arcdUserId:alvo.id,nome:alvo.nome}});
        if(error)return res.status(400).json({error:error.message});
      }else{
        // A conta pode ter sido criada antes da implantação do vínculo
        // authUserId (ou diretamente no painel do Supabase). Nesse caso não
        // tentamos cadastrar o mesmo e-mail novamente: localizamos a conta,
        // redefinimos a senha e passamos a vinculá-la ao operador do ArcD.
        const {data:listagem,error:erroLista}=await db.auth.admin.listUsers({page:1,perPage:1000});
        if(erroLista)return res.status(400).json({error:erroLista.message});
        const existente=(listagem?.users||[]).find(u=>String(u.email||"").trim().toLowerCase()===email);
        if(existente){
          const vinculo=(atual.usuarios||[]).find(u=>u.id!==alvo.id&&u.authUserId===existente.id);
          if(vinculo)return res.status(409).json({error:`Este e-mail já está vinculado ao operador ${vinculo.nome}.`});
          authId=existente.id;
          const {error}=await db.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{...(existente.user_metadata||{}),arcdUserId:alvo.id,nome:alvo.nome}});
          if(error)return res.status(400).json({error:error.message});
        }else{
          const {data:criado,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{arcdUserId:alvo.id,nome:alvo.nome}});
          if(error)return res.status(400).json({error:error.message});
          authId=criado.user.id;
        }
      }
      const novo={...atual,usuarios:(atual.usuarios||[]).map(u=>u.id===alvo.id?{...u,authUserId:authId,email}:u)};
      const agora=new Date().toISOString();
      const {data:gravado,error}=await db.from("company_app_data").update({value:encodeAppData(novo),updated_at:agora}).eq("company_id",COMPANY).eq("key",KEY).select("updated_at").maybeSingle();
      if(error)throw error;
      await salvarIndicePerfis(novo);
      return res.status(200).json({ok:true,data:novo,updatedAt:gravado?.updated_at||agora});
    }

    // Motor Financeiro Canônico: o navegador envia somente o comando. A RPC
    // faz bloqueios, idempotência, saldo, evento, auditoria e outbox na mesma
    // transação PostgreSQL. Mantido nesta rota para caber no plano Hobby da
    // Vercel sem criar uma 13ª função serverless.
    if (action === "financial-command") {
      const command=req.body?.command||{};
      if(!FINANCIAL_COMMANDS.has(command.type))return res.status(400).json({error:"Comando financeiro inválido."});
      if(!FINANCIAL_COMMAND_ROLES[command.type].includes(usuario.role))return res.status(403).json({error:"Seu perfil não pode executar este comando financeiro."});
      if(!/^[a-zA-Z0-9_-]{16,200}$/.test(String(command.idempotencyKey||"")))return res.status(400).json({error:"Chave de idempotência inválida."});
      const {data:resultado,error}=await db.rpc("financial_execute_command",{p_company_id:COMPANY,p_actor_id:usuario.id,p_command:command});
      if(error){console.error("Falha no motor financeiro:",error.message);return res.status(409).json({error:"O comando não foi efetivado. Nenhum lançamento parcial foi salvo."});}
      return res.status(200).json(resultado);
    }

    // Comandos operacionais usam versão da própria entidade, não a semântica
    // insegura de "último snapshot vence". A rota ainda devolve a projeção
    // filtrada pelo papel para poder substituir o save legado gradualmente.
    if(action==="operational-command"){
      const command=req.body?.command||{};
      const roles=OPERATIONAL_COMMAND_ROLES[command.type];
      if(!roles)return res.status(400).json({error:"Comando operacional inválido."});
      if(!roles.includes(usuario.role))return res.status(403).json({error:"Seu perfil não pode executar este comando operacional."});
      if(!/^[a-zA-Z0-9_-]{16,200}$/.test(String(command.idempotencyKey||"")))return res.status(400).json({error:"Chave idempotente operacional inválida."});

      let result=applyOperationalCommand(atual,{...command,actorId:usuario.id,actorName:usuario.nome||usuario.email||"Usuário autenticado"});
      if(!result.ok)return res.status(409).json({conflict:true,reason:result.reason,currentUpdatedAt:updatedAt});
      if(result.idempotent)return res.status(200).json({ok:true,idempotent:true,data:projectDataForUser(atual,usuario),updatedAt});

      const persistir=async(base,value)=>salvarComAuditoria({expectedUpdatedAt:base.updatedAt,value,actor:usuario,
        action:`operational_${command.type.toLowerCase()}`,
        before:{command:command.type,entityId:command.payload?.measurementId||command.payload?.pedidoId||command.payload?.report?.id||command.payload?.measurement?.id||""},
        after:{command:command.type,idempotencyKey:command.idempotencyKey}});
      let gravacao=await persistir({updatedAt},result.data);
      if(!gravacao.applied){
        const recente=await lerLinha();
        result=applyOperationalCommand(recente.payload,{...command,actorId:usuario.id,actorName:usuario.nome||usuario.email||"Usuário autenticado"});
        if(!result.ok)return res.status(409).json({conflict:true,reason:result.reason,currentUpdatedAt:recente.updatedAt});
        if(result.idempotent)return res.status(200).json({ok:true,idempotent:true,data:projectDataForUser(recente.payload,usuario),updatedAt:recente.updatedAt});
        gravacao=await persistir(recente,result.data);
        if(!gravacao.applied)return res.status(409).json({conflict:true,reason:"Outra alteração foi gravada ao mesmo tempo. Tente novamente."});
      }
      return res.status(200).json({ok:true,data:projectDataForUser(result.data,usuario),updatedAt:gravacao.updatedAt||new Date().toISOString()});
    }

    // FIN-002: fotografia em sombra do legado versus motor canônico. Não
    // grava nem altera o legado; serve como portão objetivo antes de FIN-003.
    if(action==="financial-shadow-report"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores homologam o motor financeiro."});
      try{return res.status(200).json(await relatorioSombraFinanceira(atual));}
      catch(error){
        if(/financial_shadow_runs|does not exist|schema cache/i.test(String(error?.message||""))){
          return res.status(409).json({error:"A migration FIN-002 ainda não foi aplicada. Execute migrations/001_sync_legacy_financial.up.sql."});
        }
        throw error;
      }
    }

    if(action==="financial-shadow-migrate"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores preparam o motor financeiro."});
      if(!process.env.POSTGRES_URL_NON_POOLING)return res.status(503).json({error:"A conexão direta do Supabase não está configurada na produção."});
      const migrationPaths=[
        path.join(process.cwd(),"migrations","001_sync_legacy_financial.up.sql"),
        path.join(process.cwd(),"migrations","002_financial_transactional_projection.up.sql"),
        path.join(process.cwd(),"migrations","003_accounting_period_enforcement.up.sql"),
      ];
      if(migrationPaths.some(file=>!fs.existsSync(file)))return res.status(500).json({error:"As migrations financeiras versionadas não foram incluídas no deploy."});
      const sql=postgres(process.env.POSTGRES_URL_NON_POOLING,{ssl:"require",max:1,connect_timeout:20,idle_timeout:5});
      try{
        for(const migrationPath of migrationPaths)await sql.unsafe(fs.readFileSync(migrationPath,"utf8"));
        const [check]=await sql`
          select
            to_regclass('public.financial_shadow_runs') is not null as table_ok,
            exists(
              select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='financial_sync_legacy_facts'
            ) as function_ok,
            exists(
              select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='financial_save_with_sync'
            ) as projection_ok
        `;
        if(!check?.table_ok||!check?.function_ok||!check?.projection_ok)throw new Error("A validação pós-migração não encontrou os objetos esperados.");
        return res.status(200).json({ok:true,migration:"001-003_financial_engine",...check});
      }catch(error){
        console.error("Falha na migration FIN-002:",error.message);
        return res.status(409).json({error:"A migration FIN-002 foi revertida pela transação. Consulte os logs do servidor antes de repetir."});
      }finally{await sql.end({timeout:2});}
    }

    if(action==="financial-shadow-sync"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores executam a carga financeira em sombra."});
      const snapshot=buildLegacyFinancialFacts(atual);
      if(!process.env.POSTGRES_URL_NON_POOLING)return res.status(503).json({error:"A conexão direta do Supabase não está configurada."});
      const sql=postgres(process.env.POSTGRES_URL_NON_POOLING,{ssl:"require",max:1,connect_timeout:20,idle_timeout:5});
      let sync;
      try{
        const [row]=await sql`select financial_sync_legacy_facts(${COMPANY},${usuario.id},${sql.json(snapshot)}) as result`;
        sync=row.result;
      }catch(error){
        console.error("Falha na carga financeira em sombra:",error.message);
        return res.status(409).json({error:/financial_sync_legacy_facts|does not exist/i.test(error.message)
          ?"A migration FIN-002 ainda não foi aplicada. Prepare o banco antes da carga."
          :"A carga foi recusada pelo banco e nenhuma ativação foi realizada."});
      }finally{await sql.end({timeout:2});}
      const report=await relatorioSombraFinanceira(atual);
      await db.from("data_quality_cases").update({status:"resolved",resolved_at:new Date().toISOString()})
        .eq("company_id",COMPANY).eq("category","financial_shadow_divergence").eq("status","open");
      if(report.divergencias.length){
        const cases=report.divergencias.map(item=>({
          company_id:COMPANY,category:"financial_shadow_divergence",
          severity:Math.abs(item.difference)>=100?"high":"medium",entity_type:item.scope==="empresa"?"company":"obra",
          entity_id:item.scope,details:item,status:"open",
        }));
        const {error:caseError}=await db.from("data_quality_cases").insert(cases);
        if(caseError)console.error("Falha ao registrar divergências da sombra:",caseError.message);
      }
      return res.status(200).json({...report,sync});
    }

    if(action==="financial-dre-report"||action==="financial-company-dre-report"){
      const year=Number(req.body?.year),month=Number(req.body?.month);
      const period=["mes","q1","q2"].includes(req.body?.period)?req.body.period:"mes";
      const requestedWork=String(req.body?.obraId||"");
      const companyStatement=action==="financial-company-dre-report";
      if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<0||month>11){
        return res.status(400).json({error:"Período do DRE inválido."});
      }
      if(companyStatement&&usuario.obraId){
        return res.status(403).json({error:"O DRE da empresa não está disponível para um perfil restrito a uma obra."});
      }
      if(!companyStatement&&usuario.obraId&&requestedWork!==String(usuario.obraId)){
        return res.status(403).json({error:"O DRE solicitado está fora do escopo da obra do usuário."});
      }
      const scope=companyStatement?"company_dre":(requestedWork||"empresa");
      const currentId=`${year}-${String(month+1).padStart(2,"0")}:${period}:${scope}`;
      const historyIds=Array.from({length:6},(_,index)=>{
        const date=new Date(year,month-5+index,1);
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}:mes:${scope}`;
      });
      const ids=[...new Set([currentId,...historyIds])];
      const {data:events,error}=await db.from("financial_events")
        .select("source_id,payload,effective_date")
        .eq("company_id",COMPANY).eq("event_type","dre_snapshot")
        .eq("source_type","dre_projection").in("source_id",ids);
      if(error)throw error;
      const activeEvents=(events||[]).filter(event=>event.payload?.active!==false);
      const byId=new Map(activeEvents.map(event=>[event.source_id,event.payload]));
      return res.status(200).json({
        ok:true,engineEnforced:FINANCIAL_ENGINE_ENFORCE,source:"canonical_ledger",
        current:byId.get(currentId)||null,
        history:historyIds.map(sourceId=>byId.get(sourceId)||null),
      });
    }

    if(action==="backup-status")return res.status(200).json({ok:true,configured:!!process.env.BACKUP_ENCRYPTION_KEY,destination:"OneDrive",folder:BACKUP_FOLDER});
    if(action==="backup-create"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores operam backups."});
      return res.status(201).json(await criarBackupOneDrive(req,usuario.id));
    }
    if(action==="backup-verify"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores verificam backups."});
      return res.status(200).json(await verificarBackupOneDrive(req));
    }

    // ── 3. Carregar ────────────────────────────────────────────────
    if (action === "load") {
      const completo = await anexarCustosArquivados(atual);
      return res.status(200).json({
        data: projectDataForUser(completo, usuario),
        updatedAt,
        usuario: publicUser(usuario),
      });
    }

    // ── 4. Salvar somente os módulos alterados ─────────────────────
    // O estado histórico continua compatível com o blob existente, porém o
    // navegador não precisa mais reenviar (e duplicar como base) toda a empresa
    // a cada clique. Cada chave de primeiro nível funciona como uma unidade de
    // alteração: Obras, RH, Compras, Financeiro etc. Em concorrência, somente
    // as seções realmente tocadas entram no merge de três vias.
    if (action === "save-sections") {
      if (!objeto(sections)) return res.status(400).json({ error: "Nenhuma seção para salvar." });
      const chaves = Object.keys(sections).filter(k => k && !k.startsWith("__")).slice(0, 120);
      const exigeMotorFinanceiro=FINANCIAL_ENGINE_ENFORCE&&chaves.some(key=>FINANCIAL_LEGACY_SECTIONS.has(key));
      if (!chaves.length) return res.status(200).json({ ok:true, updatedAt, unchanged:true });
      const erroAutorizacao=authorizeSectionChanges(usuario,Object.fromEntries(chaves.map(key=>[key,sections[key]])));
      if(erroAutorizacao)return res.status(403).json({error:erroAutorizacao});
      const erroExclusao=validateNoPhysicalDeletes(Object.fromEntries(chaves.map(key=>[key,atual?.[key]])),sections);
      if(erroExclusao)return res.status(409).json({error:erroExclusao});
      if(chaves.includes("conferencias")){
        const baseConferencias=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"conferencias")?baseSections.conferencias:atual?.conferencias;
        const erroPermissao=validarAlteracoesConferencias(usuario,baseConferencias||[],sections.conferencias||[],atual?.conferencias||[],atual?.obras||[]);
        if(erroPermissao)return res.status(403).json({error:erroPermissao});
      }
      if(chaves.includes("pedidos")){
        const basePedidos=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"pedidos")?baseSections.pedidos:atual?.pedidos;
        const erroCompras=validatePurchaseChanges(usuario,basePedidos||[],sections.pedidos||[]);
        if(erroCompras)return res.status(403).json({error:erroCompras});
      }
      if(chaves.includes("obras")){
        const baseObras=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"obras")?baseSections.obras:atual?.obras;
        const erroObras=validarExclusaoObras(usuario,baseObras||[],sections.obras||[]);
        if(erroObras)return res.status(403).json({error:erroObras});
      }

      const houveConcorrencia=expectedUpdatedAt&&updatedAt&&!mesmoInstante(expectedUpdatedAt,updatedAt);
      const aplicar = (estado, concorrente) => {
        const proximo={...(estado||{})};
        chaves.forEach(k => {
          proximo[k]=concorrente&&baseSections&&Object.prototype.hasOwnProperty.call(baseSections,k)
            ? mesclarTresVias(baseSections[k],sections[k],estado?.[k])
            : sections[k];
        });
        return proximo;
      };
      let valor=aplicar(atual,houveConcorrencia);
      let agora=new Date().toISOString();
      const salvarVersao=exigeMotorFinanceiro?salvarFinanceiroComAuditoria:salvarComAuditoria;
      let gravacao=await salvarVersao({expectedUpdatedAt:updatedAt,value:valor,actor:usuario,action:exigeMotorFinanceiro?"financial_save_sections":"save_sections",
        before:Object.fromEntries(chaves.map(key=>[key,atual?.[key]])),after:Object.fromEntries(chaves.map(key=>[key,valor?.[key]]))});
      let gravado=gravacao.applied?{updated_at:gravacao.updatedAt}:null;

      let combinado=houveConcorrencia;
      if(!gravado){
        const recente=await lerLinha();
        valor=aplicar(recente.payload,true);
        agora=new Date().toISOString();
        const retry=await salvarVersao({expectedUpdatedAt:recente.updatedAt,value:valor,actor:usuario,action:exigeMotorFinanceiro?"financial_save_sections":"save_sections",
          before:Object.fromEntries(chaves.map(key=>[key,recente.payload?.[key]])),after:Object.fromEntries(chaves.map(key=>[key,valor?.[key]]))});
        if(!retry.applied)return res.status(409).json({conflict:true,reason:"Muitas alterações simultâneas. Tente novamente."});
        gravado={updated_at:retry.updatedAt};combinado=true;
      }
      if(chaves.includes("usuarios"))await salvarIndicePerfis(valor);
      return res.status(200).json({ok:true,merged:combinado,data:combinado?valor:undefined,updatedAt:gravado?.updated_at||agora,savedSections:chaves});
    }

    // ── 4b. Salvar blob completo (compatibilidade / primeiro acesso) ─
    if (action === "save") {
      if (!payload) return res.status(400).json({ error: "Nada para salvar." });
      const secoesAlteradas=Object.fromEntries([...new Set([...Object.keys(payload||{}),...Object.keys(atual||{})])]
        .filter(key=>!igual(payload?.[key],atual?.[key])).map(key=>[key,payload?.[key]]));
      const exigeMotorFinanceiro=FINANCIAL_ENGINE_ENFORCE&&Object.keys(secoesAlteradas).some(key=>FINANCIAL_LEGACY_SECTIONS.has(key));
      const erroAutorizacao=authorizeSectionChanges(usuario,secoesAlteradas);
      if(erroAutorizacao)return res.status(403).json({error:erroAutorizacao});
      const erroExclusao=validateNoPhysicalDeletes(atual,payload);
      if(erroExclusao)return res.status(409).json({error:erroExclusao});
      if(!igual(payload.conferencias,atual?.conferencias)){
        const erroPermissao=validarAlteracoesConferencias(usuario,basePayload?.conferencias||atual?.conferencias||[],payload.conferencias||[],atual?.conferencias||[],atual?.obras||[]);
        if(erroPermissao)return res.status(403).json({error:erroPermissao});
      }
      if(!igual(payload.pedidos,atual?.pedidos)){
        const erroCompras=validatePurchaseChanges(usuario,basePayload?.pedidos||atual?.pedidos||[],payload.pedidos||[]);
        if(erroCompras)return res.status(403).json({error:erroCompras});
      }
      if(!igual(payload.obras,atual?.obras)){
        const erroObras=validarExclusaoObras(usuario,basePayload?.obras||atual?.obras||[],payload.obras||[]);
        if(erroObras)return res.status(403).json({error:erroObras});
      }

      // Se outro salvou depois da sua leitura, recusa — e devolve a versão
      // do servidor + o que você tentou salvar, para o app reaplicar.
      //
      // ⚠️ COMPARAR INSTANTE, NÃO STRING.
      //
      // Este trecho já teve um bug que travava TODO salvamento a partir do
      // segundo. O JS gera "2026-07-14T09:46:11.545Z"; o Postgres, na coluna
      // timestamptz, devolve "2026-07-14T09:46:11.545+00:00". É o MESMO
      // instante, mas são strings diferentes — e comparar com !== dava
      // conflito eterno. O ponto simplesmente não salvava.
      const houveConcorrencia=expectedUpdatedAt&&updatedAt&&!mesmoInstante(expectedUpdatedAt,updatedAt);
      let valor=houveConcorrencia&&basePayload?mesclarTresVias(basePayload,payload,atual):payload;
      if(houveConcorrencia&&!basePayload)return res.status(409).json({conflict:true,reason:"Outro usuário salvou enquanto você trabalhava.",currentData:atual,currentUpdatedAt:updatedAt});

      const agora = new Date().toISOString();
      const beforeAudit=Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,atual?.[key]]));
      const afterAudit=Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,valor?.[key]]));

      // .select() devolve a linha COMO O BANCO A GUARDOU. Assim o carimbo que
      // mandamos de volta ao navegador é exatamente o que estará lá na próxima
      // comparação — sem discrepância de formato.
      const salvarVersao=exigeMotorFinanceiro?salvarFinanceiroComAuditoria:salvarComAuditoria;
      const primeira=await salvarVersao({expectedUpdatedAt:updatedAt,value:valor,actor:usuario,action:exigeMotorFinanceiro?"financial_save_blob":"save_blob",before:beforeAudit,after:afterAudit});
      let gravado=primeira.applied?{updated_at:primeira.updatedAt}:null;
      // Outra gravação pode entrar entre a leitura e o UPDATE. A condição no
      // updated_at impede sobrescrita; nesse caso relê e reaplica a mesma mescla.
      if(!gravado){
        if(!basePayload)return res.status(409).json({conflict:true,reason:"Outro usuário salvou ao mesmo tempo."});
        const recente=await lerLinha();valor=mesclarTresVias(basePayload,payload,recente.payload);
        const novoAgora=new Date().toISOString();
        const retry=await salvarVersao({expectedUpdatedAt:recente.updatedAt,value:valor,actor:usuario,action:exigeMotorFinanceiro?"financial_save_blob":"save_blob",
          before:Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,recente.payload?.[key]])),after:Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,valor?.[key]]))});
        if(!retry.applied)return res.status(409).json({conflict:true,reason:"Muitas alterações simultâneas. Tente novamente."});
        gravado={updated_at:retry.updatedAt};
      }
      if(!igual(valor?.usuarios,atual?.usuarios))await salvarIndicePerfis(valor);
      return res.status(200).json({ ok: true, merged:!!houveConcorrencia||!mesmoInstante(gravado?.updated_at,agora), data:(houveConcorrencia||!mesmoInstante(gravado?.updated_at,agora))?valor:undefined, updatedAt: gravado?.updated_at || agora });
    }

    // ── 5. Quinzenas arquivadas ────────────────────────────────────
    //
    // O dataset principal e UM json so, e a Vercel corta o corpo da
    // requisicao em ~4,5MB. Com 60 funcionarios lancando ponto todo dia,
    // um dia o save simplesmente para de passar. A saida: quinzena
    // finalizada e paga sai do json principal e vira uma LINHA PROPRIA
    // (key `arced_ponto_v1__arq__2026-07-Q1`), consultada sob demanda.
    //
    // A cirurgia acontece AQUI, no servidor, sobre o estado atual do
    // banco: mover os lancamentos e gravar as duas linhas na mesma
    // requisicao elimina a janela em que um conflito perderia dados.
    // O papel (rh/admin) e conferido aqui - a tela apenas esconde o botao.

    const PAPEIS_ARQUIVO = ["admin", "rh"];
    const chaveArquivo = (qid) => `${KEY}__arq__${qid}`;
    const quinzenaValida = (qid) => /^\d{4}-\d{2}-Q[12]$/.test(String(qid || ""));

    if (action === "archive-quinzena") {
      if (!PAPEIS_ARQUIVO.includes(usuario.role)) {
        return res.status(403).json({ error: "Apenas RH e administrador podem arquivar quinzenas." });
      }
      const { quinzenaId, label, dates } = req.body.archive || {};
      if (!quinzenaValida(quinzenaId) || !Array.isArray(dates) || !dates.length) {
        return res.status(400).json({ error: "Quinzena inválida." });
      }
      if ((atual?.quinzenasArquivadas || {})[quinzenaId]) {
        return res.status(409).json({ error: "Esta quinzena já foi arquivada." });
      }
      const { data: jaExiste } = await db.from("company_app_data")
        .select("key").eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (jaExiste) {
        return res.status(409).json({ error: "Esta quinzena já foi arquivada." });
      }

      // Recorta do attendance principal apenas as datas da quinzena.
      const setDatas = new Set(dates);
      const fatia = {};
      const restante = {};
      let totalLanc = 0;
      for (const [empId, mapa] of Object.entries(atual?.attendance || {})) {
        const dentro = {};
        const fora = {};
        for (const [d, reg] of Object.entries(mapa || {})) {
          if (setDatas.has(d)) { dentro[d] = reg; totalLanc += 1; }
          else fora[d] = reg;
        }
        if (Object.keys(dentro).length) fatia[empId] = dentro;
        if (Object.keys(fora).length) restante[empId] = fora;
      }
      if (!totalLanc) {
        return res.status(400).json({ error: "Não há lançamentos nesta quinzena para arquivar." });
      }

      // Fotografia dos funcionarios envolvidos: diaria e beneficios DA EPOCA
      // ficam congelados no arquivo, mesmo que o cadastro mude depois.
      const idsEnvolvidos = new Set(Object.keys(fatia));
      const employeesSnapshot = (atual?.employees || [])
        .filter(e => idsEnvolvidos.has(e.id))
        .map(e => ({
          id: e.id, name: e.name, role: e.role || "", obra: e.obra || "",
          dailyRate: Number(e.dailyRate || 0),
          vtDaily: Number(e.vtDaily || 0), vrDaily: Number(e.vrDaily || 0),
          startDate: e.startDate || "", endDate: e.endDate || "",
        }));

      const agora = new Date().toISOString();
      const meta = {
        quinzenaId,
        label: String(label || quinzenaId),
        inicio: dates[0],
        fim: dates[dates.length - 1],
        totalLancamentos: totalLanc,
        funcionarios: employeesSnapshot.length,
        archivedAt: agora,
        archivedBy: { id: usuario.id, nome: usuario.nome },
      };
      // Autoritativo: o cliente informa apenas qual quinzena será arquivada.
      // Valores são calculados exclusivamente pelo servidor com a fotografia
      // de ponto, lotação, diária e benefícios que acabou de ler do banco.
      const resumoFinanceiro = normalizeArchivedCosts(
        summarizeArchivedCosts({ attendance: fatia, employeesSnapshot })
      );

      const { error: errArq } = await db.from("company_app_data")
        .insert({
          company_id: COMPANY,
          key: chaveArquivo(quinzenaId),
          value: { meta, attendance: fatia, employeesSnapshot, financialSnapshot: resumoFinanceiro },
          updated_at: agora,
        });
      if (errArq) throw errArq;

      const novoPrincipal = {
        ...atual,
        attendance: restante,
        archivedLaborCosts: {
          ...(atual?.archivedLaborCosts || {}),
          [quinzenaId]: resumoFinanceiro,
        },
        quinzenasArquivadas: { ...(atual?.quinzenasArquivadas || {}), [quinzenaId]: meta },
        changeLog: [
          ...(atual?.changeLog || []),
          { id: `arq_${Date.now()}`, date: agora.slice(0, 10), at: agora, type: "quinzena_archived",
            operador: usuario.nome, operadorId: usuario.id,
            message: `${usuario.nome} finalizou e arquivou a quinzena ${meta.label} (${totalLanc} lançamento(s) de ${employeesSnapshot.length} funcionário(s))` },
        ].slice(-200),
      };

      const { data: gravado, error: errMain } = await db.from("company_app_data")
        .update({ value: encodeAppData(novoPrincipal), updated_at: agora, updated_by: null })
        .eq("company_id", COMPANY).eq("key", KEY)
        .select("updated_at").maybeSingle();
      if (errMain) throw errMain;

      return res.status(200).json({ ok: true, data: novoPrincipal, updatedAt: gravado?.updated_at || agora, meta });
    }

    if (action === "list-quinzena-archives") {
      if (!PAPEIS_ARQUIVO.includes(usuario.role)) {
        return res.status(403).json({ error: "Sem permissão para ver os arquivos." });
      }
      const { data: linhas, error } = await db.from("company_app_data")
        .select("key, updated_at, value->meta")
        .eq("company_id", COMPANY)
        .like("key", `${KEY}__arq__%`);
      if (error) throw error;
      const arquivos = (linhas || [])
        .map(l => ({ key: l.key, updatedAt: l.updated_at, meta: l.meta || {} }))
        .sort((a, b) => String(b.meta?.inicio || "").localeCompare(String(a.meta?.inicio || "")));
      return res.status(200).json({ ok: true, arquivos });
    }

    if (action === "load-quinzena-archive") {
      if (!PAPEIS_ARQUIVO.includes(usuario.role)) {
        return res.status(403).json({ error: "Sem permissão para ler o arquivo." });
      }
      const { quinzenaId } = req.body || {};
      if (!quinzenaValida(quinzenaId)) return res.status(400).json({ error: "Quinzena inválida." });
      const { data: linha, error } = await db.from("company_app_data")
        .select("value, updated_at")
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (error) throw error;
      if (!linha) return res.status(404).json({ error: "Arquivo não encontrado." });
      return res.status(200).json({ ok: true, arquivo: linha.value, updatedAt: linha.updated_at });
    }

    // Restaurar e ato de ADMIN: desfaz um arquivamento feito por engano.
    // Os lancamentos voltam ao principal SEM sobrescrever o que ja existir la
    // (se alguem relancou um dia, o relancado vence e o do arquivo e descartado).
    if (action === "restore-quinzena") {
      if (usuario.role !== "admin") {
        return res.status(403).json({ error: "Apenas o administrador pode restaurar uma quinzena." });
      }
      const { quinzenaId } = req.body || {};
      if (!quinzenaValida(quinzenaId)) return res.status(400).json({ error: "Quinzena inválida." });
      const { data: linha, error: errLer } = await db.from("company_app_data")
        .select("value")
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (errLer) throw errLer;
      if (!linha) return res.status(404).json({ error: "Arquivo não encontrado." });

      const arq = linha.value || {};
      const attendance = { ...(atual?.attendance || {}) };
      let devolvidos = 0, mantidos = 0;
      for (const [empId, mapa] of Object.entries(arq.attendance || {})) {
        const destino = { ...(attendance[empId] || {}) };
        for (const [d, reg] of Object.entries(mapa || {})) {
          if (destino[d]) { mantidos += 1; continue; }
          destino[d] = reg; devolvidos += 1;
        }
        attendance[empId] = destino;
      }

      const agora = new Date().toISOString();
      const marcadores = { ...(atual?.quinzenasArquivadas || {}) };
      delete marcadores[quinzenaId];
      const custosArquivados = { ...(atual?.archivedLaborCosts || {}) };
      delete custosArquivados[quinzenaId];
      const novoPrincipal = {
        ...atual,
        attendance,
        archivedLaborCosts: custosArquivados,
        quinzenasArquivadas: marcadores,
        changeLog: [
          ...(atual?.changeLog || []),
          { id: `res_${Date.now()}`, date: agora.slice(0, 10), at: agora, type: "quinzena_restored",
            operador: usuario.nome, operadorId: usuario.id,
            message: `${usuario.nome} restaurou a quinzena ${arq.meta?.label || quinzenaId} (${devolvidos} lançamento(s) devolvido(s)${mantidos ? `, ${mantidos} mantido(s) como estavam` : ""})` },
        ].slice(-200),
      };

      const { data: gravado, error: errMain } = await db.from("company_app_data")
        .update({ value: encodeAppData(novoPrincipal), updated_at: agora, updated_by: null })
        .eq("company_id", COMPANY).eq("key", KEY)
        .select("updated_at").maybeSingle();
      if (errMain) throw errMain;

      const { error: errDel } = await db.from("company_app_data")
        .delete()
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId));
      if (errDel) throw errDel;

      return res.status(200).json({ ok: true, data: novoPrincipal, updatedAt: gravado?.updated_at || agora, devolvidos, mantidos });
    }

    return res.status(400).json({ error: "Ação desconhecida." });
  } catch (err) {
    console.error("Falha em /api/data:", err);
    // Não devolve o erro cru: pode conter nome de tabela, coluna, etc.
    return res.status(500).json({ error: "Erro interno." });
  }
}
