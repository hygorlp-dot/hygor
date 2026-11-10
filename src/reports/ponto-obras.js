import { marcellReportHtml } from './marcell-report.js';
import { apresentacaoJornada, COLUNAS_JORNADA, COLUNAS_RESUMO, dataRelatorio, horarioRelatorio, linhaResumo, tabelasRelatorioObras } from '../domains/ponto-eletronico/relatorio-obras.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const conferir=r=>{if(!r?.coberturaCompleta)throw Error('Conclua a consulta completa antes de exportar.');};
const celulas=(l,tag='td')=>l.map(v=>`<${tag}>${esc(v)}</${tag}>`).join('');
const tabela=(titulos,linhas)=>`<table><thead><tr>${celulas(titulos,'th')}</tr></thead><tbody>${linhas.map(l=>`<tr>${celulas(l)}</tr>`).join('')}</tbody></table>`;
const tomSaldo=n=>n>0?'credito':n<0?'debito':'';
export function htmlRelatorioPontoObras(r,{incluirAuditoria=false}={}){
 conferir(r);
 const resumo=r.grupos.map(g=>{
  const c=linhaResumo(g);if(g.resumo.parcial)c[0]+=' · parcial';
  return `<tr>${c.map((v,i)=>`<td class="${i===3&&g.resumo.creditosMinutos>0?'credito':i===4&&g.resumo.debitosMinutos>0?'debito':i===5?tomSaldo(g.resumo.saldoMinutos):''}">${esc(v)}</td>`).join('')}</tr>`;
 }).join('');
 const detalhes=r.grupos.map(g=>`<section><table class="jornadas"><thead><tr><th colspan="11" class="pessoa">${esc(g.nome)}${g.matricula?` · Matrícula ${esc(g.matricula)}`:''}${g.funcao?` · ${esc(g.funcao)}`:''} · Detalhamento diário</th></tr><tr>${celulas(COLUNAS_JORNADA,'th')}</tr></thead>${g.dias.map(d=>{
  const a=apresentacaoJornada(d,r.fuso);
  return `<tbody class="jornada"><tr>${a.celulas.map((v,i)=>`<td class="${i===9?tomSaldo(d.saldoMinutos):''}">${esc(v)}</td>`).join('')}</tr>${a.sublinha?`<tr class="sublinha"><td colspan="11">${esc(a.sublinha)}</td></tr>`:''}</tbody>`;
 }).join('')}</table></section>`).join('');
 const pendencias=r.pendencias.length?`<section><h2>Pendências e observações</h2>${tabela(['Funcionário','Data','Pendência','Observação'],r.pendencias.map(p=>[p.nome,p.data?dataRelatorio(p.data):'—',p.pendencia,p.observacao]))}</section>`:'';
 const auditoria=incluirAuditoria?`<section class="auditoria"><h2>Anexo de auditoria — marcações e tratamentos originais</h2>${tabelasRelatorioObras(r,{incluirAuditoria:true}).filter(t=>t.nome==='Auditoria').map(t=>tabela(t.colunas.map(c=>c.titulo),t.linhas)).join('')}</section>`:'';
 return marcellReportHtml(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de ponto e banco de horas</title><style>
 @page{size:A4 landscape;margin:12mm 10mm 16mm;@bottom-left{content:"Relatório gerencial de consulta. Não substitui os documentos oficiais de registro de ponto.";font:6pt Nimbus Sans,Arial,sans-serif;color:#536171}}
 body{margin:0}header{display:flex;gap:18px;align-items:center;border-bottom:1px solid #d9dde2;padding-bottom:8px;margin-bottom:12px}header .mrc-report-brand{flex:none;margin:0}header h1{margin:0 0 6px}header p{margin:3px 0}.contexto{display:flex;flex-wrap:wrap;gap:4px 20px}.contexto span{display:inline-block}h2{margin:14px 0 6px;break-after:avoid}table{width:100%;border-collapse:collapse;margin:8px 0 14px;table-layout:auto}th,td{padding:4px 5px;border-bottom:1px solid #d9dde2;text-align:left;vertical-align:top}th{white-space:normal}tbody.jornada,tr{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}.pessoa{font-weight:600!important;text-align:left;background:#fff!important;border-top:1px solid #d9dde2;padding-top:12px}.sublinha td{font-size:9px!important;color:#536171;padding-top:0}.credito{color:#2e6652}.debito{color:#a63b3b}.limite{font-size:10px;color:#536171;margin:5px 0}.auditoria{break-before:page}footer{font-size:8px;color:#536171;margin-top:10px}body[data-marcell-report]>header.report-header{padding:6px 0!important;border-bottom-color:#d9dde2!important}.toolbar{margin-bottom:10px}@media print{.toolbar,footer{display:none}header{break-inside:avoid}}
 </style></head><body><header class="report-header"><div class="logo-box">MARCELL</div><div><h1>Relatório de ponto e banco de horas</h1><div class="contexto"><span><strong>Obra:</strong> ${esc(r.obra)}</span><span><strong>Período:</strong> ${esc(dataRelatorio(r.periodo.de))} a ${esc(dataRelatorio(r.periodo.ate))}</span><span><strong>Funcionário:</strong> ${esc(r.funcionario)}</span></div><p>Emissão: ${esc(horarioRelatorio(r.emitidoEm||r.consultadoEm,r.fuso,true))} · ${esc(r.fuso)}</p></div></header><div class="toolbar"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div><h2>Resumo do período</h2><p class="limite">Saldo estimado do período. Saldo anterior e compensações não disponíveis; saldo final não consolidado. Totais parciais usam valores verificáveis; saldos somam apenas jornadas válidas.</p><table><thead><tr>${celulas(COLUNAS_RESUMO,'th')}</tr></thead><tbody>${resumo}</tbody></table>${detalhes}${pendencias}${auditoria}<footer>${esc(r.nota)}</footer></body></html>`,{watermark:false});
}
export function exportarPdfPontoObras(r,options){
 const html=htmlRelatorioPontoObras(r,options),win=window.open('','_blank');
 if(!win)throw Error('Permita abrir a prévia para imprimir ou salvar o PDF.');
 win.opener=null;win.document.open();win.document.write(html);win.document.close();return win;
}
export async function exportarExcelPontoObras(r,options){
 conferir(r);const {writeTables}=await import('../lib/spreadsheet.js');
 await writeTables(tabelasRelatorioObras(r,options),`Ponto-por-obra-${r.periodo.de}-${r.periodo.ate}.xlsx`);
}
