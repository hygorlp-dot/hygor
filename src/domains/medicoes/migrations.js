import { normalizeTechnicalMeasurement } from "./model.js";

const issueId=(id,code)=>`medicao-legada:${id}:${code}`;
export const uniqueIssues=(issues=[])=>{
  const seen=new Set();
  return issues.filter(issue=>{
    const key=issue?.chave||issue?.id;
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  });
};

/**
 * Migração local, pura e idempotente. Não inventa data, autor ou fato novo:
 * apenas torna explícitos schema/status/data e registra divergências que
 * precisam de decisão humana antes de qualquer uso financeiro.
 */
export const migrateLegacyTechnicalMeasurements=(data={})=>{
  const usedNumbers=new Map();
  (data.medicoesObra||[]).forEach(item=>{
    const obraId=String(item?.obraId||"");
    const number=Number(item?.numero||0);
    if(number>0){const current=usedNumbers.get(obraId)||new Set();current.add(number);usedNumbers.set(obraId,current);}
  });
  const nextNumber=obraId=>{
    const used=usedNumbers.get(obraId)||new Set();
    let candidate=1;while(used.has(candidate))candidate++;
    used.add(candidate);usedNumbers.set(obraId,used);return candidate;
  };
  const issues=[];
  const medicoesObra=(data.medicoesObra||[]).map(record=>{
    const explicitNumber=Number(record?.numero||0);
    const normalized=normalizeTechnicalMeasurement(record,{nextNumber:explicitNumber>0?explicitNumber:nextNumber(String(record?.obraId||""))});
    const frozenProgress=Number(record?.avancoFisico);
    if(Number.isFinite(frozenProgress)&&Math.abs(frozenProgress-normalized.avancoFisico)>0.01){
      issues.push({
        id:issueId(record.id,"avanco-divergente"),chave:issueId(record.id,"avanco-divergente"),
        tipo:"medicao_tecnica_avanco_divergente",colecao:"medicoesObra",registroId:record.id,obraId:record.obraId||"",
        status:"aberta",origem:"migracao_legado",
        descricao:"O avanço físico gravado diverge do cálculo pelos itens; revise o boletim antes de novo faturamento.",
        gravado:frozenProgress,calculado:normalized.avancoFisico,
      });
    }
    return {
      ...normalized,
      numero:Number(record?.numero||0)>0?Number(record.numero):normalized.numero,
      avancoFisico:Number.isFinite(frozenProgress)?frozenProgress:normalized.avancoFisico,
      legacyStatus:record?.legacyStatus||String(record?.status||""),
    };
  });
  return {data:{...data,medicoesObra},issues:uniqueIssues(issues)};
};
