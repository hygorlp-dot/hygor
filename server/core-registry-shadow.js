import crypto from "node:crypto";

export const CORE_REGISTRY_SCHEMA_VERSION = 1;

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

const projectRow = project => withHash({
  id:text(project?.id),
  name:text(project?.name),
  code:text(project?.code || project?.codigo || project?.name),
  status:text(project?.status || "active"),
  active:project?.status !== "done" && project?.status !== "cancelado" && project?.active !== false,
  engineerId:text(project?.engineerId),
  startDate:date(project?.startDate),
  endDate:date(project?.contractEnd || project?.endDate),
  sourceVersion:version(project?.version),
  payload:project || {},
});

const employeeRow = employee => withHash({
  id:text(employee?.id),
  name:text(employee?.name),
  roleTitle:text(employee?.role),
  workArea:text(employee?.workArea).toLowerCase() === "administrativo"
    || (!text(employee?.obra || employee?.obraId)
      && text(employee?.workArea).toLowerCase() !== "campo")
    ? "administrativo"
    : "campo",
  active:employee?.active !== false,
  startDate:date(employee?.startDate),
  endDate:date(employee?.endDate),
  sourceVersion:version(employee?.version),
  payload:employee || {},
});

const identifierRowsForEmployee = employee => {
  const candidates = [
    ["cpf", employee?.cpf],
    ["pix", employee?.pixKey],
    ["pix", employee?.pixChave],
    ["pix", employee?.pix],
  ];
  const seen = new Set();
  return candidates.flatMap(([type, raw]) => {
    const displayValue=text(raw);
    const normalizedValue=type === "cpf"
      ? displayValue.replace(/\D/g, "")
      : displayValue.toLocaleLowerCase("pt-BR").replace(/\s+/g, "");
    const key=`${type}:${normalizedValue}`;
    if (!normalizedValue || seen.has(key)) return [];
    seen.add(key);
    return [withHash({
      employeeId:text(employee?.id),
      identifierType:type,
      normalizedValue,
      displayValue,
      payload:{ source:"legacy", field:type },
    })];
  });
};

const supplierRow = supplier => withHash({
  id:text(supplier?.id),
  name:text(supplier?.nome || supplier?.name),
  taxId:text(supplier?.cnpj || supplier?.cpf).replace(/\D/g, ""),
  active:supplier?.ativo !== false && supplier?.active !== false,
  categories:array(supplier?.categorias),
  payload:supplier || {},
});

const thirdPartyProfileRow = contractor => withHash({
  id:text(contractor?.prestadorId || contractor?.id),
  name:text(contractor?.name || contractor?.nome),
  personType:text(contractor?.tipoPessoa).toUpperCase() === "PF" ? "PF" : "PJ",
  taxId:text(contractor?.documento).replace(/\D/g, ""),
  active:contractor?.active !== false,
  payload:Object.fromEntries(
    [
      "prestadorId", "name", "nome", "tipoPessoa", "documento",
      "razaoSocial", "inscEstadual", "inscMunicipal", "phone", "pixKey",
      "email", "responsavel", "cep", "endereco", "cidade", "ufEnd",
      "banco", "agencia", "conta", "documentos",
    ].filter(key => contractor?.[key] !== undefined).map(key => [key, contractor[key]]),
  ),
});

const thirdPartyContractRow = contractor => withHash({
  id:text(contractor?.id),
  profileId:text(contractor?.prestadorId || contractor?.id),
  projectId:text(contractor?.obraId || contractor?.obra),
  specialty:text(contractor?.specialty),
  status:text(contractor?.situacao || (contractor?.active === false ? "pausado" : "andamento")),
  active:contractor?.active !== false
    && !["cancelado", "cancelada", "concluido"].includes(text(contractor?.situacao).toLowerCase()),
  startDate:date(contractor?.startDate),
  endDate:date(contractor?.endDate),
  sourceVersion:version(contractor?.version),
  payload:contractor || {},
});

const uniqueBy = (rows, keyOf) => {
  const values=new Map();
  rows.forEach(row => {
    const key=keyOf(row);
    if (key) values.set(key, row);
  });
  return [...values.values()];
};

export const buildCoreRegistrySnapshot = data => {
  const projects=array(data?.obras).map(projectRow).filter(row => row.id && row.name);
  const employees=array(data?.employees).map(employeeRow).filter(row => row.id && row.name);
  const projectIds=new Set(projects.map(row => row.id));
  const employeeIds=new Set(employees.map(row => row.id));
  const employeeAssignments=employees.flatMap(employee => {
    const legacy=array(data?.employees).find(item => text(item?.id) === employee.id);
    const projectId=text(legacy?.obra || legacy?.obraId);
    if (!projectId || !projectIds.has(projectId)) return [];
    return [withHash({
      employeeId:employee.id,
      projectId,
      assignmentType:"primary",
      active:employee.active,
      validFrom:employee.startDate,
      validTo:employee.endDate,
      payload:{ source:"legacy", projectField:legacy?.obra ? "obra" : "obraId" },
    })];
  });
  const employeeIdentifiers=array(data?.employees)
    .filter(employee => employeeIds.has(text(employee?.id)))
    .flatMap(identifierRowsForEmployee);
  const suppliers=array(data?.fornecedores)
    .map(supplierRow).filter(row => row.id && row.name);
  const contracts=array(data?.terceirizados)
    .map(thirdPartyContractRow)
    .filter(row => row.id && row.profileId && row.projectId && projectIds.has(row.projectId));
  const profiles=uniqueBy(
    array(data?.terceirizados).map(thirdPartyProfileRow).filter(row => row.id && row.name),
    row => row.id,
  );
  const snapshot={
    schemaVersion:CORE_REGISTRY_SCHEMA_VERSION,
    complete:true,
    projects,
    employees,
    employeeAssignments,
    employeeIdentifiers,
    suppliers,
    thirdPartyProfiles:profiles,
    thirdPartyContracts:contracts,
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
  projects:row => text(row.id),
  employees:row => text(row.id),
  employeeAssignments:row => `${text(row.employee_id ?? row.employeeId)}:${text(row.project_id ?? row.projectId)}`,
  employeeIdentifiers:row => `${text(row.employee_id ?? row.employeeId)}:${text(row.identifier_type ?? row.identifierType)}:${text(row.normalized_value ?? row.normalizedValue)}`,
  suppliers:row => text(row.id),
  thirdPartyProfiles:row => text(row.id),
  thirdPartyContracts:row => text(row.id),
};

export const compareCoreRegistrySnapshot = (snapshot, canonical = {}) => {
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
