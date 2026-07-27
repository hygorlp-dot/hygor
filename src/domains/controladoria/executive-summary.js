const safeArray = value => Array.isArray(value) ? value : [];

export const createExecutiveSummaryEngine = ({
  calcDREObra,
  calcDREConsolidado,
  today,
  colors,
} = {}) => {
  const statusObraExec = work => {
    const mismatch = Number(work?.pctFinanceiro || 0) - Number(work?.pctFisico || 0);
    if (work?.prazo && work.prazo < today() && Number(work.pctFisico || 0) < 100) {
      return { k:"critica", l:"Atrasada", cor:colors.red };
    }
    if (Number(work?.margem || 0) < 0 || mismatch > 20) {
      return { k:"critica", l:"Crítica", cor:colors.red };
    }
    if (Number(work?.margem || 0) < 10 || mismatch > 10) {
      return { k:"atencao", l:"Atenção", cor:colors.orange };
    }
    return { k:"saudavel", l:"Saudável", cor:colors.green };
  };

  const calcAlertas = (data, year, month) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const alerts = [];
    const push = (sev, texto, tab, obraId = "") =>
      alerts.push({ sev, texto, tab, obraId });

    safeArray(data?.obras).forEach(work => {
      const dre = calcDREObra(data, work.id, year, month);
      if (dre.margemBruta < 0 && dre.faturadoAcum > 0) {
        push(3, `${work.name}: margem negativa (${dre.margemBruta.toFixed(0)}%)`, "dre", work.id);
      }
    });
    safeArray(data?.pedidos).forEach(order => {
      if (!order?.previsao || ["entregue","recebido","cancelado"].includes(order.status)) return;
      const forecast = new Date(`${order.previsao}T00:00:00`);
      if (forecast < currentDate) {
        const days = Math.floor((currentDate - forecast) / 86400000);
        push(days >= 5 ? 3 : 2, `Pedido ${order.numero || ""} atrasado ha ${days} dia(s)${order.fornecedor ? ` - ${order.fornecedor}` : ""}`, "cmp");
      }
    });
    const pendingRequests = safeArray(data?.solicitacoesCompra)
      .filter(request => request?.status === "enviada").length;
    if (pendingRequests > 0) {
      push(1, `${pendingRequests} solicitacao(oes) de compra aguardando`, "cmp");
    }
    safeArray(data?.comercial?.contratos).forEach(contract => {
      if (["rascunho","aguardando","aguardando_assinatura","pendente"].includes(contract?.status)) {
        push(2, `Contrato ${contract.numero || ""} aguardando assinatura`, "com_contratos");
      }
    });
    const activeLeads = safeArray(data?.comercial?.leads)
      .filter(lead => !["perdido","arquivado","transferido"].includes(lead?.etapa) && lead?.status !== "perdido");
    let overdueLeads = 0;
    let leadsWithoutFollowUp = 0;
    activeLeads.forEach(lead => {
      if (!lead.proximaAtividadeEm) {
        leadsWithoutFollowUp += 1;
      } else if (new Date(lead.proximaAtividadeEm) < currentDate) {
        overdueLeads += 1;
      }
    });
    if (overdueLeads > 0) push(2, `${overdueLeads} lead(s) com follow-up vencido`, "com_funil");
    if (leadsWithoutFollowUp > 0) push(1, `${leadsWithoutFollowUp} lead(s) sem proxima atividade`, "com_leads");

    let expiredDocuments = 0;
    safeArray(data?.terceirizados).forEach(contractor =>
      safeArray(contractor?.documentos).forEach(document => {
        if (document?.validade && new Date(document.validade) < currentDate) expiredDocuments += 1;
      }));
    if (expiredDocuments > 0) {
      push(2, `${expiredDocuments} documento(s) de terceiro vencido(s)`, "terc");
    }
    return alerts.sort((left, right) => right.sev - left.sev);
  };

  const calcResumoExecutivo = (data, year, month) => {
    const worksData = safeArray(data?.obras);
    const dre = calcDREConsolidado(data, year, month);
    const activeWorks = worksData.filter(work =>
      work?.status !== "done" && work?.status !== "paused");
    const works = worksData.map(work => {
      const workDre = calcDREObra(data, work.id, year, month);
      const measurements = safeArray(data?.medicoesObra)
        .filter(measurement => measurement?.obraId === work.id);
      const physicalProgress = measurements.length
        ? measurements.reduce((maximum, measurement) =>
          Math.max(maximum, measurement.avancoFisico || 0), 0)
        : workDre.pctAvanco || 0;
      const line = {
        id:work.id,
        nome:work.name,
        cliente:work.client || work.engineer || "",
        cidade:work.address || "",
        status:work.status,
        prazo:work.contractEnd || "",
        contrato:workDre.contratoTotal,
        faturadoAcum:workDre.faturadoAcum,
        recebidoAcum:workDre.recebidoAcum,
        backlog:workDre.backlog,
        custoMes:workDre.totalCustos,
        margem:workDre.margemBruta,
        pctFisico:Math.round(physicalProgress),
        pctFinanceiro:Math.round(workDre.pctFaturado || 0),
        aReceber:workDre.aReceberAcum,
      };
      line.exec = statusObraExec(line);
      return line;
    });
    const commercial = data?.comercial || {};
    const activeLeads = safeArray(commercial.leads)
      .filter(lead => !["perdido","arquivado","transferido"].includes(lead?.etapa));
    const pipeline = activeLeads.reduce((total, lead) =>
      total + Number(lead.orcamentoEstimado || 0), 0);
    const weightedPipeline = activeLeads.reduce((total, lead) =>
      total + Number(lead.orcamentoEstimado || 0) * Number(lead.probabilidade || 0) / 100, 0);
    const commercialContracts = safeArray(commercial.contratos)
      .reduce((total, contract) => total + Number(contract.valor || 0), 0);
    const pendingPurchases = safeArray(data?.pedidos)
      .filter(order => order?.status && !["cancelado","entregue","recebido"].includes(order.status)).length;
    const openRequests = safeArray(data?.solicitacoesCompra)
      .filter(request => request?.status === "enviada").length;

    return {
      dre,
      obrasAtivas:activeWorks.length,
      contratoTotalCarteira:worksData.reduce((total, work) =>
        total + Number(work.contractValue || 0), 0),
      obras:works,
      obrasAtencao:works.filter(work => work.exec.k === "atencao").length,
      obrasCriticas:works.filter(work => work.exec.k === "critica").length,
      pipeline,
      pipelinePonderado:weightedPipeline,
      contratosComerciais:commercialContracts,
      leadsAtivos:activeLeads.length,
      comprasPendentes:pendingPurchases,
      solicitacoesAbertas:openRequests,
    };
  };

  return { statusObraExec, calcAlertas, calcResumoExecutivo };
};
