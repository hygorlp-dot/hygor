import { adjustableTablesScript } from "./adjustable-tables.js";
import { MARCELL_LOGO } from "../brand/identity.js";
import regularFont from "./assets/NimbusSans-Regular.woff2?inline";
import boldFont from "./assets/NimbusSans-Bold.woff2?inline";

// Atualiza apenas a assinatura visual dos documentos. Tabelas, scripts,
// estilos, CNPJ e a configuração persistida continuam intactos.
function atualizarAssinatura(html) {
  return html.split(/(<(?:table|script|style)\b[^>]*>[\s\S]*?<\/(?:table|script|style)>)/gi).map((parte, i) => i % 2 ? parte : parte.replace(
    /<(h[1-6]|p|b|strong|small|span|div|footer)\b([^>]*)>([^<>]*)<\/\1>/gi,
    (tag, nome, atributos, texto) => `<${nome}${atributos}>${texto.replace(/^(\s*(?:Gerado por\s+|Empresa:\s*)?)ArcD\s+(?:Construtech|Construtora|Obras)(?=\s*(?:$|em\s+\d))/gi, "$1MARCELL")}</${nome}>`,
  )).join("");
}

// Presentation only: the existing report remains responsible for its data,
// totals, columns, paper size, signatures and legal company identification.
export function marcellReportHtml(html, { adjustableTables = false } = {}) {
  if (/<body\b[^>]*\bdata-marcell-report=/i.test(html)) return html;
  const a2 = /@page\s*\{\s*size\s*:\s*A2\b/i.test(html);
  const dense = /<title>Memória de Cálculo/i.test(html);
  const columns = Math.max(0, ...[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
    [...row.matchAll(/<th\b([^>]*)>/gi)].reduce((n, [, attrs]) => n + Number(attrs.match(/colspan=["']?(\d+)/i)?.[1] || 1), 0)));
  const wide = !a2 && columns > 12;
  const format = a2 ? "a2" : wide ? "wide" : dense ? "dense" : "standard";
  const logo = `<img class="mrc-report-logo" src="${MARCELL_LOGO}" alt="MARCELL - Engenharia e construção">`;
  const brand = `<div class="mrc-report-brand">${logo}</div>`;
  let branded = false;
  let result = atualizarAssinatura(html).replace(/<div class="(?:logo|logo-box)">(?:MARCELL|ArcD)<\/div>/g, () => {
    branded = true;
    return brand;
  }).replace(/<img\b[^>]*class="logo"[^>]*>/g, () => {
    branded = true;
    return logo;
  });
  // Standalone print documents use local fonts, never a third-party stylesheet.
  result = result.replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, "");
  // Chromium does not recognise the named A2 size: explicit dimensions avoid
  // a silent fallback to Letter that shrinks or clips a planning sheet.
  const paper = a2 ? "size:594mm 420mm;margin:8mm;" : wide ? "size:A3 landscape;margin:12mm 10mm 14mm;" : /@page\s*\{[^}]*\bsize\s*:/i.test(html) ? "" : "size:A4;margin:12mm 10mm 14mm;";
  const css = `<style id="marcell-report-theme">
@font-face{font-family:"Nimbus Sans";font-style:normal;font-weight:400 500;font-display:swap;src:url("${regularFont}") format("woff2")}
@font-face{font-family:"Nimbus Sans";font-style:normal;font-weight:600 700;font-display:swap;src:url("${boldFont}") format("woff2")}
@page{${paper}@bottom-right{content:"Página " counter(page) " de " counter(pages);font:7pt "Nimbus Sans",Arial,sans-serif;color:#536171}}
body[data-marcell-report]{font-family:"Nimbus Sans",Arial,sans-serif!important;font-size:11px!important;line-height:1.45;color:#0d1b2e;background:#fff}
body[data-marcell-report] :is(p,div,span,li,td,th,b,strong,small,h1,h2,h3,button,em,a,figcaption){font-family:"Nimbus Sans",Arial,sans-serif!important}
body[data-marcell-report] h1{font-size:18px!important;font-weight:500!important;line-height:1.25;letter-spacing:-.015em}
body[data-marcell-report] h2{font-size:13px!important;font-weight:500!important;line-height:1.35;letter-spacing:0;text-transform:none}
body[data-marcell-report] h3{font-size:11.5px!important;font-weight:500!important;line-height:1.4}
body[data-marcell-report] table{font-size:10px;font-variant-numeric:tabular-nums}
body[data-marcell-report] :is(td,th){border-color:#d9dde2!important}
body[data-marcell-report] th{font-size:9px!important;font-weight:500!important;line-height:1.35;letter-spacing:0!important;text-transform:none!important;background:#edf3f7!important;color:#0d1b2e!important;white-space:normal}
body[data-marcell-report] td{font-size:10px!important;line-height:1.4}
body[data-marcell-report] :is(.num,.n,.r,.value,.valor){font-variant-numeric:tabular-nums}
body[data-marcell-report] :is(.num,.n,td.r,th.r){text-align:right}
body[data-marcell-report] thead{display:table-header-group}
body[data-marcell-report] tfoot{display:table-row-group}
body[data-marcell-report] tr{break-inside:avoid;page-break-inside:avoid}
body[data-marcell-report] :is(tfoot,.total){font-weight:600}
body[data-marcell-report] tfoot tr.tot td{background:#f3f0e9!important;color:#0d1b2e!important}
body[data-marcell-report] :is(.cabecalho,.ph,.head){border-bottom:1px solid #b9985b!important}
body[data-marcell-report]>header{background:#fff!important;color:#0d1b2e!important;border-bottom:1px solid #b9985b!important;padding:12px 0!important}
body[data-marcell-report]>header p{color:#536171!important}
body[data-marcell-report] :is(.kpi,.box,.summary){box-shadow:none}
body[data-marcell-report] .kpi{border-top:1px solid #b9985b!important}
body[data-marcell-report] :is(.kpi span,.meta small){font-weight:400!important;letter-spacing:0!important}
body[data-marcell-report] .kpi b{font-size:15px!important;font-weight:600}
body[data-marcell-report] :is(.footer,.foot,footer){color:#536171!important;font-size:9px!important}
body[data-marcell-report] .mrc-report-brand{display:flex;align-items:center;break-inside:avoid;margin:0 0 10px;padding:0;background:transparent}
body[data-marcell-report] .mrc-report-logo{display:block!important;width:108px!important;height:auto!important;max-width:108px!important;max-height:none!important;object-fit:contain!important;padding:0!important;border:0!important}
body[data-marcell-report] .mrc-report-watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:65%;max-width:420px;opacity:.045;pointer-events:none;z-index:0;line-height:0}
body[data-marcell-report] .mrc-report-watermark img{display:block;width:100%;height:auto;object-fit:contain}
body[data-marcell-report][data-marcell-format="dense"] :is(td,th){font-size:8px!important;padding:4px 3px;white-space:normal;overflow-wrap:normal}
body[data-marcell-report][data-marcell-format="dense"] td.r{white-space:nowrap}
body[data-marcell-report][data-marcell-format="a2"] :is(td,th){font-size:6.6pt!important;line-height:normal;white-space:nowrap}
body[data-marcell-report][data-marcell-format="a2"] .mrc-report-brand{margin:0 0 2mm}
body[data-marcell-report][data-marcell-format="wide"] table{table-layout:fixed}
body[data-marcell-report][data-marcell-format="wide"] :is(td.num,td.n){white-space:normal!important}
body[data-adjustable-tables] table[data-mrc-adjustable]{table-layout:fixed}
body[data-adjustable-tables] table[data-mrc-adjustable] td{font-size:var(--mrc-table-font,10px)!important;line-height:1.2!important;padding:var(--mrc-table-padding,2px) 4px!important;overflow-wrap:break-word}
body[data-adjustable-tables] table[data-mrc-adjustable] th{font-size:calc(var(--mrc-table-font,10px) - 1px)!important;line-height:1.2!important;padding:4px!important}
body[data-adjustable-tables] table[data-mrc-adjustable] td.num{white-space:normal!important;overflow-wrap:anywhere}
body[data-adjustable-tables] table[data-mrc-adjustable] tfoot td.num{white-space:nowrap!important;overflow-wrap:normal}
body[data-adjustable-tables] .section{break-before:auto!important;page-break-before:auto!important}
body[data-adjustable-tables][data-annex-new-page="true"] .section{break-before:page!important;page-break-before:always!important}
body[data-adjustable-tables] .section :is(h3,p){break-after:avoid}
.mrc-report-controls{background:#f3f0e9;border:1px solid #7a8591;padding:16px;margin-bottom:20px}
.mrc-report-controls__fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;margin:12px 0}
.mrc-report-controls label{display:flex;flex-direction:column;gap:6px;font-size:12px}
.mrc-report-controls select{padding:8px;background:white;color:#0d1b2e;border:1px solid #7a8591;font:inherit;min-height:36px;max-width:100%}
.mrc-report-controls input[type=range]{width:100%;accent-color:#0d1b2e}
.mrc-report-controls .mrc-report-controls__check{flex-direction:row;align-items:center;margin:12px 0}
.mrc-report-controls__actions{display:flex;gap:8px;flex-wrap:wrap}
.mrc-report-controls :is(input,select,button):focus-visible{outline:2px solid #7b6030;outline-offset:2px}
@media print{.mrc-report-controls{display:none!important}body[data-marcell-report]{-webkit-print-color-adjust:exact;print-color-adjust:exact}body[data-marcell-report] :is(button,.acoes,.toolbar,.print-btn,.btn-print,.print){display:none!important}body[data-marcell-report] .mrc-report-brand{break-after:avoid}}
@media screen{body[data-marcell-report]{max-width:1400px;margin-inline:auto}body[data-marcell-report] button{font-size:12px!important;font-weight:400!important;background:#0d1b2e!important;color:white!important;border:1px solid #0d1b2e;padding:9px 14px;border-radius:4px}body[data-marcell-report] :is(td,th){overflow-wrap:break-word}}
</style>`;
  result = result.replace(/<\/head>/i, `${css}</head>`);
  const watermark = `<div class="mrc-report-watermark" aria-hidden="true"><img src="${MARCELL_LOGO}" alt=""></div>`;
  result = result.replace(/<body\b([^>]*)>/i, `<body$1 data-marcell-report="true" data-marcell-format="${format}"${adjustableTables ? ' data-adjustable-tables="true"' : ""}>${watermark}${branded || a2 ? "" : brand}`);
  if (a2) result = result.replace(/<section class="page">/g, `<section class="page">${brand}`);
  // Printing from any existing button/automatic path waits for the actual
  // fonts and embedded brand. No totals or report content are recomputed.
  const readyScript = `<script>(()=>{const original=window.print.bind(window);const ready=Promise.resolve().then(async()=>{if(document.fonts){await Promise.all([document.fonts.load('400 11px "Nimbus Sans"'),document.fonts.load('600 11px "Nimbus Sans"')]);await document.fonts.ready;}await Promise.all([...document.querySelectorAll('.mrc-report-logo, .mrc-report-watermark img')].map(img=>img.decode?img.decode():Promise.resolve()));${adjustableTables ? adjustableTablesScript() : ""}});ready.catch(()=>{});window.__marcellReportReady=ready;let printing=false;window.print=async()=>{if(printing)return;printing=true;try{await ready;original();}catch{window.alert('Não foi possível carregar a identidade do relatório. Verifique a conexão e reabra o documento antes de imprimir.');}finally{printing=false;}};})();</script>`;
  return result.replace(/<\/body>/i, `${readyScript}</body>`);
}
