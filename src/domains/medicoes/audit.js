export const technicalMeasurementAuditEvent=({type,measurement,actor={},occurredAt,reason=""}={})=>({
  id:`medicao:${measurement?.id||"sem-id"}:${type}:${occurredAt||""}`,
  aggregateType:"medicao_tecnica",aggregateId:measurement?.id||"",type,
  obraId:measurement?.obraId||"",occurredAt:occurredAt||"",
  actorId:actor.id||"",actorName:actor.nome||actor.name||"",reason:String(reason||""),
  snapshot:{status:measurement?.status||"",version:Number(measurement?.version||0),dataMedicao:measurement?.dataMedicao||measurement?.data||""},
});
