import {useEffect,useMemo,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {REPORT_TYPES,GROUP_LABELS,createReportLedger,buildFinancialReport,reportCategoryLabel} from '../../domains/financeiro/report-center.js';
import {financialReportSheets,reportCsv,reportPrintHtml,safeReportText} from '../../domains/financeiro/report-export.js';
import {marcellReportHtml} from '../../reports/marcell-report.js';
import './financial-reports.css';
const money=value=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const endOfMonth=month=>/^\d{4}-\d{2}$/.test(month)?new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10):'';

export default function FinancialReportCenter({data,calcPeriod,view,onViewChange,obraId,onObraChange,onOpen,loadSpreadsheet}) {
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const filters=useMemo(()=>({...view,obraId}),[view,obraId]);
 const bundle=useMemo(()=>createReportLedger(data,calcPeriod,filters),[data,calcPeriod,obraId,view.kind,view.start,view.end,view.asOf]);
 const report=useMemo(()=>buildFinancialReport(data,bundle,filters),[data,bundle,filters]);
 const categories=useMemo(()=>[...new Set([...bundle.ledger.events.map(item=>item.category).filter(Boolean),...bundle.extra.map(item=>item.category)])].sort((a,b)=>reportCategoryLabel(a).localeCompare(reportCategoryLabel(b),'pt-BR')),[bundle]);
 const page=Math.min(view.page||0,Math.max(0,Math.ceil(report.groups.length/50)-1));
 useEffect(()=>{setExportError('');},[filters]);
 const change=(key,value)=>onViewChange(current=>({...current,[key]:value,page:0}));
 const setPage=value=>onViewChange(current=>({...current,page:value}));
 const chooseReport=kind=>onViewChange(current=>({...current,kind,page:0,account:'all',status:'all',...(kind==='result'&&current.start&&current.end?{start:current.start.slice(0,7)+'-01',end:endOfMonth(current.end.slice(0,7))}:{})}));
 const context=report.error?'':`${report.labels.report} · ${report.labels.work} · ${report.labels.period} · ${report.labels.basis} · Categoria: ${report.labels.category} · Tipo: ${report.labels.direction} · Situação: ${report.labels.status} · Conta: ${report.labels.account} · Busca: ${view.query||'Sem busca'}${view.kind==='due'?` · Posição em ${view.asOf} · Sem vencimento: ${view.includeUndated?"incluídos":"fora do recorte"}`:''}`;
 const exportReport=async format=>{
  if(report.error||exporting)return;
  const snapshot=report;
  setExporting(true);setExportError('');
  try{
   const name=`financeiro-${view.kind}-${view.start}-${view.end}`;
   if(format==='print'){
    const popup=window.open('','_blank');
    if(!popup)throw new Error('Permita abrir a janela para imprimir ou salvar o PDF.');
    popup.opener=null;popup.document.open();popup.document.write(marcellReportHtml(reportPrintHtml(snapshot)));popup.document.close();
   }else if(format==='csv'){
    const url=URL.createObjectURL(new Blob([reportCsv(snapshot)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`${name}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }else{
    const xlsx=await loadSpreadsheet(),book=xlsx.utils.book_new();
    for(const [title,rows] of Object.entries(financialReportSheets(snapshot))){
     const sheet=xlsx.utils.aoa_to_sheet(rows.map(row=>row.map(value=>typeof value==='string'?safeReportText(value):value)));
     sheet['!cols']=rows[0].map(()=>({wch:24}));xlsx.utils.book_append_sheet(book,sheet,title);
    }
    await xlsx.writeFile(book,`${name}.xlsx`);
   }
  }catch(error){setExportError(error.message||'Não foi possível exportar. Tente novamente.');}
  finally{setExporting(false);}
 };
 const definition=REPORT_TYPES[view.kind];
 const openGroup=group=>onOpen({title:`${report.labels.report} · ${group.label}`,context:`${context} · Composição da coluna líquida: ${definition.incoming} com sinal positivo; ${definition.outgoing} com sinal negativo.`,totalCents:group.net,items:group.items.map(item=>({...item,amountCents:item.direction==='in'?item.amountCents:-item.amountCents}))});
 const groups=report.groups.slice(page*50,(page+1)*50);
 const activeFilters=[
  view.query&&{key:'query',value:'',label:`Busca: ${view.query}`},
  view.category!=='all'&&{key:'category',value:'all',label:`Categoria: ${reportCategoryLabel(view.category==='unclassified'?'':view.category)}`},
  view.direction!=='all'&&{key:'direction',value:'all',label:view.direction==='in'?definition.incoming:definition.outgoing},
  view.group!=='work'&&{key:'group',value:'work',label:`Agrupamento: ${GROUP_LABELS[view.group]}`},
  view.kind==='due'&&view.status!=='all'&&{key:'status',value:'all',label:`Situação: ${view.status}`},
  view.kind==='cash'&&view.account!=='all'&&{key:'account',value:'all',label:`Conta: ${report.labels?.account||view.account}`},
 ].filter(Boolean);
 return <section className="financial-reports" aria-labelledby="financial-reports-title">
  <header><h2 id="financial-reports-title">Central de relatórios financeiros</h2><p>Consulte a origem dos valores e exporte o mesmo recorte da tela.</p></header>
  <fieldset disabled={exporting} className="financial-reports__filters"><legend>Consulta financeira</legend>
   <label>Relatório<select aria-label="Relatório" value={view.kind} onChange={event=>chooseReport(event.target.value)}>{Object.entries(REPORT_TYPES).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}</select></label>
   <label>Obra<select aria-label="Obra" value={obraId} onChange={event=>{setPage(0);onObraChange(event.target.value);}}><option value="all">Todas as obras e empresa</option>{(data.obras||[]).map(work=><option key={work.id} value={work.id}>{work.name}</option>)}</select></label>
  </fieldset>
  <details className="financial-reports__options"><summary>Filtros do relatório · {view.kind==='result'?`${view.start.slice(0,7)} a ${view.end.slice(0,7)}`:`${view.start} a ${view.end}`}</summary>
  <fieldset disabled={exporting} className="financial-reports__filters"><legend>Refinar consulta</legend>
   <label>{view.kind==='result'?'Competência inicial':'Data inicial'}<Input aria-label={view.kind==='result'?'Competência inicial':'Data inicial'} type={view.kind==='result'?'month':'date'} value={view.kind==='result'?view.start.slice(0,7):view.start} onChange={event=>change('start',view.kind==='result'&&event.target.value?event.target.value+'-01':event.target.value)}/></label>
   <label>{view.kind==='result'?'Competência final':'Data final'}<Input aria-label={view.kind==='result'?'Competência final':'Data final'} type={view.kind==='result'?'month':'date'} value={view.kind==='result'?view.end.slice(0,7):view.end} onChange={event=>change('end',view.kind==='result'?endOfMonth(event.target.value):event.target.value)}/></label>
   <label>Agrupar por<select aria-label="Agrupar por" value={view.group} onChange={event=>change('group',event.target.value)}>{Object.entries(GROUP_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label>Tipo<select aria-label="Tipo" value={view.direction} onChange={event=>change('direction',event.target.value)}><option value="all">Todos</option><option value="in">{definition.incoming}</option><option value="out">{definition.outgoing}</option></select></label>
   <label>Categoria<select aria-label="Categoria" value={view.category} onChange={event=>change('category',event.target.value)}><option value="all">Todas</option><option value="unclassified">Sem categoria</option>{categories.map(id=><option key={id} value={id}>{reportCategoryLabel(id)}</option>)}</select></label>
   <label>Pesquisar lançamento, contraparte ou documento<Input type="search" value={view.query} onChange={event=>change('query',event.target.value)}/></label>
   {view.kind==='cash'&&<label>Conta do movimento bancário vinculado<select aria-label="Conta do movimento bancário vinculado" value={view.account} onChange={event=>change('account',event.target.value)}><option value="all">Todas</option><option value="unlinked">Sem conta vinculada</option>{(data.contasBancarias||[]).map(account=><option key={account.id} value={account.id}>{account.nome}</option>)}</select></label>}
   {view.kind==='due'&&<><label>Data de posição<Input type="date" value={view.asOf} onChange={event=>change('asOf',event.target.value)}/></label><label>Situação<select aria-label="Situação" value={view.status} onChange={event=>change('status',event.target.value)}><option value="all">Todas</option><option value="aberto">Em aberto</option><option value="parcial">Parcial (inclui vencidos)</option><option value="vencido">Vencido (inclui parciais)</option><option value="liquidado">Resíduo até R$ 0,01</option></select></label><label className="financial-reports__checkbox"><input type="checkbox" checked={view.includeUndated} onChange={event=>change('includeUndated',event.target.checked)}/> Incluir títulos sem vencimento</label></>}
  </fieldset></details>
  {activeFilters.length>0&&<div className="financial-reports__active" aria-label="Filtros adicionais ativos">{activeFilters.map(filter=><Button key={filter.key} variant="outline" size="sm" aria-label={`Remover filtro ${filter.label}`} onClick={()=>change(filter.key,filter.value)}>{filter.label} ×</Button>)}</div>}
  {report.error?<Alert variant="warning"><AlertDescription>{report.error}</AlertDescription></Alert>:<>
   <dl className="financial-reports__totals">{[['incoming',definition.incoming],['outgoing',definition.outgoing],['net',definition.net]].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{money(report.summary[key])}</dd></div>)}</dl>
   <div className="financial-reports__basis"><h3>{report.labels.report}</h3><p><strong>Base:</strong> {report.labels.basis}. {report.labels.formula}</p><p>{report.labels.work} · {report.labels.period} · Categoria: {report.labels.category} · Tipo: {report.labels.direction} · Situação: {report.labels.status} · Busca: {view.query||'Sem busca'}</p>{view.kind==='cash'&&<p>Conta vinculada: {report.labels.account}. Movimentos sem vínculo permanecem identificados.</p>}{view.kind==='due'&&<p>Posição em {view.asOf} · {report.undated} título(s) sem vencimento {view.includeUndated?'incluído(s)':'fora da janela de vencimentos'}.</p>}<details><summary>Fonte e alcance da consulta</summary><p>{report.source} Competência é diferente de vencimento e pagamento. A base é gerencial e não substitui o demonstrativo fiscal completo. {view.kind==='result'?'Equipamentos da empresa seguem a composição do módulo de equipamentos.':''}</p></details></div>
   <div className="financial-reports__exports"><p>{report.entries.length} lançamento(s) · {report.groups.length} grupo(s) · Gerado nesta consulta: {new Date(report.generatedAt).toLocaleString('pt-BR')}</p><Button variant="outline" disabled={exporting} onClick={()=>exportReport('csv')}>Exportar CSV</Button><Button variant="outline" disabled={exporting} onClick={()=>exportReport('xlsx')}>Exportar Excel</Button><Button variant="outline" disabled={exporting} onClick={()=>exportReport('print')}>Imprimir / salvar PDF</Button></div>
   {exportError&&<Alert><AlertDescription>{exportError}</AlertDescription></Alert>}
   <div className="scroll-x" tabIndex={0} aria-label="Resultados do relatório"><table><caption>{report.labels.group} · valores em reais (R$)</caption><thead><tr><th>{report.labels.group}</th><th>{definition.incoming}</th><th>{definition.outgoing}</th><th>{definition.net}</th><th>Origem</th></tr></thead><tbody>{groups.map(group=><tr key={group.id}><th scope="row">{group.label}</th><td data-label={definition.incoming}>{money(group.incoming)}</td><td data-label={definition.outgoing}>{money(group.outgoing)}</td><td data-label={definition.net}>{money(group.net)}</td><td data-label="Origem"><Button variant="link" onClick={()=>openGroup(group)}>Ver {group.items.length} lançamento(s)</Button></td></tr>)}</tbody><tfoot><tr><th>Total do recorte</th><td data-label={definition.incoming}>{money(report.summary.incoming)}</td><td data-label={definition.outgoing}>{money(report.summary.outgoing)}</td><td data-label={definition.net}>{money(report.summary.net)}</td><td data-label="Origem">{report.entries.length} lançamento(s)</td></tr></tfoot></table></div>
   {!report.entries.length&&<p role="status">Nenhum lançamento neste recorte. Revise período, obra, categoria e busca.</p>}
   {report.groups.length>50&&<div className="financial-reports__exports"><Button variant="outline" disabled={!page} onClick={()=>setPage(page-1)}>Página anterior</Button><span>Página {page+1} de {Math.ceil(report.groups.length/50)}</span><Button variant="outline" disabled={(page+1)*50>=report.groups.length} onClick={()=>setPage(page+1)}>Próxima página</Button></div>}
   <p className="financial-reports__note">CSV, Excel e impressão incluem recorte, resumo e todos os lançamentos filtrados, inclusive fora da página visível.</p>
  </>}
 </section>;
}
