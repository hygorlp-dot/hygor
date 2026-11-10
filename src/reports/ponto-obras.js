import { marcellReportHtml } from './marcell-report.js';
import { tabelasRelatorioObras } from '../domains/ponto-eletronico/relatorio-obras.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const conferir=r=>{if(!r?.coberturaCompleta)throw Error('Conclua a consulta completa antes de exportar.');};
export function htmlRelatorioPontoObras(r){
 conferir(r);
 return marcellReportHtml(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Batidas e banco de horas por obra</title><style>@page{size:A4 landscape;margin:12mm}table{width:100%;border-collapse:collapse;margin:12px 0 24px}td,th{padding:6px;border-bottom:1px solid #d9dde2;text-align:left;overflow-wrap:anywhere}.consulta :is(th,td):first-child{width:110px;white-space:nowrap}h2{break-after:avoid}tr{break-inside:avoid}</style></head><body><h1>Batidas e banco de horas por obra</h1><p>Relatório de consulta — não substitui comprovante oficial, AFD ou AEJ.</p><button onclick="window.print()">Imprimir / salvar PDF</button>${tabelasRelatorioObras(r).map(t=>`<h2>${esc(t.nome)}</h2><table class="${t.nome==='Consulta'?'consulta':''}"><thead><tr>${t.colunas.map(c=>`<th>${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>${t.linhas.map(l=>`<tr>${l.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}</body></html>`);
}
export function exportarPdfPontoObras(r){
 const html=htmlRelatorioPontoObras(r),win=window.open('','_blank');
 if(!win)throw Error('Permita abrir a prévia para imprimir ou salvar o PDF.');
 win.opener=null;win.document.open();win.document.write(html);win.document.close();return win;
}
export async function exportarExcelPontoObras(r){
 conferir(r);const {writeTables}=await import('../lib/spreadsheet.js');
 await writeTables(tabelasRelatorioObras(r),`Ponto-por-obra-${r.periodo.de}-${r.periodo.ate}.xlsx`);
}
