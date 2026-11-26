// @ts-check
import { Suspense, useMemo, useState } from "react";
import { obterProjecaoMaoObra } from "../../api.js";
import { contar } from "../../design-system/copy.js";
import { ScopeNote } from "../../design-system/patterns/ScopeNote.jsx";
import { origemPagamentoLabel, statusPagamentoPedido } from "../../domains/compras/calculations.js";
import { calcObraLaborCost, calcProjecaoContratoObra, calcRelatorioMensal } from "../../domains/financeiro/legacy-calculations.js";
import { calculateWorkCash as calcCaixaObra } from "../../domains/financeiro/work-cash.js";
import { CONTRACT_LABELS as contractLabels } from "../../domains/licenciamento/legacy-checklists.js";
import { getAtt, getDays, getHolidayPayRule, getPayrollHolidays, isEmployeeEmployedOnDate, prIsWeekdayIso } from "../../domains/ponto/attendance-engine.js";
import { isLeaveStatus } from "../../domains/ponto/attendance-status.js";
import LaborProjectionReport from "../../domains/ponto/components/LaborProjectionReport.jsx";
import { calculateAttendanceDayCost } from "../../domains/ponto/payroll.js";
import { resolveEmployeeAttendanceObraId, resolveHolidayObraId } from "../../domains/ponto/permissions.js";
import { RESCISSION_TYPE_LABEL as rescissionLabels } from "../../domains/rh/rescission-calculations.js";
import { FlowTabs } from "../workflow/WorkflowNavigation.jsx";
import { useSyncedWorkObra } from "../workflow/work-context.js";
import { carregarXLSX } from "../../legacy/files.js";
import { escapeHtml, fmt, fmtDate, fmtDateFull, fullMonth, pct1, today } from "../../legacy/format.js";
import { C, FONT_DISPLAY } from "../../legacy/palette.js";
import { Badge, Btn, Ic, Inp, LoadingState, PageHero, Sel, TabRow } from "../../legacy/ui.jsx";
import { lazyWithCssRetry as lazy } from "../../lib/lazy-with-css-retry.js";
import { abrirRelatorioPadrao, montarRelatorioPadraoHtml } from "../../reports/legacy-standard.js";
import { gerarRelatorioCaixaObraPDF } from "../../reports/work-cash-report.js";

const LazyRelatoriosChartPanel = lazy(() => import("../../components/charts/RelatoriosChartPanel.jsx"));

/** @typedef {import("../../reports/legacy-standard.js").ReportToast} ReportToast */
/** @typedef {{id:string, name:string, areaM2?:number|string, hasCaixa?:boolean, contractType:string, adminPercentage?:number|string, cliente?:string, address?:string}} ReportWork */
/** @typedef {{id:string, name:string, obra:string, active?:boolean}} ReportEmployee */
/** @typedef {{materialId:string, descricaoRef?:string, unidadeRef?:string, qtd?:number|string, precoUnit?:number|string}} PurchaseItem */
/** @typedef {{id:string, status?:string, data?:string, obraId:string, origemPagamento?:string, numero?:string, fornecedorId:string, itens?:PurchaseItem[]}} Purchase */
/**
 * @typedef {Omit<import("../../reports/legacy-standard.js").ReportBrandData,"config"> & {
 *   config:NonNullable<import("../../reports/legacy-standard.js").ReportBrandData["config"]> & {paymentHolidays?:unknown},
 *   obras:ReportWork[], employees:ReportEmployee[], pedidos?:Purchase[],
 *   fornecedores?:{id:string, nome:string}[], materiais?:{id:string, descricao:string}[],
 * } & Record<string, unknown>} ReportsData
 */
/** @typedef {{data:ReportsData, showToast:ReportToast}} ReportProps */
/** @typedef {ReportProps & {year:number, month:number}} PeriodReportProps */
/** @typedef {{pedidoId:string, numero:string, data:string, obra:string, fornecedor:string, item:string, unidade:string, qtd:number, precoUnit:number, subtotal:number, origemPagamento:string, statusLabel:string}} PurchaseRow */
/** @typedef {{comprado:number, pago:number, pendente:number}} PurchaseTotals */
/** @typedef {{obra:ReportWork, ap:number, adminBase:number, valorAdmin:number, jaFechado:number, pendente:number, laborBase:number, materialCost:number, tercCost:number, outrosCustos:number, incluiMaoDeObra:boolean, incluiMateriais:boolean, incluiTerceirizados:boolean}} AdministrationRow */
/** @typedef {{previsto:number, fechado:number, pendente:number}} AdministrationTotals */
/**
 * @typedef {{obra:ReportWork, activeEmps:number, activeTercs:number, presencaDias:number, faltas:number,
 *   received:number, revenueEsperada:number, moData:{laborCost:number, benefitCost:number},
 *   tercCost:number, rescTotal:number, adiantTotal:number, totalDespesas:number, margem:number,
 *   margemEsperada:number, margemPct:number,
 *   tercDetalhes:{id:string, tercName?:string, amount:number, date:string, specialty?:string, description?:string}[],
 *   rescDetalhes:{id:string, tipo:string, empName?:string, empCPF?:string, admissao:string, demissao:string, totalLiquido:number}[],
 *   recDetalhes:{date:string, amount:number, description?:string}[]}} MonthlyRow
 */
/** @typedef {[label:string,value:number,color:string,skip?:boolean]} SummaryRow */
/** @type {Record<string, string|undefined>} */
const CONTRACT_LABELS = contractLabels;
/** @type {Record<string, string|undefined>} */
const TIPO_LABEL = rescissionLabels;

/** @param {{label:string, value:string|number, detail?:string, color?:string, icon?:string, active?:boolean, onClick?:()=>void}} props */
function ReportMetric({ label, value, detail, color=C.yellow, icon="chart", active=false, onClick }) {
  const Comp=onClick?"button":"div";
  return <Comp type={onClick?"button":undefined} onClick={onClick} className={onClick?"lift-card":""} style={{
    appearance:"none",textAlign:"left",width:"100%",background:active?`${color}0D`:"var(--arcd-surface-card)",
    border:`var(--arcd-border-width) solid ${active?color:C.line}`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-2) var(--arcd-space-3)",cursor:onClick?"pointer":"default",
    boxShadow:active?`0 0 0 2px ${color}12`:C.shHair,position:"relative",overflow:"hidden",
  }}><span style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:color}}/><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"var(--arcd-space-2)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,letterSpacing:.8,textTransform:"uppercase",color:"var(--arcd-text-secondary)"}}>{label}</p><span style={{width:24,height:24,borderRadius:"var(--arcd-radius-control)",display:"grid",placeItems:"center",background:`${color}10`,color}}><Ic n={icon} s={12} color={color}/></span></div><p style={{fontFamily:FONT_DISPLAY,fontSize:"clamp(17px,2vw,21px)",fontWeight:600,letterSpacing:-.55,color:"var(--arcd-text-primary)",lineHeight:1,marginTop:"var(--arcd-space-2)"}}>{value}</p>{detail&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>{detail}</p>}</Comp>;
}

//
// Relatórios
//

// Relatório financeiro consolidado do caixa de obra: uma linha por obra com
// caixa ativado, saldo/aportes/gastos e um PDF por obra (mesmo template já
// usado dentro da tela Caixa de Obra).
/** @param {ReportProps} props */
function RelatorioCaixaObra({ data, showToast }) {
  const obrasComCaixa = useMemo(() => (data.obras||[]).filter(o=>o.hasCaixa), [data.obras]);
  const linhas = useMemo(() => obrasComCaixa.map(o => ({ obra:o, ...calcCaixaObra(data,o.id) })),
    [obrasComCaixa, data.caixaObra]);
  const totalAportes  = linhas.reduce((s,l)=>s+l.totalAportes,0);
  const totalDespesas = linhas.reduce((s,l)=>s+l.totalDespesas,0);
  const totalDevolucoes = linhas.reduce((s,l)=>s+l.totalDevolucoes,0);
  const totalSaldo    = linhas.reduce((s,l)=>s+l.saldo,0);

  if (!obrasComCaixa.length) {
    return (
      <div style={{padding:"var(--arcd-space-6)",textAlign:"center",border:`var(--arcd-border-width) dashed var(--arcd-border-default)`,borderRadius:"var(--arcd-box-radius)",color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-label)"}}>
        Nenhuma obra com caixa ativado. Ative em <strong>Obras</strong> · "Esta obra possui caixa de obra".
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:"var(--arcd-space-2)"}}>
        <ReportMetric label="Total de entradas" value={fmt(totalAportes)} color={C.green} icon="download"/>
        <ReportMetric label="Total de gastos" value={fmt(totalDespesas)} color={C.red} icon="cart"/>
        <ReportMetric label="Devoluções" value={fmt(totalDevolucoes)} color={C.muted} icon="wallet"/>
        <ReportMetric label="Saldo consolidado" value={fmt(totalSaldo)} color={(totalSaldo>0?C.green:totalSaldo<0?C.red:C.muted)} icon="wallet"/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
        {linhas.map(l => (
          <div key={l.obra.id} style={{background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid var(--arcd-border-default)`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-3) var(--arcd-space-3)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
            <div>
              <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:"var(--arcd-text-primary)"}}>{l.obra.name}</p>
              <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{contar(l.movimentos.length,"lançamento","lançamentos")} · entradas {fmt(l.totalAportes)} · despesas {fmt(l.totalDespesas)} · devoluções {fmt(l.totalDevolucoes)}</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-2)"}}>
              <b style={{fontSize:"var(--arcd-type-card-title)",color:(l.saldo>0?C.green:l.saldo<0?C.red:C.muted)}}>{fmt(l.saldo)}</b>
              <Btn size="sm" v="ghost" onClick={()=>gerarRelatorioCaixaObraPDF(data,l.obra,l,showToast)}><Ic n="download" s={12}/> PDF</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {ReportsData} data
 * @param {{inicio:string, fim:string, obraId:string, origem:string, linhas:PurchaseRow[], totais:PurchaseTotals}} filters
 * @param {ReportToast} showToast
 */
function gerarRelatorioComprasPDF(data, { inicio, fim, obraId, origem, linhas, totais }, showToast) {
  const obraNomeSel = obraId === "all" ? "Todas as obras" : (data.obras||[]).find(o=>o.id===obraId)?.name || "-";
  const origemSel = origem === "todas" ? "Todos" : origemPagamentoLabel(origem);
  const html = montarRelatorioPadraoHtml({
    data,
    titulo: "Relatório de compras",
    subtitulo: `${fmtDateFull(inicio)} a ${fmtDateFull(fim)}`,
    meta: [
      { label: "Obra", value: obraNomeSel },
      { label: "Quem pagou", value: origemSel },
    ],
    kpis: [
      { label: "Total comprado", value: fmt(totais.comprado) },
      { label: "Total pago", value: fmt(totais.pago) },
      { label: "Saldo a pagar", value: fmt(totais.pendente) },
      { label: "Itens no período", value: String(linhas.length) },
    ],
    tabelas: [{
      headers: ["Data","Pedido","Obra","Fornecedor","Item",{label:"Qtd",num:true},{label:"Preço unit.",num:true},{label:"Subtotal",num:true},"Quem pagou","Status"],
      rows: linhas.map(l => [
        escapeHtml(fmtDateFull(l.data)), escapeHtml(l.numero), escapeHtml(l.obra), escapeHtml(l.fornecedor),
        escapeHtml(l.item), escapeHtml(`${l.qtd} ${l.unidade}`), escapeHtml(fmt(l.precoUnit)), escapeHtml(fmt(l.subtotal)),
        escapeHtml(l.origemPagamento), escapeHtml(l.statusLabel),
      ]),
      totalRow: ["","","","","","","TOTAL", fmt(totais.comprado), "", ""],
      vazio: "Nenhuma compra encontrada neste filtro.",
    }],
  });
  abrirRelatorioPadrao(html, showToast);
}

/** @param {ReportProps} props */
function RelatorioCompras({ data, showToast }) {
  const [inicio, setInicio] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`);
  const [fim, setFim] = useState(() => today());
  const [obraId, setObraId] = useState("all");
  const [origem, setOrigem] = useState("todas");

  const obraPorIdC = useMemo(() => new Map((data.obras||[]).map(o=>[o.id,o])), [data.obras]);
  const fornecedorPorId = useMemo(() => new Map((data.fornecedores||[]).map(f=>[f.id,f])), [data.fornecedores]);
  const materialPorId = useMemo(() => new Map((data.materiais||[]).map(m=>[m.id,m])), [data.materiais]);

  const linhas = useMemo(() => {
    /** @type {PurchaseRow[]} */
    const out = [];
    (data.pedidos||[]).forEach(p => {
      if (p.status === "cancelado") return;
      const date = p.data;
      if (!date || date < inicio || date > fim) return;
      if (obraId!=="all" && p.obraId!==obraId) return;
      const origemPag = p.origemPagamento || "empresa";
      if (origem!=="todas" && origemPag!==origem) return;
      const statusPag = statusPagamentoPedido(p);
      const statusLabel = statusPag==="pago"?"Pago":statusPag==="parcial"?"Parcial":statusPag==="cancelado"?"Cancelado":"Pendente";
      (p.itens||[]).forEach(item => {
        const nomeItem = materialPorId.get(item.materialId)?.descricao || item.descricaoRef || "Item";
        const subtotal = Number(item.qtd||0) * Number(item.precoUnit||0);
        out.push({
          pedidoId: p.id, numero: p.numero||"-", data: date,
          obra: obraPorIdC.get(p.obraId)?.name || "-",
          fornecedor: fornecedorPorId.get(p.fornecedorId)?.nome || "-",
          item: nomeItem, unidade: item.unidadeRef||"-",
          qtd: Number(item.qtd||0), precoUnit: Number(item.precoUnit||0), subtotal,
          origemPagamento: origemPagamentoLabel(origemPag),
          statusLabel,
        });
      });
    });
    return out.sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
  }, [data.pedidos, obraPorIdC, fornecedorPorId, materialPorId, inicio, fim, obraId, origem]);

  const totais = useMemo(() => {
    const comprado = linhas.reduce((s,l)=>s+l.subtotal,0);
    const pago = linhas.filter(l=>l.statusLabel==="Pago").reduce((s,l)=>s+l.subtotal,0);
    return { comprado, pago, pendente: comprado - pago };
  }, [linhas]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
      <div className="no-print" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"var(--arcd-space-2)"}}>
        <Inp label="De" type="date" value={inicio} onChange={setInicio}/>
        <Inp label="Até" type="date" value={fim} onChange={setFim}/>
        <Sel label="Obra" value={obraId} onChange={setObraId} options={[{v:"all",l:"Todas as obras"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
        <Sel label="Quem pagou" value={origem} onChange={setOrigem} options={[{v:"todas",l:"Todos"},{v:"empresa",l:origemPagamentoLabel("empresa")},{v:"caixa_obra",l:origemPagamentoLabel("caixa_obra")},{v:"cliente_direto",l:origemPagamentoLabel("cliente_direto")}]}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:"var(--arcd-space-2)"}}>
        <ReportMetric label="Total comprado" value={fmt(totais.comprado)} color={C.blue} icon="cart"/>
        <ReportMetric label="Total pago" value={fmt(totais.pago)} color={C.green} icon="check"/>
        <ReportMetric label="Saldo a pagar" value={fmt(totais.pendente)} color={totais.pendente>0?C.orange:C.green} icon="wallet"/>
      </div>
      <div className="no-print" style={{display:"flex",justifyContent:"flex-end"}}>
        <Btn size="sm" v="ghost" onClick={()=>gerarRelatorioComprasPDF(data,{inicio,fim,obraId,origem,linhas,totais},showToast)}><Ic n="download" s={12}/> Exportar PDF</Btn>
      </div>
      <div className="scroll-x" style={{border:`var(--arcd-border-width) solid var(--arcd-border-default)`,borderRadius:"var(--arcd-box-radius)",overflow:"hidden"}}>
        <table className="arcd-data-table__table" style={{width:"100%",minWidth:900,borderCollapse:"collapse",background:"var(--arcd-surface-card)"}}>
          <thead><tr>{["Data","Pedido","Obra","Fornecedor","Item","Qtd","Preço unit.","Subtotal","Quem pagou","Status"].map(h=><th key={h} style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",textAlign:["Qtd","Preço unit.","Subtotal"].includes(h)?"right":"left",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",borderBottom:`var(--arcd-border-width) solid var(--arcd-border-default)`}}>{h}</th>)}</tr></thead>
          <tbody>{linhas.map((l,i)=><tr key={`${l.pedidoId}-${i}`} style={{borderTop:`var(--arcd-border-width) solid var(--arcd-border-subtle)`}}>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",color:"var(--arcd-text-secondary)",whiteSpace:"nowrap"}}>{fmtDate(l.data)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",fontWeight:600,color:C.blue}}>{l.numero}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)"}}>{l.obra}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)"}}>{l.fornecedor}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",maxWidth:220,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.item}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right",whiteSpace:"nowrap"}}>{l.qtd} {l.unidade}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right"}}>{fmt(l.precoUnit)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",fontWeight:600,textAlign:"right"}}>{fmt(l.subtotal)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)"}}>{l.origemPagamento}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)"}}><Badge color={l.statusLabel==="Pago"?C.green:l.statusLabel==="Parcial"?C.orange:l.statusLabel==="Cancelado"?C.red:C.muted}>{l.statusLabel}</Badge></td>
          </tr>)}</tbody>
        </table>
        {!linhas.length&&<div style={{padding:"var(--arcd-space-6)",textAlign:"center",color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-label)"}}>Nenhuma compra encontrada neste filtro.</div>}
      </div>
    </div>
  );
}

/**
 * @param {ReportsData} data
 * @param {{period:string, linhas:AdministrationRow[], totais:AdministrationTotals}} report
 * @param {ReportToast} showToast
 */
function gerarRelatorioAdministracaoPDF(data, { period, linhas, totais }, showToast) {
  const html = montarRelatorioPadraoHtml({
    data,
    titulo: "Previsão de recebimento por administração",
    subtitulo: period,
    kpis: [
      { label: "Previsto no período", value: fmt(totais.previsto) },
      { label: "Já fechado nas medições", value: fmt(totais.fechado) },
      { label: "Pendente de fechamento", value: fmt(totais.pendente) },
      { label: "Obras por administração", value: String(linhas.length) },
    ],
    tabelas: [{
      headers: ["Obra","Modalidade",{label:"% Admin.",num:true},{label:"Mão de obra",num:true},{label:"Materiais",num:true},{label:"Terceirizados",num:true},{label:"Base calculada",num:true},{label:"Previsto",num:true},{label:"Já fechado",num:true},{label:"Pendente",num:true}],
      rows: linhas.map(l => [
        escapeHtml(l.obra.name), escapeHtml(CONTRACT_LABELS[l.obra.contractType]||l.obra.contractType),
        escapeHtml(`${l.ap}%`),
        escapeHtml(`${fmt(l.laborBase)}${l.incluiMaoDeObra?"":" (não entra)"}`),
        escapeHtml(`${fmt(l.materialCost)}${l.incluiMateriais?"":" (não entra)"}`),
        escapeHtml(`${fmt(l.tercCost)}${l.incluiTerceirizados?"":" (não entra)"}`),
        escapeHtml(fmt(l.adminBase)), escapeHtml(fmt(l.valorAdmin)),
        escapeHtml(fmt(l.jaFechado)), escapeHtml(fmt(l.pendente)),
      ]),
      totalRow: ["","","","","","", "", fmt(totais.previsto), fmt(totais.fechado), fmt(totais.pendente)],
      vazio: "Nenhuma obra por administração encontrada.",
    }],
    legenda: "Base calculada = soma apenas das categorias configuradas no cadastro de cada obra (materiais, mão de obra e/ou terceirizados). Compras via pedidos e terceirizados pagos pela empresa para a obra já estão incluídos nos valores de materiais e terceirizados.",
  });
  abrirRelatorioPadrao(html, showToast);
}

// Documento voltado ao cliente, para justificar a cobrança da administração
// de uma obra específica no período - só entram as categorias efetivamente
// configuradas para esta obra (cadastro de Obras).
/**
 * @param {ReportsData} data
 * @param {{l:AdministrationRow, period:string}} report
 * @param {ReportToast} showToast
 */
function gerarRelatorioCobrancaAdministracaoPDF(data, { l, period }, showToast) {
  const obra = l.obra;
  const composicao = [
    { label: "Mão de obra e benefícios", valor: l.laborBase, incluido: l.incluiMaoDeObra },
    { label: "Materiais (lançamentos e compras)", valor: l.materialCost, incluido: l.incluiMateriais },
    { label: "Terceirizados", valor: l.tercCost, incluido: l.incluiTerceirizados },
  ];
  if (obra.contractType === "admin_only" && l.outrosCustos > 0) {
    composicao.push({ label: "Equipamentos, rescisões e outras despesas", valor: l.outrosCustos, incluido: true });
  }
  const html = montarRelatorioPadraoHtml({
    data,
    titulo: "Relatório de cobrança - administração de obra",
    subtitulo: `${obra.name} · ${period}`,
    paisagem: false,
    meta: [
      { label: "Cliente", value: obra.cliente || "Não informado" },
      { label: "Obra", value: obra.name },
      { label: "Endereço", value: obra.address || "-" },
      { label: "Modalidade", value: CONTRACT_LABELS[obra.contractType] || obra.contractType },
    ],
    kpis: [
      { label: "Base de cálculo", value: fmt(l.adminBase) },
      { label: "% de administração", value: `${l.ap}%` },
      { label: "Valor da administração", value: fmt(l.valorAdmin) },
      { label: "Já fechado nas medições", value: fmt(l.jaFechado) },
    ],
    tabelas: [{
      titulo: "Composição dos custos do período",
      headers: ["Categoria",{label:"Valor gasto",num:true},"Entra na base de administração?"],
      rows: composicao.map(c => [escapeHtml(c.label), escapeHtml(fmt(c.valor)), c.incluido?"Sim":"Não"]),
      totalRow: ["Base de administração ($ × %)", fmt(l.adminBase), `${l.ap}% = ${fmt(l.valorAdmin)}`],
    }],
    legenda: `Valor calculado como ${l.ap}% sobre a base de administração definida no contrato desta obra. Categorias marcadas "Não" não entram no cálculo, conforme configurado no cadastro da obra.`,
    assinaturas: ["Responsável pela construtora", `Representante · ${obra.cliente || "cliente"}`],
  });
  abrirRelatorioPadrao(html, showToast);
}

/** @param {PeriodReportProps} props */
function RelatorioAdministracao({ data, year, month, showToast }) {
  const obrasAdmin = useMemo(() => (data.obras||[])
    .filter(o => o.contractType==="admin_only" || o.contractType==="fixed_labor_admin"),
    [data.obras]);

  const linhas = useMemo(() => {
    return obrasAdmin.map(obra => {
      const projection = calcProjecaoContratoObra(data, obra.id, year, month);
      const laborBase = projection.laborCost + projection.benefitCost;
      // Usa exclusivamente a configuração salva no cadastro da obra (nenhum
      // filtro deste relatório sobrescreve o que foi definido lá).
      const {
        adminBase, incluiMaoDeObra, incluiMateriais, incluiTerceirizados,
        outrosCustos, adminEligibleMaterialCost, tercCost, jaFechado,
      } = projection;
      const ap = Number(obra.adminPercentage||0);
      const valorAdmin = adminBase * (ap/100);
      return {
        obra, ap, adminBase, valorAdmin, jaFechado, pendente: Math.max(0, valorAdmin-jaFechado),
        // Usa o material líquido (já descontando lançamentos marcados "não
        // entra na taxa de administração"), não o bruto - senão a soma das
        // linhas "Sim" deste relatório não bate com a base de fato cobrada.
        laborBase, materialCost: adminEligibleMaterialCost, tercCost, outrosCustos,
        incluiMaoDeObra, incluiMateriais, incluiTerceirizados,
      };
    });
  }, [obrasAdmin, year, month, data]);

  const totais = useMemo(() => ({
    previsto: linhas.reduce((s,l)=>s+l.valorAdmin,0),
    fechado:  linhas.reduce((s,l)=>s+l.jaFechado,0),
    pendente: linhas.reduce((s,l)=>s+l.pendente,0),
  }), [linhas]);

  const period = `${fullMonth(month)} · ${year}`;
  /** @param {number} valor @param {boolean} incluido */
  const celulaCategoria = (valor, incluido) => (
    <span style={{color:incluido?"var(--arcd-text-primary)":"var(--arcd-text-secondary)",textDecoration:incluido?"none":"line-through"}}>{fmt(valor)}</span>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
      <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>A base de cálculo usa exatamente o que está configurado no cadastro de cada obra (Obras → Contrato financeiro). Valores riscados não entram na base dessa obra.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:"var(--arcd-space-2)"}}>
        <ReportMetric label="Previsto no período" value={fmt(totais.previsto)} color={C.purple} icon="dollar"/>
        <ReportMetric label="Já fechado nas medições" value={fmt(totais.fechado)} color={C.green} icon="check"/>
        <ReportMetric label="Pendente de fechamento" value={fmt(totais.pendente)} color={totais.pendente>0?C.orange:C.green} icon="wallet"/>
      </div>
      <div className="no-print" style={{display:"flex",justifyContent:"flex-end"}}>
        <Btn size="sm" v="ghost" onClick={()=>gerarRelatorioAdministracaoPDF(data,{ period, linhas, totais },showToast)}><Ic n="download" s={12}/> Exportar PDF</Btn>
      </div>
      <div className="scroll-x" style={{border:`var(--arcd-border-width) solid var(--arcd-border-default)`,borderRadius:"var(--arcd-box-radius)",overflow:"hidden"}}>
        <table className="arcd-data-table__table" style={{width:"100%",minWidth:1050,borderCollapse:"collapse",background:"var(--arcd-surface-card)"}}>
          <thead><tr>{["Obra","Modalidade","% Admin.","Mão de obra","Materiais","Terceirizados","Base calculada","Previsto","Já fechado","Pendente","Ações"].map(h=><th key={h} style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",textAlign:["Obra","Modalidade","Ações"].includes(h)?"left":"right",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",borderBottom:`var(--arcd-border-width) solid var(--arcd-border-default)`}}>{h}</th>)}</tr></thead>
          <tbody>{linhas.map(l=><tr key={l.obra.id} style={{borderTop:`var(--arcd-border-width) solid var(--arcd-border-subtle)`}}>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",fontWeight:600}}>{l.obra.name}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",color:"var(--arcd-text-secondary)"}}>{CONTRACT_LABELS[l.obra.contractType]||l.obra.contractType}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right"}}>{l.ap}%</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right"}}>{celulaCategoria(l.laborBase,l.incluiMaoDeObra)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right"}}>{celulaCategoria(l.materialCost,l.incluiMateriais)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right"}}>{celulaCategoria(l.tercCost,l.incluiTerceirizados)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right",fontWeight:600}}>{fmt(l.adminBase)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",fontWeight:600,textAlign:"right",color:C.purple}}>{fmt(l.valorAdmin)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right",color:C.green}}>{fmt(l.jaFechado)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",fontSize:"var(--arcd-type-table)",textAlign:"right",fontWeight:600,color:l.pendente>0?C.orange:C.green}}>{fmt(l.pendente)}</td>
            <td style={{padding:"var(--arcd-space-2) var(--arcd-space-2)"}}><Btn size="sm" v="ghost" onClick={()=>gerarRelatorioCobrancaAdministracaoPDF(data,{l,period},showToast)}><Ic n="download" s={11}/> Cobrança</Btn></td>
          </tr>)}</tbody>
        </table>
        {!linhas.length&&<div style={{padding:"var(--arcd-space-6)",textAlign:"center",color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-label)"}}>Nenhuma obra por administração (admin_only ou mista) encontrada.</div>}
      </div>
    </div>
  );
}

/** @param {ReportProps & {currentUser?:{role?:string}}} props */
export default function Relatorios({ data, showToast, currentUser }) {
  const [section,setSection]=useState("monthly");
  const canViewProjection=["admin","rh","financeiro"].includes(currentUser?.role ?? "");
  return <div>
    {canViewProjection&&<FlowTabs label="Relatórios de mão de obra" active={section} onChange={setSection}
      steps={[{id:"monthly",label:"Relatórios mensais"},{id:"projection",label:"Projeção de mão de obra"}]}/>}
    {section==="projection"&&canViewProjection
      ?<LaborProjectionReport requestReport={obterProjecaoMaoObra} onOpenPending={undefined}/>
      :<RelatoriosMensais data={data} showToast={showToast}/>}
  </div>;
}

/** @param {ReportProps} props */
function RelatoriosMensais({ data, showToast }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [filterObra, setFilterObra] = useState("all");
  const [view, setView] = useState("custos");
  const usesMonthlyPeriod = view === "custos" || view === "relatorio" || view === "administracao";

  /** @type {string[]} */
  const days = useMemo(() => getDays(year, month), [year, month]);
  const obraPorIdRel = useMemo(() => new Map(data.obras.map(o => [o.id, o])), [data.obras]);
  /** @param {string} id */
  const obraName = id => obraPorIdRel.get(id)?.name || "-";
  const payrollHolidays = useMemo(() => getPayrollHolidays(data, year), [data.config?.paymentHolidays, year]);
  const holidaysInMonth = useMemo(() => days.filter(d => payrollHolidays.includes(d) && prIsWeekdayIso(d)),
    [days, payrollHolidays]);
  const obraCostRows = useMemo(() => data.obras.map(o => {
    const activeEmps = data.employees.filter(e => e.active !== false && e.obra === o.id);

    let presentes = 0;
    let meiodia = 0;
    let faltas = 0;
    let semRegistro = 0;
    let holidayPay = 0;

    data.employees.forEach(e => {
      days.forEach(d => {
        if (!isEmployeeEmployedOnDate(e, d)) return;
        if (holidaysInMonth.includes(d)) return;

        const a = getAtt(data, e.id, d);
        const obraDoDia = resolveEmployeeAttendanceObraId({
          data,
          employee:e,
          date:d,
          record:a,
        });
        if (obraDoDia !== o.id) return;
        const s = a?.status;

        if (s === "P") {
          presentes++;
        } else if (s === "M") {
          meiodia++;
        } else if (s === "F") {
          faltas++;
        } else if (isLeaveStatus(s)) {
          // Afastamento (férias/atestado/folga): não é falta nem pendência.
        } else if (e.obra === o.id && e.active !== false) {
          semRegistro++;
        }
      });

      holidaysInMonth.forEach(h => {
        if (!isEmployeeEmployedOnDate(e, h)) return;
        if (resolveHolidayObraId({ data, employee:e, holidayIso:h }) !== o.id) return;
        const rule = getHolidayPayRule(data, e, h, payrollHolidays);
        holidayPay += Number(rule.amount || 0);
      });
    });

    // Fonte única dos valores: a mesma função consumida pelo DRE, incluindo
    // hora extra, benefício, obra gravada no ponto e custos arquivados.
    const { laborCost, benefitCost, totalCost } = calcObraLaborCost(data, o.id, days);
    const areaM2 = Number(o.areaM2 || 0);
    const laborCostPerM2 = areaM2 > 0 ? laborCost / areaM2 : 0;
    const totalCostPerM2 = areaM2 > 0 ? totalCost / areaM2 : 0;

    return {
      id: o.id,
      name: o.name,
      areaM2,
      trabalhadores: activeEmps.length,
      presentes,
      meiodia,
      faltas,
      semRegistro,
      laborCost,
      benefitCost,
      holidayPay,
      totalCost,
      laborCostPerM2,
      totalCostPerM2,
    };
  }), [data, days, holidaysInMonth, payrollHolidays]);

  const filteredRows = obraCostRows.filter(r => filterObra === "all" || r.id === filterObra);

  const totals = filteredRows.reduce((acc, r) => ({
    areaM2: acc.areaM2 + r.areaM2,
    trabalhadores: acc.trabalhadores + r.trabalhadores,
    presentes: acc.presentes + r.presentes,
    meiodia: acc.meiodia + r.meiodia,
    faltas: acc.faltas + r.faltas,
    semRegistro: acc.semRegistro + r.semRegistro,
    laborCost: acc.laborCost + r.laborCost,
    benefitCost: acc.benefitCost + r.benefitCost,
    holidayPay: acc.holidayPay + r.holidayPay,
    totalCost: acc.totalCost + r.totalCost,
  }), {
    areaM2: 0,
    trabalhadores: 0,
    presentes: 0,
    meiodia: 0,
    faltas: 0,
    semRegistro: 0,
    laborCost: 0,
    benefitCost: 0,
    holidayPay: 0,
    totalCost: 0,
  });

  const totalLaborCostPerM2 = totals.areaM2 > 0 ? totals.laborCost / totals.areaM2 : 0;
  const totalCostPerM2 = totals.areaM2 > 0 ? totals.totalCost / totals.areaM2 : 0;

  const byObra = filteredRows.map(r => ({
    id: r.id,
    name: r.name,
    trabalhadores: r.trabalhadores,
    presentes: r.presentes,
    faltas: r.faltas,
    custo: r.laborCost,
    custoTotal: r.totalCost,
    custoM2: r.laborCostPerM2,
  }));

  const topCost = useMemo(() => data.employees.map(e => {
    let total = 0;

    days.forEach(d => {
      if (!isEmployeeEmployedOnDate(e, d)) return;
      if (holidaysInMonth.includes(d)) return;
      const record = getAtt(data, e.id, d);
      const obraDoDia = resolveEmployeeAttendanceObraId({
        data,
        employee:e,
        date:d,
        record,
      });
      if (filterObra !== "all" && obraDoDia !== filterObra) return;
      total += calculateAttendanceDayCost({ employee:e, record, config:data.config }).laborCost;
    });

    holidaysInMonth.forEach(h => {
      if (!isEmployeeEmployedOnDate(e, h)) return;
      const obraDoDia = resolveHolidayObraId({ data, employee:e, holidayIso:h });
      if (filterObra !== "all" && obraDoDia !== filterObra) return;
      total += Number(getHolidayPayRule(data, e, h, payrollHolidays).amount || 0);
    });

    return { name: e.name, obra: obraName(e.obra), total };
  }).filter(i => i && i.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    [data, filterObra, days, holidaysInMonth, payrollHolidays, obraPorIdRel]);

  const exportObraCosts = async () => {
    const XLSX = await carregarXLSX();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Relatório de gasto por obra", `${fullMonth(month)} ${year}`],
      ["Filtro", filterObra === "all" ? "Todas as obras" : obraName(filterObra)],
      [],
      [
        "Obra",
        "Área (m)",
        "Trabalhadores ativos",
        "Presenças",
        "Meio dia",
        "Faltas",
        "Sem registro",
        "Mão de obra",
        "Feriados pagos",
        "VT/VR",
        "Total com benefícios",
        "Mão de obra por m",
        "Total por m",
      ],
      ...filteredRows.map(r => [
        r.name,
        r.areaM2,
        r.trabalhadores,
        r.presentes,
        r.meiodia,
        r.faltas,
        r.semRegistro,
        r.laborCost,
        r.holidayPay,
        r.benefitCost,
        r.totalCost,
        r.laborCostPerM2,
        r.totalCostPerM2,
      ]),
      [
        "TOTAL",
        totals.areaM2,
        totals.trabalhadores,
        totals.presentes,
        totals.meiodia,
        totals.faltas,
        totals.semRegistro,
        totals.laborCost,
        totals.holidayPay,
        totals.benefitCost,
        totals.totalCost,
        totalLaborCostPerM2,
        totalCostPerM2,
      ],
    ]);

    ws["!cols"] = [22, 10, 16, 10, 10, 10, 12, 14, 14, 12, 18, 18, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Gasto por Obra");
    await XLSX.writeFile(wb, `arcd-gasto-obra-${year}-${String(month + 1).padStart(2, "0")}.xlsx`);
  };

  const [chartMode, setChartMode] = useState("custos");
  const [highlightObra, setHighlightObra] = useState("");
  // O escopo e o destaque andam juntos, tanto na escolha da tela quanto na vinda do carimbo.
  /** @param {string} v */
  const escolherEscopoObra = v => { setFilterObra(v); setHighlightObra(v === "all" ? "" : v); };
  useSyncedWorkObra(filterObra, escolherEscopoObra, { allowedIds: (data.obras || []).map(o => o.id), allValue: "all" });

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-3)" }}>
      <PageHero
        title="Relatórios e inteligência"
        description="Consulte custos, presença, caixa e compras."
      />

      <div className="no-print" style={{display:"flex",flexWrap:"wrap",gap:"var(--arcd-space-2)",alignItems:"end"}}>
        <TabRow tabs={[["custos","Painel analítico"],["relatorio","Relatório executivo"],["caixa","Caixa de obra"],["compras","Relatório de compras"],["administracao","Recebimento por administração"]]} active={view} onChange={setView}/>
        {usesMonthlyPeriod && <div style={{display:"flex",gap:"var(--arcd-space-2)",marginInlineStart:"auto"}}>
          <Sel label="Mês do relatório" value={String(month)} onChange={v => setMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i), l: fullMonth(i) }))} />
          <Sel label="Ano do relatório" value={String(year)} onChange={v => setYear(Number(v))} options={Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => ({ v: String(y), l: String(y) }))} />
        </div>}
      </div>

      {/*  RELATÓRIO MENSAL COMPLETO  */}
      {view === "relatorio" && <RelatorioMensal data={data} year={year} month={month} showToast={showToast}/>}

      {/*  CAIXA DE OBRA  */}
      {view === "caixa" && <>
        <ScopeNote title="Escopo do caixa de obra">Saldo acumulado das obras com caixa ativo.</ScopeNote>
        <RelatorioCaixaObra data={data} showToast={showToast}/>
      </>}

      {/*  RELATÓRIO DE COMPRAS  */}
      {view === "compras" && <RelatorioCompras data={data} showToast={showToast}/>}

      {/*  RECEBIMENTO POR ADMINISTRAÇÃO  */}
      {view === "administracao" && <RelatorioAdministracao data={data} year={year} month={month} showToast={showToast}/>}

      {/*  INDICADORES (view padrão)  */}
      {view === "custos" && <>
      <div className="no-print" style={{display:"flex",alignItems:"end",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
        <div style={{flex:"1 1 12rem",minWidth:0}}><Sel label="Escopo da análise" value={filterObra} onChange={escolherEscopoObra} options={[{ v: "all", l: "Todas as obras" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]}/></div>
        <Btn onClick={exportObraCosts} v="ghost"><Ic n="download" s={14}/> Exportar base</Btn>
      </div>
      <ScopeNote title="Indicadores e exportação">{filterObra === "all" ? "Todas as obras" : obraName(filterObra)} · {fullMonth(month)} {year}.</ScopeNote>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:"var(--arcd-space-2)"}}>
        <ReportMetric label="Mão de obra" value={fmt(totals.laborCost)} detail={`${totals.trabalhadores} profissionais ativos`} color={C.yellow} icon="users"/>
        <ReportMetric label="Custo por m²" value={totals.areaM2>0?fmt(totalLaborCostPerM2):"Sem área"} detail={`${totals.areaM2.toLocaleString("pt-BR")} m² analisados`} color={totals.areaM2>0?C.green:C.muted} icon="ruler"/>
        <ReportMetric label="Custo total" value={fmt(totals.totalCost)} detail={`${fmt(totals.benefitCost)} em VT/VR`} color={C.blue} icon="wallet"/>
        <ReportMetric label="Registros críticos" value={totals.faltas+totals.semRegistro} detail={`${totals.faltas} faltas · ${totals.semRegistro} sem registro`} color={(totals.faltas+totals.semRegistro)>0?C.red:C.green} icon="alert"/>
      </div>

      <Suspense fallback={<LoadingState label="gráfico"/>}>
        <LazyRelatoriosChartPanel byObra={byObra} chartMode={chartMode} setChartMode={setChartMode} highlightObra={highlightObra} setHighlightObra={setHighlightObra}/>
      </Suspense>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-2)" }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"var(--arcd-space-2)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",color:"var(--arcd-text-secondary)"}}>Leitura técnica por obra</p>{highlightObra&&<button onClick={()=>setHighlightObra("")} style={{border:0,background:"transparent",color:C.yellowD,fontSize:"var(--arcd-type-control)",fontWeight:600,cursor:"pointer"}}>Limpar destaque</button>}</div>
        {[...filteredRows].sort((a,b)=>Number(b.id===highlightObra)-Number(a.id===highlightObra)).map(r => (
          <div key={r.id} onClick={()=>setHighlightObra(r.id)} className="lift-card" style={{ background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid ${highlightObra===r.id?C.yellow:C.line}`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-3)",cursor:"pointer",opacity:highlightObra&&highlightObra!==r.id?0.72:1,boxShadow:highlightObra===r.id?`0 8px 24px ${C.yellow}12`:C.shHair }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--arcd-space-2)", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontFamily:FONT_DISPLAY, fontWeight:600,fontSize:"var(--arcd-type-card-title)" }}>{r.name}</p>
                <p style={{ color: "var(--arcd-text-secondary)", fontSize:"var(--arcd-type-label)",marginTop:"var(--arcd-space-half)" }}>
                  Área: {r.areaM2 > 0 ? `${r.areaM2.toLocaleString("pt-BR")} m²` : "não cadastrada"} · {contar(r.trabalhadores,"trabalhador","trabalhadores")}
                </p>
                <p style={{ color: "var(--arcd-text-muted)", fontSize:"var(--arcd-type-label)",marginTop:"var(--arcd-space-half)" }}>
                  {r.presentes} presentes · {r.meiodia} meios períodos · {r.faltas} faltas · {r.semRegistro} sem registro
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: C.yellow, fontWeight:600 }}>{fmt(r.laborCost)}</p>
                <p style={{ color: r.areaM2 > 0 ? C.green : "var(--arcd-text-secondary)", fontSize: "var(--arcd-type-body)", fontWeight:600 }}>
                  {r.areaM2 > 0 ? `${fmt(r.laborCostPerM2)}/m` : "sem m"}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--arcd-space-1)", marginTop: "var(--arcd-space-2)" }}>
              {[
                ["Feriados pagos", fmt(r.holidayPay), C.green],
                ["VT/VR", fmt(r.benefitCost), C.blue],
                ["Total", fmt(r.totalCost), C.yellow],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid var(--arcd-border-subtle)`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-2) var(--arcd-space-2)" }}>
                  <p style={{ fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:600,letterSpacing:.5 }}>{label}</p>
                  <p style={{ color:"var(--arcd-text-primary)",fontWeight:600,fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--arcd-surface-card)", border: `var(--arcd-border-width) solid var(--arcd-border-default)`, padding: "var(--arcd-space-3)" }}>
        <h3 style={{ fontFamily:FONT_DISPLAY, color: C.yellow, textTransform: "uppercase", marginBottom: "var(--arcd-space-2)" }}>Top custos do mês</h3>
        {topCost.length === 0 && <p style={{ color: "var(--arcd-text-secondary)", fontSize: "var(--arcd-type-body)" }}>Nenhum custo lançado no período.</p>}
        {topCost.map(i => (
          <div key={`${i.name}-${i.obra}`} style={{ borderTop: `var(--arcd-border-width) solid var(--arcd-border-default)`, padding: "var(--arcd-space-2) 0", display: "flex", justifyContent: "space-between" }}>
            <div><p style={{ fontWeight:600 }}>{i.name}</p><p style={{ color: "var(--arcd-text-secondary)", fontSize: "var(--arcd-type-body)" }}>{i.obra}</p></div>
            <p style={{ color: C.yellow, fontWeight:600 }}>{fmt(i.total)}</p>
          </div>
        ))}
      </div>
      </> /* fim view==="custos" */}
    </div>
  );
}


//
// RELATÓRIO MENSAL COMPLETO POR OBRA
//

/** @param {PeriodReportProps} props */
function RelatorioMensal({ data, year, month, showToast }) {
  /** @type {MonthlyRow[]} */
  const rows   = useMemo(() => calcRelatorioMensal(data, year, month), [year, month,
    data.obras, data.attendance, data.employees, data.pagsTerceiros, data.payments,
    data.terceirizados, data.outrasDesp, data.pedidos, data.medicoes, data.rescisoes,
    data.equipamentos, data.locacoesEquip, data.advances]);
  const period = `${fullMonth(month)} ${year}`;

  // Totais consolidados
  const tot = rows.reduce((acc, r) => ({
    received:       acc.received       + r.received,
    revenueEsp:     acc.revenueEsp     + r.revenueEsperada,
    laborCost:      acc.laborCost      + r.moData.laborCost,
    benefitCost:    acc.benefitCost    + r.moData.benefitCost,
    tercCost:       acc.tercCost       + r.tercCost,
    rescTotal:      acc.rescTotal      + r.rescTotal,
    adiantTotal:    acc.adiantTotal    + r.adiantTotal,
    totalDespesas:  acc.totalDespesas  + r.totalDespesas,
    margem:         acc.margem         + r.margem,
  }), { received:0, revenueEsp:0, laborCost:0, benefitCost:0, tercCost:0, rescTotal:0, adiantTotal:0, totalDespesas:0, margem:0 });

  //  PDF
  const gerarPDF = () => {
    /** @param {MonthlyRow} r @returns {import("../../reports/legacy-standard.js").ReportTable} */
    const tabelaObra = r => ({
      titulo: r.obra.name,
      descricao: [
        `${CONTRACT_LABELS[r.obra.contractType]||"Contrato"} · ${r.activeEmps} func. ativos · ${r.activeTercs} terceiros · ${r.presencaDias} presenças`,
        r.tercDetalhes.length ? `Terceirizados pagos: ${r.tercDetalhes.map(p=>`${p.tercName||"-"} (${fmt(p.amount)}, ${fmtDateFull(p.date)})`).join("; ")}` : "",
        r.rescDetalhes.length ? `Rescisões: ${r.rescDetalhes.map(rd=>`${rd.empName||"-"} (${fmt(rd.totalLiquido)}, ${fmtDateFull(rd.demissao)})`).join("; ")}` : "",
      ].filter(Boolean).join(" — "),
      headers: ["Descrição", { label:"Valor", num:true }],
      rows: [
        ["(+) Receita recebida", escapeHtml(fmt(r.received))],
        ["(+) Receita esperada (contrato)", escapeHtml(fmt(r.revenueEsperada))],
        ["(-) Mão de obra própria", escapeHtml(fmt(r.moData.laborCost))],
        ["(-) Benefícios (VT/VR)", escapeHtml(fmt(r.moData.benefitCost))],
        ["(-) Terceirizados", escapeHtml(fmt(r.tercCost))],
        ...(r.rescTotal>0 ? [["(-) Rescisões", escapeHtml(fmt(r.rescTotal))]] : []),
        ...(r.adiantTotal>0 ? [["(-) Adiantamentos", escapeHtml(fmt(r.adiantTotal))]] : []),
        ["Total de despesas", escapeHtml(fmt(r.totalDespesas))],
        ["Margem esperada", escapeHtml(fmt(r.margemEsperada))],
      ],
      totalRow: [`Margem (${pct1(r.margemPct)})`, escapeHtml(fmt(r.margem))],
    });

    const html = montarRelatorioPadraoHtml({
      data,
      titulo: "Relatório mensal",
      subtitulo: period,
      kpis: [
        { label: "Receita recebida", value: fmt(tot.received) },
        { label: "Custo MO própria", value: fmt(tot.laborCost+tot.benefitCost) },
        { label: "Terceiros + rescisões", value: fmt(tot.tercCost+tot.rescTotal) },
        { label: "Margem global", value: fmt(tot.margem) },
      ],
      tabelas: [
        ...rows.map(tabelaObra),
        {
          titulo: "Consolidado geral",
          headers: ["Descrição", { label:"Valor", num:true }],
          rows: [
            ["(+) Receita recebida total", escapeHtml(fmt(tot.received))],
            ["(+) Receita esperada total", escapeHtml(fmt(tot.revenueEsp))],
            ["(-) Mão de obra própria", escapeHtml(fmt(tot.laborCost))],
            ["(-) Benefícios (VT/VR)", escapeHtml(fmt(tot.benefitCost))],
            ["(-) Terceirizados", escapeHtml(fmt(tot.tercCost))],
            ...(tot.rescTotal>0 ? [["(-) Rescisões", escapeHtml(fmt(tot.rescTotal))]] : []),
            ...(tot.adiantTotal>0 ? [["(-) Adiantamentos", escapeHtml(fmt(tot.adiantTotal))]] : []),
            ["Total de despesas", escapeHtml(fmt(tot.totalDespesas))],
          ],
          totalRow: ["Margem global", escapeHtml(fmt(tot.margem))],
        },
      ],
    });
    abrirRelatorioPadrao(html, showToast);
  };

  //  Excel
  const exportXLS = async () => {
    const XLSX = await carregarXLSX();
    const wb = XLSX.utils.book_new();

    // Aba 1 - Resumo consolidado
    const ws1 = XLSX.utils.aoa_to_sheet([
      [`Relatório Mensal - ${period}`],
      [`Empresa: ${data.config.companyName||"ArcD"}`],
      [],
      ["Indicador","Valor"],
      ["Receita recebida",        tot.received],
      ["Receita esperada",        tot.revenueEsp],
      ["(-) Mão de obra própria", tot.laborCost],
      ["(-) Benefícios",          tot.benefitCost],
      ["(-) Terceirizados",       tot.tercCost],
      ["(-) Rescisões",           tot.rescTotal],
      ["(-) Adiantamentos",       tot.adiantTotal],
      ["Total despesas",          tot.totalDespesas],
      ["Margem global",           tot.margem],
    ]);
    ws1["!cols"] = [{wch:28},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

    // Aba 2 - Detalhe por obra
    const header2 = ["Obra","Tipo Contrato","Recebido","Receita Esp.","MO Própria","Benefícios","Terceiros","Rescisões","Adiantamentos","Total Desp.","Margem","Margem %","Presenças","Faltas","Func.Ativos","Terceiros Ativos"];
    const body2 = rows.map(r=>[
      r.obra.name,
      CONTRACT_LABELS[r.obra.contractType]||r.obra.contractType,
      r.received, r.revenueEsperada,
      r.moData.laborCost, r.moData.benefitCost,
      r.tercCost, r.rescTotal, r.adiantTotal, r.totalDespesas,
      r.margem, r.margemPct.toFixed(1)+"%",
      r.presencaDias, r.faltas, r.activeEmps, r.activeTercs,
    ]);
    const total2 = ["TOTAL","",tot.received,tot.revenueEsp,tot.laborCost,tot.benefitCost,tot.tercCost,tot.rescTotal,tot.adiantTotal,tot.totalDespesas,tot.margem,"","","","",""];
    const ws2 = XLSX.utils.aoa_to_sheet([[`Detalhe por obra - ${period}`],[],header2,...body2,total2]);
    ws2["!cols"] = [22,16,12,12,12,12,12,12,12,12,12,10,10,8,10,12].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws2, "Por Obra");

    // Aba 3 - Pagamentos recebidos
    const h3=["Data","Obra","Valor","Descrição"];
    const b3=rows.flatMap(r=>r.recDetalhes.map(p=>[p.date, r.obra.name, p.amount, p.description]));
    const ws3=XLSX.utils.aoa_to_sheet([[`Pagamentos recebidos - ${period}`],[],h3,...b3]);
    ws3["!cols"]=[12,22,12,30].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws3, "Recebimentos");

    // Aba 4 - Terceiros
    const h4=["Data","Obra","Terceirizado","Especialidade","Valor","Descrição"];
    const b4=rows.flatMap(r=>r.tercDetalhes.map(p=>[p.date,r.obra.name,p.tercName||"-",p.specialty||"-",p.amount,p.description||"-"]));
    const ws4=XLSX.utils.aoa_to_sheet([[`Pagamentos terceiros - ${period}`],[],h4,...b4]);
    ws4["!cols"]=[12,22,20,14,12,28].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws4, "Terceiros");

    // Aba 5 - Rescisões
    const h5=["Obra","Funcionário","CPF","Admissão","Rescisão","Tipo","Total Líquido"];
    const b5=rows.flatMap(r=>r.rescDetalhes.map(rc=>[r.obra.name,rc.empName||"-",rc.empCPF||"-",rc.admissao,rc.demissao,TIPO_LABEL[rc.tipo]||rc.tipo,rc.totalLiquido]));
    if(b5.length>0){
      const ws5=XLSX.utils.aoa_to_sheet([[`Rescisões - ${period}`],[],h5,...b5]);
      ws5["!cols"]=[22,22,14,12,12,30,12].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws5, "Rescisões");
    }

    await XLSX.writeFile(wb, `arcd-relatorio-${year}-${String(month+1).padStart(2,"0")}.xlsx`);
  };

  //  UI
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}} className="anim">

      <PageHero
        title="Relatório executivo"
        description="Visão consolidada de receita, custo e resultado por obra."
        actions={<span style={{display:"inline-flex",padding:"var(--arcd-space-1) var(--arcd-space-2)",border:`var(--arcd-border-width) solid var(--arcd-border-default)`,borderRadius:"var(--arcd-radius-control)",background:"var(--arcd-surface-card)",color:C.yellowD,fontSize:"var(--arcd-type-caption)",fontWeight:600,letterSpacing:.3}}>{fullMonth(month)} · {year}</span>}
      />

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"var(--arcd-space-2)"}}>
        <ReportMetric label="Receita recebida" value={fmt(tot.received)} detail="Caixa realizado no período" color={C.yellow} icon="wallet"/>
        <ReportMetric label="Margem global" value={fmt(tot.margem)} detail={tot.received?`${((tot.margem/tot.received)*100).toFixed(1)}% da receita`:"Sem receita no período"} color={(tot.margem>0?C.green:tot.margem<0?C.red:C.muted)} icon="trending"/>
        <ReportMetric label="Total de despesas" value={fmt(tot.totalDespesas)} detail="Custos diretos e benefícios" color={C.red} icon="receipt"/>
        <ReportMetric label="Receita esperada" value={fmt(tot.revenueEsp)} detail="Posição contratual estimada" color={C.text} icon="target"/>
      </div>

      {/* Ações */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"var(--arcd-space-2)"}}>
        <Btn onClick={gerarPDF} v="danger" full><Ic n="file"/> Relatório PDF</Btn>
        <Btn onClick={exportXLS} v="success" full><Ic n="download"/> Excel Completo</Btn>
      </div>

      {/* Cards por obra */}
      {rows.map(r => {
        const margemColor = r.margem >= 0 ? C.green : C.red;
        return (
          <div key={r.obra.id} style={{
            background:"var(--arcd-surface-card)", border:`var(--arcd-border-width) solid var(--arcd-border-default)`,
            borderTop:`2px solid ${margemColor}`, borderRadius:"var(--arcd-box-radius)", overflow:"hidden",
          }}>
            {/* Header da obra */}
            <div style={{padding:"var(--arcd-space-3) var(--arcd-space-4)",borderBottom:`var(--arcd-border-width) solid var(--arcd-border-subtle)`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"var(--arcd-space-2)"}}>
              <div>
                <p style={{fontFamily:FONT_DISPLAY,fontWeight:600,fontSize:"var(--arcd-type-section-title)",letterSpacing:.3}}>{r.obra.name}</p>
                <div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap",marginTop:"var(--arcd-space-1)"}}>
                  <Badge color={C.yellow}>{CONTRACT_LABELS[r.obra.contractType]||"Contrato"}</Badge>
                  <Badge color={C.blue}>{r.activeEmps} func.</Badge>
                  {r.activeTercs>0&&<Badge color={C.orange}>{r.activeTercs} terceiros</Badge>}
                  <Badge color={C.muted}>{r.presencaDias} presenças</Badge>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontFamily:FONT_DISPLAY,fontWeight:600,fontSize:"var(--arcd-type-section-title)",color:margemColor,letterSpacing:.5,lineHeight:1}}>{fmt(r.margem)}</p>
                <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>margem {r.margemPct.toFixed(0)}%</p>
              </div>
            </div>

            {/* DRE mini */}
            <div style={{padding:"var(--arcd-space-2) var(--arcd-space-4)",display:"flex",flexDirection:"column",gap:0}}>
              {/* Receitas */}
              <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:"var(--arcd-text-secondary)",textTransform:"uppercase",letterSpacing:.8,marginBottom:"var(--arcd-space-1)"}}>Receitas</p>
              {/** @type {SummaryRow[]} */ ([
                ["Recebido no mês",  r.received,         C.green],
                ["Esperado (contrato)", r.revenueEsperada, C.subtle],
              ]).map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"var(--arcd-space-half) 0",borderBottom:`var(--arcd-border-width) solid var(--arcd-border-subtle)44`}}>
                  <p style={{fontSize:"var(--arcd-type-body)",color:c}}>{l}</p>
                  <p style={{fontSize:"var(--arcd-type-body)",color:c,fontWeight:600}}>{fmt(v)}</p>
                </div>
              ))}

              {/* Despesas */}
              <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:"var(--arcd-text-secondary)",textTransform:"uppercase",letterSpacing:.8,marginTop:"var(--arcd-space-2)",marginBottom:"var(--arcd-space-1)"}}>Despesas</p>
              {/** @type {SummaryRow[]} */ ([
                ["(-) MO própria",       r.moData.laborCost,   C.orange],
                ["(-) Benefícios VT/VR", r.moData.benefitCost, C.muted],
                ["(-) Terceirizados",    r.tercCost,           C.purple, r.tercCost===0],
                ["(-) Rescisões",        r.rescTotal,          C.red,    r.rescTotal===0],
                ["(-) Adiantamentos",    r.adiantTotal,        C.muted,  r.adiantTotal===0],
              ]).filter(([,,, skip])=>!skip).map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"var(--arcd-space-half) 0",borderBottom:`var(--arcd-border-width) solid var(--arcd-border-subtle)44`}}>
                  <p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)"}}>{l}</p>
                  <p style={{fontSize:"var(--arcd-type-body)",color:c,fontWeight:600}}>{fmt(v)}</p>
                </div>
              ))}

              {/* Totais */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-2)"}}>
                <div style={{background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid var(--arcd-border-default)`,padding:"var(--arcd-space-2) var(--arcd-space-2)",borderRadius:"var(--arcd-box-radius)"}}>
                  <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:600}}>Total despesas</p>
                  <p style={{fontSize:"var(--arcd-type-card-title)",color:C.red,fontWeight:600,marginTop:"var(--arcd-space-half)"}}>{fmt(r.totalDespesas)}</p>
                </div>
                <div style={{background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid ${margemColor}44`,padding:"var(--arcd-space-2) var(--arcd-space-2)",borderRadius:"var(--arcd-box-radius)"}}>
                  <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:600}}>Margem esp.</p>
                  <p style={{fontSize:"var(--arcd-type-card-title)",color:(r.margemEsperada>0?C.green:r.margemEsperada<0?C.red:C.muted),fontWeight:600,marginTop:"var(--arcd-space-half)"}}>{fmt(r.margemEsperada)}</p>
                </div>
              </div>

              {/* Detalhe terceiros/rescisões se houver */}
              {r.tercDetalhes.length>0&&(
                <div style={{marginTop:"var(--arcd-space-2)"}}>
                  <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.purple,textTransform:"uppercase",marginBottom:"var(--arcd-space-half)"}}>Terceiros pagos</p>
                  {r.tercDetalhes.map(p=>(
                    <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",padding:"var(--arcd-space-half) 0"}}>
                      <span>{p.tercName||"-"} <span style={{color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-label)"}}>({fmtDateFull(p.date)})</span></span>
                      <span style={{color:C.purple,fontWeight:600}}>{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {r.rescDetalhes.length>0&&(
                <div style={{marginTop:"var(--arcd-space-2)"}}>
                  <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.red,textTransform:"uppercase",marginBottom:"var(--arcd-space-half)"}}>Rescisões</p>
                  {r.rescDetalhes.map(rc=>(
                    <div key={rc.id} style={{display:"flex",justifyContent:"space-between",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",padding:"var(--arcd-space-half) 0"}}>
                      <span>{rc.empName||"-"} <span style={{color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-label)"}}>({TIPO_LABEL[rc.tipo]||rc.tipo})</span></span>
                      <span style={{color:C.red,fontWeight:600}}>{fmt(rc.totalLiquido)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Totais finais */}
      <div style={{background:"var(--arcd-surface-card)",border:`2px solid ${C.yellow}`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-3) var(--arcd-space-4)"}}>
        <p style={{fontFamily:FONT_DISPLAY,fontWeight:600,fontSize:"var(--arcd-type-card-title)",color:C.yellow,textTransform:"uppercase",letterSpacing:.5,marginBottom:"var(--arcd-space-2)"}}>Consolidado Geral - {fullMonth(month)} {year}</p>
        {/** @type {SummaryRow[]} */ ([
          ["Receita recebida",  tot.received,          C.green],
          ["Receita esperada",  tot.revenueEsp,        C.subtle],
          ["MO própria",        tot.laborCost,         C.orange],
          ["Benefícios",        tot.benefitCost,       C.muted],
          ["Terceirizados",     tot.tercCost,          C.purple],
          ["Rescisões",         tot.rescTotal,         C.red],
          ["Adiantamentos",     tot.adiantTotal,       C.muted],
          ["Total despesas",    tot.totalDespesas,     C.red],
          ["Margem global",     tot.margem,            (tot.margem>0?C.green:tot.margem<0?C.red:C.muted)],
        ]).map(([l,v,c])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"var(--arcd-space-1) 0",borderBottom:`var(--arcd-border-width) solid var(--arcd-border-subtle)44`}}>
            <p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)"}}>{l}</p>
            <p style={{fontSize:"var(--arcd-type-body)",color:c,fontWeight:600}}>{fmt(v)}</p>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--arcd-space-2)"}}>
        <Btn onClick={gerarPDF} v="danger" full><Ic n="file"/> PDF</Btn>
        <Btn onClick={exportXLS} v="success" full><Ic n="download"/> Excel</Btn>
      </div>
    </div>
  );
}
