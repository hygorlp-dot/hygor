export const TECHNICAL_MEASUREMENT_SCHEMA_VERSION = 1;

export const TECHNICAL_MEASUREMENT_STATUS = Object.freeze({
  DRAFT: "rascunho",
  UNDER_REVIEW: "em_revisao",
  APPROVED: "aprovada",
  CANCELLED: "cancelada",
});

const STATUS_ALIASES = Object.freeze({
  confirmada: TECHNICAL_MEASUREMENT_STATUS.APPROVED,
  confirmado: TECHNICAL_MEASUREMENT_STATUS.APPROVED,
  approved: TECHNICAL_MEASUREMENT_STATUS.APPROVED,
  cancelled: TECHNICAL_MEASUREMENT_STATUS.CANCELLED,
  cancelado: TECHNICAL_MEASUREMENT_STATUS.CANCELLED,
  draft: TECHNICAL_MEASUREMENT_STATUS.DRAFT,
  review: TECHNICAL_MEASUREMENT_STATUS.UNDER_REVIEW,
});

export const normalizeTechnicalMeasurementStatus = value => {
  const normalized=String(value||TECHNICAL_MEASUREMENT_STATUS.DRAFT).trim().toLowerCase();
  return STATUS_ALIASES[normalized]||normalized;
};

export const isApprovedTechnicalMeasurement = measurement =>
  normalizeTechnicalMeasurementStatus(measurement?.status)===TECHNICAL_MEASUREMENT_STATUS.APPROVED;

export const isCancelledTechnicalMeasurement = measurement =>
  normalizeTechnicalMeasurementStatus(measurement?.status)===TECHNICAL_MEASUREMENT_STATUS.CANCELLED;
