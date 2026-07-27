import { PORTAL_VISIBILITY } from "./client-portal-inventory.js";

const PUBLISHED = new Set(["published", "publicado"]);
const list = value => Array.isArray(value) ? value : [];
const string = value => typeof value === "string" ? value : "";
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const projectIdOf = record => String(record?.projectId || record?.obraId || record?.obra || "");
const published = record => PUBLISHED.has(string(record?.status).trim().toLowerCase());
const belongsTo = (record, projectId) => projectIdOf(record) === String(projectId);

function denied(message) { const error = new Error(message); error.status = 403; return error; }

function allowedProjectIds(user = {}, permissions = {}) {
  return new Set([
    ...list(user.projectIds), ...list(user.obraIds), user.projectId, user.obraId,
    ...list(permissions.projectIds), ...list(permissions.obraIds),
  ].filter(Boolean).map(String));
}

function hasPermission(user = {}, permissions = {}, capability) {
  return permissions?.[capability] === true || list(user.permissions).includes(capability);
}

export function isPortalRecordVisible(record, user = {}) {
  const visibility = string(record?.visibility || "project_users").toLowerCase();
  if (!PORTAL_VISIBILITY.includes(visibility)) return false;
  if (visibility === "project_users") return true;
  if (visibility === "owners") return ["owner", "spouse"].includes(string(user.profile));
  if (visibility === "financial") return string(user.profile) === "financial";
  if (visibility === "selected_profiles") return list(record.visibleToProfiles).map(String).includes(string(user.profile));
  return list(record.visibleToUserIds).map(String).includes(string(user.id));
}

function context({ user = {}, project, permissions = {}, sourceData = {} } = {}) {
  const projectId = string(project?.id);
  if (!projectId) throw denied("Obra do portal não informada.");
  if (!allowedProjectIds(user, permissions).has(projectId)) throw denied("Você não possui acesso a esta obra.");
  return { user, project, permissions, sourceData, projectId, can: capability => hasPermission(user, permissions, capability) };
}

function publishedRecords(sourceData, key, projectId, user) {
  return list(sourceData?.[key]).filter(record => belongsTo(record, projectId) && published(record) && isPortalRecordVisible(record, user));
}

const portalProject = project => ({
  id: string(project?.id), name: string(project?.portalName || project?.name),
  coverImage: string(project?.portalCoverImage || project?.portal?.coverImage),
  currentPhase: string(project?.portalCurrentPhase || project?.portal?.currentPhase),
  progress: number(project?.portalProgress ?? project?.portal?.progress),
  estimatedCompletion: string(project?.portalEstimatedCompletion || project?.portal?.estimatedCompletion),
  lastUpdate: string(project?.portalLastUpdate || project?.portal?.lastUpdate),
});

const weeklyUpdate = item => ({ id:string(item.id), period:string(item.period), summary:string(item.summary), completed:list(item.completed).map(string), inProgress:list(item.inProgress).map(string), nextSteps:list(item.nextSteps).map(string), attentionPoints:list(item.attentionPoints).map(string), progress:number(item.progress), publishedAt:string(item.publishedAt), authorName:string(item.authorName) });
const timelineItem = item => ({ id:string(item.id), phase:string(item.phase || item.name), status:string(item.clientStatus || item.status), plannedStart:string(item.plannedStart), plannedEnd:string(item.plannedEnd), actualStart:string(item.actualStart), actualEnd:string(item.actualEnd), progress:number(item.progress), variance:string(item.variance), justification:string(item.clientJustification), lastUpdate:string(item.lastUpdate) });
// Nunca reutiliza `url`: a mídia interna pode apontar para armazenamento sem
// política de cliente. A API de mídia deverá entregar somente URLs temporárias.
const mediaItem = item => ({ id:string(item.id), type:string(item.type), url:string(item.clientUrl), thumbnailUrl:string(item.clientThumbnailUrl || item.thumbnailUrl), caption:string(item.caption || item.legenda), date:string(item.date), phase:string(item.phase), environment:string(item.environment), category:string(item.category), authorName:string(item.authorName) });
const decisionItem = item => ({ id:string(item.id), title:string(item.title), description:string(item.description), dueDate:string(item.dueDate), status:string(item.status), options:list(item.options).map(option => ({ id:string(option.id), label:string(option.label), description:string(option.description), financialImpact:number(option.financialImpact), scheduleImpactDays:number(option.scheduleImpactDays) })), financialImpact:number(item.financialImpact), scheduleImpactDays:number(item.scheduleImpactDays), technicalRecommendation:string(item.technicalRecommendation), publishedAt:string(item.publishedAt) });
const measurementItem = item => ({ id:string(item.id), number:string(item.number || item.codigo), period:string(item.period || item.competencia), description:string(item.description || item.descricao), status:string(item.clientStatus || item.status), percentage:number(item.percentage || item.percentual), amount:number(item.clientAmount), dueDate:string(item.dueDate || item.vencimento), publishedAt:string(item.publishedAt), documentUrl:string(item.clientDocumentUrl) });
const paymentItem = item => ({ id:string(item.id), description:string(item.description), amount:number(item.amount), dueDate:string(item.dueDate), status:string(item.clientStatus || item.status), receiptUrl:string(item.clientReceiptUrl) });
const documentItem = item => ({ id:string(item.id), title:string(item.title || item.nome), category:string(item.category), version:string(item.version), status:string(item.status), publishedAt:string(item.publishedAt), expiresAt:string(item.expiresAt), url:string(item.clientUrl) });
const messageItem = item => ({ id:string(item.id), subject:string(item.subject), contextType:string(item.contextType), contextId:string(item.contextId), body:string(item.body), createdAt:string(item.createdAt), senderName:string(item.senderName), attachments:list(item.attachments).filter(published).map(mediaItem).filter(item => item.url) });
const teamItem = item => ({ id:string(item.id), name:string(item.name || item.nome), role:string(item.role || item.funcao), photoUrl:string(item.photoUrl), contactChannel:string(item.clientContactChannel) });
const financialSummary = item => ({ id:string(item.id), contractOriginal:number(item.contractOriginal), approvedChanges:number(item.approvedChanges), contractCurrent:number(item.contractCurrent), measured:number(item.measured), approved:number(item.approved), paid:number(item.paid), openAmount:number(item.openAmount), balanceToMeasure:number(item.balanceToMeasure), asOf:string(item.asOf), status:string(item.status) });
const projectCashSummary = item => ({ id:string(item.id), totalContributions:number(item.totalContributions), totalExpenses:number(item.totalExpenses), balance:number(item.balance), asOf:string(item.asOf) });
const projectCashMovement = item => ({ id:string(item.id), date:string(item.date), type:string(item.type), category:string(item.category), description:string(item.description), amount:number(item.amount), balance:number(item.balance) });
const invoiceItem = item => ({ id:string(item.id), type:string(item.type), number:string(item.number), issuedAt:string(item.issuedAt), dueDate:string(item.dueDate), supplierName:string(item.supplierName), description:string(item.description), category:string(item.category), grossAmount:number(item.grossAmount), netAmount:number(item.netAmount), status:string(item.clientStatus || item.status) });
const purchaseOrderItem = item => ({ id:string(item.id), number:string(item.number), date:string(item.date), expectedAt:string(item.expectedAt), supplierName:string(item.supplierName), status:string(item.clientStatus || item.status), total:number(item.total), items:list(item.items).map(entry=>({ description:string(entry.description), unit:string(entry.unit), quantity:number(entry.quantity), receivedQuantity:number(entry.receivedQuantity), unitPrice:number(entry.unitPrice) })) });
const quotationItem = item => ({ id:string(item.id), date:string(item.date), status:string(item.clientStatus || item.status), material:string(item.material), unit:string(item.unit), quantity:number(item.quantity), proposals:list(item.proposals).map(entry=>({ supplierName:string(entry.supplierName), unitPrice:number(entry.unitPrice), total:number(entry.total), leadTimeDays:number(entry.leadTimeDays), selected:entry.selected===true })) });
const supportItem = item => ({ id:string(item.id), number:string(item.number), status:string(item.status), category:string(item.category), environment:string(item.environment), openedAt:string(item.openedAt), updatedAt:string(item.updatedAt), slaDueAt:string(item.slaDueAt) });

export function projectClientProjectSummary(input) { const c=context(input); return portalProject(c.project); }
export function projectClientTimeline(input) { const c=context(input); return c.can("viewProgress") ? publishedRecords(c.sourceData,"timeline",c.projectId,c.user).map(timelineItem) : []; }
export function projectClientWeeklyUpdates(input) { const c=context(input); return c.can("viewWeeklyUpdates") ? publishedRecords(c.sourceData,"weeklyUpdates",c.projectId,c.user).map(weeklyUpdate) : []; }
export function projectClientMedia(input) { const c=context(input); return c.can("viewMedia") ? publishedRecords(c.sourceData,"media",c.projectId,c.user).map(mediaItem).filter(item => item.url) : []; }
export function projectClientDecisions(input) { const c=context(input); return c.can("viewDecisions") ? publishedRecords(c.sourceData,"decisions",c.projectId,c.user).map(decisionItem) : []; }
export function projectClientChangeOrders(input) { const c=context(input); return c.can("viewChanges") ? publishedRecords(c.sourceData,"changeOrders",c.projectId,c.user).map(decisionItem) : []; }
export function projectClientFinancialSummary(input) { const c=context(input); return c.can("viewFinancial") ? publishedRecords(c.sourceData,"financialSummaries",c.projectId,c.user).map(financialSummary) : []; }
export function projectClientMeasurements(input) { const c=context(input); return c.can("viewFinancial") ? publishedRecords(c.sourceData,"measurements",c.projectId,c.user).map(measurementItem) : []; }
export function projectClientDocuments(input) { const c=context(input); return c.can("downloadDocuments") ? publishedRecords(c.sourceData,"documents",c.projectId,c.user).map(documentItem).filter(item => item.url) : []; }
export function projectClientMessages(input) { const c=context(input); return c.can("sendMessages") ? publishedRecords(c.sourceData,"messages",c.projectId,c.user).map(messageItem) : []; }
export function projectClientSupport(input) { const c=context(input); return c.can("openAssistance") ? publishedRecords(c.sourceData,"support",c.projectId,c.user).map(supportItem) : []; }

/**
 * Produz a única forma permitida de dados para o Portal do Cliente. O
 * agregador é de conveniência do dashboard; endpoints novos devem chamar as
 * projeções específicas para não devolver um objeto gigante.
 */
export function projectClientPortalData(input = {}) {
  const c=context(input);
  return {
    project:projectClientProjectSummary(c),
    weeklyUpdates:projectClientWeeklyUpdates(c),
    timeline:projectClientTimeline(c),
    decisions:projectClientDecisions(c),
    approvedChanges:projectClientChangeOrders(c),
    financialSummary:projectClientFinancialSummary(c),
    measurements:projectClientMeasurements(c),
    payments:c.can("viewFinancial") ? publishedRecords(c.sourceData,"clientPayments",c.projectId,c.user).map(paymentItem) : [],
    projectCashSummary:c.can("viewProjectCash") ? publishedRecords(c.sourceData,"projectCashSummaries",c.projectId,c.user).map(projectCashSummary) : [],
    projectCashMovements:c.can("viewProjectCash") ? publishedRecords(c.sourceData,"projectCashMovements",c.projectId,c.user).map(projectCashMovement) : [],
    invoices:c.can("viewProcurement") ? publishedRecords(c.sourceData,"clientInvoices",c.projectId,c.user).map(invoiceItem) : [],
    purchaseOrders:c.can("viewProcurement") ? publishedRecords(c.sourceData,"clientPurchaseOrders",c.projectId,c.user).map(purchaseOrderItem) : [],
    quotations:c.can("viewProcurement") ? publishedRecords(c.sourceData,"clientQuotations",c.projectId,c.user).map(quotationItem) : [],
    publishedDocuments:projectClientDocuments(c),
    publishedMedia:projectClientMedia(c),
    messages:projectClientMessages(c),
    support:projectClientSupport(c),
    team:c.can("viewTeam") ? publishedRecords(c.sourceData,"team",c.projectId,c.user).map(teamItem) : [],
  };
}
