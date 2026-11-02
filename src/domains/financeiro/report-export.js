export const safeReportText=value=>{
 const text=String(value??'');
 return /^[\s\u0000-\u001f]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text)?`'${text}`:text;
};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export function financialReportSheets(report) {
 const {labels,filters,definition}=report;
 const metadata=[['Relatório',labels.report],['Base de cálculo',labels.basis],['Fórmula',labels.formula],['Fonte',report.source],['Moeda','Reais (R$)'],['Obra',labels.work],['Período',labels.period],['Agrupamento',labels.group],['Tipo',labels.direction],['Categoria',labels.category],['Conta vinculada',labels.account],['Situação',labels.status],['Busca',filters.query||'Sem busca'],['Data de posição',filters.kind==='due'?filters.asOf:'Não se aplica'],['Sem vencimento',filters.kind==='due'?(filters.includeUndated?'Incluídos':'Fora do recorte'):'Não se aplica'],['Gerado nesta consulta',report.generatedAt],['Quantidade de lançamentos',report.entries.length]];
 const groups=[[labels.group,definition.incoming,definition.outgoing,definition.net,'Lançamentos'],...report.groups.map(group=>[group.label,group.incoming/100,group.outgoing/100,group.net/100,group.items.length]),['TOTAL',report.summary.incoming/100,report.summary.outgoing/100,report.summary.net/100,report.entries.length]];
 const entries=[['Lançamento','Descrição','Obra','Cliente / fornecedor','Documento','Competência','Data do lançamento / movimento','Vencimento','Categoria','Conta vinculada','Situação','Tipo',filters.kind==='due'?'Saldo em aberto (R$)':'Valor da linha (R$)'],...report.entries.map(item=>[item.id,item.description,item.obra,item.counterparty||'Não informado',item.documentNumber||'Não informado',item.competence||'',item.date||'',item.dueDate||'',item.categoryLabel,item.account,item.statusLabel,item.direction==='in'?definition.incoming:definition.outgoing,item.amountCents/100])];
 return {Recorte:metadata,Resumo:groups,Lançamentos:entries};
}
export function reportCsv(report) {
 const rows=Object.entries(financialReportSheets(report)).flatMap(([name,values])=>[[name],...values,[]]);
 const encode=value=>`"${(typeof value==='number'?String(value).replace('.',','):safeReportText(value)).replaceAll('"','""')}"`;
 return '\uFEFF'+rows.map(row=>row.map(encode).join(';')).join('\r\n');
}
export function reportPrintHtml(report) {
 const sheets=financialReportSheets(report);
 const table=(rows,heading)=>`<h2>${escapeHtml(heading)}</h2><table>${rows.map((row,index)=>`<tr>${row.map(value=>`<${index===0?'th':'td'}>${escapeHtml(typeof value==='number'?value.toLocaleString('pt-BR',{maximumFractionDigits:2}):value)}</${index===0?'th':'td'}>`).join('')}</tr>`).join('')}</table>`;
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(report.labels.report)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#0d1b2e;font-size:11px}h1{font-size:20px}h2{font-size:15px;margin-top:24px}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{text-align:left;vertical-align:top;border-bottom:1px solid #d9dde2;padding:7px;overflow-wrap:anywhere}th{background:#f3f0e9}thead{display:table-header-group}.recorte{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.recorte p{margin:0;overflow-wrap:anywhere}.details{font-size:8px}@media print{button{display:none}}</style></head><body><div class="logo">MARCELL</div><h1>${escapeHtml(report.labels.report)}</h1><button onclick="window.print()">Imprimir / salvar PDF</button><div class="recorte">${sheets.Recorte.map(([key,value])=>`<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>`).join('')}</div>${table(sheets.Resumo,'Resumo do mesmo recorte')}<div class="details">${table(sheets.Lançamentos,'Todos os lançamentos do recorte')}</div></body></html>`;
}
