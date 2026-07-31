import { isThirdPartyRecordActive } from "../terceirizados/lifecycle.js";

const inactive = item => !isThirdPartyRecordActive(item);
const userName = actor => actor?.nome || actor?.email || "Usuário autenticado";

export const createThirdPartyPayment = ({ data, payment, actor, id, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para registrar o pagamento de terceiro.");
  if (!id) throw new Error("Identificador do pagamento de terceiro ausente.");
  const tercId=String(payment?.tercId || "");
  const amount=Number(payment?.amount ?? payment?.valor);
  const date=String(payment?.date || payment?.data || "");
  const pagador=String(payment?.pagador || "");
  if (!tercId) throw new Error("Selecione o contrato do terceiro.");
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Informe um valor positivo para o pagamento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Informe uma data válida para o pagamento.");
  if (!["empresa","obra"].includes(pagador)) throw new Error("Informe quem realizou o pagamento.");
  if (pagador === "obra" && !payment?.obraId) throw new Error("Informe a obra que realizou o pagamento.");
  const nome=userName(actor);
  const registro={
    ...payment,id,tercId,amount,date,pagador,medicaoTercId:String(payment?.medicaoTercId || ""),
    description:String(payment?.description || payment?.descricao || "Pagamento de terceiro").trim() || "Pagamento de terceiro",
    status:"ativo",origem:"manual_sem_medicao",reconhecerCusto:false,
    createdAt:now,createdById:actor.id,createdBy:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome,version:1,
  };
  return {...data,pagsTerceiros:[...(Array.isArray(data?.pagsTerceiros)?data.pagsTerceiros:[]),registro]};
};

export const reverseThirdPartyPayment = ({ data, paymentId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para estornar o pagamento de terceiro.");
  const motivoCancelamento=String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do estorno do pagamento.");
  const pagamentos=Array.isArray(data?.pagsTerceiros)?data.pagsTerceiros:[];
  const payment=pagamentos.find(item=>item.id===paymentId);
  if (!payment) throw new Error("Pagamento de terceiro não encontrado.");
  if (inactive(payment)) throw new Error("Este pagamento já está estornado.");
  if (payment.conciliado || payment.transacaoId) throw new Error("Desfaça a conciliação bancária antes de estornar este pagamento.");
  const nome=userName(actor);
  return {
    ...data,
    pagsTerceiros:pagamentos.map(item=>item.id!==paymentId?item:{...item,status:"estornado",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome,version:Number(item.version||0)+1}),
    medicoesTerc:(Array.isArray(data?.medicoesTerc)?data.medicoesTerc:[]).map(item=>item.pagamentoId!==paymentId?item:{...item,pagamentoId:"",pagamentoEstornadoEm:now,pagamentoEstornadoPorId:actor.id,updatedAt:now,updatedById:actor.id,updatedBy:nome,version:Number(item.version||0)+1}),
  };
};

export const createThirdPartyMeasurement = ({ data, measurement, actor, id, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para registrar a medição de terceiro.");
  if (!id) throw new Error("Identificador da medição de terceiro ausente.");
  const tercId=String(measurement?.tercId || "");
  const obraId=String(measurement?.obraId || "");
  const date=String(measurement?.data || "");
  const total=Number(measurement?.total);
  const itens=Array.isArray(measurement?.itens) ? measurement.itens : [];
  if (!tercId || !obraId) throw new Error("A medição precisa ter contrato e obra vinculados.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Informe uma data válida para a medição.");
  if (!(total > 0) || !Number.isFinite(total) || !itens.length) throw new Error("A medição precisa ter etapas executadas e valor positivo.");
  const nome=userName(actor);
  const registro={
    ...measurement,id,tercId,obraId,date,total,itens:itens.map(item=>({...item})),status:"aprovada",origem:"medicao_terceiro",
    pagamentoId:"",createdAt:now,createdById:actor.id,createdBy:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome,version:1,
  };
  return {...data,medicoesTerc:[...(Array.isArray(data?.medicoesTerc)?data.medicoesTerc:[]),registro]};
};

export const cancelThirdPartyMeasurement = ({ data, measurementId, reason, actor, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para cancelar a medição de terceiro.");
  const motivoCancelamento=String(reason || "").trim();
  if (!motivoCancelamento) throw new Error("Informe o motivo do cancelamento da medição.");
  const medicoes=Array.isArray(data?.medicoesTerc)?data.medicoesTerc:[];
  const medicao=medicoes.find(item=>item.id===measurementId);
  if (!medicao) throw new Error("Medição de terceiro não encontrada.");
  if (inactive(medicao)) throw new Error("Esta medição já está cancelada.");
  const possuiPagamento=(data?.pagsTerceiros || []).some(item=>(item.medicaoTercId===measurementId||item.medicaoId===measurementId)&&!inactive(item));
  if (medicao.pagamentoId || possuiPagamento) throw new Error("Estorne o pagamento antes de cancelar a medição.");
  const nome=userName(actor);
  return {...data,medicoesTerc:medicoes.map(item=>item.id!==measurementId?item:{
    ...item,status:"cancelada",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:nome,
    updatedAt:now,updatedById:actor.id,updatedBy:nome,version:Number(item.version || 0)+1,
  })};
};

export const payThirdPartyMeasurement = ({ data, measurementId, payment, actor, id, now = new Date().toISOString() }) => {
  const medicao=(data?.medicoesTerc || []).find(item=>item.id===measurementId&&!inactive(item));
  if (!medicao) throw new Error("Medição de terceiro não encontrada ou cancelada.");
  if (medicao.pagamentoId) throw new Error("Esta medição já possui pagamento registrado.");
  const result=createThirdPartyPayment({data,payment:{...payment,obraId:medicao.obraId,tercId:medicao.tercId,medicaoTercId:medicao.id,amount:medicao.total},actor,id,now});
  return {
    ...result,
    pagsTerceiros:(result.pagsTerceiros||[]).map(item=>item.id===id
      ?{...item,origem:"liquidacao_medicao",reconhecerCusto:false}:item),
    medicoesTerc:(result.medicoesTerc || []).map(item=>item.id===medicao.id?{
      ...item,pagamentoId:id,pagamentoRegistradoEm:now,
      pagamentoRegistradoPorId:actor.id,updatedAt:now,
      updatedById:actor.id,updatedBy:userName(actor),
      version:Number(item.version||0)+1,
    }:item),
  };
};
