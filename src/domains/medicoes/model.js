import { TECHNICAL_MEASUREMENT_SCHEMA_VERSION, TECHNICAL_MEASUREMENT_STATUS, normalizeTechnicalMeasurementStatus } from "./constants.js";
import { calculateMeasurementProgress } from "./calculations.js";

export const normalizeTechnicalMeasurement=(measurement={}, {now="",nextNumber=0}={})=>{
  const {items,physicalProgress}=calculateMeasurementProgress(measurement.itens||[]);
  const status=normalizeTechnicalMeasurementStatus(measurement.status||TECHNICAL_MEASUREMENT_STATUS.APPROVED);
  const dataMedicao=String(measurement.dataMedicao||measurement.data||"");
  return {
    ...measurement,
    schemaVersion:Math.max(TECHNICAL_MEASUREMENT_SCHEMA_VERSION,Number(measurement.schemaVersion||0)),
    data:dataMedicao,
    dataMedicao,
    numero:Number(measurement.numero||nextNumber||0),
    status,
    itens:items,
    avancoFisico:physicalProgress,
    createdAt:measurement.createdAt||now,
    updatedAt:now||measurement.updatedAt||"",
  };
};
