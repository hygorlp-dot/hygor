import { createHash } from 'node:crypto';

const list = value => Array.isArray(value) ? value : [];
const fail = (status, code) => ({ ok: false, status, code });
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const text = (value, max = 2000) => typeof value === 'string' ? value.slice(0, max) : '';
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const roles = ['admin', 'compras', 'engenheiro', 'financeiro'];

export const SIGNATURE_PROVIDER_CONTRACT = Object.freeze({
  state: 'not-implemented',
  requiredCapabilities: ['authenticated-provider-client', 'document-hash-binding', 'verified-webhook-or-authenticated-poll', 'deduplicated-events', 'signer-identity-evidence', 'immutable-evidence-storage'],
  forbidden: ['client-supplied-signed-status', 'automatic-user-signature', 'mark-signed-from-URL'],
});

export function signatureProviderReadiness() {
  return { configured: false, active: false, provider: null, providerRequired:false, reason: 'MANUAL_USER_TOKEN_SIGNING',
    trackingMode: 'manual', tokenHandledByUser: true, canPrepare: true, canSend: false, canVerifySignature: false, automaticSigning: false };
}

function access({data, user, grant, obraId, scope}) {
  const actor = list(data?.usuarios).find(u => u.id === grant?.userId && u.active !== false);
  if (!actor || actor.id !== user?.id || actor.role !== user?.role || actor.obraId !== user?.obraId || !roles.includes(actor.role) || !list(grant?.scopes).includes(scope)) return fail(403, 'SIGNATURE_SCOPE_FORBIDDEN');
  if (!id(obraId) || !list(grant.obraIds).includes(obraId) || (actor.obraId && actor.obraId !== obraId) || !list(data.obras).some(w => w.id === obraId)) return fail(403, 'WORK_FORBIDDEN');
  return {ok:true,actor};
}

// Read-only preparation: caller persists this packet through the audited mutation path.
// This is a review summary from recorded terms, not a legal-completeness assertion.
export function buildSignaturePacket({data = {}, user = {}, grant = {}, body = {}, now = new Date().toISOString()} = {}) {
  const authorized = access({data,user,grant,obraId:body.obraId,scope:'contratos:prepare'});
  if (!authorized.ok) return authorized;
  const allowed = ['action','packetId','obraId','sourceType','sourceId','expectedVersion','expectedSourceHash','idempotencyKey'];
  if (Object.keys(body).some(k => !allowed.includes(k)) || !id(body.packetId) || !id(body.sourceId) || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || !['supply-contract','contract-amendment'].includes(body.sourceType)) return fail(400, 'INVALID_SIGNATURE_PACKET');
  const obra = list(data.obras).find(w => w.id === body.obraId);
  const source = body.sourceType === 'supply-contract' ? list(data.contratosFornecimento).find(c => c.id === body.sourceId && c.obraId === body.obraId) : list(obra.aditivosContrato).find(a => a.id === body.sourceId);
  if (!source) return fail(404,'SIGNATURE_SOURCE_NOT_FOUND');
  if (body.sourceType === 'supply-contract' && !['admin','compras'].includes(user.role)) return fail(403,'SIGNATURE_SCOPE_FORBIDDEN');
  if (body.sourceType === 'contract-amendment' && !['admin','engenheiro','financeiro'].includes(user.role)) return fail(403,'SIGNATURE_SCOPE_FORBIDDEN');
  if (Number(source.version || 0) !== body.expectedVersion) return fail(409,'SIGNATURE_SOURCE_CHANGED');
  if (['cancelado','cancelada','encerrado','encerrada','recusado'].includes(source.status)) return fail(409,'SIGNATURE_SOURCE_INACTIVE');
  let terms;
  if (body.sourceType === 'supply-contract') {
    if (list(source.itens).length > 200) return fail(422,'SIGNATURE_SOURCE_TOO_LARGE');
    const supplier = list(data.fornecedores).find(f => f.id === source.fornecedorId);
    if (!supplier || (supplier.obraId && supplier.obraId !== body.obraId)) return fail(403,'SIGNATURE_SUPPLIER_UNAVAILABLE');
    terms = { numero:text(source.numero,100), fornecedorId:text(source.fornecedorId,100), fornecedorNome:text(supplier?.nome,200),
      vigenciaInicio:text(source.vigenciaInicio,30), vigenciaFim:text(source.vigenciaFim,30), observacao:text(source.observacao),
      itens:list(source.itens).map(i => ({id:text(i.id,100),materialId:text(i.materialId,100),unidadeRef:text(i.unidadeRef,40),unidadeCompra:text(i.unidadeCompra,40),fatorConversao:number(i.fatorConversao),qtdContratada:number(i.qtdContratada),precoUnit:number(i.precoUnit)})) };
    if (!terms.fornecedorId || !terms.itens.length || terms.itens.some(i => i.qtdContratada == null || i.precoUnit == null || !Number.isSafeInteger(Math.round(i.qtdContratada*i.precoUnit*100)))) return fail(422,'SIGNATURE_SOURCE_INCOMPLETE');
  } else {
    terms = {numero:source.numero == null?'':String(source.numero),descricao:text(source.descricao),justificativa:text(source.justificativa),valor:number(source.valor),prazoDias:number(source.prazoDias),orcamentoRevisaoId:text(source.orcamentoRevisaoId,100)};
    if (!terms.descricao || terms.valor == null || !Number.isSafeInteger(Math.round(terms.valor*100))) return fail(422,'SIGNATURE_SOURCE_INCOMPLETE');
  }
  const sourceSnapshot = {obraId:body.obraId,obraNome:text(obra.name||obra.nome,200),sourceType:body.sourceType,sourceId:body.sourceId,sourceVersion:Number(source.version||0),sourceStatus:text(source.status,50),terms};
  const sourceHash = hash(sourceSnapshot);
  if (body.expectedSourceHash !== undefined && body.expectedSourceHash !== sourceHash) return fail(409,'SIGNATURE_SOURCE_CHANGED');
  const title = body.sourceType === 'supply-contract' ? 'Contrato de fornecimento — pacote para revisão' : 'Aditivo contratual — pacote para revisão';
  const document = {format:'text/plain',title,text:[title,`Obra: ${sourceSnapshot.obraNome} (${body.obraId})`,`Origem: ${body.sourceType}/${body.sourceId}, versão ${sourceSnapshot.sourceVersion}`,`Estado registrado: ${sourceSnapshot.sourceStatus}`,JSON.stringify(terms,null,2),'MINUTA/RESUMO PARA REVISÃO HUMANA. Não enviada nem assinada. Conferir partes, cláusulas, anexos e representação antes de encaminhar.'].join('\n\n')};
  if(document.text.length>250000)return fail(422,'SIGNATURE_SOURCE_TOO_LARGE');
  const contentHash = hash(document);
  return {ok:true,packet:{id:body.packetId,obraId:body.obraId,sourceType:body.sourceType,sourceId:body.sourceId,sourceVersion:sourceSnapshot.sourceVersion,sourceHash,contentHash,hashAlgorithm:'sha256',contentHashEncoding:'canonical-json-sorted-keys-v1',
    status:'prepared-awaiting-user-signature',preparedAt:now,preparedById:authorized.actor.id,preparedByGrantId:grant.id,document,
    reviewRequired:true,provider:null,providerEnvelopeId:null,signatureVerified:false,sentAt:null,signedAt:null},provider:signatureProviderReadiness()};
}

// Stored preparation is visible; unsupported provider status is never trusted or promoted.
export function readSignaturePackets({data = {}, user = {}, grant = {}, body = {}} = {}) {
  const authorized = access({data,user,grant,obraId:body.obraId,scope:'contratos:signatures:read'});
  if (!authorized.ok) return authorized;
  const offset = body.offset ?? 0, limit = body.limit ?? 50;
  if (!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100) return fail(400,'INVALID_PAGE');
  if(body.packetId!==undefined&&!id(body.packetId))return fail(400,'INVALID_PACKET_ID');
  const source = list(data.integrationSignaturePackets).filter(p=>(body.packetId===undefined||p.id===body.packetId)&&p.obraId===body.obraId && (p.sourceType==='supply-contract'?['admin','compras'].includes(user.role):p.sourceType==='contract-amendment'&&['admin','engenheiro','financeiro'].includes(user.role)));
  return {ok:true,obraId:body.obraId,total:source.length,nextOffset:offset+limit<source.length?offset+limit:null,
    packets:source.slice(offset,offset+limit).map(p=>({id:text(p.id,100),obraId:body.obraId,sourceType:text(p.sourceType,50),sourceId:text(p.sourceId,100),sourceVersion:number(p.sourceVersion),sourceHash:text(p.sourceHash,64),contentHash:text(p.contentHash,64),hashAlgorithm:'sha256',contentHashEncoding:'canonical-json-sorted-keys-v1',preparedAt:text(p.preparedAt,40),version:number(p.version),status:['awaiting-signature','reported-signed','reported-declined'].includes(p.status)&&p.trackingMode==='manual'?p.status:'prepared-awaiting-user-signature',trackingMode:'manual',reportedAt:text(p.manualReportedAt,40)||null,reportedById:text(p.manualReportedById,100)||null,signatureVerified:false,providerStatus:'not-used',...(body.packetId?projectDocument(p):{})})),provider:signatureProviderReadiness()};
}

// Manual status is an attributed human report, NEVER cryptographic verification.
// No token PIN, certificate secret, URL fetching or provider request is accepted.
export function prepareSignatureMutation({data = {},user = {},grant = {},body = {},now = new Date().toISOString()} = {}) {
  const preparing = body.operation === 'prepare';
  if (!preparing && body.operation !== 'record-manual-status') return {kind:'error',status:400,error:'INVALID_SIGNATURE_OPERATION'};
  const permission = access({data,user,grant,obraId:body.obraId,scope:preparing?'contratos:prepare':'contratos:signatures:write'});
  const error = result => ({kind:'error',status:result.status,error:result.code});
  if (!permission.ok) return error(permission);
  if (!id(body.packetId) || !/^[a-zA-Z0-9_-]{16,160}$/.test(body.idempotencyKey||'')) return error(fail(400,'INVALID_SIGNATURE_REQUEST'));
  const packets = list(data.integrationSignaturePackets);
  const packet = packets.find(p=>p.id===body.packetId);
  if (packet && packet.obraId!==body.obraId) return error(fail(403,'WORK_FORBIDDEN'));
  const receipt = hash({grantId:grant.id,obraId:body.obraId,key:body.idempotencyKey});
  const fingerprint = hash(body);
  const prior = packets.find(p=>p.obraId===body.obraId && (p.preparationReceipt?.key===receipt || list(p.history).some(h=>h.receipt===receipt)));
  if (prior) {
    const previousHash=prior.preparationReceipt?.key===receipt?prior.preparationReceipt.fingerprint:list(prior.history).find(h=>h.receipt===receipt)?.requestHash;
    return previousHash===fingerprint?{kind:'idempotent',packetId:prior.id}:{kind:'error',status:409,error:'IDEMPOTENCY_MISMATCH'};
  }
  if (preparing) {
    if (packet) return error(fail(409,'SIGNATURE_PACKET_EXISTS'));
    if (packets.length>=200) return error(fail(409,'SIGNATURE_PACKET_CAPACITY_REACHED'));
    const {operation,...input}=body;
    const built=buildSignaturePacket({data,user,grant,body:input,now});
    if (!built.ok) return error(built);
    const created={...built.packet,version:1,trackingMode:'manual',preparationReceipt:{key:receipt,fingerprint},history:[]};
    return {kind:'save',data:{...data,integrationSignaturePackets:[...packets,created]},packetId:created.id,
      before:{sourceId:created.sourceId,sourceHash:created.sourceHash},after:{packetId:created.id,contentHash:created.contentHash,status:created.status,integrationGrantId:grant.id,signatureVerified:false}};
  }
  const fields=['action','operation','packetId','obraId','expectedVersion','idempotencyKey','documentHash','reportedStatus','evidence'];
  if (Object.keys(body).some(k=>!fields.includes(k)) || !Number.isSafeInteger(body.expectedVersion) || !['awaiting-signature','reported-signed','reported-declined'].includes(body.reportedStatus)) return error(fail(400,'INVALID_MANUAL_STATUS'));
  if (!packet) return error(fail(404,'SIGNATURE_PACKET_NOT_FOUND'));
  if (packet.version!==body.expectedVersion || packet.contentHash!==body.documentHash) return error(fail(409,'SIGNATURE_DOCUMENT_CHANGED'));
  if (list(packet.history).length>=100) return error(fail(409,'SIGNATURE_HISTORY_CAPACITY_REACHED'));
  let evidence=null;
  if (body.evidence!==undefined) {
    const e=body.evidence;
    if (!e || typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!['sha256','fileName','mimeType'].includes(k))||!/^[a-f0-9]{64}$/.test(e.sha256||'')||typeof e.fileName!=='string'||!e.fileName||e.fileName.length>200||!/^[\w .()_-]+$/.test(e.fileName)||!['application/pdf','application/pkcs7-signature','application/pkcs7-mime'].includes(e.mimeType)) return error(fail(400,'INVALID_EVIDENCE_METADATA'));
    evidence={sha256:e.sha256,fileName:e.fileName,mimeType:e.mimeType,hashMeaning:'external-file-bytes-user-reported',verified:false};
  }
  if(body.reportedStatus==='reported-signed'&&!evidence)return error(fail(400,'EVIDENCE_METADATA_REQUIRED'));
  // Revalidate source snapshot without granting the caller a new public preparation permission.
  const current=buildSignaturePacket({data,user,grant:{...grant,scopes:[...list(grant.scopes),'contratos:prepare']},body:{packetId:packet.id,obraId:packet.obraId,sourceType:packet.sourceType,sourceId:packet.sourceId,expectedVersion:packet.sourceVersion,expectedSourceHash:packet.sourceHash},now});
  if(!current.ok)return error(current);
  const event={status:body.reportedStatus,reportedAt:now,reportedById:permission.actor.id,reportedByGrantId:grant.id,source:'manual',signatureVerified:false,documentHash:packet.contentHash,evidence,receipt,requestHash:fingerprint};
  const updated={...packet,version:packet.version+1,status:body.reportedStatus,trackingMode:'manual',signatureVerified:false,manualReportedAt:now,manualReportedById:permission.actor.id,history:[...list(packet.history),event]};
  return {kind:'save',data:{...data,integrationSignaturePackets:packets.map(p=>p.id===packet.id?updated:p)},packetId:packet.id,
    before:{packetId:packet.id,status:packet.status,version:packet.version},after:{packetId:packet.id,status:updated.status,version:updated.version,source:'manual',signatureVerified:false,documentHash:packet.contentHash,integrationGrantId:grant.id}};
}

function projectDocument(packet){
  const d=packet.document;
  if(!d||d.format!=='text/plain'||typeof d.title!=='string'||typeof d.text!=='string'||d.title.length>200||d.text.length>250000||hash(d)!==packet.contentHash)return {document:null,documentIntegrity:'mismatch'};
  return {document:{format:'text/plain',title:d.title,text:d.text},documentIntegrity:'matched-content-hash'};
}
