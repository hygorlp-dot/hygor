import { TECHNICAL_MEASUREMENT_STATUS, normalizeTechnicalMeasurementStatus } from "./constants.js";

const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const number=value=>Number(value);

export const validateTechnicalMeasurement=(measurement,{requireApprovedItems=false}={})=>{
  const errors=[];
  if(!String(measurement?.id||"").trim())errors.push("Medição técnica sem identificação.");
  if(!String(measurement?.obraId||"").trim())errors.push("Medição técnica sem obra.");
  const effectiveDate=measurement?.dataMedicao||measurement?.data;
  if(!validDate(effectiveDate))errors.push("Informe a data efetiva da medição.");
  const status=normalizeTechnicalMeasurementStatus(measurement?.status);
  if(!Object.values(TECHNICAL_MEASUREMENT_STATUS).includes(status))errors.push("Status da medição técnica inválido.");
  const ids=new Set();
  (measurement?.itens||[]).forEach(item=>{
    const tarefaId=String(item?.tarefaId||"").trim();
    if(!tarefaId)errors.push("Item de medição sem tarefa.");
    else if(ids.has(tarefaId))errors.push(`A tarefa ${tarefaId} foi informada mais de uma vez.`);
    else ids.add(tarefaId);
    const percent=number(item?.pctConfirmado);
    if(!Number.isFinite(percent)||percent<0||percent>100)errors.push(`Percentual aprovado inválido para ${tarefaId||"a tarefa"}.`);
  });
  if(requireApprovedItems&&status===TECHNICAL_MEASUREMENT_STATUS.APPROVED&&!ids.size)errors.push("Uma medição aprovada precisa ter ao menos um item.");
  return {ok:errors.length===0,errors};
};
