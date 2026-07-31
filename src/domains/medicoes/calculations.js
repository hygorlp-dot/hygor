import { isApprovedTechnicalMeasurement } from "./constants.js";

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const round=value=>Math.round((number(value)+Number.EPSILON)*1000000)/1000000;

/**
 * O boletim técnico guarda percentual acumulado por tarefa. A projeção sempre
 * é refeita a partir dos boletins aprovados, nunca a partir da tela que o
 * chamou nem do último RDO editado.
 */
export const projectTechnicalMeasurementProgress=(measurements=[],obraId="")=>{
  const latestByTask=new Map();
  const approved=(measurements||[])
    .filter(item=>item?.obraId===obraId&&isApprovedTechnicalMeasurement(item))
    .sort((a,b)=>String(a.dataMedicao||a.data||a.aprovadaEm||"").localeCompare(String(b.dataMedicao||b.data||b.aprovadaEm||""))||String(a.id||"").localeCompare(String(b.id||"")));

  approved.forEach(measurement=>(measurement.itens||[]).forEach(item=>{
    const tarefaId=String(item?.tarefaId||"");
    if(!tarefaId)return;
    latestByTask.set(tarefaId,{
      tarefaId,
      progresso:round(clamp(item.pctConfirmado,0,100)),
      medicaoId:measurement.id,
      dataMedicao:measurement.dataMedicao||measurement.data||"",
      origem:"medicao_tecnica_aprovada",
    });
  }));
  return [...latestByTask.values()];
};

export const calculateMeasurementProgress=(items=[])=>{
  const normalized=(items||[]).map(item=>({
    ...item,
    pctDiario:round(clamp(item?.pctDiario,0,100)),
    pctConfirmado:round(clamp(item?.pctConfirmado,0,100)),
    custo:number(item?.custo),
  }));
  const totalCost=normalized.reduce((sum,item)=>sum+Math.max(0,item.custo),0);
  const physicalProgress=totalCost>0
    ? normalized.reduce((sum,item)=>sum+(Math.max(0,item.custo)*item.pctConfirmado),0)/totalCost
    : 0;
  return {items:normalized,totalCost:round(totalCost),physicalProgress:round(physicalProgress)};
};
