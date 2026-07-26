const inactive = item => ["cancelado", "cancelada", "estornado", "arquivado"].includes(String(item?.status || "").toLowerCase());
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
    createdAt:now,createdById:actor.id,createdBy:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome,
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
    pagsTerceiros:pagamentos.map(item=>item.id!==paymentId?item:{...item,status:"estornado",motivoCancelamento,canceladoEm:now,canceladoPorId:actor.id,canceladoPor:nome,updatedAt:now,updatedById:actor.id,updatedBy:nome}),
    medicoesTerc:(Array.isArray(data?.medicoesTerc)?data.medicoesTerc:[]).map(item=>item.pagamentoId!==paymentId?item:{...item,pagamentoEstornadoEm:now,pagamentoEstornadoPorId:actor.id}),
  };
};
