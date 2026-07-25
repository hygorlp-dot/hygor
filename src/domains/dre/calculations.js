import {
  buildFinancialLedger,
  selectDRE,
  selectCashFlow,
  selectAccountsReceivable,
  selectAccountsPayable,
  selectCommitments,
  validateFinancialReconciliation,
  toCents,
  fromCents,
} from "../financeiro/ledger.js";

// Adaptadores públicos do DRE. A fórmula financeira vive exclusivamente no
// ledger; as dependências injetadas apenas traduzem ponto e equipamentos,
// cujos motores operacionais continuam em seus módulos próprios.
export const createDreCalculations = ({
  getDays,
  getQ,
  monthName,
  calcObraLaborCost,
  calcObraTercCost: _calcObraTercCost,
  calcTercEmpresaCost: _calcTercEmpresaCost,
  calcObraTercEmpresaCost,
  calcObraComprasCost: _calcObraComprasCost,
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
      tercEmpresaObra:calcObraTercEmpresaCost?.(data,obraId,ctx.per0,ctx.perF)||0,
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
    const resultadoObras = sum("lucroBruto");
    const resultadoCorporativo = fromCents(corporateRevenueCents-corporateCostCents);
    const resultadoEquipamentosExternos = Number(equipment.lucro || 0);
    const eliminacoesInternas = 0;
    const resultadoConsolidado = resultadoObras + resultadoCorporativo + resultadoEquipamentosExternos - eliminacoesInternas;
    const faturamento = sum("faturamento") + fromCents(corporateRevenueCents) + resultadoEquipamentosExternos;
    const totalCustos = sum("totalCustos") + fromCents(corporateCostCents);
    const recebido = sum("recebido");
    const entradasCaixa = sum("entradasCaixa");
    const saidasCaixa = sum("saidasCaixa");
    const reconciliation = {
      resultadoObras, resultadoCorporativo, resultadoEquipamentosExternos,
      eliminacoesInternas, resultadoConsolidado,
      diferencaCents:toCents(resultadoConsolidado-(faturamento-totalCustos)),
    };
    return {
      obras:rows, periodo, days:ctx.days, per0:ctx.per0, perF:ctx.perF,
      faturamento, recebido, aReceber:sum("aReceber"),
      laborCost:sum("laborCost","moData"), benefitCost:sum("benefitCost","moData"),
      tercCost:sum("tercCost"), tercEmpresa:0, tercEmpresaObras:sum("tercEmpresaObra"),
      rescTotal:sum("rescTotal"), outrasTotal:sum("outrasTotal"), comprasCost:sum("comprasCost"),
      equipCostObras:sum("equipCost"), equipReceita:Number(equipment.receita||0), equipLucro:resultadoEquipamentosExternos,
      totalCustos, lucroBruto:resultadoConsolidado, saldoCaixa:entradasCaixa-saidasCaixa,
      faturadoAcum:sum("faturadoAcum"), recebidoAcum:sum("recebidoAcum"), backlog:sum("backlog"),
      margemBruta:faturamento?resultadoConsolidado/faturamento*100:0,
      margemCaixa:entradasCaixa?(entradasCaixa-saidasCaixa)/entradasCaixa*100:0,
      entradasCaixa, saidasCaixa, contasReceber:sum("contasReceber"),
      contasPagar:sum("contasPagar"), comprometido:sum("comprometido"),
      recebimentosNaoAlocados:sum("recebimentosNaoAlocados"),
      pagamentosNaoAlocados:sum("pagamentosNaoAlocados"),
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

  return { diasPeriodoDRE, calcDREObra, calcDREConsolidado, calcDREHistorico };
};
