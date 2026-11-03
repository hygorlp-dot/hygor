import {useHelpTopic} from '../help/HelpContext.jsx';
import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {useMemo,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {buildWorkFinancialReport,workFinancialSheets,workFinancialCsv,workFinancialPrint} from '../../domains/financeiro/work-financial-report.js';
import {safeReportText} from '../../domains/financeiro/report-export.js';
import {marcellReportHtml} from '../../reports/marcell-report.js';
import './work-financial-report.css';
import {contar} from '../../design-system/copy.js';

const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function WorkFinancialReport({data,calcPeriod,view,onViewChange,obraId,onObraChange,onOpen,loadSpreadsheet}){
 useHelpTopic('fin','fin_relatorios_obra',20);
 const range=view.workReport||{start:view.start.slice(0,7),end:view.end.slice(0,7)};
 const [draft,setDraft]=useState(range),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const report=useMemo(()=>{try{return buildWorkFinancialReport(data,calcPeriod,{obraId,...range});}catch{return {error:'Não foi possível conferir a composição do relatório. Consulte as pendências antes de usar os totais.'};}},[data,calcPeriod,obraId,range.start,range.end]);
 const open=(title,items,total)=>onOpen({title:`${title} · ${report.work.name}`,context:`${report.start} a ${report.end} · ${report.basis}`,items,totalCents:total});
 const exporting=async format=>{
  if(report.error||busy)return;setBusy(true);setError('');
  try{
   if(format==='print'){const popup=window.open('','_blank');if(!popup)throw new Error('Permita abrir a janela para imprimir ou salvar o PDF.');popup.opener=null;popup.document.open();popup.document.write(marcellReportHtml(workFinancialPrint(report)));popup.document.close();}
   else if(format==='csv'){const url=URL.createObjectURL(new Blob([workFinancialCsv(report)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`obra-${report.work.id}-${report.start}-${report.end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
   else{const xlsx=await loadSpreadsheet(),book=xlsx.utils.book_new();for(const [name,rows]of Object.entries(workFinancialSheets(report))){const sheet=xlsx.utils.aoa_to_sheet(rows.map(r=>r.map(v=>typeof v==='string'?safeReportText(v):v)));sheet['!cols']=rows[0].map(()=>({wch:24}));xlsx.utils.book_append_sheet(book,sheet,name);}await xlsx.writeFile(book,`obra-${report.work.id}-${report.start}-${report.end}.xlsx`);}
  }catch(e){setError(e.message||'Não foi possível exportar.');}finally{setBusy(false);}
 };
 return <section className="work-financial-report" aria-label="Relatório financeiro completo por obra">
  <header><h2>Financeiro completo por obra</h2><p>Custos e resultado por competência, mão de obra total e origem de cada lançamento. Consulta interna, sem alterar a empresa.</p></header>
  <fieldset disabled={busy} className="financial-reports__filters"><legend>Obra e período</legend>
   <label>Obra do relatório<SelectControl aria-label="Obra do relatório" value={obraId} onChange={e=>onObraChange(e.target.value)}><option value="all">Selecione uma obra</option>{(data.obras||[]).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</SelectControl></label>
   <label>Competência inicial da obra<Input type="month" value={draft.start} onChange={e=>setDraft(v=>({...v,start:e.target.value}))}/></label>
   <label>Competência final da obra<Input type="month" value={draft.end} onChange={e=>setDraft(v=>({...v,end:e.target.value}))}/></label>
   <Button variant="outline" onClick={()=>onViewChange(v=>({...v,workReport:{...draft}}))}>Aplicar período da obra</Button>
  </fieldset>
  {(draft.start!==range.start||draft.end!==range.end)&&<p role="status">Período em edição. A tela, os memoriais e as exportações mantêm o último período aplicado.</p>}
  {report.error?<Alert variant="warning"><AlertDescription>{report.error}</AlertDescription></Alert>:<>
   <p><strong>{report.work.name}</strong> · {report.start} a {report.end} · Posição dos títulos: {report.lastDate} · Consulta: {new Date(report.generatedAt).toLocaleString('pt-BR')}</p>
   <Alert variant="warning"><AlertDescription>Base gerencial disponível. Encargos já incorporados à mão de obra não são somados novamente. Componentes ausentes não foram estimados. Rateio da administração central não incluído nesta etapa.</AlertDescription></Alert>
   <div className="work-financial-report__metrics">{[
    ['Custo total reconhecido',report.summary.cost,report.costs],['Mão de obra própria e componentes',report.summary.labor,report.costs.filter(e=>['mao_obra','beneficios','encargos','rescisao'].includes(e.category))],['Terceirizados',report.summary.thirdParty,report.costs.filter(e=>e.category==='terceirizado')],['Receita reconhecida',report.summary.revenue,report.revenues],['Resultado gerencial antes do rateio',report.summary.result,[...report.revenues,...report.costs.map(e=>({...e,amountCents:-e.amountCents}))]]
   ].map(([title,total,items])=><Button variant="outline" key={title} onClick={()=>open(title,items,total)}><span>{title}</span><strong>{money(total)}</strong><small>Ver memorial</small></Button>)}</div>
   <p>Mão de obra própria inclui as categorias reconhecidas de equipe, encargos, benefícios e rescisões. <strong>Mão de obra própria + terceiros: {money(report.summary.labor+report.summary.thirdParty)}.</strong> O total depende dos componentes presentes na base; não representa confirmação de pagamento.</p>
   <div className="financial-reports__exports"><Button variant="outline" disabled={busy} onClick={()=>exporting('csv')}>Exportar CSV da obra</Button><Button variant="outline" disabled={busy} onClick={()=>exporting('xlsx')}>Exportar Excel da obra</Button><Button variant="outline" disabled={busy} onClick={()=>exporting('print')}>Imprimir / salvar PDF da obra</Button></div>
   {error&&<Alert><AlertDescription>{error}</AlertDescription></Alert>}
   <h3>Composição dos custos</h3><div className="work-financial-report__groups">{report.categories.map(g=><Button key={g.id} variant="outline" onClick={()=>open(g.label,g.items,g.amountCents)}><span>{g.label} · {contar(g.items.length,'lançamento','lançamentos')}</span><strong>{money(g.amountCents)}</strong></Button>)}</div>
   {!report.costs.length&&<p role="status">Nenhum custo reconhecido para a obra e as competências selecionadas.</p>}
   <details><summary>Custos por etapa · {contar(report.unassigned,'lançamento','lançamentos')} sem etapa identificada</summary><div className="work-financial-report__groups">{report.stages.map(g=><Button key={g.id} variant="outline" onClick={()=>open(g.label,g.items,g.amountCents)}><span>{g.label}</span><strong>{money(g.amountCents)}</strong></Button>)}</div></details>
   <h3>Composição mensal e mão de obra</h3><div className="scroll-x" tabIndex={0} aria-label="Custos mensais da obra"><table><caption>Valores reconhecidos por competência, líquidos de estornos</caption><thead><tr><th>Competência</th><th>Custo total</th><th>Mão de obra própria</th><th>Terceiros</th><th>Origem</th></tr></thead><tbody>{report.monthly.map(m=><tr key={m.id}><th scope="row">{m.id}</th><td data-label="Custo total">{money(m.amountCents)}</td><td data-label="Mão de obra própria">{money(m.labor)}</td><td data-label="Terceiros">{money(m.thirdParty)}</td><td data-label="Origem"><Button variant="link" onClick={()=>open(`Custos · ${m.id}`,m.items,m.amountCents)}>Ver composição</Button></td></tr>)}</tbody></table></div>
   <details><summary>Memória do cálculo de mão de obra própria</summary><p>Valores do mesmo motor do DRE. A mão de obra inclui os encargos calculados; a parcela identificável de encargos já está contida nesse valor. Arquivos antigos podem conservar somente totais. Não há estimativa de componentes individuais ausentes nem duplicação de folha e Pix.</p>{report.labor.map(l=><div key={l.month}><h4>{l.month}</h4>{l.calculation?<p>Mão de obra e encargos: {money(Math.round(Number(l.calculation.laborCost||0)*100))} · Benefícios: {money(Math.round(Number(l.calculation.benefitCost||0)*100))} · Encargos identificáveis, já incluídos: {l.calculation.chargesCost==null?'Indisponíveis':money(Math.round(l.calculation.chargesCost*100))}</p>:<p>Memória operacional de mão de obra indisponível nesta competência; os eventos reconhecidos no razão continuam no relatório.</p>}</div>)}</details>
   <h3>Caixa realizado e posição das obrigações</h3><p>Movimentos do período, sem saldo inicial. Pagamentos diretos do cliente são informativos e ficam fora do caixa da empresa. Obrigações em aberto são acumuladas até {report.lastDate}.</p><div className="work-financial-report__groups">{[['Entradas realizadas','cashIn'],['Saídas realizadas','cashOut'],['Pagamentos diretos do cliente','clientPaid'],['A pagar na posição','payable'],['A receber na posição','receivable']].map(([title,key])=><Button variant="outline" key={key} onClick={()=>open(title,report[key],report.summary[key])}><span>{title}</span><strong>{money(report.summary[key])}</strong></Button>)}</div>
   <details><summary>Fontes, limites e pendências · {contar(report.issues.length,'alerta','alertas')} do razão</summary><p>{report.basis}</p><p>Etapas sem identificação permanecem separadas. O relatório não substitui o fechamento histórico, não constitui uma previsão revisada de engenharia e não distribui automaticamente custos da administração central.</p>{report.issues.map((issue,i)=><p key={i}>{issue.code||'Alerta'} · {issue.description||issue.message||'Conferir registro de origem'}</p>)}</details>
  </>}
 </section>;
}
