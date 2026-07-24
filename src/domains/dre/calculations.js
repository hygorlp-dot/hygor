// Núcleo financeiro do DRE. As dependências de folha, terceiros e equipamentos
// são injetadas para manter este domínio puro e testável durante a migração.
export const createDreCalculations = ({
  getDays,
  getQ,
  monthName,
  calcObraLaborCost,
  calcObraTercCost,
  calcTercEmpresaCost,
  calcObraTercEmpresaCost,
  calcObraComprasCost,
  calcEquipCustoObra,
  calcEquipFaturamentoEmpresa,
}) => {
  const diasPeriodoDRE = (year, month, periodo = "mes") => {
    if (periodo === "q1") return getQ(year, month).q1;
    if (periodo === "q2") return getQ(year, month).q2;
    return getDays(year, month);
  };

  const calcDREObra = (data, obraId, year, month, periodo = "mes") => {
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    const days = diasPeriodoDRE(year, month, periodo);
    const per0 = days[0] || "";
    const perF = days[days.length - 1] || "";
    const noPeriodo = value => !!value && value >= per0 && value <= perF;
    const obra = data.obras.find(o => o.id === obraId);
    const dataCompetenciaMedicao = m =>
      m.dataEmissao || m.dataVencimento || `${m.competencia || ym}-20`;
    const medDoMes = (data.medicoes || []).filter(m =>
      m.obraId === obraId &&
      (periodo === "mes"
        ? m.competencia === ym
        : noPeriodo(dataCompetenciaMedicao(m)))
    );
    const faturamento = medDoMes.reduce((s, m) => s + m.valorPrevisto, 0);
    const recMed = (data.medicoes || [])
      .filter(m => m.obraId === obraId && m.recebido &&
        noPeriodo(m.dataPagamento || dataCompetenciaMedicao(m)))
      .reduce((s, m) => s + Number(m.valorRecebido || 0), 0);
    const recLivre = (data.payments || [])
      .filter(p => p.obraId === obraId && noPeriodo(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const recebido = recMed + recLivre;
    const recebidoDasMedicoes = medDoMes
      .filter(m => m.recebido)
      .reduce((s, m) => s + Number(m.valorRecebido || 0), 0);
    const aReceber = Math.max(0, faturamento - recebidoDasMedicoes);
    const moData = calcObraLaborCost(data, obraId, days);
    const tercCost = calcObraTercCost(data, obraId, per0, perF);
    const rescTotal = (data.rescisoes || [])
      .filter(r => r.obraName === (obra?.name || "") && noPeriodo(r.demissao))
      .reduce((s, r) => s + Number(r.totalLiquido || 0), 0);
    const outrasNoPeriodo = d =>
      d.obraId === obraId &&
      (periodo === "mes"
        ? d.competencia === ym
        : noPeriodo(d.data || `${d.competencia || ym}-20`));
    const outrasDesp = (data.outrasDesp || []).filter(outrasNoPeriodo);
    const outrasTotal = outrasDesp.reduce((s, d) => s + Number(d.valor || 0), 0);
    const equipCost = calcEquipCustoObra(data, obraId, ym, per0, perF);
    // Compras (pedidos) são um custo real da obra, à parte de outrasDesp -
    // sem risco de duplicação, pois nunca fazem parte desse lançamento manual.
    const comprasCost = calcObraComprasCost(data, obraId, per0, perF);
    // Terceirizados pagos pela EMPRESA para esta obra: por decisão de negócio
    // não entram no custo/margem da própria obra (a empresa absorve como
    // overhead - ver calcObraTercCost), mas ficam disponíveis para exibição e
    // para a base do percentual de administração cobrado do cliente.
    const tercEmpresaObra = calcObraTercEmpresaCost(data, obraId, per0, perF);
    const totalCustos =
      moData.laborCost + moData.benefitCost + tercCost + rescTotal +
      outrasTotal + equipCost + comprasCost;
    const lucroBruto = faturamento - totalCustos;
    const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
    const saldoCaixa = recebido - totalCustos;
    const margemCaixa = recebido > 0 ? (saldoCaixa / recebido) * 100 : 0;
    const contratoTotal = Number(obra?.contractValue || 0);
    const faturadoAcum = (data.medicoes || [])
      .filter(m => m.obraId === obraId)
      .reduce((s, m) => s + m.valorPrevisto, 0);
    const recebidoAcum =
      (data.medicoes || []).filter(m => m.obraId === obraId && m.recebido)
        .reduce((s, m) => s + m.valorRecebido, 0) +
      (data.payments || []).filter(p => p.obraId === obraId)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
    const aReceberAcum = Math.max(0, faturadoAcum - recebidoAcum);
    const backlog = Math.max(0, contratoTotal - faturadoAcum);
    const pctFaturado = contratoTotal > 0 ? (faturadoAcum / contratoTotal) * 100 : 0;
    const pctRecebido = contratoTotal > 0 ? (recebidoAcum / contratoTotal) * 100 : 0;
    const meds = (data.medicoes || [])
      .filter(m => m.obraId === obraId && m.tipo === "percentual");
    const pctAvanco = meds.length
      ? Math.max(...meds.map(m => m.percentualAcumulado))
      : 0;
    return {
      obra, ym, periodo, days, per0, perF, faturamento, recebido, aReceber,
      medDoMes, moData, tercCost, tercEmpresaObra, rescTotal, outrasTotal, outrasDesp, equipCost,
      comprasCost, totalCustos, lucroBruto, margemBruta, saldoCaixa, margemCaixa,
      contratoTotal, faturadoAcum, recebidoAcum, aReceberAcum, backlog,
      pctFaturado, pctRecebido, pctAvanco,
    };
  };

  const calcDREConsolidado = (data, year, month, periodo = "mes") => {
    const days = diasPeriodoDRE(year, month, periodo);
    const per0 = days[0] || "";
    const perF = days[days.length - 1] || "";
    const rows = data.obras.map(o => calcDREObra(data, o.id, year, month, periodo));
    const sum = (key, sub) =>
      rows.reduce((s, r) => s + (sub ? r[sub][key] || 0 : r[key] || 0), 0);
    const tercEmpresa = calcTercEmpresaCost(data, per0, perF);
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    const equipEmpresa = calcEquipFaturamentoEmpresa(data, ym);
    const equipCostObras = sum("equipCost");
    const equipLucro = equipEmpresa.lucro;
    const totalCustos = sum("totalCustos") - equipCostObras + tercEmpresa;
    const faturamento = sum("faturamento") + equipLucro;
    const recebido = sum("recebido");
    const lucroBruto = faturamento - totalCustos;
    const saldoCaixa = recebido - totalCustos;
    return {
      obras: rows, periodo, days, per0, perF, faturamento, recebido,
      aReceber: sum("aReceber"),
      laborCost: sum("laborCost", "moData"),
      benefitCost: sum("benefitCost", "moData"),
      tercCost: sum("tercCost"), tercEmpresa, tercEmpresaObras: sum("tercEmpresaObra"),
      rescTotal: sum("rescTotal"), outrasTotal: sum("outrasTotal"),
      comprasCost: sum("comprasCost"),
      equipCostObras, equipReceita: equipEmpresa.receita, equipLucro,
      totalCustos, lucroBruto, saldoCaixa,
      faturadoAcum: sum("faturadoAcum"),
      recebidoAcum: sum("recebidoAcum"),
      backlog: sum("backlog"),
      margemBruta: faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0,
      margemCaixa: recebido > 0 ? (saldoCaixa / recebido) * 100 : 0,
    };
  };

  const calcDREHistorico = (data, year, month, nMeses = 6) =>
    Array.from({ length: nMeses }, (_, i) => {
      const d = new Date(year, month - nMeses + 1 + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      return {
        mes: `${monthName(m)}/${String(y).slice(2)}`,
        ...calcDREConsolidado(data, y, m),
        y,
        m,
      };
    });

  return { diasPeriodoDRE, calcDREObra, calcDREConsolidado, calcDREHistorico };
};
