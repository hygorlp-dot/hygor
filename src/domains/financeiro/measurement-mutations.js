import { active } from "./ledger.js";
import { isClientMeasurementMutable } from "./measurement-lifecycle.js";

const inactive = item => !isClientMeasurementMutable(item);
const activeReceipts = measurement => (Array.isArray(measurement?.recebimentos) ? measurement.recebimentos : [])
  .filter(active);
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

export const saveGeneratedClientMeasurements = ({ data, obraId, measurements, overwrite = false, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para gerar parcelas.");
  if (!obraId) throw new Error("Selecione a obra para gerar as parcelas.");
  const novas=Array.isArray(measurements) ? measurements : [];
  if (!novas.length) throw new Error("Não há parcelas novas para gerar.");
  novas.forEach(item=>{
    if (!item?.id || !/^\d{4}-\d{2}$/.test(String(item.competencia || ""))) throw new Error("Uma parcela gerada não possui identificação ou competência válida.");
    if (!Number.isFinite(Number(item.valorPrevisto)) || Number(item.valorPrevisto) < 0) throw new Error("Uma parcela gerada possui valor inválido.");
  });
  const medicoes=Array.isArray(data?.medicoes) ? data.medicoes : [];
  const chavesNovas=new Set(novas.map(item=>`${item.numeroParcela || ""}|${item.dataVencimento || ""}`));
  const substituiveis=overwrite ? medicoes.filter(item=>item.obraId===obraId&&!inactive(item)&&(
    item.origem==="geracao_contrato" || chavesNovas.has(`${item.numeroParcela || ""}|${item.dataVencimento || ""}`)
  )) : [];
  if (substituiveis.some(item=>activeReceipts(item).length || (!Array.isArray(item.recebimentos) && Number(item.valorRecebido || 0) > 0))) {
    throw new Error("Não é possível regenerar parcelas que já possuem recebimento. Estorne ou ajuste a parcela antes.");
  }
  const nome=userName(actor);
  const canceladas=new Set(substituiveis.map(item=>item.id));
  const anteriores=medicoes.map(item=>!canceladas.has(item.id)?item:{
    ...item,status:"cancelada",motivoCancelamento:"Parcelas regeneradas a partir da configuração contratual",canceladoEm:now,
    canceladoPorId:actor.id,canceladoPor:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome,version:Number(item.version || 0)+1,
  });
  const geradas=novas.map(item=>({
    ...item,obraId,status:"emitida",origem:"geracao_contrato",recebimentos:Array.isArray(item.recebimentos)?item.recebimentos:[],
    valorRecebido:Number(item.valorRecebido || 0),dataPagamento:item.dataPagamento || "",recebido:!!item.recebido,
    createdAt:now,createdById:actor.id,createdBy:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome,version:1,
  }));
  return {...data,medicoes:[...anteriores,...geradas].sort((a,b)=>String(a.dataVencimento||a.competencia).localeCompare(String(b.dataVencimento||b.competencia)))};
};
