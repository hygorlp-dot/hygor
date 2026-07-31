export const importarReferenciasDiario=(data={},obraId,date)=>({
  trabalhadores:(data.employees||[]).filter(item=>item.active!==false&&String(item.obra)===String(obraId)).map(item=>({employeeId:item.id,nome:item.name||item.nome||"",presente:(data.attendance||[]).some(row=>String(row.employeeId)===String(item.id)&&String(row.date)===String(date)&&["P","M"].includes(row.status))})),
  terceiros:(data.terceirizados||[]).filter(item=>String(item.obraId||item.obra)===String(obraId)&&item.active!==false).map(item=>({terceiroId:item.id,nome:item.nome||item.name||""})),
  equipamentos:(data.equipamentos||[]).filter(item=>String(item.obraId||item.obra)===String(obraId)&&item.status!=="arquivado").map(item=>({equipmentId:item.id,nome:item.nome||item.descricao||""})),
  entregas:(data.pedidos||[]).filter(item=>String(item.obraId)===String(obraId)&&String(item.dataRecebimento||item.recebidoEm||"").slice(0,10)===String(date)).map(item=>({pedidoId:item.id,numero:item.numero||""})),
  compromissos:(data.weeklyCommitments||[]).filter(item=>String(item.obraId)===String(obraId)&&String(item.data||item.date)===String(date)&&item.status!=="cancelado").map(item=>({commitmentId:item.id,activityId:item.activityId||"",descricao:item.descricao||"",quantidadePrometida:Number(item.quantidadePrometida||0)})),
});

export const summarizeDailyProduction=(log={})=>{const entries=log.entries||[];const quantity=entries.reduce((sum,item)=>sum+Number(item.quantity||0),0);const workerHours=entries.reduce((sum,item)=>sum+Number(item.workerHours||0),0);return {quantity,workerHours,entryCount:entries.length,unfulfilled:(log.commitments||[]).filter(item=>item.status==="nao_concluido").length};};
