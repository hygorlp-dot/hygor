// Schema de compatibilidade para o blob legado. O normalizador da interface
// pode continuar preenchendo campos de apresentação, mas não pode apagar
// metadados de auditoria nem inventar uma data histórica.
import { migrateLegacyTechnicalMeasurements, uniqueIssues } from "../medicoes/migrations.js";
import { orcamentoAprovado } from "../orcamentos/budget-approval.js";

export const APP_SCHEMA_VERSION = 6;

const AUDIT_FIELDS = new Set([
  "id", "obraId", "status", "createdAt", "createdById", "createdBy",
  "updatedAt", "updatedById", "updatedBy", "version", "origem",
  "motivoAlteracao", "canceladoEm", "canceladoPorId", "canceladoPor",
  "motivoCancelamento", "aprovadoEm", "aprovadoPorId", "aprovadoPor",
  "progressoAtualizadoEm", "progressoOrigem", "atualizadoEm",
  "ajusteOrigem", "dataMedicao", "origemData", "dataPendenteValidacao",
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const isCancelled = status => ["cancelado", "cancelada", "cancelled"].includes(String(status || "").toLowerCase());

const preserveRecord = (source, normalized) => {
  if (!source || !normalized) return normalized;
  const preserved = { ...normalized };
  Object.entries(source).forEach(([key, value]) => {
    // Campos desconhecidos pertencem à origem e não podem sumir por uma tela
    // ainda não migrada. Campos conhecidos continuam com a coerção segura do
    // normalizador, exceto os metadados auditáveis.
    if (!hasOwn(normalized, key) || AUDIT_FIELDS.has(key)) preserved[key] = value;
  });
  // Um cancelamento é um fato; nenhuma interface pode reativá-lo ao recarregar.
  if (isCancelled(source.status)) preserved.status = source.status;
  return preserved;
};

// Registros que, uma vez fechados, voltam exatamente como estão gravados: o
// servidor compara a versão aprovada byte a byte, e qualquer coerção do
// normalizador (um campo novo descartado, um default preenchido) fazia todo
// salvamento de orçamento ser recusado como "alteração em versão aprovada".
const FROZEN_RECORDS = { orcamentos: orcamentoAprovado };

// Listas filhas com id (itens e etapas do orçamento, por exemplo) seguem a
// mesma regra do registro: campo que o normalizador não conhece não some.
const preserveNestedLists = (source, record) => {
  const next = { ...record };
  Object.keys(next).forEach(key => {
    const original = source?.[key];
    if (!Array.isArray(next[key]) || !Array.isArray(original)) return;
    const comId = item => item && typeof item === "object" && item.id != null;
    if (!next[key].every(comId)) return;
    const byId = new Map(original.filter(comId).map(item => [item.id, item]));
    next[key] = next[key].map(item => byId.has(item.id) ? preserveRecord(byId.get(item.id), item) : item);
  });
  return next;
};

const preserveCollection = (source, normalized, key) => {
  const original = Array.isArray(source?.[key]) ? source[key] : [];
  const byId = new Map(original.filter(item => item?.id).map(item => [item.id, item]));
  return (normalized?.[key] || []).map(item => {
    const origem = byId.get(item?.id);
    if (origem && FROZEN_RECORDS[key]?.(origem)) return origem;
    const preserved = preserveRecord(origem, item);
    return origem ? preserveNestedLists(origem, preserved) : preserved;
  });
};

const missingEffectiveDateIssues = (source, currentIssues) => {
  const existing = new Set((currentIssues || []).map(issue => issue?.chave || issue?.id));
  const issues = [];
  ["medicoesObra", "medicoesTerc"].forEach(collection => {
    (Array.isArray(source?.[collection]) ? source[collection] : []).forEach(record => {
      if (!record?.id || record.data || record.dataMedicao) return;
      const chave = `data-efetiva-ausente:${collection}:${record.id}`;
      if (existing.has(chave)) return;
      issues.push({
        id: chave,
        chave,
        tipo: "data_efetiva_ausente",
        colecao: collection,
        registroId: record.id,
        obraId: record.obraId || "",
        status: "aberta",
        origem: "migracao_legado",
        descricao: "Registro histórico sem data efetiva; informe a data com justificativa.",
      });
    });
  });
  return issues;
};

// Aplicado no fim de normalizeData. É puro e idempotente: o mesmo snapshot
// normalizado novamente produz o mesmo resultado e as pendências têm chave
// determinística, sem depender da data atual.
export const finalizeNormalizedData = (source, normalized) => {
  const next = { ...normalized };
  // A regra é deliberadamente genérica: novos módulos não podem perder
  // metadados só porque ainda não foram incluídos numa whitelist manual.
  Object.keys(next).forEach(key => {
    if (Array.isArray(next[key])) next[key] = preserveCollection(source, next, key);
  });
  const migrated=migrateLegacyTechnicalMeasurements(next);
  Object.assign(next,migrated.data);
  const quality = Array.isArray(next.qualidadeDados) ? next.qualidadeDados : [];
  next.qualidadeDados=uniqueIssues([...quality,...missingEffectiveDateIssues(source,quality),...migrated.issues]);
  next.schemaVersion = Math.max(APP_SCHEMA_VERSION, Number(source?.schemaVersion || 0), Number(next.schemaVersion || 0));
  return next;
};
