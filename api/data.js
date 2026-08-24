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
import { restorationRecord, restoreArchivedAttendance } from "../server/archived-restoration.js";
import { validatePurchaseChanges } from "../server/permission-policies.js";
import { validateProcurementChain } from "../server/procurement-chain-policy.js";
import { backupKeyFromEnv, createBackupBundle, verifyBackupBundle } from "../server/backup.js";
import { projectDataForUser, publicUser } from "../server/data-projection.js";
import { findSectionConflicts } from "../server/three-way-conflicts.js";
import { mergeThreeWay } from "../server/three-way-merge.js";
import { authorizeSectionChanges, validateBudgetBaselinePolicy, validateNoPhysicalDeletes, validatePlanningBaselinePolicy } from "../server/section-authorizations.js";
import { buildLegacyFinancialFacts, compareDreProjectionRows, compareFinancialScopes, summarizeCanonicalFinancialRows, summarizeLegacyFinancialFacts } from "../server/financial-shadow.js";
import { buildRequestedDreProjectionRows } from "../server/dre-projection.js";
import { applyReconciliationCommand, RECONCILIATION_COMMAND } from "../server/reconciliation-command.js";
import { authorizeReconciliationCommand } from "../server/reconciliation-policy.js";
import { executeReconciliationWithRetry } from "../server/reconciliation-execution.js";
import { projectReconciliationPatch } from "../server/reconciliation-response.js";
import { projectChangedSectionsPatch } from "../server/section-patch.js";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { validateOperationalCommandScope } from "../server/operational-command-policy.js";
import {
  requiresFinancialOperationalPersistence,
} from "../server/operational-command-persistence.js";
import {
  coreFieldsOnly, DOMAIN_ROW, mergeDomainRows, pickDomainFields, rowForAttendanceCommand,
  rowForOperationalCommand, SPLITTABLE_DOMAINS,
} from "../server/domain-row-routing.js";
import { applyAttendanceCommand, ATTENDANCE_COMMAND } from "../server/attendance-command.js";
import {
  applyEntriesToAttendance, attendanceObraKey, attendanceObraKeyPrefix,
  groupAttendanceEntriesByObra, mergeAttendanceObjects, obraBucketFromKey,
} from "../server/attendance-obra-routing.js";
import {
  CORE_REGISTRY_TABLES, summarizeCoreRegistryShadowStatus,
} from "../server/core-registry-shadow-status.js";
import { financialPersistenceMode, hasLegacyFinancialWrite, validateFinancialWritePath, validateProjectFinancialSnapshotPolicy } from "../server/financial-write-policy.js";
import { getOrCreateFolder, graph, refresh, rootItem } from "../server/microsoft/graph.js";
import { hashPortalPassword, normalizePortalEmail, validPortalPassword } from "../server/client-portal-auth.js";
import { applyPersistentAuthRateLimit, hashAppPin, verifyAppPin } from "../server/app-auth-security.js";
import { buildClientPortalPublicationRows } from "../server/client-portal-publication.js";
import { sanitizeClientError } from "../server/client-error-report.js";

const URL     = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;   // sem REACT_APP_ — server-side
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY     = "arced_ponto_v1";
const PROFILE_KEY = "arced_auth_profiles_v1";
// Linhas separadas na MESMA tabela (mesmo padrão de PROFILE_KEY e do arquivo
// de ponto por quinzena, "${KEY}__arq__<id>") - eliminam a contenção de
// escrita entre domínios que hoje disputam a mesma linha (achado de
// 20/08/2026, ver server/domain-row-routing.js para a classificação
// completa e a justificativa de por que só estes domínios). RDO
// (21/08/2026) entrou depois que duplicarRdo migrou para dispatchCommand -
// ver o comentário em domain-row-routing.js.
const PONTO_KEY = `${KEY}__ponto`;
const LOOKAHEAD_KEY = `${KEY}__lookahead`;
const CONFIG_KEY = `${KEY}__config`;
const EQUIPAMENTOS_KEY = `${KEY}__equipamentos`;
const RDO_KEY = `${KEY}__rdo`;
const SPLIT_ROW_KEYS = Object.freeze({
  [DOMAIN_ROW.PONTO]: PONTO_KEY,
  [DOMAIN_ROW.LOOKAHEAD]: LOOKAHEAD_KEY,
  [DOMAIN_ROW.CONFIG]: CONFIG_KEY,
  [DOMAIN_ROW.EQUIPAMENTOS]: EQUIPAMENTOS_KEY,
  [DOMAIN_ROW.RDO]: RDO_KEY,
});
// Fase 1.5 reduzida (22/08/2026): `data.attendance` sai da linha "meta" de
// Ponto (PONTO_KEY, que continua só com locks/unlockRequests/
// dailyCheckDate/receipts) e passa a viver numa linha própria POR OBRA -
// descoberta por padrão de chave (LIKE), não por um dicionário fixo como
// SPLIT_ROW_KEYS, já que o número de obras muda com o tempo (ver
// server/attendance-obra-routing.js para a justificativa completa de
// escopo). `pontoObraKey(obraId)` gera a chave de uma obra;
// PONTO_OBRA_KEY_PREFIX é o padrão usado no filtro LIKE de lerLinha().
const PONTO_OBRA_KEY_PREFIX = attendanceObraKeyPrefix(PONTO_KEY);
const pontoObraKey = obraId => attendanceObraKey(PONTO_KEY, obraId);
const keyForDomain = domain => SPLIT_ROW_KEYS[domain] || KEY;
// A linha separada de um domínio só existe depois que
// scripts/seed-split-domain-rows.mjs roda contra a empresa. Enquanto isso
// não acontece, `rowVersions[domain]` vem null de lerLinha() - em vez de
// bloquear a escrita (o que exigiria coordenar exatamente o deploy com a
// migração, sob risco de derrubar Ponto/Lookahead/Config/Equipamentos
// inteiros até alguém rodar o script), cai de volta a gravar a linha core
// inteira, exatamente como sempre funcionou antes desta separação. Assim
// que o script rodar e a linha passar a existir, a PRÓXIMA escrita já
// migra sozinha para ela - sem exigir nenhuma ordem de deploy específica.
const linhaEfetivaParaEscrita = (domain, rowVersions) =>
  (domain!==DOMAIN_ROW.CORE && rowVersions[domain]==null) ? DOMAIN_ROW.CORE : domain;
const DRE_PROJECTION_VERSION = "2026-08-third-party-equipment-cost-v5";
const OPERATIONAL_RESPONSE_EXCLUDED_SECTIONS = [
  "operationalCommandReceipts",
  "changeLog",
];
// Ativação somente após executar a migração canônica e concluir a comparação
// em sombra. Evita quebrar instalações legadas durante a transição.
const FINANCIAL_ENGINE_ENFORCE = process.env.FINANCIAL_ENGINE_ENFORCE === "true";
export const FINANCIAL_COMMANDS = new Set(["CREATE_FINANCIAL_TITLE","REGISTER_SETTLEMENT","REVERSE_SETTLEMENT","CLOSE_ACCOUNTING_PERIOD"]);
export const FINANCIAL_COMMAND_ROLES = {
  CREATE_FINANCIAL_TITLE:["admin","financeiro"], REGISTER_SETTLEMENT:["admin","financeiro"],
  REVERSE_SETTLEMENT:["admin","financeiro"], CLOSE_ACCOUNTING_PERIOD:["admin"],
};
// Mesmo padrão de authorizeOperationalCommand, para o motor financeiro
// canônico (rota "financial-command").
export const authorizeFinancialCommand = (commandType, role) => {
  if (!FINANCIAL_COMMANDS.has(commandType)) return { ok:false, status:400, error:"Comando financeiro inválido." };
  if (!FINANCIAL_COMMAND_ROLES[commandType].includes(role)) return { ok:false, status:403, error:"Seu perfil não pode executar este comando financeiro." };
  return { ok:true };
};
const RECONCILIATION_COMMANDS=new Set(Object.values(RECONCILIATION_COMMAND));
const ATTENDANCE_COMMANDS=new Set(Object.values(ATTENDANCE_COMMAND));
export const OPERATIONAL_COMMAND_ROLES = {
  [OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_REOPENED]:["admin"],
  [OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_RELEASED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED]:["admin","compras","financeiro","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENTS_GENERATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_ADMIN_CLOSED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_BILLED]:["admin","financeiro","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED]:["admin","comercial"],
  [OPERATIONAL_COMMAND.PROJECT_EXPENSE_CREATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.PROJECT_EXPENSE_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_EXPENSE_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CREATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_CANCELLED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IGNORED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.BANK_TRANSACTIONS_REOPENED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_RECORDED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_REVERSED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_PAID]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_INVOICE_LINKED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.INVOICE_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.INVOICE_APPROVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.SUPPLIER_SAVED]:["admin","compras","financeiro"],
  [OPERATIONAL_COMMAND.MATERIAL_SAVED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_QUOTE_CANCELLED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED]:["admin","rh"],
  [OPERATIONAL_COMMAND.EMPLOYEE_SAVED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CANCELLED]:["admin","rh"],
  [OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_SAVED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_DELETED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_PHASES_SAVED]:["admin"],
  [OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_ITEM_INSPECTED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_NONCONFORMITY_RESOLVED]:["admin","engenheiro","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_RECORD_DETAILS_UPDATED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED]:["admin","engenheiro","seguranca"],
  [OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED]:["admin","engenheiro","seguranca"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_CREATED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre","qualidade","seguranca"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre","qualidade","seguranca"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED]:["admin"],
  [OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED]:["admin"],
  [OPERATIONAL_COMMAND.EQUIPMENT_SAVED]:["admin","engenheiro","engenheiro_auditor","compras","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED]:["admin","engenheiro","engenheiro_auditor","compras","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED]:["admin","engenheiro","engenheiro_auditor","compras","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_CANCELLED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_CANCELLED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
};
// Extraído do handler para ser testável sem mock de Supabase/HTTP - é o
// único ponto de rejeição por papel para comandos operacionais.
export const authorizeOperationalCommand = (commandType, role) => {
  const roles = OPERATIONAL_COMMAND_ROLES[commandType];
  if (!roles) return { ok:false, status:400, error:"Comando operacional inválido." };
  if (!roles.includes(role)) return { ok:false, status:403, error:"Seu perfil não pode executar este comando operacional." };
  return { ok:true };
};
const FINANCIAL_OPERATIONAL_COMMANDS=new Set([
  OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED,
  OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_SAVED,OPERATIONAL_COMMAND.CLIENT_MEASUREMENTS_GENERATED,
  OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_CANCELLED,OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,
  OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_ADMIN_CLOSED,
  OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_BILLED,
  OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED,
  OPERATIONAL_COMMAND.PROJECT_EXPENSE_CREATED,OPERATIONAL_COMMAND.PROJECT_EXPENSE_CANCELLED,
  OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED,OPERATIONAL_COMMAND.COMPANY_EXPENSE_CANCELLED,
  OPERATIONAL_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED,
  OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CREATED,OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,
  OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED,OPERATIONAL_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED,
  OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED,
  OPERATIONAL_COMMAND.PURCHASE_CANCELLED,
  OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED,
  OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IGNORED,
  OPERATIONAL_COMMAND.BANK_TRANSACTIONS_REOPENED,
  OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_RECORDED,
  OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,
  OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,
  OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED,
  OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,
  OPERATIONAL_COMMAND.THIRD_PARTY_INVOICE_LINKED,
  OPERATIONAL_COMMAND.INVOICE_SAVED,
  OPERATIONAL_COMMAND.INVOICE_APPROVED,
  OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED,
  OPERATIONAL_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE,
  OPERATIONAL_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED,
  OPERATIONAL_COMMAND.PURCHASE_QUOTE_CANCELLED,
  OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED,
  OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED,
  OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
  OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED,
  OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CANCELLED,
  OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,
  OPERATIONAL_COMMAND.PROJECT_SAVED,OPERATIONAL_COMMAND.PROJECT_DELETED,
  OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED,
  OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED,
  OPERATIONAL_COMMAND.EQUIPMENT_SAVED,OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED,
  OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED,OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,
  OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,
]);
const BACKUP_FOLDER="00 - Backups ARCD";
const cronAutorizado=req=>!!process.env.CRON_SECRET&&req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`;

const db = URL&&SERVICE ? createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
// Achado de 24/08/2026 (docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Fase 2,
// primeiro consumidor real"): qualquer chamada db.auth.* (signInWithPassword,
// refreshSession, getUser, admin.*) muda o estado interno de autenticação do
// próprio cliente - chamadas .from()/.rpc() POSTERIORES nesse mesmo cliente
// passam a usar o JWT da sessão/usuário em vez da service_role key com que o
// cliente foi criado. Isso já derrubou core-registry-report com "permission
// denied" (tabelas que revogam tudo exceto service_role) e pode estar
// silenciosamente afetando qualquer leitura/escrita feita DEPOIS da
// resolução de `usuario` em toda ação deste arquivo - inclusive em
// instâncias "quentes" da função serverless, que sobrevivem entre
// requisições. authDb existe só para isolar as chamadas .auth.* - nunca deve
// ser usado para .from()/.rpc() de dado; `db` nunca deve receber uma chamada
// .auth.*.
const authDb = URL&&SERVICE ? createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

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
const clientErrorBuckets = new Map();
const CLIENT_ERROR_WINDOW = 60 * 1000;
const CLIENT_ERROR_LIMIT = 12;

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
const aceitarErroCliente = (ip, now=Date.now()) => {
  const atual=clientErrorBuckets.get(ip);
  if(!atual||now-atual.desde>=CLIENT_ERROR_WINDOW){
    clientErrorBuckets.set(ip,{desde:now,n:1});
    return true;
  }
  atual.n+=1;
  return atual.n<=CLIENT_ERROR_LIMIT;
};
const limparFalhas = subject => tentativas.delete(subject);
const rateLimitCentral=async(subject,action)=>{
  const result=await applyPersistentAuthRateLimit(db,{company:COMPANY,subject,action});
  return result?{blocked:result.blocked,retry:result.retryAfter}:null;
};

// Lê a linha core e mescla nela as linhas separadas (Ponto/Lookahead/
// Config/Equipamentos), quando existirem. Antes da migração de dado rodar
// (ver scripts/seed-split-domain-rows.mjs), essas linhas simplesmente não
// existem ainda - o merge trata isso como "nenhuma contribuição", e os
// campos continuam vindo da linha core como sempre vieram, sem quebrar
// nada. `rowVersions` devolve o updated_at de CADA linha, para quem grava
// um domínio separado usar como CAS da própria linha, em vez do updated_at
// da core (que mudar por outro motivo não deveria invalidar essa gravação).
const lerLinha = async () => {
  // Achado de 21/08/2026: as três leituras abaixo (linha core, linhas
  // separadas de domínio fixo, linhas de Ponto por obra) são independentes
  // - não há motivo para uma esperar a outra terminar. Rodá-las em
  // paralelo (em vez de sequencialmente) tira round-trips inteiros de rede
  // do caminho crítico de toda gravação. A terceira usa LIKE (padrão de
  // chave), não um .in() de lista fixa, porque o número de obras muda com
  // o tempo - ver server/attendance-obra-routing.js.
  const splitEntries = Object.entries(SPLIT_ROW_KEYS);
  const [{ data, error }, { data: splitRows, error: splitError }, { data: pontoObraRows, error: pontoObraError }] = await Promise.all([
    db.from("company_app_data").select("value, updated_at")
      .eq("company_id", COMPANY).eq("key", KEY).maybeSingle(),
    db.from("company_app_data").select("key, value, updated_at")
      .eq("company_id", COMPANY).in("key", splitEntries.map(([, key]) => key)),
    db.from("company_app_data").select("key, value, updated_at")
      .eq("company_id", COMPANY).like("key", `${PONTO_OBRA_KEY_PREFIX}%`),
  ]);
  if (error) throw error;
  if (!data) return { payload: null, updatedAt: null, rowVersions: {}, rowVersionsPontoObra: {} };
  if (splitError) throw splitError;
  if (pontoObraError) throw pontoObraError;
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

  const rowVersions = { [DOMAIN_ROW.CORE]: data.updated_at || null };
  const rowPayloadsByDomain = {};
  for (const [domain, key] of splitEntries) {
    const row = (splitRows || []).find(item => item.key === key);
    rowVersions[domain] = row?.updated_at || null;
    if (row) rowPayloadsByDomain[domain] = decodeAppData(row.value);
  }
  let merged = mergeDomainRows(payload, rowPayloadsByDomain);

  // A cópia de `attendance` que sobrar em `merged` até aqui vem da linha
  // "meta" de Ponto (ou, se essa também não existir ainda, da própria
  // core) - é o fallback correto para qualquer obra que ainda não ganhou
  // linha própria. Uma linha por obra, quando existe, sempre VENCE esse
  // fallback (mergeAttendanceObjects: fontes posteriores vencem).
  const rowVersionsPontoObra = {};
  const attendanceSources = [merged.attendance || {}];
  for (const row of pontoObraRows || []) {
    rowVersionsPontoObra[obraBucketFromKey(PONTO_KEY, row.key)] = row.updated_at || null;
    attendanceSources.push(decodeAppData(row.value)?.attendance || {});
  }
  merged = { ...merged, attendance: mergeAttendanceObjects(...attendanceSources) };

  return { payload: merged, updatedAt: data.updated_at || null, rowVersions, rowVersionsPontoObra };
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
// Toda gravação na linha core passa por aqui - `value` pode chegar com uma
// cópia inteira de Ponto/Lookahead/Config/Equipamentos dentro (porque
// `atual`/`resultData`, em qualquer chamador, vêm do `data` já mesclado por
// lerLinha()). coreFieldsOnly tira essas 4 linhas separadas do que
// realmente vai ser codificado/gravado na core - sem isso, cada gravação
// core reencodava (gzip) e regravava todo o histórico dessas 4 linhas de
// novo, sem necessidade (achado de 21/08/2026: era a causa real de
// EMPLOYEE_SAVED levando ~25s mesmo depois da separação de linhas).
const salvarComAuditoria = async ({ key=KEY, expectedUpdatedAt, value, rowVersions={}, keepDomain=null, actor, action, before, after }) => {
  const correlationId=crypto.randomUUID();
  const valorPersistido=key===KEY?coreFieldsOnly(value,rowVersions,keepDomain):value;
  const {data,error}=await db.rpc("company_save_with_audit",{
    p_company_id:COMPANY,p_key:key,p_expected_updated_at:expectedUpdatedAt,p_value:encodeAppData(valorPersistido),
    p_actor_id:String(actor?.id||"system"),p_actor_name:String(actor?.nome||actor?.email||"Sistema"),
    p_correlation_id:correlationId,p_action:action,p_before:before||{},p_after:after||{},
  });
  if(error){
    if(/PGRST202|schema cache|Could not find the function|does not exist/i.test(`${error.code||""} ${error.message||""}`)){
      const missing=new Error("A migration de persistência e auditoria ainda não foi aplicada.");
      missing.code="AUDIT_RPC_MIGRATION_REQUIRED";
      throw missing;
    }
    throw error;
  }
  const result=Array.isArray(data)?data[0]:data;
  return { applied:!!result?.applied, updatedAt:result?.updated_at||null, correlationId };
};

const executarArquivoPontoTransacional=async({
  mode,mainKey=KEY,expectedUpdatedAt,mainValue,archiveKey,archiveValue,actor,before,after,
})=>{
  const correlationId=crypto.randomUUID();
  const rpc=mode==="archive"?"attendance_archive_transaction":"attendance_restore_transaction";
  const args={
    p_company_id:COMPANY,p_main_key:mainKey,p_archive_key:archiveKey,
    p_expected_updated_at:expectedUpdatedAt,p_main_value:encodeAppData(mainValue),
    p_actor_id:String(actor?.id||"system"),p_actor_name:String(actor?.nome||actor?.email||"Sistema"),
    p_actor_role:String(actor?.role||""),
    p_correlation_id:correlationId,p_before:before||{},p_after:after||{},
  };
  if(mode==="archive")args.p_archive_value=archiveValue||{};
  const {data,error}=await db.rpc(rpc,args);
  if(error){
    const wrapped=new Error(/PGRST202|schema cache|Could not find the function|does not exist/i.test(`${error.code||""} ${error.message||""}`)
      ?"A migration transacional do arquivo de ponto não foi aplicada."
      :"A transação do arquivo de ponto falhou.");
    wrapped.code=/migration/i.test(wrapped.message)?"ATTENDANCE_ARCHIVE_MIGRATION_REQUIRED":"ATTENDANCE_ARCHIVE_FAILED";
    throw wrapped;
  }
  const result=Array.isArray(data)?data[0]:data;
  return {
    applied:!!result?.applied,updatedAt:result?.updated_at||null,
    reason:String(result?.reason||""),correlationId,
  };
};

// Achado de 21/08/2026 (limitação documentada duas vezes sem correção -
// ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): o arquivamento/restauração de
// ponto sempre grava `attendance` na linha core (`p_main_key=KEY`, sem
// roteamento por domínio), porque tornar attendance_archive_transaction/
// attendance_restore_transaction (já uma RPC de duas chaves) ciente de um
// terceiro alvo (a linha de Ponto) exigiria uma nova migration
// transacional de três chaves - risco maior do que o benefício justifica
// para uma ação rara (admin, periódica, não concorrente com o check-in
// normal). Em vez disso, esta segunda escrita best-effort sincroniza a
// cópia de `attendance` na linha própria de Ponto logo depois que a
// transação principal já confirmou o arquivamento/restauração - fecha a
// lacuna que fazia a leitura (que sempre prioriza a linha de Ponto sobre a
// core para esse campo) ignorar o resultado. Se essa segunda escrita
// falhar (ex.: conflito de versão por um check-in concorrente
// raríssimo), o arquivamento em si já está correto e seguro na linha
// core - só fica registrado no log do servidor, sem bloquear a resposta.
// Achado de 22/08/2026 (Fase 1.5 reduzida): `attendance` saiu de
// DOMAIN_FIELDS[PONTO], então pickDomainFields sozinho passou a devolver só
// os 4 campos meta - esta função silenciosamente deixaria de sincronizar a
// própria coisa para a qual existe. O arquivamento/restauração não conhece
// obra por obra (a RPC opera a quinzena inteira, todos os funcionários), só
// o resultado final consolidado (`novoPrincipal.attendance`, já com o
// funcionário/data arquivado removido ou restaurado) - dividir esse
// resultado por obra exigiria diferenciar antes/depois entrada a entrada,
// risco maior do que uma ação rara e não concorrente justifica (mesma lógica
// do comentário acima). Em vez disso, grava o blob completo como cópia
// legada na própria linha de Ponto: para qualquer (funcionário,data) que
// ainda não migrou para uma linha própria de obra, essa cópia já é a fonte
// lida por lerLinha(); para quem já migrou, a linha de obra continua
// vencendo a leitura (mergeAttendanceObjects) - a mesma tolerância de
// "melhor esforço" que este best-effort já assumia antes desta fase.
const sincronizarPontoAposArquivo=async({rowVersions,novoPrincipal,actor,quinzenaId,action})=>{
  if(rowVersions?.[DOMAIN_ROW.PONTO]==null)return;
  try{
    await salvarComAuditoria({
      key:PONTO_KEY,expectedUpdatedAt:rowVersions[DOMAIN_ROW.PONTO],
      value:{...pickDomainFields(novoPrincipal,DOMAIN_ROW.PONTO),attendance:novoPrincipal.attendance||{}},
      actor,action,before:{quinzenaId},after:{quinzenaId},
    });
  }catch(err){
    console.error(`Falha ao sincronizar attendance na linha de Ponto apos ${action}:`,err.message);
  }
};

// `financialSnapshotData` é o `data` COMPLETO mesclado (todos os domínios),
// usado só para calcular os fatos financeiros de sincronização
// (buildLegacyFinancialFacts lê medicoes/pedidos/notasFiscais/etc., que não
// existem no `value` quando `value` é a fatia de uma linha separada, ex.:
// Equipamentos). Sem esse parâmetro, gravar um comando de Equipamentos
// routeado para a própria linha zeraria silenciosamente o snapshot
// financeiro. Todo chamador que ainda grava a linha core inteira (o caso de
// sempre, antes desta separação) não precisa passá-lo - o default preserva
// o comportamento exato de antes.
const salvarFinanceiroComAuditoria = async ({ key=KEY, expectedUpdatedAt, value, financialSnapshotData=value, rowVersions={}, keepDomain=null, actor, action, before, after }) => {
  // Enquanto FIN-003 está em sombra, o legado é a fonte oficial. Exigir a
  // reconstrução integral do razão dentro de cada clique deixava conciliações
  // presas em 503 sob concorrência. A ativação do enforcement restaura a
  // transação conjunta; até lá, preservamos disponibilidade + auditoria.
  if(financialPersistenceMode(FINANCIAL_ENGINE_ENFORCE)==="audited_shadow"){
    return salvarComAuditoria({key,expectedUpdatedAt,value,rowVersions,keepDomain,actor,action,before,after});
  }
  if(!process.env.POSTGRES_URL_NON_POOLING)throw new Error("A conexão transacional do motor financeiro não está configurada.");
  const correlationId=crypto.randomUUID();
  const sql=postgres(process.env.POSTGRES_URL_NON_POOLING,{ssl:"require",max:1,connect_timeout:20,idle_timeout:5});
  try{
    const snapshot=buildLegacyFinancialFacts(financialSnapshotData,{includeDreSnapshots:false});
    const valorPersistido=key===KEY?coreFieldsOnly(value,rowVersions,keepDomain):value;
    const [result]=await sql`
      select * from financial_save_with_sync(
        ${COMPANY},${key},${expectedUpdatedAt},${sql.json(encodeAppData(valorPersistido))},
        ${String(actor?.id||"system")},${String(actor?.nome||actor?.email||"Sistema")},
        ${correlationId},${action},${sql.json(before||{})},${sql.json(after||{})},${sql.json(snapshot)},
        false
      )
    `;
    return {
      applied:!!result?.applied,updatedAt:result?.updated_at||null,
      correlationId,syncResult:result?.sync_result||{},
    };
  }finally{await sql.end({timeout:2});}
};

const operationalCommandEntityId=command=>
  command.payload?.statement?.id
  ||command.payload?.targets?.[0]?.id
  ||command.payload?.contractId
  ||command.payload?.medicaoTecnicaId
  ||command.payload?.expenseId
  ||command.payload?.measurementId
  ||command.payload?.pedidoId
  ||command.payload?.targetId
  ||command.payload?.paymentId
  ||command.payload?.recordId
  ||command.payload?.reportId
  ||command.payload?.commitmentId
  ||command.payload?.rentalId
  ||command.payload?.unavailabilityId
  ||command.payload?.equipmentId
  ||command.payload?.rescissionId
  ||command.payload?.advanceId
  ||command.payload?.projectId
  ||command.payload?.payment?.id
  ||command.payload?.expense?.id
  ||command.payload?.rescission?.id
  ||command.payload?.employee?.id
  ||command.payload?.advance?.id
  ||command.payload?.project?.id
  ||command.payload?.request?.id
  ||command.payload?.supplier?.id
  ||command.payload?.material?.id
  ||command.payload?.report?.id
  ||command.payload?.measurement?.id
  ||command.payload?.record?.id
  ||command.payload?.commitment?.id
  ||command.payload?.equipment?.id
  ||command.payload?.rental?.id
  ||command.payload?.unavailability?.id
  ||command.payload?.maintenance?.id
  ||command.payload?.transfer?.id
  ||command.payload?.records?.[0]?.id
  ||(command.type===OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED?"company-config":"");

// Só estes 7 campos alimentam financial_titles/settlements/bank_transactions
// (buildLegacyFinancialFacts, server/financial-shadow.js:33-114) - dreSnapshots
// NÃO entra aqui de propósito: depende de employees/config/obras/equipamentos/
// rescisoes (labor-cost-engine.js, dre-projection.js) e já se auto-repara na
// leitura (ver includeDreSnapshots:false abaixo), então nunca precisa
// disparar a sincronização síncrona por si só.
export const LEGACY_FINANCIAL_FACT_FIELDS=[
  "medicoes","payments","pagsTerceiros","outrasDesp","despesasEmpresa","pedidos","transacoes",
];
export const legacyFinancialFactsChanged=(before,after)=>
  LEGACY_FINANCIAL_FACT_FIELDS.some(field=>
    JSON.stringify(before?.[field])!==JSON.stringify(after?.[field]));

const gravarMutacaoNaTransacao=async({
  transaction,key=KEY,rowVersions={},keepDomain=null,value,basePayload=null,actor,action,before,after,financial=false,
})=>{
  const correlationId=crypto.randomUUID();
  // Achado de 21/08/2026: este era o único ponto do caminho travado que
  // ainda gravava sempre em key=KEY, ignorando o roteamento por domínio -
  // ver executarMutacaoEmpresaBloqueada. Quando key aponta para uma linha
  // separada, `value` já chega recortado (pickDomainFields) e não precisa
  // de coreFieldsOnly; só a linha core precisa da poda.
  const valorPersistido=key===KEY?coreFieldsOnly(value,rowVersions,keepDomain):value;
  // basePayload só existe quando o chamador tem o dado completo de antes da
  // mutação em mãos (executarMutacaoEmpresaBloqueada); sem ele, o default
  // (true) preserva o comportamento de sempre - sincroniza incondicionalmente.
  const legacyFactsChanged=basePayload==null||legacyFinancialFactsChanged(basePayload,valorPersistido);
  if(financial&&FINANCIAL_ENGINE_ENFORCE&&legacyFactsChanged){
    // Achado de 21/08/2026: financial_sync_legacy_facts reconstruía também
    // os ~1.764 snapshots de DRE da empresa a cada chamada, dominando o
    // tempo do request (~25s medidos ao vivo). O DRE já se auto-repara na
    // leitura (ação financial-dre-report, via sourceRevision/updated_at),
    // então o caminho de escrita nunca precisa reconstruí-lo.
    const snapshot=buildLegacyFinancialFacts(valorPersistido,{includeDreSnapshots:false});
    const [saved]=await transaction`
      select * from financial_save_with_sync(
        ${COMPANY},${key},
        (
          select updated_at
            from company_app_data
           where company_id=${COMPANY} and key=${key}
        ),
        ${JSON.stringify(encodeAppData(valorPersistido))}::jsonb,
        ${String(actor?.id||"system")},${String(actor?.nome||actor?.email||"Sistema")},
        ${correlationId},${action},
        ${JSON.stringify(before||{})}::jsonb,
        ${JSON.stringify(after||{})}::jsonb,
        ${JSON.stringify(snapshot)}::jsonb,
        false
      )
    `;
    if(!saved?.applied)throw new Error("A mutação financeira perdeu o bloqueio exclusivo da base.");
    return {updatedAt:saved.updated_at,syncResult:saved.sync_result||{}};
  }

  const [saved]=await transaction`
    update company_app_data
       set value=${JSON.stringify(encodeAppData(valorPersistido))}::jsonb,
           updated_at=clock_timestamp(),
           updated_by=null
     where company_id=${COMPANY} and key=${key}
     returning updated_at
  `;
  if(!saved)throw new Error("A base da empresa desapareceu durante o salvamento.");
  await transaction`
    insert into audit_events(
      company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
      correlation_id,before_snapshot,after_snapshot,source
    ) values (
      ${COMPANY},'company_app_data',${key},${action},
      ${String(actor?.id||"system")},${String(actor?.nome||actor?.email||"Sistema")},
      ${correlationId},
      ${JSON.stringify(before||{})}::jsonb,
      ${JSON.stringify(after||{})}::jsonb,
      'api/data'
    )
  `;
  return {updatedAt:saved.updated_at};
};

// Todos os escritores do blob passam pelo mesmo bloqueio do PostgreSQL - mas,
// diferente das tentativas otimistas (CAS) que já roteiam por domínio desde
// 20/08/2026, este caminho travava e gravava sempre a linha core, ignorando
// a separação de linhas inteiramente (achado de 21/08/2026 - Ponto,
// Lookahead, Config, Equipamentos e RDO nunca chegavam à própria linha
// aqui, reintroduzindo a MESMA contenção cruzada que a separação deveria
// eliminar). Corrigido travando só a linha do domínio de fato escrito
// (`domain`), enquanto o restante do dado (para leitura cross-domain em
// `mutate()`, ex.: Produção lendo `employees`) vem de uma leitura sem lock
// via `lerLinha()` - a mesma tradeoff que o caminho CAS já usa: a
// consistência de quem É travado/escrito é garantida pelo lock real; a
// consistência de quem só é lido continua garantida por `expectedVersion`
// checado dentro de `mutate()`, não por um lock de leitura.
const executarMutacaoEmpresaBloqueada=async({actor,action,financial=false,domain=DOMAIN_ROW.CORE,linha:linhaConhecida=null,mutate})=>{
  // Achado de 21/08/2026: todo chamador já fez lerLinha() uma vez no topo
  // do handler, antes de qualquer branch. Reaproveitar essa leitura em vez
  // de repeti-la aqui evita um round-trip de rede inteiro - a mesma
  // leitura sem lock, só que mais nova que a garantia que realmente
  // precisamos (a tolerância a essa "quase-mesma-idade" é igual à de
  // sempre: só o que É travado precisa estar fresco).
  const linha=linhaConhecida||await lerLinha();
  const effectiveDomain=linhaEfetivaParaEscrita(domain,linha.rowVersions);
  const key=keyForDomain(effectiveDomain);
  const connection=postgres(process.env.POSTGRES_URL_NON_POOLING,{
    ssl:"require",max:1,connect_timeout:20,idle_timeout:5,
  });
  try{
    return await connection.begin(async transaction=>{
      const [locked]=await transaction`
        select value,updated_at
          from company_app_data
         where company_id=${COMPANY} and key=${key}
         for update
      `;
      if(!locked)return {kind:"error",status:404,error:"Base de dados da empresa não encontrada."};
      // Reconstrói a visão mesclada completa (para mutate() ler qualquer
      // campo cross-domain), mas usando para `effectiveDomain` o valor
      // ACABADO DE TRAVAR - nunca a cópia de `linha` (lida sem lock antes da
      // transação), que poderia estar desatualizada por uma escrita
      // concorrente na janela entre a leitura e a aquisição do lock.
      const freshSlice=decodeAppData(locked.value);
      const rowPayloadsByDomain=Object.fromEntries(
        SPLITTABLE_DOMAINS.map(dominio=>[
          dominio,
          dominio===effectiveDomain?freshSlice:pickDomainFields(linha.payload,dominio),
        ]),
      );
      const corePayload=effectiveDomain===DOMAIN_ROW.CORE?freshSlice:coreFieldsOnly(linha.payload,linha.rowVersions);
      const current=mergeDomainRows(corePayload,rowPayloadsByDomain);
      const outcome=await mutate({payload:current,updatedAt:locked.updated_at});
      if(!outcome||outcome.kind!=="save")return outcome;
      const valueToWrite=effectiveDomain===DOMAIN_ROW.CORE?outcome.data:pickDomainFields(outcome.data,effectiveDomain);
      const saved=await gravarMutacaoNaTransacao({
        transaction,key,rowVersions:linha.rowVersions,keepDomain:effectiveDomain,
        value:valueToWrite,basePayload:freshSlice,actor,action,
        before:outcome.before,after:outcome.after,financial,
      });
      return {...outcome,updatedAt:saved.updatedAt,syncResult:saved.syncResult};
    });
  }finally{
    await connection.end({timeout:2});
  }
};

// Uma alteração real na mesma entidade continua sendo recusada por
// `expectedVersion`; concorrência em outro módulo apenas aguarda o bloqueio.
const executarComandoOperacionalBloqueado=async({command,usuario,financial,linha})=>{
  return executarMutacaoEmpresaBloqueada({
    actor:usuario,
    action:`operational_${command.type.toLowerCase()}`,
    financial,
    domain:rowForOperationalCommand(command.type),
    linha,
    mutate:async({payload:current,updatedAt})=>{
      const scope=validateOperationalCommandScope({user:usuario,data:current,command});
      if(!scope.ok)return {kind:"error",status:scope.error.includes("vinculado")?400:403,error:scope.error};
      const executed=applyOperationalCommand(current,{
        ...command,actorId:usuario.id,
        actorName:usuario.nome||usuario.email||"Usuário autenticado",
      });
      if(!executed.ok)return {
        kind:"error",status:409,error:executed.reason,
        conflict:true,currentUpdatedAt:updatedAt,
      };
      if(executed.idempotent)return {
        kind:"idempotent",data:current,updatedAt,
      };
      return {
        kind:"save",data:executed.data,
        basePayload:current,
        copied:executed.copied,summary:executed.summary,
        before:{command:command.type,entityId:operationalCommandEntityId(command)},
        after:{command:command.type,idempotencyKey:command.idempotencyKey},
      };
    },
  });
};

// Fase 1.5 reduzida (22/08/2026, ver server/attendance-obra-routing.js):
// attendance-upsert/attendance-batch-upsert são os únicos comandos de Ponto
// que tocam `data.attendance` - por isso são os únicos que precisam de um
// caminho de trava dedicado, capaz de travar MAIS de uma linha na mesma
// transação (a linha "meta" de Ponto, para locks/unlockRequests/
// dailyCheckDate/receipts, mais uma linha por obra distinta tocada pelo
// lote). Os outros 5 comandos (lock/unlock/daily-check) continuam no
// executarMutacaoEmpresaBloqueada genérico, domain:PONTO, sem mudança.
//
// A leitura de `current.attendance` usada para VALIDAR o comando (dentro de
// applyAttendanceCommand) vem da cópia sem lock de `linha` (a mesma
// tolerância que o caminho otimista/CAS já aceita hoje) - só fica
// desatualizada no raro caso de dois usuários editando o EXATO mesmo
// funcionário+data ao mesmo tempo. A GRAVAÇÃO em si nunca sofre esse risco:
// cada linha de obra é travada (for update) e mesclada contra o valor
// recém-lido via applyEntriesToAttendance, nunca sobrescrita às cegas -
// nenhuma escrita concorrente em OUTRO funcionário/data da mesma obra se
// perde.
const executarComandoPontoBloqueado=async({usuario,command,operationNow,linha:linhaConhecida=null})=>{
  const linha=linhaConhecida||await lerLinha();
  const pontoEfetiva=linhaEfetivaParaEscrita(DOMAIN_ROW.PONTO,linha.rowVersions);
  const pontoKeyAlvo=keyForDomain(pontoEfetiva);
  const connection=postgres(process.env.POSTGRES_URL_NON_POOLING,{
    ssl:"require",max:1,connect_timeout:20,idle_timeout:5,
  });
  try{
    return await connection.begin(async transaction=>{
      const [lockedPonto]=await transaction`
        select value,updated_at from company_app_data
         where company_id=${COMPANY} and key=${pontoKeyAlvo}
         for update
      `;
      if(!lockedPonto)return {kind:"error",status:404,error:"Base de dados da empresa não encontrada."};
      const freshPontoSlice=decodeAppData(lockedPonto.value);
      // locks/unlockRequests/dailyCheckDate/receipts vêm da linha RECÉM
      // TRAVADA (nunca de `linha`, que pode estar desatualizada) - é o que
      // garante que ensureUnlocked e a checagem de idempotência (via
      // attendanceOperationReceipts) enxerguem o estado mais novo possível.
      const current={
        ...linha.payload,
        attendanceLocks:freshPontoSlice.attendanceLocks||{},
        unlockRequests:freshPontoSlice.unlockRequests||[],
        dailyCheckDate:freshPontoSlice.dailyCheckDate||"",
        attendanceOperationReceipts:freshPontoSlice.attendanceOperationReceipts||[],
      };
      const applied=applyAttendanceCommand(current,usuario,command,operationNow);
      if(!applied.ok)return {kind:"error",status:applied.status||400,error:applied.error};
      if(applied.idempotent)return {kind:"idempotent",result:applied.result,updatedAt:lockedPonto.updated_at};

      // Preserva (`...freshPontoSlice`) qualquer campo que já estivesse
      // gravado nesta linha antes desta escrita - inclusive um eventual
      // `attendance` legado (a própria linha de Ponto chegou a acumular
      // attendance completo antes desta Fase 1.5, quando ainda fazia parte
      // de DOMAIN_FIELDS[PONTO]). Sem o spread, esta gravação sobrescreveria
      // a linha inteira só com os 4 campos meta, apagando esse legado para
      // todo funcionário/data que este request específico não tocou.
      const pontoValue={
        ...freshPontoSlice,
        attendanceLocks:applied.data.attendanceLocks||{},
        unlockRequests:applied.data.unlockRequests||[],
        dailyCheckDate:applied.data.dailyCheckDate||"",
        attendanceOperationReceipts:applied.data.attendanceOperationReceipts||[],
      };
      const correlationId=crypto.randomUUID();
      const [savedPonto]=await transaction`
        update company_app_data
           set value=${JSON.stringify(encodeAppData(pontoValue))}::jsonb,
               updated_at=clock_timestamp(), updated_by=null
         where company_id=${COMPANY} and key=${pontoKeyAlvo}
         returning updated_at
      `;
      await transaction`
        insert into audit_events(
          company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
          correlation_id,before_snapshot,after_snapshot,source
        ) values (
          ${COMPANY},'company_app_data',${pontoKeyAlvo},${applied.audit?.action||command.action},
          ${String(usuario?.id||"system")},${String(usuario?.nome||usuario?.email||"Sistema")},
          ${correlationId},
          ${JSON.stringify(applied.audit?.before||{})}::jsonb,
          ${JSON.stringify(applied.audit?.after||{operationId:command.operationId})}::jsonb,
          'api/data'
        )
      `;

      // Uma linha por obra distinta tocada pelo lote - criada sob demanda
      // (insert ... on conflict do nothing + select for update logo em
      // seguida, para não haver corrida entre dois primeiros-escritores da
      // MESMA obra nova) e sempre mesclada contra o valor recém-travado via
      // applyEntriesToAttendance, nunca sobrescrita inteira. Não precisa de
      // um script de seed prévio: cada edição migra sozinha a célula
      // (funcionário,data) tocada, e a leitura (lerLinha) já mescla
      // corretamente linha-de-obra + sobra legada na linha de Ponto.
      const grupos=groupAttendanceEntriesByObra(applied.result?.attendance);
      for(const [obraBucket,entries] of grupos){
        const key=`${PONTO_OBRA_KEY_PREFIX}${obraBucket}`;
        await transaction`
          insert into company_app_data(company_id,key,value,updated_at,updated_by)
          values (${COMPANY},${key},${JSON.stringify(encodeAppData({attendance:{}}))}::jsonb,clock_timestamp(),null)
          on conflict (company_id,key) do nothing
        `;
        const [lockedObra]=await transaction`
          select value from company_app_data
           where company_id=${COMPANY} and key=${key}
           for update
        `;
        const existente=decodeAppData(lockedObra.value)?.attendance||{};
        const proximo=applyEntriesToAttendance(existente,entries,applied.data.attendance);
        await transaction`
          update company_app_data
             set value=${JSON.stringify(encodeAppData({attendance:proximo}))}::jsonb,
                 updated_at=clock_timestamp(), updated_by=null
           where company_id=${COMPANY} and key=${key}
        `;
      }

      return {kind:"save",result:applied.result,updatedAt:savedPonto.updated_at};
    });
  }finally{
    await connection.end({timeout:2});
  }
};

// Confere o PIN contra o hash guardado no próprio dataset
const conferirPin = (payload, userId, pin) => {
  const u = (payload?.usuarios || []).find(x => x.id === userId && x.active !== false);
  if (!u) return {usuario:null,upgradeHash:""};
  const verification=verifyAppPin(pin,u.pin);
  return {usuario:verification.ok?u:null,upgradeHash:verification.needsUpgrade?hashAppPin(pin):""};
};

const encontrarUsuarioAuth = (payload, authUser) => {
  if (!authUser) return null;
  const email = String(authUser.email || "").trim().toLowerCase();
  return (payload?.usuarios || []).find(u => u.active !== false &&
    (u.authUserId === authUser.id || String(u.email || "").trim().toLowerCase() === email)) || null;
};

const igual = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const objeto = value => value && typeof value === "object" && !Array.isArray(value);

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
    return res.status(503).json({
      error:"Persistência não configurada: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.",
      code:"PERSISTENCE_ENV_MISSING",
    });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "desconhecido";
  const { action=req.query?.action, userId, pin, accessToken, payload, expectedUpdatedAt, basePayload, sections, baseSections } = req.body || {};

  try {
    if(action==="client-error"){
      if(!aceitarErroCliente(ip))return res.status(429).json({error:"Limite de diagnósticos atingido."});
      console.error("[ARCD_CLIENT_ERROR]",JSON.stringify(sanitizeClientError(req.body)));
      return res.status(202).json({ok:true});
    }
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
      const rowsPublicados=buildClientPortalPublicationRows({data:p,projectId:obraId,publishedAt:portal.atualizadoEm || new Date().toISOString()});
      const payloads=domain=>rowsPublicados.filter(row=>row.domain===domain).map(row=>row.payload);
      const atualizacoes=payloads("weekly_update").map(item=>({id:item.id,at:item.period,mensagem:item.summary,responsavel:item.authorName||"Equipe ARCD"}));
      return res.status(200).json({ portal:{
        obra:{ id:obra.id, nome:obra.name, status:obra.status, capaUrl:obra.capaUrl || "", cliente:obra.cliente || "", engenheiro:obra.engineer || "", endereco:obra.address || "", inicio:obra.contractStart || obra.startDate || "", terminoPrevisto:obra.contractEnd || "" },
        mensagem:portal.mensagem || "Acompanhe aqui a evolução da sua obra.", progresso,
        cronograma:portal.publicarCronograma === false ? [] : tarefas.slice(0,30),
        diarios:rdos.map(r => ({ id:r.id, codigo:r.codigo, data:r.data, descricao:r.descricao || "", clima:r.clima || {}, fotos:(r.fotos||[]).filter(f=>f.publicarCliente!==false).length })),
        fotos, medicoes, documentos, atualizacoes,
        caixaResumo:payloads("cash_summary")[0] || null,
        caixaMovimentacoes:payloads("cash_movement"),
        notasFiscais:payloads("invoice"),
        compras:payloads("purchase_order"),
        cotacoes:payloads("quotation"),
        atualizadoEm:portal.atualizadoEm || "",
      }});
    }

    if (action === "auth-login") {
      const email=String(req.body?.email||"").trim().toLowerCase();
      const password=String(req.body?.password||"");
      const authSubject=`${ip}|email:${email||"unknown"}`;
      const limiteCentral=await rateLimitCentral(authSubject,"status");
      if(limiteCentral?.blocked||bloqueado(authSubject)){
        return res.status(429).json({error:"Muitas tentativas. Aguarde 5 minutos."});
      }
      const {data:auth,error}=await authDb.auth.signInWithPassword({email,password});
      if(error||!auth?.session){
        registrarFalha(authSubject);
        await rateLimitCentral(authSubject,"failure");
        return res.status(401).json({error:"E-mail ou senha inválidos."});
      }
      const {payload:p,updatedAt}=await lerLinha();
      // signInWithPassword já devolve um usuário autenticado pelo Supabase.
      // Consultá-lo novamente com getUser adicionava uma viagem de rede inteira
      // ao login sem aumentar a segurança desta mesma requisição.
      const usuario=encontrarUsuarioAuth(p,auth.user||auth.session.user);
      if(!usuario)return res.status(403).json({error:"Conta sem vínculo com um operador ativo do ArcD."});
      limparFalhas(authSubject);
      await rateLimitCentral(authSubject,"success");
      const completo=await anexarCustosArquivados(p);
      return res.status(200).json({data:projectDataForUser(completo,usuario),updatedAt,usuario:publicUser(usuario),accessToken:auth.session.access_token,refreshToken:auth.session.refresh_token});
    }

    if (action === "auth-refresh") {
      const {data:auth,error}=await authDb.auth.refreshSession({refresh_token:String(req.body?.refreshToken||"")});
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

      const recebido = (payload?.usuarios || [])[0];
      const pinInicial=String(recebido?.pinPlain||"");
      if (!recebido?.id || pinInicial.length<4) {
        return res.status(400).json({ error: "Dados do administrador incompletos." });
      }
      const {pinPlain:_,...camposUsuario}=recebido;
      const novoUsuario={...camposUsuario,pin:hashAppPin(pinInicial)};

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
    // Token JWT válido não participa do contador de tentativas de PIN. Isso
    // impede que falhas de outra pessoa no mesmo NAT bloqueiem sessões ativas.
    const usaPin=!accessToken;
    if(usaPin){
      const limiteCentral=await rateLimitCentral(ip,"status");
      if (limiteCentral?.blocked||bloqueado(ip)) {
        return res.status(429).json({ error: "Muitas tentativas. Aguarde 5 minutos." });
      }
    }

    // A leitura do dataset e a validação do token não dependem uma da outra.
    // Em sessões por e-mail, fazê-las em paralelo reduz o tempo até o dashboard
    // ao maior dos dois tempos, em vez de somar as duas esperas de rede.
    const [linha,tokenAuth] = await Promise.all([
      lerLinha(),
      accessToken ? authDb.auth.getUser(accessToken) : Promise.resolve({data:null,error:null}),
    ]);
    let { payload: atual, updatedAt, rowVersions, rowVersionsPontoObra } = linha;
    const pinAuth=usaPin?conferirPin(atual,userId,pin):{usuario:null,upgradeHash:""};
    const usuario = (!tokenAuth.error&&tokenAuth.data?.user?encontrarUsuarioAuth(atual,tokenAuth.data.user):null) || pinAuth.usuario;

    if (!usuario) {
      if(usaPin){
        registrarFalha(ip);
        await rateLimitCentral(ip,"failure");
      }
      return res.status(401).json({ error: "Sessão inválida ou PIN incorreto." });
    }
    if(usaPin){
      limparFalhas(ip);
      await rateLimitCentral(ip,"success");
      if(pinAuth.upgradeHash){
        const atualizado={...atual,usuarios:(atual.usuarios||[]).map(item=>item.id===usuario.id?{...item,pin:pinAuth.upgradeHash}:item)};
        const migration=await salvarComAuditoria({
          expectedUpdatedAt:updatedAt,value:atualizado,rowVersions,actor:usuario,action:"auth_pin_upgraded",
          before:{userId:usuario.id,algorithm:"sha256"},after:{userId:usuario.id,algorithm:"scrypt-v1"},
        });
        if(migration.applied){
          atual=atualizado;
          updatedAt=migration.updatedAt;
          await salvarIndicePerfis(atualizado);
        }
      }
    }

    if(action==="auth-pin-set"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores podem definir o PIN de operadores."});
      const targetUserId=String(req.body?.targetUserId||"");
      const newPin=String(req.body?.newPin||"");
      if(newPin.length<4||newPin.length>12||!/^[0-9]+$/.test(newPin))return res.status(400).json({error:"O PIN deve conter entre 4 e 12 dígitos."});
      const outcome=await executarMutacaoEmpresaBloqueada({
        actor:usuario,action:"auth_pin_set",financial:false,
        linha:{payload:atual,rowVersions},
        mutate:async({payload:current})=>{
          const target=(current.usuarios||[]).find(item=>String(item.id)===targetUserId);
          if(!target)return {kind:"error",status:404,error:"Operador não encontrado."};
          return {
            kind:"save",
            data:{...current,usuarios:(current.usuarios||[]).map(item=>String(item.id)===targetUserId?{...item,pin:hashAppPin(newPin)}:item)},
            before:{userId:targetUserId,credentialChanged:true},after:{userId:targetUserId,algorithm:"scrypt-v1"},
          };
        },
      });
      if(outcome.kind==="error")return res.status(outcome.status||400).json({error:outcome.error});
      await salvarIndicePerfis(outcome.data);
      return res.status(200).json({ok:true,data:projectDataForUser(outcome.data,usuario),updatedAt:outcome.updatedAt});
    }

    if (action === "auth-provision") {
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores podem ativar contas."});
      const alvo=(atual.usuarios||[]).find(u=>u.id===req.body?.targetUserId);
      const email=String(alvo?.email||"").trim().toLowerCase(), password=String(req.body?.password||"");
      if(!alvo||!email)return res.status(400).json({error:"Cadastre um e-mail válido para o operador."});
      if(password.length<8)return res.status(400).json({error:"A senha temporária deve ter ao menos 8 caracteres."});
      let authId=alvo.authUserId||"";
      if(authId){
        const {error}=await authDb.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{arcdUserId:alvo.id,nome:alvo.nome}});
        if(error)return res.status(400).json({error:error.message});
      }else{
        // A conta pode ter sido criada antes da implantação do vínculo
        // authUserId (ou diretamente no painel do Supabase). Nesse caso não
        // tentamos cadastrar o mesmo e-mail novamente: localizamos a conta,
        // redefinimos a senha e passamos a vinculá-la ao operador do ArcD.
        const {data:listagem,error:erroLista}=await authDb.auth.admin.listUsers({page:1,perPage:1000});
        if(erroLista)return res.status(400).json({error:erroLista.message});
        const existente=(listagem?.users||[]).find(u=>String(u.email||"").trim().toLowerCase()===email);
        if(existente){
          const vinculo=(atual.usuarios||[]).find(u=>u.id!==alvo.id&&u.authUserId===existente.id);
          if(vinculo)return res.status(409).json({error:`Este e-mail já está vinculado ao operador ${vinculo.nome}.`});
          authId=existente.id;
          const {error}=await authDb.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{...(existente.user_metadata||{}),arcdUserId:alvo.id,nome:alvo.nome}});
          if(error)return res.status(400).json({error:error.message});
        }else{
          const {data:criado,error}=await authDb.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{arcdUserId:alvo.id,nome:alvo.nome}});
          if(error)return res.status(400).json({error:error.message});
          authId=criado.user.id;
        }
      }
      if(process.env.POSTGRES_URL_NON_POOLING){
        const outcome=await executarMutacaoEmpresaBloqueada({
          actor:usuario,action:"auth_provision",
          linha:{payload:atual,rowVersions},
          mutate:async({payload:current})=>{
            const vigente=(current.usuarios||[]).find(u=>u.id===alvo.id);
            if(!vigente)return {kind:"error",status:409,error:"O operador foi removido durante a ativação da conta."};
            const linked={...vigente,authUserId:authId,email};
            return {
              kind:"save",
              data:{...current,usuarios:(current.usuarios||[]).map(u=>u.id===vigente.id?linked:u)},
              before:{usuario:{id:vigente.id,email:vigente.email||"",authUserId:vigente.authUserId||""}},
              after:{usuario:{id:linked.id,email:linked.email,authUserId:linked.authUserId}},
            };
          },
        });
        if(outcome.kind==="error")return res.status(outcome.status||409).json({error:outcome.error});
        await salvarIndicePerfis(outcome.data);
        return res.status(200).json({ok:true,data:outcome.data,updatedAt:outcome.updatedAt});
      }
      const novo={...atual,usuarios:(atual.usuarios||[]).map(u=>u.id===alvo.id?{...u,authUserId:authId,email}:u)};
      const agora=new Date().toISOString();
      const {data:gravado,error}=await db.from("company_app_data").update({value:encodeAppData(coreFieldsOnly(novo,rowVersions)),updated_at:agora}).eq("company_id",COMPANY).eq("key",KEY).select("updated_at").maybeSingle();
      if(error)throw error;
      await salvarIndicePerfis(novo);
      return res.status(200).json({ok:true,data:novo,updatedAt:gravado?.updated_at||agora});
    }

    if (action === "client-portal-admin") {
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores podem gerenciar acessos de clientes."});
      const operation=String(req.body?.operation || "list");
      const obraId=String(req.body?.obraId || "");
      const obra=(atual.obras || []).find(item=>String(item.id)===obraId);
      if(!obra)return res.status(404).json({error:"Obra não encontrada."});

      const listAccess=async()=>{
        const {data:memberships,error}=await db.from("client_portal_project_memberships")
          .select("id,portal_user_id,profile,grants,revokes,active,created_at,client_portal_users!inner(id,email,phone,status,last_login_at)")
          .eq("company_id",COMPANY).eq("project_id",obraId).order("created_at",{ascending:false});
        if(error)throw error;
        return (memberships || []).map(item=>{
          const client=Array.isArray(item.client_portal_users)?item.client_portal_users[0]:item.client_portal_users;
          return {
            id:item.id,userId:item.portal_user_id,profile:item.profile,grants:item.grants||[],revokes:item.revokes||[],
            active:item.active!==false,email:client?.email||"",phone:client?.phone||"",
            status:client?.status||"",lastLoginAt:client?.last_login_at||"",
          };
        });
      };

      if(operation==="list")return res.status(200).json({ok:true,accesses:await listAccess()});

      if(operation==="revoke"){
        const membershipId=String(req.body?.membershipId || "");
        const {data:membership,error:findError}=await db.from("client_portal_project_memberships")
          .select("id,portal_user_id").eq("company_id",COMPANY).eq("project_id",obraId).eq("id",membershipId).maybeSingle();
        if(findError)throw findError;
        if(!membership)return res.status(404).json({error:"Acesso não encontrado."});
        const now=new Date().toISOString();
        const {error}=await db.from("client_portal_project_memberships").update({active:false,updated_at:now}).eq("id",membership.id);
        if(error)throw error;
        await db.from("client_portal_sessions").update({revoked_at:now}).eq("company_id",COMPANY).eq("portal_user_id",membership.portal_user_id).is("revoked_at",null);
        await db.from("client_portal_audit_events").insert({company_id:COMPANY,portal_user_id:membership.portal_user_id,project_id:obraId,event_type:"access_revoked",metadata:{actorId:usuario.id}});
        return res.status(200).json({ok:true,accesses:await listAccess()});
      }

      const publishProject=async()=>{
        const now=new Date().toISOString();
        const rows=buildClientPortalPublicationRows({data:atual,projectId:obraId,publishedAt:now});
        await db.from("client_portal_publications").update({status:"superseded",updated_at:now}).eq("company_id",COMPANY).eq("project_id",obraId).eq("status","published");
        const {error}=await db.from("client_portal_publications").insert(rows.map(row=>({company_id:COMPANY,project_id:obraId,domain:row.domain,status:"published",visibility:"project_users",payload:row.payload,created_by:usuario.id,published_by:usuario.id,published_at:now})));
        if(error)throw error;
      };

      if(operation==="publish"){await publishProject();return res.status(200).json({ok:true,accesses:await listAccess()});}
      if(operation!=="provision")return res.status(400).json({error:"Operação de portal inválida."});

      const email=normalizePortalEmail(req.body?.email), password=String(req.body?.password||"");
      const profile=String(req.body?.profile||"owner");
      const allowedProfiles=new Set(["owner","spouse","representative","financial","external_architect","observer"]);
      if(!email||!email.includes("@"))return res.status(400).json({error:"Informe um e-mail válido."});
      if(!validPortalPassword(password))return res.status(400).json({error:"A senha inicial deve ter 12 caracteres, letras e números."});
      if(!allowedProfiles.has(profile))return res.status(400).json({error:"Perfil de cliente inválido."});
      let {data:portalUser,error:userError}=await db.from("client_portal_users").select("id").eq("company_id",COMPANY).eq("email",email).maybeSingle();
      if(userError)throw userError;
      const userValues={company_id:COMPANY,email,phone:String(req.body?.phone||"").trim(),password_hash:hashPortalPassword(password),status:"active",updated_at:new Date().toISOString()};
      if(portalUser){
        const {error}=await db.from("client_portal_users").update(userValues).eq("id",portalUser.id);if(error)throw error;
      }else{
        const created=await db.from("client_portal_users").insert(userValues).select("id").single();if(created.error)throw created.error;portalUser=created.data;
      }
      const membershipValues={company_id:COMPANY,portal_user_id:portalUser.id,project_id:obraId,profile,grants:Array.isArray(req.body?.grants)?req.body.grants:[],revokes:Array.isArray(req.body?.revokes)?req.body.revokes:[],active:true,updated_at:new Date().toISOString()};
      const {error:membershipError}=await db.from("client_portal_project_memberships").upsert(membershipValues,{onConflict:"company_id,portal_user_id,project_id"});
      if(membershipError)throw membershipError;
      await publishProject();
      await db.from("client_portal_audit_events").insert({company_id:COMPANY,portal_user_id:portalUser.id,project_id:obraId,event_type:"access_provisioned",metadata:{actorId:usuario.id,profile}});
      return res.status(200).json({ok:true,accesses:await listAccess(),portalUrl:`/cliente/obra/${encodeURIComponent(obraId)}`});
    }

    // Motor Financeiro Canônico: o navegador envia somente o comando. A RPC
    // faz bloqueios, idempotência, saldo, evento, auditoria e outbox na mesma
    // transação PostgreSQL. Mantido nesta rota para caber no plano Hobby da
    // Vercel sem criar uma 13ª função serverless.
    if (action === "financial-command") {
      const command=req.body?.command||{};
      const authzFin=authorizeFinancialCommand(command.type,usuario.role);
      if(!authzFin.ok)return res.status(authzFin.status).json({error:authzFin.error});
      if(!/^[a-zA-Z0-9_-]{16,200}$/.test(String(command.idempotencyKey||"")))return res.status(400).json({error:"Chave de idempotência inválida."});
      const {data:resultado,error}=await db.rpc("financial_execute_command",{p_company_id:COMPANY,p_actor_id:usuario.id,p_command:command});
      if(error){console.error("Falha no motor financeiro:",error.message);return res.status(409).json({error:"O comando não foi efetivado. Nenhum lançamento parcial foi salvo."});}
      return res.status(200).json(resultado);
    }

    // REC-001: a classificação bancária não recebe mais um snapshot montado
    // no navegador. O servidor relê a transação, aplica a regra pura e salva
    // blob, auditoria e projeção financeira canônica na mesma transação.
    if(action==="reconciliation-command"){
      const command=req.body?.command||{};
      if(!RECONCILIATION_COMMANDS.has(command.type))return res.status(400).json({error:"Comando de conciliação inválido."});
      if(command.type===RECONCILIATION_COMMAND.REVERSE_RECONCILIATION&&usuario.role!=="admin")return res.status(403).json({error:"Somente administrador pode desfazer uma conciliação."});
      if(!/^[a-zA-Z0-9_-]{16,200}$/.test(String(command.idempotencyKey||"")))return res.status(400).json({error:"Chave idempotente de conciliação inválida."});

      const execute=base=>{
        const authorization=authorizeReconciliationCommand(base,command,usuario);
        if(!authorization.ok)return {forbidden:true,error:authorization.error};
        const already=(base.reconciliationCommandLog||[]).find(item=>item.idempotencyKey===command.idempotencyKey);
        if(already)return {idempotent:true,data:base,resumo:already.resumo||{ok:true}};
        const result=applyReconciliationCommand(base,command,usuario);
        if(!result?.resumo?.ok)return {error:result?.resumo?.motivo||"Não foi possível conciliar a transação."};
        const auditEntry={id:crypto.randomUUID(),idempotencyKey:command.idempotencyKey,type:command.type,transactionId:String(command.payload?.transactionId||""),actorId:usuario.id,createdAt:new Date().toISOString(),resumo:result.resumo};
        return {data:{...result.data,reconciliationCommandLog:[...(result.data.reconciliationCommandLog||[]),auditEntry].slice(-1000)},resumo:result.resumo};
      };
      if(process.env.POSTGRES_URL_NON_POOLING){
        const outcome=await executarMutacaoEmpresaBloqueada({
          actor:usuario,
          action:`reconciliation_${String(command.type).toLowerCase()}`,
          financial:true,
          linha:{payload:atual,rowVersions},
          mutate:async({payload:current,updatedAt:lockedUpdatedAt})=>{
            const executed=execute(current);
            if(executed.forbidden)return {kind:"error",status:403,error:executed.error};
            if(executed.error)return {kind:"error",status:409,error:executed.error,currentUpdatedAt:lockedUpdatedAt};
            if(executed.idempotent)return {
              kind:"idempotent",data:current,updatedAt:lockedUpdatedAt,resumo:executed.resumo,
            };
            const transactionId=String(command.payload?.transactionId||"");
            const beforeTransaction=(current.transacoes||[]).find(item=>String(item.id)===transactionId)||null;
            const afterTransaction=(executed.data?.transacoes||[]).find(item=>String(item.id)===transactionId)||null;
            return {
              kind:"save",data:executed.data,resumo:executed.resumo,basePayload:current,
              before:{transaction:beforeTransaction},
              after:{transaction:afterTransaction,command:{type:command.type,idempotencyKey:command.idempotencyKey}},
            };
          },
        });
        if(outcome.kind==="error")return res.status(outcome.status||409).json({
          error:outcome.error,
          ...(outcome.currentUpdatedAt?{currentUpdatedAt:outcome.currentUpdatedAt}:{}),
        });
        if(outcome.kind==="idempotent")return res.status(200).json({
          ok:true,idempotent:true,resumo:outcome.resumo,
          data:projectDataForUser(outcome.data,usuario),updatedAt:outcome.updatedAt,
        });
        return res.status(200).json({
          ok:true,resumo:outcome.resumo,updatedAt:outcome.updatedAt,
          sections:projectReconciliationPatch(outcome.basePayload,outcome.data,usuario),
        });
      }
      const persist=async(base,executed)=>{
        const transactionId=String(command.payload?.transactionId||"");
        const beforeTransaction=(base.payload?.transacoes||[]).find(item=>String(item.id)===transactionId)||null;
        const afterTransaction=(executed.data?.transacoes||[]).find(item=>String(item.id)===transactionId)||null;
        return salvarFinanceiroComAuditoria({
          expectedUpdatedAt:base.updatedAt,
          value:executed.data,
          rowVersions,
          actor:usuario,
          action:`reconciliation_${String(command.type).toLowerCase()}`,
          before:{transaction:beforeTransaction},
          after:{transaction:afterTransaction,command:{type:command.type,idempotencyKey:command.idempotencyKey}},
        });
      };
      const outcome=await executeReconciliationWithRetry({
        initial:{payload:atual,updatedAt},execute,persist,reload:lerLinha,maxAttempts:6,
      });
      if(outcome.kind==="error"){
        return res.status(outcome.forbidden?403:409).json({
          error:outcome.error,
          ...(outcome.forbidden?{}:{conflict:outcome.attempts>1,currentUpdatedAt:outcome.base?.updatedAt}),
        });
      }
      if(outcome.kind==="idempotent")return res.status(200).json({
        ok:true,idempotent:true,resumo:outcome.resumo,
        data:projectDataForUser(outcome.base.payload,usuario),updatedAt:outcome.base.updatedAt,
      });
      if(outcome.kind==="busy")return res.status(503).json({
        error:"O servidor está processando outras alterações. A conciliação não foi perdida; tente confirmar novamente.",
        code:"RECONCILIATION_CONCURRENCY_BUSY",retryable:true,currentUpdatedAt:outcome.base?.updatedAt,
      });
      // Sem concorrência, devolvemos somente as seções confirmadas pelo
      // comando. Se foi preciso reexecutar sobre uma versão mais nova, a
      // fotografia completa continua sendo enviada para incorporar também as
      // mudanças do outro operador.
      const resposta={
        ok:true,resumo:outcome.executed.resumo,
        updatedAt:outcome.saved.updatedAt||new Date().toISOString(),
      };
      if(outcome.attempts===1){
        resposta.sections=projectReconciliationPatch(outcome.base.payload,outcome.executed.data,usuario);
      }else{
        resposta.data=projectDataForUser(outcome.executed.data,usuario);
      }
      return res.status(200).json(resposta);
    }

    // Ponto é persistido por fato, nunca pela substituição da seção projetada.
    // O payload permanece constante (um registro ou lote curto), a validação
    // usa o dataset autoritativo e a mesma RPC grava mutação + auditoria.
    if(ATTENDANCE_COMMANDS.has(action)){
      const command={...req.body,action};
      const operationNow=new Date().toISOString();
      // upsert/batch-upsert são os únicos comandos que tocam `attendance`
      // (agora particionado por obra - ver executarComandoPontoBloqueado);
      // os outros 5 (lock/unlock/daily-check) só mexem nos campos "meta" que
      // continuam numa única linha compartilhada, então seguem no caminho
      // genérico de sempre.
      const isAttendanceWrite=action===ATTENDANCE_COMMAND.UPSERT||action===ATTENDANCE_COMMAND.BATCH_UPSERT;
      if(process.env.POSTGRES_URL_NON_POOLING&&isAttendanceWrite){
        const outcome=await executarComandoPontoBloqueado({
          usuario,command,operationNow,linha:{payload:atual,rowVersions},
        });
        if(outcome.kind==="error")return res.status(outcome.status||400).json({
          ok:false,error:outcome.error,
        });
        return res.status(200).json({
          ok:true,idempotent:outcome.kind==="idempotent",
          result:outcome.result,updatedAt:outcome.updatedAt,
        });
      }
      if(process.env.POSTGRES_URL_NON_POOLING){
        const outcome=await executarMutacaoEmpresaBloqueada({
          actor:usuario,
          action,
          domain:rowForAttendanceCommand(),
          linha:{payload:atual,rowVersions},
          mutate:async({payload:current,updatedAt:lockedUpdatedAt})=>{
            const applied=applyAttendanceCommand(current,usuario,command,operationNow);
            if(!applied.ok)return {kind:"error",status:applied.status||400,error:applied.error};
            if(applied.idempotent)return {
              kind:"idempotent",result:applied.result,updatedAt:lockedUpdatedAt,
            };
            return {
              kind:"save",data:applied.data,result:applied.result,
              before:applied.audit?.before||{},
              after:applied.audit?.after||{operationId:command.operationId},
            };
          },
        });
        if(outcome.kind==="error")return res.status(outcome.status||400).json({
          ok:false,error:outcome.error,
        });
        return res.status(200).json({
          ok:true,idempotent:outcome.kind==="idempotent",
          result:outcome.result,updatedAt:outcome.updatedAt,
        });
      }
      // Ponto grava na própria linha (PONTO_KEY) assim que ela existir - o
      // CAS passa a usar o updated_at da linha de ponto, então uma escrita
      // em qualquer outro domínio (ex.: EMPLOYEE_SAVED) não invalida mais
      // esta tentativa (achado de 20/08/2026: essa contenção cruzada é o
      // que causava a demora/retentativas reportadas ao salvar um
      // funcionário). Antes de scripts/seed-split-domain-rows.mjs rodar,
      // cai de volta a gravar a linha core inteira - ver
      // linhaEfetivaParaEscrita.
      const dominioInicial=linhaEfetivaParaEscrita(DOMAIN_ROW.PONTO,rowVersions);
      let base={payload:atual,domain:dominioInicial,rowVersions,updatedAt:dominioInicial===DOMAIN_ROW.CORE?updatedAt:rowVersions[DOMAIN_ROW.PONTO]};
      for(let attempt=0;attempt<6;attempt+=1){
        const applied=applyAttendanceCommand(base.payload,usuario,command,operationNow);
        if(!applied.ok)return res.status(applied.status||400).json({ok:false,error:applied.error});
        if(applied.idempotent){
          return res.status(200).json({
            ok:true,idempotent:true,result:applied.result,updatedAt:base.updatedAt,
          });
        }
        // `attendance` saiu de DOMAIN_FIELDS[PONTO] (Fase 1.5 - agora vive em
        // linhas por obra, ver executarComandoPontoBloqueado), então
        // pickDomainFields sozinho não bastaria mais aqui: este caminho
        // (CAS, hoje inativo em produção - POSTGRES_URL_NON_POOLING está
        // definido) não implementa a divisão por obra, só continua gravando
        // o blob inteiro de attendance na linha de Ponto, exatamente como
        // sempre fez. Isso é seguro na leitura: linhas de obra (quando
        // existirem) sempre vencem essa cópia no merge de lerLinha().
        const valorComAttendance=data=>({...pickDomainFields(data,DOMAIN_ROW.PONTO),attendance:data.attendance||{}});
        const saved=await salvarComAuditoria({
          key:keyForDomain(base.domain),
          expectedUpdatedAt:base.updatedAt,
          value:base.domain===DOMAIN_ROW.CORE?applied.data:valorComAttendance(applied.data),
          rowVersions:base.rowVersions,keepDomain:DOMAIN_ROW.PONTO,
          actor:usuario,
          action:applied.audit?.action||action,
          before:applied.audit?.before||{},
          after:applied.audit?.after||{operationId:command.operationId},
        });
        if(saved.applied){
          return res.status(200).json({
            ok:true,result:applied.result,updatedAt:saved.updatedAt||operationNow,
          });
        }
        const recarregado=await lerLinha();
        const domain=linhaEfetivaParaEscrita(DOMAIN_ROW.PONTO,recarregado.rowVersions);
        base={payload:recarregado.payload,domain,rowVersions:recarregado.rowVersions,updatedAt:domain===DOMAIN_ROW.CORE?recarregado.updatedAt:recarregado.rowVersions[DOMAIN_ROW.PONTO]};
      }
      return res.status(503).json({
        ok:false,code:"ATTENDANCE_CONCURRENCY_BUSY",
        error:"Há muitas atualizações de ponto ao mesmo tempo. O servidor preservou os dados; tente novamente em instantes.",
      });
    }

    // Comandos operacionais usam versão da própria entidade, não a semântica
    // insegura de "último snapshot vence". A rota ainda devolve a projeção
    // filtrada pelo papel para poder substituir o save legado gradualmente.
    if(action==="operational-command"){
      const command=req.body?.command||{};
      const authz=authorizeOperationalCommand(command.type,usuario.role);
      if(!authz.ok)return res.status(authz.status).json({error:authz.error});
      if(!/^[a-zA-Z0-9_-]{16,200}$/.test(String(command.idempotencyKey||"")))return res.status(400).json({error:"Chave idempotente operacional inválida."});
      const scope=validateOperationalCommandScope({user:usuario,data:atual,command});
      if(!scope.ok)return res.status(scope.error.includes("vinculado")?400:403).json({error:scope.error});

      const persistenciaFinanceira=requiresFinancialOperationalPersistence(
        command.type,FINANCIAL_OPERATIONAL_COMMANDS,
      );
      // A conexão direta permite serializar TODOS os comandos, não somente os
      // financeiros. Cadastro, RH, compras e engenharia deixam de concorrer
      // entre si pela linha global da empresa.
      if(process.env.POSTGRES_URL_NON_POOLING){
        const outcome=await executarComandoOperacionalBloqueado({
          command,usuario,financial:persistenciaFinanceira,
          linha:{payload:atual,rowVersions},
        });
        if(outcome.kind==="error")return res.status(outcome.status||409).json({
          error:outcome.error,reason:outcome.error,
          ...(outcome.conflict?{conflict:true,currentUpdatedAt:outcome.currentUpdatedAt}:{}),
        });
        return res.status(200).json({
          ok:true,idempotent:outcome.kind==="idempotent",
          ...(outcome.kind==="idempotent"
            ?{data:projectDataForUser(outcome.data,usuario)}
            :{sections:projectChangedSectionsPatch(
              outcome.basePayload,outcome.data,usuario,
              {exclude:OPERATIONAL_RESPONSE_EXCLUDED_SECTIONS},
            )}),
          updatedAt:outcome.updatedAt,
          ...(outcome.copied!=null?{copied:outcome.copied}:{}),
          ...(outcome.summary!=null?{summary:outcome.summary}:{}),
        });
      }

      // Lookahead/Config/Equipamentos gravam na própria linha assim que ela
      // existir (achado de 20/08/2026 - ver server/domain-row-routing.js);
      // qualquer outro tipo de comando (RH, RDO, Financeiro, Compras...)
      // continua indo para a linha core, exatamente como antes desta
      // separação. Antes de scripts/seed-split-domain-rows.mjs rodar, cai
      // de volta a gravar a linha core inteira - ver linhaEfetivaParaEscrita.
      const domainAlvo=rowForOperationalCommand(command.type);

      const persistir=async(base,resultData)=>{
        // `financialSnapshotData` sempre recebe o `data` COMPLETO mesclado -
        // buildLegacyFinancialFacts precisa de medicoes/pedidos/notasFiscais
        // etc., que não existem em `valorLinha` quando o domínio é uma linha
        // separada (ex.: Equipamentos, que é financeiro).
        const valorLinha=base.domain===DOMAIN_ROW.CORE?resultData:pickDomainFields(resultData,base.domain);
        const save=persistenciaFinanceira
          ?salvarFinanceiroComAuditoria
          :salvarComAuditoria;
        return save({key:keyForDomain(base.domain),expectedUpdatedAt:base.updatedAt,value:valorLinha,
        financialSnapshotData:resultData,rowVersions:base.rowVersions,keepDomain:domainAlvo,actor:usuario,
        action:`operational_${command.type.toLowerCase()}`,
        before:{command:command.type,entityId:operationalCommandEntityId(command)},
        after:{command:command.type,idempotencyKey:command.idempotencyKey}});
      };

      // Um único reenvio não bastava sob concorrência real: qualquer gravação
      // em qualquer outra tela que divida a MESMA linha já derrubava a
      // segunda tentativa. Reexecuta o comando sobre a fotografia mais nova,
      // no mesmo padrão de tentativas limitadas usado acima para o ponto.
      const dominioInicial=linhaEfetivaParaEscrita(domainAlvo,rowVersions);
      let base={payload:atual,domain:dominioInicial,rowVersions,updatedAt:dominioInicial===DOMAIN_ROW.CORE?updatedAt:rowVersions[domainAlvo]};
      for(let attempt=0;attempt<6;attempt+=1){
        const result=applyOperationalCommand(base.payload,{...command,actorId:usuario.id,actorName:usuario.nome||usuario.email||"Usuário autenticado"});
        if(!result.ok)return res.status(409).json({conflict:true,reason:result.reason,currentUpdatedAt:base.updatedAt});
        if(result.idempotent)return res.status(200).json({ok:true,idempotent:true,data:projectDataForUser(base.payload,usuario),updatedAt:base.updatedAt});
        const gravacao=await persistir(base,result.data);
        if(gravacao.applied){
          return res.status(200).json({
            ok:true,
            sections:projectChangedSectionsPatch(
              base.payload,result.data,usuario,
              {exclude:OPERATIONAL_RESPONSE_EXCLUDED_SECTIONS},
            ),
            updatedAt:gravacao.updatedAt||new Date().toISOString(),
            ...(result.copied!=null?{copied:result.copied}:{}),
            ...(result.summary!=null?{summary:result.summary}:{}),
          });
        }
        const recarregado=await lerLinha();
        const domain=linhaEfetivaParaEscrita(domainAlvo,recarregado.rowVersions);
        base={payload:recarregado.payload,domain,rowVersions:recarregado.rowVersions,updatedAt:domain===DOMAIN_ROW.CORE?recarregado.updatedAt:recarregado.rowVersions[domainAlvo]};
      }
      return res.status(503).json({
        ok:false,code:"OPERATIONAL_COMMAND_CONCURRENCY_BUSY",
        error:"Há muitas atualizações ao mesmo tempo. O servidor preservou os dados; tente novamente em instantes.",
      });
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

    // Fase 2, primeiro consumidor real do CORE-001 (23/08/2026, ver
    // docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): só leitura, só admin. Reaproveita
    // o mesmo resumo de server/core-registry-shadow-status.js usado por
    // scripts/check-core-registry-shadow-status.mjs, mais uma amostra
    // pequena de cada tabela - prova que a projeção é consultável de
    // verdade, sem virar tela nem exigir política de RLS por papel/obra
    // (que não se aplica aqui: toda leitura já passa por `db`, o cliente
    // service_role compartilhado - a autorização por papel é sempre feita
    // aqui em JS, nunca em RLS, mesmo padrão do resto deste arquivo).
    if(action==="core-registry-report"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores consultam a projeção cadastral."});
      // Achado de 24/08/2026: `db` é um cliente Supabase compartilhado de
      // escopo de módulo (pode sobreviver a múltiplas requisições numa
      // instância "quente" da função serverless), e `db.auth.getUser(
      // accessToken)` - chamado mais acima, na resolução de `usuario` -
      // muda o estado interno de sessão do próprio `db`, fazendo chamadas
      // .from() POSTERIORES (como estas) usarem o JWT do usuário logado em
      // vez da service_role key com que `db` foi criado. Isso derruba com
      // "permission denied" em qualquer tabela sem grant para
      // "authenticated" (como as core_*, que revogam tudo exceto
      // service_role - migration 007). Um cliente isolado, criado aqui e
      // usado só nesta ação, evita essa contaminação - mesmo padrão que
      // scripts/check-core-registry-shadow-status.mjs já usa (que nunca
      // teve esse problema, por nunca compartilhar cliente entre requests).
      const registryDb = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: runs, error: runsError } = await registryDb
        .from("core_registry_shadow_runs")
        .select("result, created_at, actor_id")
        .eq("company_id", COMPANY)
        .order("created_at", { ascending: false })
        .limit(20);
      if (runsError) throw runsError;
      const liveCounts = {};
      const sample = {};
      for (const [section, table] of Object.entries(CORE_REGISTRY_TABLES)) {
        const [{ count, error: countError }, { data: sampleRows, error: sampleError }] = await Promise.all([
          registryDb.from(table).select("*", { count: "exact", head: true })
            .eq("company_id", COMPANY).is("archived_at", null),
          registryDb.from(table).select("*")
            .eq("company_id", COMPANY).is("archived_at", null)
            .order("synced_at", { ascending: false }).limit(5),
        ]);
        if (countError) throw countError;
        if (sampleError) throw sampleError;
        liveCounts[section] = count || 0;
        sample[section] = sampleRows || [];
      }
      const summary = summarizeCoreRegistryShadowStatus({ runs: runs || [], liveCounts });
      return res.status(200).json({ ok:true, ...summary, liveCounts, sample });
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
      const historyRequests=Array.from({length:6},(_,index)=>{
        const date=new Date(year,month-5+index,1);
        return {year:date.getFullYear(),month:date.getMonth(),period:"mes",scope};
      });
      const historyIds=historyRequests.map(item=>
        `${item.year}-${String(item.month+1).padStart(2,"0")}:mes:${scope}`);
      const ids=[...new Set([currentId,...historyIds])];
      const loadEvents=()=>db.from("financial_events")
        .select("source_id,payload,effective_date")
        .eq("company_id",COMPANY).eq("event_type","dre_snapshot")
        .eq("source_type","dre_projection").in("source_id",ids);
      let {data:events,error}=await loadEvents();
      if(error)throw error;
      let currentEvent=(events||[]).find(event=>
        event.source_id===currentId&&event.payload?.active!==false);
      const sourceRevision=String(updatedAt||"");
      if(!currentEvent
        ||String(currentEvent.payload?.sourceRevision||"")!==sourceRevision
        ||String(currentEvent.payload?.projectionVersion||"")!==DRE_PROJECTION_VERSION){
        const projectionRequests=[
          {year,month,period,scope},
          ...historyRequests,
        ];
        const rows=buildRequestedDreProjectionRows(atual,projectionRequests).map(row=>({
          company_id:COMPANY,event_type:"dre_snapshot",source_type:"dre_projection",
          source_id:row.sourceId,effective_date:`${row.year}-${String(row.month+1).padStart(2,"0")}-01`,
          payload:{...row.payload,active:true,obraId:row.obraId,year:row.year,month:row.month,
            period:row.period,sourceRevision,projectionVersion:DRE_PROJECTION_VERSION},
          created_by:String(usuario.id||"system"),
        }));
        const {error:projectionError}=await db.from("financial_events").upsert(rows,{
          onConflict:"company_id,event_type,source_type,source_id",
        });
        if(projectionError){
          console.error("Falha ao materializar o DRE canônico:",{
            code:projectionError.code,message:projectionError.message,
            details:projectionError.details,hint:projectionError.hint,
            sourceId:currentId,
          });
          return res.status(503).json({
            error:"O razão canônico não conseguiu atualizar a projeção deste período.",
            code:"DRE_PROJECTION_SYNC_FAILED",
          });
        }
        ({data:events,error}=await loadEvents());
        if(error)throw error;
        currentEvent=(events||[]).find(event=>
          event.source_id===currentId&&event.payload?.active!==false);
      }
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

    if(action==="persistence-health"){
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores verificam a persistência."});
      const tableCheck=await db.from("company_app_data").select("key",{head:true,count:"exact"})
        .eq("company_id",COMPANY).eq("key",KEY);
      if(tableCheck.error)return res.status(503).json({
        ok:false,code:"COMPANY_APP_DATA_UNAVAILABLE",
        error:"A tabela principal não respondeu à verificação.",
      });
      const probeId=crypto.randomUUID();
      const auditCheck=await db.rpc("company_save_with_audit",{
        p_company_id:`${COMPANY}__health_probe`,p_key:"health",
        p_expected_updated_at:"1970-01-01T00:00:00.000Z",p_value:{},
        p_actor_id:String(usuario.id||"admin"),p_actor_name:String(usuario.nome||"Administrador"),
        p_correlation_id:probeId,p_action:"health_probe",p_before:{},p_after:{},
      });
      if(auditCheck.error)return res.status(503).json({
        ok:false,code:"AUDIT_RPC_UNAVAILABLE",
        error:"A RPC append-only não está disponível. Execute migrations/20260725_append_only_audit.sql.",
      });
      const archiveCheck=await db.rpc("attendance_archive_transaction",{
        p_company_id:`${COMPANY}__health_probe`,p_main_key:"health",p_archive_key:"health_archive",
        p_expected_updated_at:"1970-01-01T00:00:00.000Z",p_main_value:{},p_archive_value:{},
        p_actor_id:String(usuario.id||"admin"),p_actor_name:String(usuario.nome||"Administrador"),
        p_actor_role:String(usuario.role||""),
        p_correlation_id:crypto.randomUUID(),p_before:{},p_after:{},
      });
      if(archiveCheck.error)return res.status(503).json({
        ok:false,code:"ATTENDANCE_ARCHIVE_RPC_UNAVAILABLE",
        error:"A RPC transacional do arquivo de ponto não está disponível. Execute migrations/006_attendance_archive_transaction.up.sql.",
      });
      return res.status(200).json({
        ok:true,companyAppData:true,auditRpc:true,attendanceArchiveRpc:true,
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
      const commandOnlySections=["attendance","attendanceLocks","unlockRequests","dailyCheckDate","attendanceOperationReceipts","changeLog"];
      const legacyPointWrite=chaves.find(key=>commandOnlySections.includes(key));
      if(legacyPointWrite)return res.status(409).json({
        error:`A seção ${legacyPointWrite} exige o comando granular do servidor.`,
        code:"ATTENDANCE_GRANULAR_REQUIRED",
      });
      // Mesmo em sombra, toda mutação financeira atualiza a projeção
      // canônica na mesma transação do blob. Assim o DRE pode ler o razão sem
      // ficar defasado; FIN-003 continua sendo apenas o bloqueio das escritas
      // legadas, ainda desligado.
      const secoesFinanceiras=Object.fromEntries(chaves.map(key=>[key,sections[key]]));
      const sincronizaFinanceiro=hasLegacyFinancialWrite(secoesFinanceiras);
      if (!chaves.length) return res.status(200).json({ ok:true, updatedAt, unchanged:true });
      if(process.env.POSTGRES_URL_NON_POOLING){
        const outcome=await executarMutacaoEmpresaBloqueada({
          actor:usuario,
          action:sincronizaFinanceiro?"financial_shadow_save_sections":"save_sections",
          financial:sincronizaFinanceiro,
          linha:{payload:atual,rowVersions},
          mutate:async({payload:current,updatedAt:lockedUpdatedAt})=>{
            const houveConcorrencia=expectedUpdatedAt&&lockedUpdatedAt
              &&!mesmoInstante(expectedUpdatedAt,lockedUpdatedAt);
            if(houveConcorrencia&&!baseSections)return {
              kind:"error",status:409,conflict:true,
              error:"A versão de origem é necessária para mesclar alterações concorrentes.",
              currentUpdatedAt:lockedUpdatedAt,
            };
            if(houveConcorrencia){
              const conflicts=findSectionConflicts(baseSections,sections,current,chaves);
              if(conflicts.length)return {
                kind:"error",status:409,conflict:true,
                error:"Outro operador alterou o mesmo registro. Atualize os dados antes de tentar novamente.",
                conflicts,currentUpdatedAt:lockedUpdatedAt,
              };
            }
            const value={...(current||{})};
            chaves.forEach(key=>{
              value[key]=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,key)
                ?mergeThreeWay(baseSections[key],sections[key],current?.[key])
                :sections[key];
            });
            const erroSnapshotObra=validateProjectFinancialSnapshotPolicy({
              engineEnforced:FINANCIAL_ENGINE_ENFORCE,before:current,after:value,
            });
            if(!erroSnapshotObra.ok)return {kind:"error",status:409,error:erroSnapshotObra.error,code:"PROJECT_FINANCIAL_COMMAND_REQUIRED"};
            const erroMotorFinanceiro=validateFinancialWritePath({
              engineEnforced:FINANCIAL_ENGINE_ENFORCE,sections:secoesFinanceiras,
            });
            if(!erroMotorFinanceiro.ok)return {kind:"error",status:409,error:erroMotorFinanceiro.error,code:"FINANCIAL_ENGINE_ENFORCED"};
            const erroAutorizacao=authorizeSectionChanges(usuario,secoesFinanceiras);
            if(erroAutorizacao)return {kind:"error",status:403,error:erroAutorizacao};
            const erroExclusao=validateNoPhysicalDeletes(
              Object.fromEntries(chaves.map(key=>[key,current?.[key]])),sections,
            );
            if(erroExclusao)return {kind:"error",status:409,error:erroExclusao};
            const erroBaseline=validateBudgetBaselinePolicy(current,value,usuario);
            if(erroBaseline)return {kind:"error",status:403,error:erroBaseline};
            const erroBaselinePlano=validatePlanningBaselinePolicy(current,value,usuario);
            if(erroBaselinePlano)return {kind:"error",status:403,error:erroBaselinePlano};
            if(chaves.includes("conferencias")){
              const origin=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"conferencias")
                ?baseSections.conferencias:current?.conferencias;
              const erro=validarAlteracoesConferencias(usuario,origin||[],sections.conferencias||[],current?.conferencias||[],current?.obras||[]);
              if(erro)return {kind:"error",status:403,error:erro};
            }
            if(chaves.includes("pedidos")){
              const origin=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"pedidos")
                ?baseSections.pedidos:current?.pedidos;
              const erro=validatePurchaseChanges(usuario,origin||[],sections.pedidos||[]);
              if(erro)return {kind:"error",status:403,error:erro};
            }
            if(chaves.some(key=>["solicitacoesCompra","cotacoes","pedidos","notasFiscais"].includes(key))){
              const erro=validateProcurementChain(value);
              if(erro)return {kind:"error",status:409,error:erro};
            }
            if(chaves.includes("obras")){
              const origin=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"obras")
                ?baseSections.obras:current?.obras;
              const erro=validarExclusaoObras(usuario,origin||[],sections.obras||[]);
              if(erro)return {kind:"error",status:403,error:erro};
            }
            return {
              kind:"save",data:value,merged:!!houveConcorrencia,
              before:Object.fromEntries(chaves.map(key=>[key,current?.[key]])),
              after:Object.fromEntries(chaves.map(key=>[key,value?.[key]])),
            };
          },
        });
        if(outcome.kind==="error")return res.status(outcome.status||409).json({
          error:outcome.error,code:outcome.code,
          ...(outcome.conflict?{
            conflict:true,reason:outcome.error,conflicts:outcome.conflicts,
            currentUpdatedAt:outcome.currentUpdatedAt,
          }:{}),
        });
        if(chaves.includes("usuarios"))await salvarIndicePerfis(outcome.data);
        return res.status(200).json({
          ok:true,merged:!!outcome.merged,
          data:outcome.merged?projectDataForUser(outcome.data,usuario):undefined,
          updatedAt:outcome.updatedAt,savedSections:chaves,
        });
      }
      const erroSnapshotObra=validateProjectFinancialSnapshotPolicy({
        engineEnforced:FINANCIAL_ENGINE_ENFORCE,before:atual,after:{...atual,...sections},
      });
      if(!erroSnapshotObra.ok)return res.status(409).json({error:erroSnapshotObra.error,code:"PROJECT_FINANCIAL_COMMAND_REQUIRED"});
      const erroMotorFinanceiro=validateFinancialWritePath({engineEnforced:FINANCIAL_ENGINE_ENFORCE,sections:secoesFinanceiras});
      if(!erroMotorFinanceiro.ok)return res.status(409).json({error:erroMotorFinanceiro.error,code:"FINANCIAL_ENGINE_ENFORCED"});
      const erroAutorizacao=authorizeSectionChanges(usuario,Object.fromEntries(chaves.map(key=>[key,sections[key]])));
      if(erroAutorizacao)return res.status(403).json({error:erroAutorizacao});
      const erroExclusao=validateNoPhysicalDeletes(Object.fromEntries(chaves.map(key=>[key,atual?.[key]])),sections);
      if(erroExclusao)return res.status(409).json({error:erroExclusao});
      const erroBaseline=validateBudgetBaselinePolicy(atual,{...atual,...sections},usuario);
      if(erroBaseline)return res.status(403).json({error:erroBaseline});
      const erroBaselinePlano=validatePlanningBaselinePolicy(atual,{...atual,...sections},usuario);
      if(erroBaselinePlano)return res.status(403).json({error:erroBaselinePlano});
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
      if(chaves.some(key=>["solicitacoesCompra","cotacoes","pedidos","notasFiscais"].includes(key))){
        const erroCadeiaCompras=validateProcurementChain({...atual,...sections});
        if(erroCadeiaCompras)return res.status(409).json({error:erroCadeiaCompras});
      }
      if(chaves.includes("obras")){
        const baseObras=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,"obras")?baseSections.obras:atual?.obras;
        const erroObras=validarExclusaoObras(usuario,baseObras||[],sections.obras||[]);
        if(erroObras)return res.status(403).json({error:erroObras});
      }

      const houveConcorrencia=expectedUpdatedAt&&updatedAt&&!mesmoInstante(expectedUpdatedAt,updatedAt);
      if(houveConcorrencia&&!baseSections)return res.status(409).json({conflict:true,reason:"A versão de origem é necessária para mesclar alterações concorrentes."});
      if(houveConcorrencia){
        const conflicts=findSectionConflicts(baseSections,sections,atual,chaves);
        if(conflicts.length)return res.status(409).json({conflict:true,reason:"Outro operador alterou o mesmo registro. Atualize os dados antes de tentar novamente.",conflicts,currentUpdatedAt:updatedAt});
      }
      const aplicar = estado => {
        const proximo={...(estado||{})};
        chaves.forEach(k => {
          const recebido=baseSections&&Object.prototype.hasOwnProperty.call(baseSections,k)
            ? mergeThreeWay(baseSections[k],sections[k],estado?.[k])
            : sections[k];
          proximo[k]=recebido;
        });
        return proximo;
      };
      let valor=aplicar(atual);
      let agora=new Date().toISOString();
      const salvarVersao=sincronizaFinanceiro?salvarFinanceiroComAuditoria:salvarComAuditoria;
      let gravacao=await salvarVersao({expectedUpdatedAt:updatedAt,value:valor,rowVersions,actor:usuario,action:sincronizaFinanceiro?"financial_shadow_save_sections":"save_sections",
        before:Object.fromEntries(chaves.map(key=>[key,atual?.[key]])),after:Object.fromEntries(chaves.map(key=>[key,valor?.[key]]))});
      let gravado=gravacao.applied?{updated_at:gravacao.updatedAt}:null;

      let combinado=houveConcorrencia;
      if(!gravado){
        const recente=await lerLinha();
        const conflicts=findSectionConflicts(baseSections,sections,recente.payload,chaves);
        if(conflicts.length)return res.status(409).json({conflict:true,reason:"Outro operador alterou o mesmo registro. Atualize os dados antes de tentar novamente.",conflicts,currentUpdatedAt:recente.updatedAt});
        valor=aplicar(recente.payload);
        agora=new Date().toISOString();
        const retry=await salvarVersao({expectedUpdatedAt:recente.updatedAt,value:valor,rowVersions:recente.rowVersions,actor:usuario,action:sincronizaFinanceiro?"financial_shadow_save_sections":"save_sections",
          before:Object.fromEntries(chaves.map(key=>[key,recente.payload?.[key]])),after:Object.fromEntries(chaves.map(key=>[key,valor?.[key]]))});
        if(!retry.applied)return res.status(409).json({conflict:true,reason:"Muitas alterações simultâneas. Tente novamente."});
        gravado={updated_at:retry.updatedAt};combinado=true;
      }
      if(chaves.includes("usuarios"))await salvarIndicePerfis(valor);
      return res.status(200).json({ok:true,merged:combinado,data:combinado?projectDataForUser(valor,usuario):undefined,updatedAt:gravado?.updated_at||agora,savedSections:chaves});
    }

    // ── 4b. Salvar blob completo (compatibilidade / primeiro acesso) ─
    if (action === "save") {
      if (!payload) return res.status(400).json({ error: "Nada para salvar." });
      const commandOnlySections=["attendance","attendanceLocks","unlockRequests","dailyCheckDate","attendanceOperationReceipts","changeLog"];
      const attemptedCommandOnly=commandOnlySections.find(key=>
        Object.prototype.hasOwnProperty.call(payload,key)&&!igual(payload?.[key],atual?.[key]));
      if(attemptedCommandOnly)return res.status(409).json({
        error:`A seção ${attemptedCommandOnly} exige o comando granular do servidor.`,
        code:"ATTENDANCE_GRANULAR_REQUIRED",
      });
      const incomingPayload={...payload};
      commandOnlySections.forEach(key=>{
        if(Object.prototype.hasOwnProperty.call(atual||{},key))incomingPayload[key]=atual[key];
        else delete incomingPayload[key];
      });
      const secoesAlteradas=Object.fromEntries([...new Set([...Object.keys(incomingPayload||{}),...Object.keys(atual||{})])]
        .filter(key=>!igual(incomingPayload?.[key],atual?.[key])).map(key=>[key,incomingPayload?.[key]]));
      const legacyPointWrite=Object.keys(secoesAlteradas).find(key=>
        commandOnlySections.includes(key));
      if(legacyPointWrite)return res.status(409).json({
        error:`A seção ${legacyPointWrite} exige o comando granular do servidor.`,
        code:"ATTENDANCE_GRANULAR_REQUIRED",
      });
      const sincronizaFinanceiro=hasLegacyFinancialWrite(secoesAlteradas);
      const erroSnapshotObra=validateProjectFinancialSnapshotPolicy({
        engineEnforced:FINANCIAL_ENGINE_ENFORCE,before:atual,after:incomingPayload,
      });
      if(!erroSnapshotObra.ok)return res.status(409).json({error:erroSnapshotObra.error,code:"PROJECT_FINANCIAL_COMMAND_REQUIRED"});
      const erroMotorFinanceiro=validateFinancialWritePath({engineEnforced:FINANCIAL_ENGINE_ENFORCE,sections:secoesAlteradas});
      if(!erroMotorFinanceiro.ok)return res.status(409).json({error:erroMotorFinanceiro.error,code:"FINANCIAL_ENGINE_ENFORCED"});
      const erroAutorizacao=authorizeSectionChanges(usuario,secoesAlteradas);
      if(erroAutorizacao)return res.status(403).json({error:erroAutorizacao});
      const erroExclusao=validateNoPhysicalDeletes(atual,incomingPayload);
      if(erroExclusao)return res.status(409).json({error:erroExclusao});
      const erroBaseline=validateBudgetBaselinePolicy(atual,incomingPayload,usuario);
      if(erroBaseline)return res.status(403).json({error:erroBaseline});
      const erroBaselinePlano=validatePlanningBaselinePolicy(atual,incomingPayload,usuario);
      if(erroBaselinePlano)return res.status(403).json({error:erroBaselinePlano});
      if(!igual(incomingPayload.conferencias,atual?.conferencias)){
        const erroPermissao=validarAlteracoesConferencias(usuario,basePayload?.conferencias||atual?.conferencias||[],incomingPayload.conferencias||[],atual?.conferencias||[],atual?.obras||[]);
        if(erroPermissao)return res.status(403).json({error:erroPermissao});
      }
      if(!igual(incomingPayload.pedidos,atual?.pedidos)){
        const erroCompras=validatePurchaseChanges(usuario,basePayload?.pedidos||atual?.pedidos||[],incomingPayload.pedidos||[]);
        if(erroCompras)return res.status(403).json({error:erroCompras});
      }
      if(["solicitacoesCompra","cotacoes","pedidos","notasFiscais"].some(key=>!igual(incomingPayload?.[key],atual?.[key]))){
        const erroCadeiaCompras=validateProcurementChain(incomingPayload);
        if(erroCadeiaCompras)return res.status(409).json({error:erroCadeiaCompras});
      }
      if(!igual(incomingPayload.obras,atual?.obras)){
        const erroObras=validarExclusaoObras(usuario,basePayload?.obras||atual?.obras||[],incomingPayload.obras||[]);
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
      if(houveConcorrencia&&basePayload){
        const conflicts=findSectionConflicts(basePayload,incomingPayload,atual,Object.keys(secoesAlteradas));
        if(conflicts.length)return res.status(409).json({conflict:true,reason:"Outro operador alterou o mesmo registro. Atualize os dados antes de tentar novamente.",conflicts,currentUpdatedAt:updatedAt});
      }
      let valor=basePayload?mergeThreeWay(basePayload,incomingPayload,atual):incomingPayload;
      if(houveConcorrencia&&!basePayload)return res.status(409).json({conflict:true,reason:"Outro usuário salvou enquanto você trabalhava.",currentData:projectDataForUser(atual,usuario),currentUpdatedAt:updatedAt});

      const agora = new Date().toISOString();
      const beforeAudit=Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,atual?.[key]]));
      const afterAudit=Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,valor?.[key]]));

      // .select() devolve a linha COMO O BANCO A GUARDOU. Assim o carimbo que
      // mandamos de volta ao navegador é exatamente o que estará lá na próxima
      // comparação — sem discrepância de formato.
      const salvarVersao=sincronizaFinanceiro?salvarFinanceiroComAuditoria:salvarComAuditoria;
      const primeira=await salvarVersao({expectedUpdatedAt:updatedAt,value:valor,rowVersions,actor:usuario,action:sincronizaFinanceiro?"financial_shadow_save_blob":"save_blob",before:beforeAudit,after:afterAudit});
      let gravado=primeira.applied?{updated_at:primeira.updatedAt}:null;
      // Outra gravação pode entrar entre a leitura e o UPDATE. A condição no
      // updated_at impede sobrescrita; nesse caso relê e reaplica a mesma mescla.
      if(!gravado){
        if(!basePayload)return res.status(409).json({conflict:true,reason:"Outro usuário salvou ao mesmo tempo."});
        const recente=await lerLinha();
        const conflicts=findSectionConflicts(basePayload,incomingPayload,recente.payload,Object.keys(secoesAlteradas));
        if(conflicts.length)return res.status(409).json({conflict:true,reason:"Outro operador alterou o mesmo registro. Atualize os dados antes de tentar novamente.",conflicts,currentUpdatedAt:recente.updatedAt});
        valor=mergeThreeWay(basePayload,incomingPayload,recente.payload);
        const novoAgora=new Date().toISOString();
        const retry=await salvarVersao({expectedUpdatedAt:recente.updatedAt,value:valor,rowVersions:recente.rowVersions,actor:usuario,action:sincronizaFinanceiro?"financial_shadow_save_blob":"save_blob",
          before:Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,recente.payload?.[key]])),after:Object.fromEntries(Object.keys(secoesAlteradas).map(key=>[key,valor?.[key]]))});
        if(!retry.applied)return res.status(409).json({conflict:true,reason:"Muitas alterações simultâneas. Tente novamente."});
        gravado={updated_at:retry.updatedAt};
      }
      if(!igual(valor?.usuarios,atual?.usuarios))await salvarIndicePerfis(valor);
      return res.status(200).json({ ok: true, merged:!!houveConcorrencia||!mesmoInstante(gravado?.updated_at,agora), data:(houveConcorrencia||!mesmoInstante(gravado?.updated_at,agora))?projectDataForUser(valor,usuario):undefined, updatedAt: gravado?.updated_at || agora });
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
          workdayHours: Number(e.workdayHours || 8),
          workStart: String(e.workStart || "07:00"),
          overtimeAdditionalPercent: Number(e.overtimeAdditionalPercent ?? 50),
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

      const novoPrincipal = {
        ...atual,
        attendance: restante,
        archivedLaborCosts: {
          ...(atual?.archivedLaborCosts || {}),
          [quinzenaId]: resumoFinanceiro,
        },
        quinzenasArquivadas: { ...(atual?.quinzenasArquivadas || {}), [quinzenaId]: meta },
      };
      const archiveValue={meta,attendance:fatia,employeesSnapshot,financialSnapshot:resumoFinanceiro};
      // `attendance` está sendo gravado aqui de verdade (é o objetivo do
      // arquivamento) - por isso keepDomain=PONTO garante que ele nunca é
      // removido, mesmo que a linha própria de Ponto já exista. Mas o
      // ARQUIVAMENTO em si sempre grava a linha core (mainKey=KEY, sem
      // roteamento por domínio) - se a linha de Ponto já existir, o
      // `attendance` reduzido gravado aqui fica sem efeito na próxima
      // leitura (a mesclagem sempre prioriza a linha de Ponto sobre a
      // core). Isso é uma limitação conhecida, não corrigida nesta rodada -
      // ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md.
      const transaction=await executarArquivoPontoTransacional({
        mode:"archive",expectedUpdatedAt:updatedAt,mainValue:coreFieldsOnly(novoPrincipal,rowVersions,DOMAIN_ROW.PONTO),
        archiveKey:chaveArquivo(quinzenaId),archiveValue,actor:usuario,
        before:{quinzenaId,attendance:fatia},
        after:{quinzenaId,meta,financialSnapshot:resumoFinanceiro},
      });
      if(!transaction.applied){
        const status=transaction.reason==="archive_exists"?409:transaction.reason==="concurrent_update"?409:500;
        return res.status(status).json({
          error:transaction.reason==="archive_exists"?"Esta quinzena já foi arquivada.":"Os dados mudaram durante o arquivamento. Recarregue e tente novamente.",
          code:`ATTENDANCE_ARCHIVE_${transaction.reason.toUpperCase()}`,
        });
      }
      await sincronizarPontoAposArquivo({rowVersions,novoPrincipal,actor:usuario,quinzenaId,action:"attendance_archive_ponto_sync"});
      return res.status(200).json({
        ok:true,data:projectDataForUser(novoPrincipal,usuario),
        updatedAt:transaction.updatedAt||agora,meta,
      });
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
      if((atual?.quinzenasRestauradas||{})[quinzenaId]){
        return res.status(200).json({
          ok:true,data:projectDataForUser(atual,usuario),updatedAt,
          devolvidos:0,mantidos:0,idempotent:true,
        });
      }
      const { data: linha, error: errLer } = await db.from("company_app_data")
        .select("value")
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (errLer) throw errLer;
      if (!linha) return res.status(404).json({ error: "Arquivo não encontrado." });

      const arq = linha.value || {};
      const restauracoes = {...(atual?.quinzenasRestauradas || {})};
      const {attendance, devolvidos, mantidos} = restoreArchivedAttendance({
        attendance: atual?.attendance || {}, archiveAttendance: arq.attendance || {},
        employeesSnapshot: arq.employeesSnapshot || [],
      });

      const agora = new Date().toISOString();
      const marcadores = { ...(atual?.quinzenasArquivadas || {}) };
      delete marcadores[quinzenaId];
      const custosArquivados = { ...(atual?.archivedLaborCosts || {}) };
      delete custosArquivados[quinzenaId];
      restauracoes[quinzenaId] = restorationRecord({archive: arq, quinzenaId, actor: usuario, at: agora});
      const novoPrincipal = {
        ...atual,
        attendance,
        archivedLaborCosts: custosArquivados,
        quinzenasArquivadas: marcadores,
        quinzenasRestauradas: restauracoes,
      };
      // Mesma ressalva do arquivamento (ver comentário lá): grava sempre a
      // linha core; se a linha própria de Ponto já existir, o `attendance`
      // restaurado aqui fica sem efeito na próxima leitura.
      const transaction=await executarArquivoPontoTransacional({
        mode:"restore",expectedUpdatedAt:updatedAt,mainValue:coreFieldsOnly(novoPrincipal,rowVersions,DOMAIN_ROW.PONTO),
        archiveKey:chaveArquivo(quinzenaId),actor:usuario,
        before:{quinzenaId,meta:arq.meta||{}},
        after:{quinzenaId,devolvidos,mantidos,restoration:restauracoes[quinzenaId]},
      });
      if(!transaction.applied){
        if(transaction.reason==="archive_not_found"){
          const recent=await lerLinha();
          if(recent.payload?.quinzenasRestauradas?.[quinzenaId]){
            return res.status(200).json({
              ok:true,data:projectDataForUser(recent.payload,usuario),updatedAt:recent.updatedAt,
              devolvidos:0,mantidos:0,idempotent:true,
            });
          }
        }
        return res.status(transaction.reason==="concurrent_update"?409:404).json({
          error:transaction.reason==="concurrent_update"
            ?"Os dados mudaram durante a restauração. Recarregue e tente novamente."
            :"Arquivo não encontrado.",
          code:`ATTENDANCE_RESTORE_${transaction.reason.toUpperCase()}`,
        });
      }
      await sincronizarPontoAposArquivo({rowVersions,novoPrincipal,actor:usuario,quinzenaId,action:"attendance_restore_ponto_sync"});
      return res.status(200).json({
        ok:true,data:projectDataForUser(novoPrincipal,usuario),
        updatedAt:transaction.updatedAt||agora,devolvidos,mantidos,
      });
    }

    return res.status(400).json({ error: "Ação desconhecida." });
  } catch (err) {
    const correlationId=crypto.randomUUID();
    console.error(`Falha em /api/data [${correlationId}]:`, err);
    if(err?.code==="ATTENDANCE_ARCHIVE_MIGRATION_REQUIRED"){
      return res.status(503).json({
        error:"O arquivamento seguro ainda não está instalado no banco. Execute migrations/006_attendance_archive_transaction.up.sql.",
        code:err.code,
        correlationId,
        retryable:false,
      });
    }
    if(err?.code==="AUDIT_RPC_MIGRATION_REQUIRED"){
      return res.status(503).json({
        error:err.message,
        code:err.code,
        correlationId,
        retryable:false,
      });
    }
    // Não devolve o erro cru: pode conter nome de tabela, coluna, etc.
    return res.status(500).json({
      error:"Não foi possível concluir a operação no servidor.",
      code:"DATA_INTERNAL_ERROR",
      correlationId,
      retryable:true,
    });
  }
}
