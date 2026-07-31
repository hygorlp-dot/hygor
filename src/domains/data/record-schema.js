// Schema de compatibilidade para o blob legado. O normalizador da interface
// pode continuar preenchendo campos de apresentação, mas não pode apagar
// metadados de auditoria nem inventar uma data histórica.
import { migrateLegacyTechnicalMeasurements, uniqueIssues } from "../medicoes/migrations.js";

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

const preserveCollection = (source, normalized, key) => {
  const original = Array.isArray(source?.[key]) ? source[key] : [];
  const byId = new Map(original.filter(item => item?.id).map(item => [item.id, item]));
  return (normalized?.[key] || []).map(item => preserveRecord(byId.get(item?.id), item));
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
