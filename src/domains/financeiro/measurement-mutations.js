const inactive = item => ["cancelado", "cancelada", "estornado", "arquivado"].includes(String(item?.status || "").toLowerCase());
const activeReceipts = measurement => (Array.isArray(measurement?.recebimentos) ? measurement.recebimentos : [])
  .filter(item=>String(item?.status || "").toLowerCase() !== "estornado");
const userName = actor => actor?.nome || actor?.email || "Usuário autenticado";

export const saveClientMeasurement = ({ data, measurement, actor, id, receiptId, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para salvar a medição.");
  if (!id) throw new Error("Identificador da medição ausente.");
  const obraId=String(measurement?.obraId || "");
  const competencia=String(measurement?.competencia || "");
  const valorPrevisto=Number(measurement?.valorPrevisto);
  if (!obraId) throw new Error("Selecione a obra da medição.");
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Informe uma competência válida para a medição.");
  if (!(valorPrevisto > 0) || !Number.isFinite(valorPrevisto)) throw new Error("Informe um valor previsto positivo para a medição.");
  const medicoes=Array.isArray(data?.medicoes) ? data.medicoes : [];
  const anterior=medicoes.find(item=>item.id===id);
  if (anterior && inactive(anterior)) throw new Error("Não é permitido editar uma medição cancelada.");
  const recebimentosAtivos=activeReceipts(anterior);
  const possuiEspelhoLegado=!recebimentosAtivos.length && Number(anterior?.valorRecebido || 0) > 0;
  const alterouFatoFinanceiro=anterior && [
    ["obraId",obraId], ["competencia",competencia], ["tipo",String(measurement?.tipo || "livre")],
    ["valorPrevisto",valorPrevisto], ["percentualAcumulado",Number(measurement?.percentualAcumulado || 0)],
  ].some(([campo,valor])=>String(anterior[campo] ?? "") !== String(valor));
  if ((recebimentosAtivos.length || possuiEspelhoLegado) && alterouFatoFinanceiro) {
    throw new Error("Esta medição já possui recebimento. Estorne o recebimento antes de alterar valor, obra ou competência.");
  }
  if ((recebimentosAtivos.length || possuiEspelhoLegado) && measurement?.recebido === false) {
    throw new Error("Use o estorno auditável para desfazer um recebimento.");
  }
  const recebidoInicial=!!measurement?.recebido && !anterior;
  if (recebidoInicial && !receiptId) throw new Error("Identificador do recebimento da medição ausente.");
  const valorRecebidoInicial=Number(measurement?.valorRecebido || valorPrevisto);
  if (recebidoInicial && (!(valorRecebidoInicial > 0) || !Number.isFinite(valorRecebidoInicial))) throw new Error("Informe um valor recebido positivo.");
  const receipt=recebidoInicial ? [{
    id:receiptId, valor:valorRecebidoInicial, data:String(measurement?.dataPagamento || ""), origem:"manual",
    createdAt:now, createdById:actor.id, createdBy:userName(actor),
  }] : (Array.isArray(anterior?.recebimentos) ? anterior.recebimentos : []);
  const valorRecebido=recebidoInicial ? valorRecebidoInicial : Number(anterior?.valorRecebido || 0);
  const registro={
    ...anterior,
    id, obraId, competencia, tipo:String(measurement?.tipo || "livre"),
    percentualAcumulado:Number(measurement?.percentualAcumulado || 0),
    percentualPeriodo:Number(measurement?.percentualPeriodo || 0), valorPrevisto,
    descricao:String(measurement?.descricao || "").trim(), recebimentos:receipt,
    valorRecebido, dataPagamento:recebidoInicial ? String(measurement?.dataPagamento || "") : (anterior?.dataPagamento || ""),
    recebido:recebidoInicial ? valorRecebidoInicial >= valorPrevisto - 0.01 : !!anterior?.recebido,
    status:anterior?.status || "emitida", origem:anterior?.origem || "medicao_manual",
    createdAt:anterior?.createdAt || now, createdById:anterior?.createdById || actor.id, createdBy:anterior?.createdBy || userName(actor),
    updatedAt:now, updatedById:actor.id, updatedBy:userName(actor), version:Number(anterior?.version || 0) + 1,
  };
  return {...data,medicoes:anterior?medicoes.map(item=>item.id===id?registro:item):[...medicoes,registro]};
};

export const cancelClientMeasurement = ({ data, measurementId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para cancelar a medição.");
  const motivoCancelamento=String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do cancelamento da medição.");
  const medicoes=Array.isArray(data?.medicoes) ? data.medicoes : [];
  const medicao=medicoes.find(item=>item.id===measurementId);
  if (!medicao) throw new Error("Medição não encontrada.");
  if (inactive(medicao)) throw new Error("Esta medição já está cancelada.");
  if (activeReceipts(medicao).length || (!Array.isArray(medicao.recebimentos) && Number(medicao.valorRecebido || 0) > 0)) {
    throw new Error("Estorne os recebimentos antes de cancelar a medição.");
  }
  return {...data,medicoes:medicoes.map(item=>item.id!==measurementId?item:{
    ...item,status:"cancelada",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:userName(actor),
    updatedAt:now,updatedById:actor.id,updatedBy:userName(actor),version:Number(item.version || 0)+1,
  })};
};
