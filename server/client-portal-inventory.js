// Inventário canônico da fronteira ERP → Portal do Cliente.
// Ele não transforma nem publica registros: documenta e restringe o contrato
// que as projeções server-side podem expor. Campos ausentes desta lista ficam
// deliberadamente fora do portal.
export const PORTAL_VISIBILITY = Object.freeze([
  "project_users", "owners", "financial", "selected_profiles", "selected_users",
]);

export const CLIENT_PORTAL_DATA_INVENTORY = Object.freeze([
  { domain:"obra", source:"obras", fields:["id","portalName|name","portalCoverImage","portalCurrentPhase","portalProgress","portalEstimatedCompletion","portalLastUpdate"], classification:"publicable_after_approval", profiles:["all project users"], publication:"portal enabled + project membership" },
  { domain:"atualização semanal", source:"weeklyUpdates", fields:["id","period","summary","completed","inProgress","nextSteps","attentionPoints","progress","publishedAt","authorName"], classification:"publicable_after_approval", profiles:["viewWeeklyUpdates"], publication:"status=published + visibility" },
  { domain:"cronograma", source:"timeline", fields:["id","phase","status","plannedStart","plannedEnd","actualStart","actualEnd","progress","variance","clientJustification","lastUpdate"], classification:"publicable_after_approval", profiles:["viewProgress"], publication:"status=published + visibility" },
  { domain:"mídia", source:"media", fields:["id","type","clientUrl","thumbnailUrl","caption","date","phase","environment","category","authorName"], classification:"publicable_after_approval", profiles:["viewMedia"], publication:"status=published + visibility + URL temporária de cliente" },
  { domain:"decisão", source:"decisions", fields:["id","title","description","dueDate","status","options[id,label,description,financialImpact,scheduleImpactDays]","financialImpact","scheduleImpactDays","technicalRecommendation","publishedAt"], classification:"restricted_by_profile", profiles:["viewDecisions","approveDecisions"], publication:"status=published + visibility" },
  { domain:"alteração de escopo", source:"changeOrders", fields:["id","title","description","dueDate","status","options","financialImpact","scheduleImpactDays","technicalRecommendation","publishedAt"], classification:"restricted_by_profile", profiles:["viewChanges","approveChanges"], publication:"status=published + visibility" },
  { domain:"resumo financeiro contratual", source:"financialSummaries", fields:["id","contractOriginal","approvedChanges","contractCurrent","measured","approved","paid","openAmount","balanceToMeasure","asOf","status"], classification:"restricted_by_profile", profiles:["viewFinancial"], publication:"status=published + visibility; nunca derivar do razão interno" },
  { domain:"medição", source:"measurements", fields:["id","number","period","description","status","percentage","amount","dueDate","publishedAt","clientDocumentUrl"], classification:"restricted_by_profile", profiles:["viewFinancial","approveMeasurements"], publication:"status=published + visibility" },
  { domain:"pagamento contratual", source:"clientPayments", fields:["id","description","amount","dueDate","status","clientReceiptUrl"], classification:"restricted_by_profile", profiles:["viewFinancial"], publication:"status=published + visibility" },
  { domain:"documento", source:"documents", fields:["id","title","category","version","status","publishedAt","expiresAt","clientUrl"], classification:"restricted_by_profile", profiles:["downloadDocuments"], publication:"status=published + visibility + URL temporária" },
  { domain:"mensagem", source:"messages", fields:["id","subject","contextType","contextId","body","createdAt","senderName","attachments"], classification:"restricted_by_profile", profiles:["sendMessages"], publication:"status=published + visibility; comentário interno é proibido" },
  { domain:"equipe", source:"team", fields:["id","name","role","photoUrl","clientContactChannel"], classification:"publicable_after_approval", profiles:["viewTeam"], publication:"status=published + visibility" },
  { domain:"assistência", source:"support", fields:["id","number","status","category","environment","openedAt","updatedAt","slaDueAt"], classification:"restricted_by_profile", profiles:["openAssistance"], publication:"somente solicitações do próprio cliente; sem notas internas" },
  { domain:"proibido", source:"ERP operacional", fields:["folha","salários","CPF","PIX","dados bancários","extrato","conciliação","DRE","margem","custos internos","observações internas","auditoria interna","tokens","backups"], classification:"prohibited", profiles:[], publication:"nunca" },
]);

export const PORTAL_PROHIBITED_FIELD_FRAGMENTS = Object.freeze([
  "salary", "salario", "payroll", "folha", "cpf", "pix", "bank", "reconciliation",
  "dre", "margin", "internalcost", "internalnotes", "servicerole", "token", "secret",
]);
