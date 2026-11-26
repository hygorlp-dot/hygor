// @ts-check
import { parseCompanyFileReference } from "../src/domains/arquivos/company-file-reference.js";
import { resolvePublishedCompanyFile } from "./company-files.js";
import { buildClientPortalPublicationRows } from "./client-portal-publication.js";

/** @typedef {string|number} RecordId */
/** @typedef {{token?: string, ativo?: boolean, publicarFotos?: boolean, publicarFinanceiro?: boolean, publicarDocumentos?: boolean, publicarCronograma?: boolean, atualizadoEm?: string, mensagem?: string}} PortalSettings */
/** @typedef {{id: RecordId, name?: string, status?: string, capaUrl?: string, cliente?: string, engineer?: string, address?: string, contractStart?: string, startDate?: string, contractEnd?: string, portalCliente?: PortalSettings, documentosOneDrive?: PortalDocument[]}} PortalWork */
/** @typedef {{id: RecordId, nome?: string, url?: string, publicarCliente?: boolean}} PortalDocument */
/** @typedef {{id?: RecordId, obraId: RecordId, status?: string, codigo?: string|number, data?: string, descricao?: string, clima?: Record<string,unknown>, fotos?: {publicarCliente?: boolean, url?: string, legenda?: string}[]}} PortalDiary */
/** @typedef {{id?: RecordId, titulo?: unknown, nome?: string, descricao?: string, inicio?: string, fim?: string, progresso?: number|string}} PortalTask */
/** @typedef {{id?: RecordId, obraId: RecordId, descricao?: string, competencia?: string, valorPrevisto?: number|string, valorRecebido?: number|string, recebido?: boolean}} PortalMeasurement */
/** @typedef {{obras?: PortalWork[], rdos?: PortalDiary[], planos?: {obraId: RecordId, tarefas?: PortalTask[]}[], medicoes?: PortalMeasurement[], [section: string]: unknown}} PortalData */
/** @typedef {{id?: unknown, period?: unknown, summary?: unknown, authorName?: string}} PublishedUpdate */

/**
 * @param {{
 *   data: PortalData|null|undefined,
 *   request: {obraId?: unknown, token?: unknown}|null|undefined,
 *   companyId: string,
 *   storage: {from: (bucket: string) => {createSignedUrl: (name: string, ttl: number) => Promise<{data: {signedUrl?: string}|null, error: unknown}>}}|undefined,
 *   equalTokens: (left: string, right: string) => boolean,
 * }} input
 */
export async function readLegacyClientPortal({data:p,request,companyId,storage,equalTokens}){
  const obraId = String(request?.obraId || "");
  const token = String(request?.token || "");
  const obra = (p?.obras || []).find(o => String(o.id) === obraId);
  const portal = obra?.portalCliente || {};
  const tokenValido = token && portal.token && token.length === String(portal.token).length &&
    equalTokens(token, String(portal.token));
  if (!p || !obra || !portal.ativo || !tokenValido) {
    return { status: /** @type {const} */ (404), body:{ error:"Portal indisponível ou link inválido." } };
  }

  const rdos = (p?.rdos || []).filter(r => r.obraId === obraId && r.status === "concluido")
    .sort((a,b) => String(b.data||"").localeCompare(String(a.data||""))).slice(0, 12);
  const fotos = portal.publicarFotos === false ? [] : rdos.flatMap(r => (r.fotos || [])
    .filter(f => f.publicarCliente !== false).map(f => ({ url:f.url || "", legenda:f.legenda || "", data:r.data, rdoCodigo:r.codigo })))
    .filter(f => f.url).slice(0, 24);
  // Token and project were verified above; never publish a stable private
  // reference or sign an object belonging to a different project/company.
  await Promise.all(fotos.map(async photo=>{
    if(!photo.url.startsWith('company-file:'))return;
    const reference=parseCompanyFileReference(photo.url);
    if(!reference){photo.url='';return;}
    const result=await resolvePublishedCompanyFile({reference:photo.url,companyId,projectId:obraId,storage});
    photo.url=result.status===200?result.body.url:'';
  }));
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
  /** @param {string} domain */
  const payloads=domain=>rowsPublicados.filter(row=>row.domain===domain).map(row=>row.payload);
  const updates=/** @type {PublishedUpdate[]} */ (payloads("weekly_update"));
  const atualizacoes=updates.map(item=>({id:item.id,at:item.period,mensagem:item.summary,responsavel:item.authorName||"Equipe ARCD"}));
  return { status: /** @type {const} */ (200), body:{ portal:{
    obra:{ id:obra.id, nome:obra.name, status:obra.status, capaUrl:obra.capaUrl || "", cliente:obra.cliente || "", engenheiro:obra.engineer || "", endereco:obra.address || "", inicio:obra.contractStart || obra.startDate || "", terminoPrevisto:obra.contractEnd || "" },
    mensagem:portal.mensagem || "Acompanhe aqui a evolução da sua obra.", progresso,
    cronograma:portal.publicarCronograma === false ? [] : tarefas.slice(0,30),
    diarios:rdos.map(r => ({ id:r.id, codigo:r.codigo, data:r.data, descricao:r.descricao || "", clima:r.clima || {}, fotos:(r.fotos||[]).filter(f=>f.publicarCliente!==false).length })),
    fotos:fotos.filter(photo=>photo.url), medicoes, documentos, atualizacoes,
    caixaResumo:payloads("cash_summary")[0] || null,
    caixaMovimentacoes:payloads("cash_movement"),
    notasFiscais:payloads("invoice"),
    compras:payloads("purchase_order"),
    cotacoes:payloads("quotation"),
    atualizadoEm:portal.atualizadoEm || "",
  }}};
}
