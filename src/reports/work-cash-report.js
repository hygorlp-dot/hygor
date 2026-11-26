// @ts-check
import { workCashNature } from "../domains/financeiro/work-cash.js";
import { escapeHtml, fmt, fmtDateFull } from "../legacy/format.js";
import { abrirRelatorioPadrao, montarRelatorioPadraoHtml } from "./legacy-standard.js";

/** @typedef {{data:string, tipo:string, descricao?:string, valor:number|string, saldoAcumulado:number}} CashReportMovement */
/** @typedef {{movimentos:CashReportMovement[], totalAportes:number, totalDespesas:number, totalDevolucoes:number, saldo:number}} WorkCashReport */

// Extrato/relatório financeiro do caixa de uma obra, em PDF. Compartilhado
// entre a tela de Caixa de Obra e o hub de Relatórios, para não duplicar o
// mesmo template em dois lugares.
/**
 * @param {import("./legacy-standard.js").ReportBrandData} data
 * @param {{name:string}|null|undefined} obra
 * @param {WorkCashReport} caixa
 * @param {import("./legacy-standard.js").ReportToast} showToast
 */
export function gerarRelatorioCaixaObraPDF(data, obra, caixa, showToast) {
  if (!obra) return;
  const c = caixa;
  const movs = [...c.movimentos].reverse(); // ordem cronológica
  const html = montarRelatorioPadraoHtml({
    data,
    titulo: "Extrato do Caixa de Obra",
    subtitulo: obra.name,
    kpis: [
      { label: "Entradas", value: fmt(c.totalAportes) },
      { label: "Despesas", value: fmt(c.totalDespesas) },
      { label: "Devoluções", value: fmt(c.totalDevolucoes) },
      { label: "Saldo em caixa", value: fmt(c.saldo) },
    ],
    tabelas: [{
      headers: ["Data", "Tipo", "Descrição", { label: "Valor", num: true }, { label: "Saldo", num: true }],
      rows: movs.map(m => [
        escapeHtml(fmtDateFull(m.data)),
        escapeHtml(workCashNature(m)),
        escapeHtml(m.descricao || "-"),
        `${m.tipo === "aporte" ? "+" : "-"} ${escapeHtml(fmt(Number(m.valor)))}`,
        escapeHtml(fmt(m.saldoAcumulado)),
      ]),
      vazio: "Nenhum lançamento neste caixa.",
    }],
  });
  abrirRelatorioPadrao(html, showToast);
}
