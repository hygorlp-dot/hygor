import { validateProjectForm } from "./project-validation.js";

export const PROJECT_COMMAND = Object.freeze({
  PROJECT_SAVED:"OBRA_SALVA",
  PROJECT_DELETED:"OBRA_EXCLUIDA",
  PROJECT_PHASES_SAVED:"FASES_OBRA_SALVAS",
});

export const PROJECT_COMMAND_TYPES = new Set(Object.values(PROJECT_COMMAND));

const fail = reason => ({ ok:false, reason });
const versionOf = item => Number(item?.version || 0);
const projectById = (data, id) =>
  (data?.obras || []).find(item => String(item?.id || "") === String(id || ""));
const validDate = value =>
  !String(value || "") || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
const nonNegative = value =>
  Number.isFinite(Number(value || 0)) && Number(value || 0) >= 0;

const financialNumbers = [
  "contractValue", "adminPercentage", "parcelaMensal", "totalParcelas",
  "diaVenc1", "diaVenc2", "entrada",
];
const editableFields = [
  "id","name","clienteId","cliente","address","condominioId",
  "condominioNome","quadra","lote","engineerId","engineer","startDate",
  "faseId","status","areaM2","oneDriveUrl","contractType","contractValue",
  "adminPercentage","adminBaseMateriais","adminBaseMaoDeObra",
  "adminBaseTerceirizados","billingType","parcelaMensal","contractStart",
  "contractEnd","totalParcelas","billingFrequency","diaVenc1","diaVenc2",
  "entrada","entradaDate","hasCaixa",
  "oneDriveDriveId","oneDriveFolderId","oneDriveFolders",
  "oneDriveStructureVersion","oneDriveStructureSyncedAt",
];
const editablePatch = raw => Object.fromEntries(
  editableFields
    .filter(field => Object.prototype.hasOwnProperty.call(raw, field))
    .map(field => [field, raw[field]]),
);

const projectHasDependencies = (data, projectId) => {
  const id = String(projectId || "");
  const collections = [
    "employees", "payments", "medicoes", "outrasDesp", "caixaObra",
    "transacoes", "notasFiscais", "pedidos", "pagsTerceiros",
    "medicoesTerc", "pagamentosFolha", "titulosFolha", "rescisoes",
    "equipamentos", "locacoesEquip", "manutencoesEquip", "rdos",
    "medicoesObra", "progressRecords", "weeklyCommitments",
    "qualidadeRegistros", "solicitacoesCompra", "cotacoes",
  ];
  return collections.some(key => (data?.[key] || []).some(item =>
    String(item?.obraId || item?.obra || item?.lastObra || "") === id
  ));
};

export const projectCommandObraId = (data = {}, command = {}) => {
  const payload = command?.payload || {};
  return String(
    payload?.project?.id
    || payload?.projectId
    || projectById(data, payload?.projectId)?.id
    || "",
  );
};

export const applyProjectCommand = (
  data = {},
  command = {},
  now = new Date().toISOString(),
) => {
  if (!PROJECT_COMMAND_TYPES.has(command.type)) return null;
  const actorId = String(command.actorId || "");
  const actorName = String(command.actorName || "").trim() || "Administrador";
  if (!actorId) return fail("Sessão do administrador indisponível.");

  if(command.type===PROJECT_COMMAND.PROJECT_PHASES_SAVED){
    const phases=Array.isArray(command.payload?.phases)?command.payload.phases:[];
    const currentVersion=Number(data?.fasesVersion||0);
    if(currentVersion!==Number(command.expectedVersion||0))return fail("As fases foram alteradas por outra pessoa. Atualize a tela.");
    if(!phases.length)return fail("O fluxo precisa de ao menos uma fase.");
    if(phases.some(item=>!String(item?.id||"").trim()||!String(item?.nome||"").trim()))return fail("Todas as fases precisam de identificação e nome.");
    const ids=new Set(phases.map(item=>String(item.id)));
    if(ids.size!==phases.length)return fail("Existem fases duplicadas no fluxo.");
    const normalized=phases.map((item,index)=>({...item,nome:String(item.nome).trim(),ordem:index,updatedAt:now,updatedById:actorId,updatedBy:actorName}));
    const fallback=normalized[0].id;
    return {ok:true,entityId:"project-phases",data:{...data,fases:normalized,fasesVersion:currentVersion+1,obras:(data.obras||[]).map(project=>ids.has(String(project.faseId||""))?project:{...project,faseId:fallback}),projectPhaseAudit:[...(data.projectPhaseAudit||[]),{at:now,byId:actorId,by:actorName,phases:normalized.map(item=>({id:item.id,nome:item.nome,ordem:item.ordem}))}].slice(-500)}};
  }

  if (command.type === PROJECT_COMMAND.PROJECT_DELETED) {
    const id = String(command.payload?.projectId || "").trim();
    const current = projectById(data, id);
    if (!current) return fail("Obra não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion)) {
      return fail("A obra foi alterada por outra pessoa. Atualize a tela.");
    }
    if (projectHasDependencies(data, id)) {
      return fail("A obra possui histórico operacional ou financeiro e não pode ser excluída.");
    }
    return {
      ok:true,
      entityId:id,
      data:{
        ...data,
        obras:(data.obras || []).filter(item => String(item?.id || "") !== id),
      },
    };
  }

  const raw = command.payload?.project || {};
  const patch = editablePatch(raw);
  const id = String(raw.id || "").trim();
  const current = projectById(data, id);
  if (!id) return fail("A obra precisa de uma identificação única.");
  if (current && versionOf(current) !== Number(command.expectedVersion)) {
    return fail("A obra foi alterada por outra pessoa. Atualize a tela.");
  }
  if (!current && Number(command.expectedVersion || 0) !== 0) {
    return fail("A versão inicial da obra é inválida.");
  }
  const name = String(raw.name || "").trim();
  if (!name) return fail("Informe o nome da obra.");
  if ((data.obras || []).some(item =>
    String(item?.id || "") !== id
    && String(item?.name || "").trim().toLocaleLowerCase("pt-BR")
      === name.toLocaleLowerCase("pt-BR")
  )) return fail("Já existe uma obra com este nome.");
  if (financialNumbers.some(field => !nonNegative(raw[field]))) {
    return fail("Valores contratuais, parcelas e percentuais não podem ser negativos.");
  }
  if (Number(raw.adminPercentage || 0) > 100) {
    return fail("O percentual de administração não pode superar 100%.");
  }
  if (!validDate(raw.contractStart) || !validDate(raw.contractEnd)
      || !validDate(raw.entradaDate) || !validDate(raw.startDate)) {
    return fail("A obra contém uma data inválida.");
  }
  if (raw.contractStart && raw.contractEnd
      && String(raw.contractEnd) < String(raw.contractStart)) {
    return fail("O término do contrato não pode anteceder o início.");
  }
  const validationErrors=validateProjectForm(raw,{requireComplete:false});
  if(Object.keys(validationErrors).length){
    return fail(Object.values(validationErrors)[0]);
  }
  const project = {
    ...(current || {}),
    ...patch,
    id,
    name,
    contractValue:Number(raw.contractValue || 0),
    adminPercentage:Number(raw.adminPercentage || 0),
    parcelaMensal:Number(raw.parcelaMensal || 0),
    totalParcelas:Number(raw.totalParcelas || 0),
    diaVenc1:Number(raw.diaVenc1 || 0),
    diaVenc2:Number(raw.diaVenc2 || 0),
    entrada:Number(raw.entrada || 0),
    hasCaixa:!!raw.hasCaixa,
    version:versionOf(current) + 1,
    createdAt:current?.createdAt || now,
    createdById:current?.createdById || actorId,
    createdBy:current?.createdBy || actorName,
    updatedAt:now,
    updatedById:actorId,
    updatedBy:actorName,
    operationalHistory:[...(current?.operationalHistory||[]),...(current&&String(current.faseId||"")!==String(patch.faseId||current.faseId||"")?[{type:"phase_changed",from:current.faseId||"",to:patch.faseId||"",at:now,byId:actorId,by:actorName}]:[])].slice(-500),
  };
  return {
    ok:true,
    entityId:id,
    data:{
      ...data,
      obras:current
        ? (data.obras || []).map(item => String(item?.id || "") === id ? project : item)
        : [...(data.obras || []), project],
    },
  };
};
