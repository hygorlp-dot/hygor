import { isApprovedTechnicalMeasurement } from "./constants.js";

export const selectTechnicalMeasurementsByWork=(data={},obraId)=>
  (data.medicoesObra||[]).filter(item=>item.obraId===obraId)
    .sort((a,b)=>String(a.dataMedicao||a.data||"").localeCompare(String(b.dataMedicao||b.data||""))||Number(a.numero||0)-Number(b.numero||0));

export const selectApprovedTechnicalMeasurements=(data={},obraId)=>
  selectTechnicalMeasurementsByWork(data,obraId).filter(isApprovedTechnicalMeasurement);
