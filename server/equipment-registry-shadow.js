import crypto from "node:crypto";

export const EQUIPMENT_REGISTRY_SCHEMA_VERSION = 1;

const array = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? "").trim();
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : "";
const version = value => Number.isInteger(Number(value)) && Number(value) >= 0
  ? Number(value)
  : 0;
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stable(value[key])]),
  );
};
const hash = value => crypto
  .createHash("sha256")
  .update(JSON.stringify(stable(value)))
  .digest("hex");
const withHash = row => ({ ...row, sourceHash:hash(row.payload) });

// CORE-002 (24/08/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): projeta
// data.equipamentos - a fonte canônica ainda editada via EQUIPAMENTO_SALVO
// (src/domains/equipamentos/commands.js) - não a normalização interna
// (equipmentModels/Lots/Units, derivada e re-derivável a qualquer momento
// por migrateLegacyEquipmentRegistry, src/domains/equipamentos/registry.js).
const equipmentRow = equipment => withHash({
  id:text(equipment?.id),
  name:text(equipment?.nome),
  category:text(equipment?.categoria),
  assetTag:text(equipment?.patrimonio),
  status:text(equipment?.status || "disponivel"),
  active:equipment?.ativo !== false,
  ownerId:text(equipment?.proprietarioId),
  currentProjectId:text(equipment?.obraAtualId),
  acquisitionValue:Number(equipment?.valorAquisicao) || 0,
  sourceVersion:version(equipment?.version),
  payload:equipment || {},
});

const ownerRow = owner => withHash({
  id:text(owner?.id),
  name:text(owner?.nome),
  ownerType:text(owner?.tipo || "terceiro"),
  active:owner?.ativo !== false,
  payload:owner || {},
});

// "Locação" já É o vínculo equipamento-obra no código - não existe um
// conceito de alocação separado (ver comentário no topo da migration 009).
// `active` é uma simplificação de consulta (== "ativa"); o estado completo
// do ciclo de vida (lifecycleState, tarifas, descontos, checkpoints...)
// fica preservado inteiro em `payload`.
const allocationRow = allocation => withHash({
  id:text(allocation?.id),
  equipmentId:text(allocation?.equipamentoId),
  projectId:text(allocation?.obraId),
  startDate:date(allocation?.inicio),
  endDate:date(allocation?.fim),
  status:text(allocation?.status || "ativa"),
  active:text(allocation?.status) === "ativa",
  sourceVersion:version(allocation?.version),
  payload:allocation || {},
});

const maintenanceEventRow = event => withHash({
  id:text(event?.id),
  equipmentId:text(event?.equipamentoId),
  projectId:text(event?.obraId),
  startDate:date(event?.inicio || event?.data),
  endDate:date(event?.fim || event?.dataConclusao),
  cost:Number(event?.custo) || 0,
  description:text(event?.descricao),
  status:text(event?.status || "programada"),
  payload:event || {},
});

export const buildEquipmentRegistrySnapshot = data => {
  const equipment=array(data?.equipamentos).map(equipmentRow).filter(row => row.id && row.name);
  const equipmentIds=new Set(equipment.map(row => row.id));
  const owners=array(data?.proprietariosEquip).map(ownerRow).filter(row => row.id && row.name);
  const allocations=array(data?.locacoesEquip).map(allocationRow)
    .filter(row => row.id && row.equipmentId && row.projectId && row.startDate && equipmentIds.has(row.equipmentId));
  const maintenanceEvents=array(data?.manutencoesEquip).map(maintenanceEventRow)
    .filter(row => row.id && row.equipmentId && row.projectId && row.startDate && equipmentIds.has(row.equipmentId));
  const snapshot={
    schemaVersion:EQUIPMENT_REGISTRY_SCHEMA_VERSION,
    complete:true,
    equipment,owners,allocations,maintenanceEvents,
  };
  return {
    ...snapshot,
    counts:Object.fromEntries(
      Object.entries(snapshot)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, value.length]),
    ),
  };
};

const keyFor = {
  equipment:row => text(row.id),
  owners:row => text(row.id),
  allocations:row => text(row.id),
  maintenanceEvents:row => text(row.id),
};

export const compareEquipmentRegistrySnapshot = (snapshot, canonical = {}) => {
  const divergences=[];
  Object.entries(keyFor).forEach(([section, getKey]) => {
    const expected=new Map(array(snapshot?.[section]).map(row => [getKey(row), row.sourceHash]));
    const actualRows=array(canonical?.[section]).filter(row => !row.archived_at);
    const actual=new Map(actualRows.map(row => [getKey(row), text(row.source_hash ?? row.sourceHash)]));
    expected.forEach((sourceHash, key) => {
      if (!actual.has(key)) divergences.push({ section, key, reason:"missing" });
      else if (actual.get(key) !== sourceHash) divergences.push({ section, key, reason:"hash_mismatch" });
    });
    actual.forEach((_, key) => {
      if (!expected.has(key)) divergences.push({ section, key, reason:"unexpected" });
    });
  });
  return divergences;
};
