import {cltPayslipHtml} from "./clt-report.js";
import {marcellReportHtml} from "../../reports/marcell-report.js";
export {reviewMonthlyPayslip} from "./clt-review.js";
export function cltBatchReport(data,reviews){
  const ready=reviews.filter(r=>r.draft&&!r.errors.length);
  if(!ready.length)throw Error('Nenhum holerite aprovado para exportar.');
  return marcellReportHtml(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Holerites aprovados</title><style>@page{size:A4 portrait;margin:15mm}.payroll-page+ .payroll-page{break-before:page}table{width:100%;border-collapse:collapse}td,th{padding:7px;border-bottom:1px solid #ccd3dc;text-align:left}.num{text-align:right}.identity{display:grid;grid-template-columns:1fr 1fr;gap:10px}.totals{display:flex;flex-wrap:wrap;gap:15px;margin:20px 0}.signature{margin-top:40px;border-top:1px solid #ccd3dc}.notes{white-space:pre-wrap}</style></head><body>${ready.map(r=>`<section class="payroll-page">${cltPayslipHtml({company:data.config,employee:r.employee,draft:r.draft,result:r.result,bodyOnly:true})}</section>`).join('')}<script>window.onload=()=>window.print();</script></body></html>`);
}
