import {
  buildFinancialLedger,
  selectDRE,
  selectCashFlow,
  selectAccountsReceivable,
  selectAccountsPayable,
  selectCommitments,
  selectFinancialMovements,
  validateFinancialReconciliation,
  toCents,
  fromCents,
} from "../financeiro/ledger.js";

export const calculateContractProjection = (work, laborCost, extraCosts = {}) => {
  const contractType = work?.contractType || "fixed_labor";
  const contractValue = Number(work?.contractValue || 0);
  const administrationRate = Number(work?.adminPercentage || 0) / 100;
  const {
    benefitCost = 0, materialCost = 0, tercCost = 0,
    outrasTotal = 0, equipCost = 0, rescTotal = 0,
  } = extraCosts;
  const outrosCustos = outrasTotal + equipCost + rescTotal;
  const totalCost = laborCost + benefitCost + tercCost + materialCost + outrosCustos;
  const incluiMaoDeObra = work?.adminBaseMaoDeObra !== undefined
    ? !!work.adminBaseMaoDeObra : contractType === "admin_only";
  const incluiMateriais = work?.adminBaseMateriais !== undefined ? !!work.adminBaseMateriais : true;
  const incluiTerceirizados = work?.adminBaseTerceirizados !== undefined
    ? !!work.adminBaseTerceirizados : true;
  const adminBase = (incluiMaoDeObra ? laborCost + benefitCost : 0)
    + (incluiMateriais ? materialCost : 0)
    + (incluiTerceirizados ? tercCost : 0)
    + (contractType === "admin_only" ? outrosCustos : 0);
  let revenue = 0;
  if (contractType === "fixed_labor") revenue = contractValue;
  else if (contractType === "fixed_labor_admin") revenue = contractValue + adminBase * administrationRate;
  else if (contractType === "admin_only") revenue = adminBase * administrationRate;
  const margin = revenue - laborCost;
  return {
    revenue, margin, marginPct:revenue ? margin / revenue * 100 : 0,
    commitment:contractValue ? laborCost / contractValue * 100 : null,
    totalCost, adminBase, adminBaseMisto:adminBase,
    incluiMaoDeObra, incluiMateriais, incluiTerceirizados, outrosCustos,
  };
};

// Adaptadores públicos do DRE. A fórmula financeira vive exclusivamente no
// ledger; as dependências injetadas apenas traduzem ponto e equipamentos,
// cujos motores operacionais continuam em seus módulos próprios.
export const createDreCalculations = ({
  getDays,
  getQ,
  monthName,
  calcObraLaborCost,
  calcEquipCustoObra,
  calcEquipFaturamentoEmpresa,
}) => {
  const diasPeriodoDRE = (year, month, periodo = "mes") => {
    if (periodo === "q1") return getQ(year, month).q1;
    if (periodo === "q2") return getQ(year, month).q2;
    return getDays(year, month);
  };

  const context = (year, month, periodo) => {
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    const days = diasPeriodoDRE(year, month, periodo);
    return { ym, days, per0: days[0] || "", perF: days[days.length - 1] || "" };
  };

  const supplementalForWork = (data, obraId, ctx) => {
    const events = [];
    const labor = calcObraLaborCost(data, obraId, ctx.days) || {};
    const laborCents = toCents(labor.laborCost);
    const benefitCents = toCents(labor.benefitCost);
    if (laborCents > 0) events.push({
      id:`ponto:${obraId}:${ctx.per0}:${ctx.perF}:labor`, effect:"cost", amountCents:laborCents,
      date:ctx.perF, competence:ctx.ym, obraId, category:"mao_obra",
      description:"Mão de obra própria", sourceType:"ponto", sourceId:`${obraId}:${ctx.per0}:${ctx.perF}`,
    });
    if (benefitCents > 0) events.push({
      id:`ponto:${obraId}:${ctx.per0}:${ctx.perF}:benefits`, effect:"cost", amountCents:benefitCents,
      date:ctx.perF, competence:ctx.ym, obraId, category:"beneficios",
      description:"Benefícios da equipe", sourceType:"ponto", sourceId:`${obraId}:${ctx.per0}:${ctx.perF}`,
    });
    const equipmentCents = toCents(calcEquipCustoObra(data, obraId, ctx.ym, ctx.per0, ctx.perF));
    if (equipmentCents > 0) events.push({
      id:`equipamento:${obraId}:${ctx.per0}:${ctx.perF}:cost`, effect:"cost", amountCents:equipmentCents,
      date:ctx.perF, competence:ctx.ym, obraId, category:"equipamento",
      description:"Uso e locação de equipamentos", sourceType:"equipamento", sourceId:`${obraId}:${ctx.per0}:${ctx.perF}`,
      metadata:{internalTransfer:true},
    });
    return { events, labor, equipmentCents };
  };

  const buildPeriodLedger = (data, ctx, onlyWorkId = "") => {
    const works = onlyWorkId
      ? (data.obras || []).filter(work => work.id === onlyWorkId)
      : (data.obras || []);
    const supplemental = works.flatMap(work => supplementalForWork(data, work.id, ctx).events);
    return buildFinancialLedger(data, { supplementalEvents: supplemental });
  };

  const calcDREObra = (data, obraId, year, month, periodo = "mes") => {
    const ctx = context(year, month, periodo);
    const obra = (data.obras || []).find(item => item.id === obraId);
    const supplemental = supplementalForWork(data, obraId, ctx);
    const ledger = buildFinancialLedger(data, { supplementalEvents: supplemental.events });
    const filters = {
      obraId, startDate:ctx.per0, endDate:ctx.perF, asOfDate:ctx.perF,
      ...(periodo === "mes" ? { competence:ctx.ym } : {}),
    };
    const dre = selectDRE(ledger, filters);
    const cash = selectCashFlow(ledger, filters);
    const receivable = selectAccountsReceivable(ledger, { obraId, asOfDate:ctx.perF });
    const payable = selectAccountsPayable(ledger, { obraId, asOfDate:ctx.perF });
    const commitments = selectCommitments(ledger, { obraId, asOfDate:ctx.perF });
    const conference = validateFinancialReconciliation(ledger, filters);
    const events = dre.events;
    const sumCategory = (...categories) => fromCents(events
      .filter(event => event.effect === "cost" && categories.includes(event.category))
      .reduce((sum, event) => sum + event.amountCents, 0));
    const sumSource = (...sources) => fromCents(events
      .filter(event => event.effect === "cost" && sources.includes(event.sourceType))
      .reduce((sum, event) => sum + event.amountCents, 0));
    const medDoMes = (data.medicoes || []).filter(measurement =>
      measurement.obraId === obraId
      && (periodo === "mes"
        ? String(measurement.competencia || measurement.dataEmissao || measurement.dataVencimento || "").startsWith(ctx.ym)
        : String(measurement.dataEmissao || measurement.dataVencimento || `${measurement.competencia}-01`) >= ctx.per0
          && String(measurement.dataEmissao || measurement.dataVencimento || `${measurement.competencia}-01`) <= ctx.perF));
    const outrasDesp = (data.outrasDesp || []).filter(expense =>
      expense.obraId === obraId
      && String(expense.data || `${expense.competencia || ""}-01`) >= ctx.per0
      && String(expense.data || `${expense.competencia || ""}-01`) <= ctx.perF
      && !["cancelado","cancelada","estornado","arquivado"].includes(String(expense.status || "").toLowerCase()));
    const faturadoAcum = fromCents(selectDRE(ledger, { obraId, endDate:ctx.perF }).revenueCents);
    const recebidoAcum = fromCents(selectCashFlow(ledger, { obraId, endDate:ctx.perF }).cashInCents);
    const contratoTotal = Number(obra?.contractValue || 0);
    const faturamento = dre.revenue;
    const recebido = cash.cashIn;
    const totalCustos = dre.costs;
    const lucroBruto = dre.result;
    const saldoCaixa = cash.balance;
    const tercCost = sumCategory("terceirizado");
    const rescTotal = sumCategory("rescisao");
    const outrasTotal = sumSource("outra_despesa");
    const comprasCost = sumSource("nota_fiscal");
    const equipCost = fromCents(supplemental.equipmentCents);
    const aReceber = fromCents(receivable.balanceCents);
    const contasPagar = fromCents(payable.balanceCents);
    const comprometido = fromCents(commitments.balanceCents);
    const recebimentosNaoAlocados = fromCents(ledger.events
      .filter(event => event.effect === "cash_in" && event.unallocated && event.obraId === obraId && event.date >= ctx.per0 && event.date <= ctx.perF)
      .reduce((sum,event)=>sum+event.amountCents,0));
    const pagamentosNaoAlocados = fromCents(ledger.events
      .filter(event => event.effect === "cash_out" && event.unallocated && event.obraId === obraId && event.date >= ctx.per0 && event.date <= ctx.perF)
      .reduce((sum,event)=>sum+event.amountCents,0));
    const recebidoDasMedicoes = fromCents(ledger.events
      .filter(event => event.effect === "cash_in" && event.sourceType === "medicao" && event.obraId === obraId && event.date >= ctx.per0 && event.date <= ctx.perF)
      .reduce((sum,event)=>sum+event.amountCents,0));
    const meds = (data.medicoes || []).filter(measurement => measurement.obraId === obraId && measurement.tipo === "percentual");
    const pctAvanco = meds.length ? Math.max(...meds.map(measurement => Number(measurement.percentualAcumulado || 0))) : 0;
    return {
      obra, ym:ctx.ym, periodo, days:ctx.days, per0:ctx.per0, perF:ctx.perF,
      faturamento, recebido, aReceber, medDoMes,
      moData:supplemental.labor, tercCost,
      // Pagador/origem não muda a natureza do custo. Terceiros pagos pela
      // empresa já estão em `tercCost`; manter outra soma duplicaria o detalhe.
      tercEmpresaObra:0,
      rescTotal, outrasTotal, outrasDesp, equipCost, comprasCost,
      totalCustos, lucroBruto, margemBruta:dre.margin,
      saldoCaixa, margemCaixa:recebido ? saldoCaixa/recebido*100 : 0,
      contratoTotal, faturadoAcum, recebidoAcum,
      aReceberAcum:aReceber, backlog:Math.max(0,contratoTotal-faturadoAcum),
      pctFaturado:contratoTotal?faturadoAcum/contratoTotal*100:0,
      pctRecebido:contratoTotal?recebidoAcum/contratoTotal*100:0, pctAvanco,
      entradasCaixa:cash.cashIn, saidasCaixa:cash.cashOut, contasReceber:aReceber,
      contasPagar, comprometido, recebimentosNaoAlocados, pagamentosNaoAlocados,
      recebidoDasMedicoes, dataIssues:ledger.issues, conference,
      revenueByCategory:dre.revenueByCategory, costByCategory:dre.costByCategory,
      revenueBySource:dre.revenueBySource, costBySource:dre.costBySource,
      ledger, dreEvents:dre.events, cashEvents:cash.events,
    };
  };

  const calcDREConsolidado = (data, year, month, periodo = "mes") => {
    const ctx = context(year, month, periodo);
    const rows = (data.obras || []).map(work => calcDREObra(data, work.id, year, month, periodo));
    const sum = (key, sub) => rows.reduce((total,row)=>total+Number(sub ? row[sub]?.[key] : row[key] || 0),0);
    const ledger = buildPeriodLedger(data, ctx);
    const corporateEvents = ledger.events.filter(event =>
      !event.obraId && event.competence >= ctx.per0.slice(0,7) && event.competence <= ctx.perF.slice(0,7)
      && ["revenue","revenue_reversal","cost","cost_reversal"].includes(event.effect));
    const corporateRevenueCents = corporateEvents.reduce((total,event)=>
      total + (event.effect==="revenue"?event.amountCents:event.effect==="revenue_reversal"?-event.amountCents:0),0);
    const corporateCostCents = corporateEvents.reduce((total,event)=>
      total + (event.effect==="cost"?event.amountCents:event.effect==="cost_reversal"?-event.amountCents:0),0);
    const equipment = calcEquipFaturamentoEmpresa(data, ctx.ym) || {receita:0,lucro:0};
    const equipmentRevenue = Number(equipment.receita || 0);
    const equipmentCost = Number.isFinite(Number(equipment.custoDono)) || Number.isFinite(Number(equipment.manut))
      ? Number(equipment.custoDono || 0) + Number(equipment.manut || 0)
      : equipmentRevenue - Number(equipment.lucro || 0);
    const resultadoObras = sum("lucroBruto");
    const resultadoCorporativo = fromCents(corporateRevenueCents-corporateCostCents);
    const resultadoEquipamentosExternos = equipmentRevenue - equipmentCost;
    const eliminacoesInternas = 0;
    const resultadoConsolidado = resultadoObras + resultadoCorporativo + resultadoEquipamentosExternos - eliminacoesInternas;
    const faturamento = sum("faturamento") + fromCents(corporateRevenueCents) + equipmentRevenue;
    const totalCustos = sum("totalCustos") + fromCents(corporateCostCents) + equipmentCost;
    const cash = selectCashFlow(ledger, { startDate:ctx.per0, endDate:ctx.perF, includeCorporate:true });
    const cashAccumulated = selectCashFlow(ledger, { endDate:ctx.perF, includeCorporate:true });
    const receivable = selectAccountsReceivable(ledger, { asOfDate:ctx.perF, includeCorporate:true });
    const payable = selectAccountsPayable(ledger, { asOfDate:ctx.perF, includeCorporate:true });
    const commitments = selectCommitments(ledger, { asOfDate:ctx.perF, includeCorporate:true });
    const recebido = cash.cashIn;
    const entradasCaixa = cash.cashIn;
    const saidasCaixa = cash.cashOut;
    const unallocatedReceipts = fromCents(cash.events
      .filter(event => event.effect === "cash_in" && event.unallocated)
      .reduce((total, event) => total + event.amountCents, 0));
    const unallocatedPayments = fromCents(cash.events
      .filter(event => event.effect === "cash_out" && event.unallocated)
      .reduce((total, event) => total + event.amountCents, 0));
    const reconciliation = {
      resultadoObras, resultadoCorporativo, resultadoEquipamentosExternos,
      eliminacoesInternas, resultadoConsolidado,
      diferencaCents:toCents(resultadoConsolidado-(faturamento-totalCustos)),
    };
    return {
      obras:rows, periodo, days:ctx.days, per0:ctx.per0, perF:ctx.perF,
      faturamento, recebido, aReceber:fromCents(receivable.balanceCents),
      laborCost:sum("laborCost","moData"), benefitCost:sum("benefitCost","moData"),
      tercCost:sum("tercCost"), tercEmpresa:0, tercEmpresaObras:sum("tercEmpresaObra"),
      rescTotal:sum("rescTotal"), outrasTotal:sum("outrasTotal"), comprasCost:sum("comprasCost"),
      equipCostObras:sum("equipCost"), equipReceita:equipmentRevenue,
      equipCustoEmpresa:equipmentCost, equipLucro:resultadoEquipamentosExternos,
      totalCustos, lucroBruto:resultadoConsolidado, saldoCaixa:entradasCaixa-saidasCaixa,
      faturadoAcum:sum("faturadoAcum"), recebidoAcum:cashAccumulated.cashIn, backlog:sum("backlog"),
      margemBruta:faturamento?resultadoConsolidado/faturamento*100:0,
      margemCaixa:entradasCaixa?(entradasCaixa-saidasCaixa)/entradasCaixa*100:0,
      entradasCaixa, saidasCaixa, contasReceber:fromCents(receivable.balanceCents),
      contasPagar:fromCents(payable.balanceCents), comprometido:fromCents(commitments.balanceCents),
      recebimentosNaoAlocados:unallocatedReceipts,
      pagamentosNaoAlocados:unallocatedPayments,
      dataIssues:ledger.issues, reconciliation,
      ledger,
      conference:validateFinancialReconciliation(ledger,{startDate:ctx.per0,endDate:ctx.perF},{
        expectedCents:toCents(resultadoConsolidado),actualCents:toCents(faturamento-totalCustos),
      }),
    };
  };

  const calcDREHistorico = (data, year, month, nMeses = 6) =>
    Array.from({length:nMeses},(_,index)=>{
      const date=new Date(year,month-nMeses+1+index,1);
      const y=date.getFullYear(),m=date.getMonth();
      return {mes:`${monthName(m)}/${String(y).slice(2)}`,...calcDREConsolidado(data,y,m),y,m};
    });

  const calcProjecaoContratoObra = (data, obraId, year, month) => {
    const dre = calcDREObra(data, obraId, year, month);
    const work = dre.obra;
    const laborCost = Number(dre.moData?.laborCost || 0);
    const benefitCost = Number(dre.moData?.benefitCost || 0);
    const tercCost = Number(dre.costByCategory?.terceirizado || 0);
    const materialFromInvoices = Number(dre.costBySource?.nota_fiscal || 0);
    const otherMaterial = dre.dreEvents
      .filter(event => event.effect === "cost" && event.sourceType === "outra_despesa" && event.category === "material")
      .reduce((total, event) => total + event.amountCents / 100, 0);
    const materialCost = materialFromInvoices + otherMaterial;
    const outrasTotal = Math.max(0, dre.totalCustos - laborCost - benefitCost
      - tercCost - materialCost - dre.equipCost - dre.rescTotal);
    const projection = calculateContractProjection(work, laborCost, {
      benefitCost, materialCost, tercCost, outrasTotal,
      equipCost:dre.equipCost, rescTotal:dre.rescTotal,
    });
    const jaFechado = (data.medicoes || [])
      .filter(measurement => measurement.obraId === obraId && measurement.competencia === dre.ym)
      .reduce((total, measurement) => total + Number(measurement.valorAdminPct || 0), 0);
    return {
      ...projection, dre, laborCost, benefitCost, tercCost, materialCost,
      outrasTotal, jaFechado,
      valorAdmin:projection.adminBase * Number(work?.adminPercentage || 0) / 100,
    };
  };

  const calcVisaoFinanceira = (data, year, month, obraId = "all") => {
    const selectedWorks = (data.obras || []).filter(work => obraId === "all" || work.id === obraId);
    const rows = selectedWorks.map(work => {
      const dre = calcDREObra(data, work.id, year, month);
      const laborCost = Number(dre.moData?.laborCost || 0);
      const benefitCost = Number(dre.moData?.benefitCost || 0);
      const commitmentPct = Number(work.contractValue || 0) > 0
        ? dre.comprometido / Number(work.contractValue) * 100 : null;
      return {
        ...work,
        laborCost,
        benefitCost,
        totalLaborAll:laborCost + benefitCost + dre.tercCost,
        tercCost:dre.tercCost,
        comprasCost:dre.comprasCost,
        materialCost:dre.comprasCost,
        equipCost:dre.equipCost,
        outrasTotal:dre.outrasTotal,
        rescTotal:dre.rescTotal,
        revenue:dre.faturamento,
        costs:dre.totalCustos,
        margin:dre.lucroBruto,
        marginPct:dre.margemBruta,
        received:dre.entradasCaixa,
        paid:dre.saidasCaixa,
        receivedTotal:dre.recebidoAcum,
        receivable:dre.contasReceber,
        payable:dre.contasPagar,
        committed:dre.comprometido,
        commitment:commitmentPct,
        unallocatedReceipts:dre.recebimentosNaoAlocados,
        unallocatedPayments:dre.pagamentosNaoAlocados,
        activeEmps:(data.employees || []).filter(employee => employee.active !== false && employee.obra === work.id).length,
        activeTercCount:(data.terceirizados || []).filter(worker => worker.active !== false && worker.obraId === work.id).length,
      };
    });
    const selected = obraId === "all"
      ? calcDREConsolidado(data, year, month)
      : calcDREObra(data, obraId, year, month);
    const ledger = selected.ledger;
    const periodMovements = selectFinancialMovements(ledger, {
      ...(obraId === "all" ? {} : { obraId }),
      startDate:selected.per0, endDate:selected.perF,
    });
    const reversalMovements = periodMovements.filter(movement =>
      ["revenue_reversal", "cost_reversal"].includes(movement.natureza));
    const cancelledStatuses = new Set(["cancelado", "cancelada", "estornado", "excluido", "excluida"]);
    const cancelledCount = [
      ...(data.medicoes || []), ...(data.notasFiscais || []), ...(data.pedidos || []),
      ...(data.pagsTerceiros || []), ...(data.medicoesTerc || []), ...(data.outrasDesp || []),
      ...(data.despesasEmpresa || []), ...(data.payments || []),
    ].filter(item => (obraId === "all" || !item.obraId || item.obraId === obraId)
      && cancelledStatuses.has(String(item.status || "").toLowerCase())).length;
    const summary = {
      revenue:selected.faturamento,
      costs:selected.totalCustos,
      result:selected.lucroBruto,
      marginPct:selected.margemBruta,
      cashIn:selected.entradasCaixa,
      cashOut:selected.saidasCaixa,
      cashBalance:selected.saldoCaixa,
      receivable:selected.contasReceber,
      payable:selected.contasPagar,
      committed:selected.comprometido,
      unallocatedReceipts:periodMovements
        .filter(movement => movement.natureza === "cash_in" && movement.unallocated)
        .reduce((total, movement) => total + movement.valor, 0),
      unallocatedPayments:periodMovements
        .filter(movement => movement.natureza === "cash_out" && movement.unallocated)
        .reduce((total, movement) => total + movement.valor, 0),
      reversals:reversalMovements.reduce((total, movement) => total + movement.valor, 0),
      reversalCount:reversalMovements.length,
      cancelledCount,
      labor:rows.reduce((total, row) => total + row.laborCost + row.benefitCost, 0),
      thirdParty:rows.reduce((total, row) => total + row.tercCost, 0),
      purchases:rows.reduce((total, row) => total + row.comprasCost, 0),
    };
    const receipts = selectFinancialMovements(ledger, obraId === "all" ? {} : { obraId })
      .filter(movement => movement.natureza === "cash_in")
      .sort((left, right) => String(right.data || "").localeCompare(String(left.data || "")))
      .map(movement => ({
        ...movement,
        amount:movement.valor,
        date:movement.data,
        description:movement.descricao,
        removable:movement.origem === "recebimento_avulso",
      }));
    const fortnightly = [];
    for (let offset = 3; offset >= 0; offset -= 1) {
      const date = new Date(year, month - offset, 1);
      const y = date.getFullYear();
      const m = date.getMonth();
      ["q1", "q2"].forEach((period, index) => {
        const line = obraId === "all"
          ? calcDREConsolidado(data, y, m, period)
          : calcDREObra(data, obraId, y, m, period);
        fortnightly.push({
          mes:`${index + 1}a ${monthName(m)}/${String(y).slice(2)}`,
          Recebido:Math.round(line.entradasCaixa),
          CustoMO:Math.round(Number(line.moData?.laborCost || line.laborCost || 0)
            + Number(line.moData?.benefitCost || line.benefitCost || 0)),
          Terceiros:Math.round(line.tercCost),
        });
      });
    }
    return { rows, summary, receipts, fortnightly, selected };
  };

  return {
    diasPeriodoDRE, calcDREObra, calcDREConsolidado, calcDREHistorico,
    calcVisaoFinanceira, calcProjecaoContratoObra,
  };
};
