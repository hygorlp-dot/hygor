import {useMemo,useState} from 'react';
import {PageHeader} from '../../../design-system/patterns/PageHeader.jsx';
import {SummaryCard} from '../../../design-system/patterns/SummaryCard.jsx';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {WorkspaceNavigation} from '../../../design-system/patterns/WorkspaceNavigation.jsx';
import {FilePicker} from '../../../design-system/patterns/FilePicker.jsx';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {Textarea} from '../../../design-system/primitives/Textarea.jsx';
import {Checkbox} from '../../../design-system/primitives/Checkbox.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {ForecastReportTable as ReportTable} from './ForecastReportTable.jsx';
import {forecastMoney as money,forecastDate as date} from './forecast-format.js';
import {ACCOUNTING_COMMAND,ACCOUNTING_GROUPS,ACCOUNTING_HEADERS,accountingBases,accountingIndicators,parseAccountingCsv,accountingErpComparison} from '../../../domains/financeiro/accounting-indicators.js';
import {accountingExportSheets,accountingMetricText,accountingPrintHtml,ACCOUNTING_BALANCE_LABELS,ACCOUNTING_INCOME_LABELS} from '../../../domains/financeiro/accounting-report-export.js';
import {shiftDay} from '../../../domains/financeiro/cash-forecast.js';
import {marcellReportHtml} from '../../../reports/marcell-report.js';
import {uid} from '../../../legacy/format.js';

function download(name,text){const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function AccountingIndicators({data,asOf,state={},onChange,dispatchCommand,onExport}){
 const section=['summary','bases','memory'].includes(state.section)?state.section:'summary';
 const records=accountingBases(data),available=records.filter(row=>row.end<=asOf);
 const selected=available.find(row=>row.id===state.selected)||[...available].filter(row=>row.status==='conferida').sort((a,b)=>a.end.localeCompare(b.end)||a.revision-b.revision).at(-1)||available.at(-1);
 const report=useMemo(()=>accountingIndicators(selected),[selected]);
 const comparison=useMemo(()=>selected?accountingErpComparison(data,selected.start,selected.end):null,[data,selected]);
 const comparisonShown=selected?.status==='conferida'?selected.erpComparison:comparison;
 const difference=selected?.status==='conferida'?selected.erpDifference:comparison?.result==null||report.statement.income?.net==null?null:report.statement.income.net-comparison.result;
 const end=shiftDay(asOf,-Number(asOf.slice(8,10)));
 const [form,setForm]=useState({start:`${end.slice(0,7)}-01`,end,entity:typeof data.config?.companyName==='string'?data.config.companyName:'',document:'',note:'',csv:'',filename:''});
 const [coverage,setCoverage]=useState(false),[reconciliation,setReconciliation]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const parsed=useMemo(()=>form.csv?parseAccountingCsv(form.csv):null,[form.csv]);
 const update=patch=>onChange({...state,...patch});
 async function selectFile(event){setMessage('');const file=event.target.files?.[0];if(!file)return;try{if(file.size>512*1024)throw new Error('O CSV deve ter até 512 KB.');const csv=await file.text();setForm(old=>({...old,csv,filename:file.name,document:old.document||file.name.replace(/\.csv$/i,'')}));}catch(error){setMessage(error.message||'Não foi possível ler o CSV.');}event.target.value='';}
 async function execute(type){
  if(!dispatchCommand){setMessage('Conecte-se ao servidor para importar ou conferir a base.');return;}
  setBusy(true);setMessage('');
  const id=type===ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED?uid():selected.id;
  try{
   const result=await dispatchCommand(()=>({type,idempotencyKey:`contabilidade-${type}-${uid()}`,expectedVersion:type===ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED?records.length:selected.version,payload:type===ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED?{...form,id}:{id,completeCoverage:coverage,erpFingerprint:comparison.fingerprint,reconciliationNote:reconciliation}}));
   if(!result?.ok)setMessage(result?.reason||result?.error||'Não foi possível gravar. Atualize e confira a base.');
   else{update({selected:id,section:'bases'});setCoverage(false);setReconciliation('');setMessage(type===ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED?'Base importada como rascunho. Confira os saldos e a origem antes de liberar os indicadores.':'Conferência registrada. Os indicadores disponíveis usam esta revisão preservada.');}
  }catch(error){setMessage(error.message||'Falha ao gravar a base. Tente novamente.');}finally{setBusy(false);}
 }
 function print(){setMessage('');try{const popup=window.open('','_blank');if(!popup)throw new Error('Permita abrir a janela de impressão para salvar o PDF.');popup.opener=null;popup.document.open();popup.document.write(marcellReportHtml(accountingPrintHtml(selected,report)));popup.document.close();}catch(error){setMessage(error.message||'Não foi possível preparar a apresentação.');}}
 const metrics=Object.fromEntries(report.metrics.map(row=>[row.id,row]));
 return <>
  <PageHeader headingLevel={2} title="Indicadores contábeis da empresa" description="Rentabilidade, liquidez e endividamento sobre balancete identificado e conferido. A posição é da empresa inteira; não há rateio por obra." secondaryActions={selected&&<><Button variant="secondary" onClick={()=>onExport(Object.entries(accountingExportSheets(selected,report)).flatMap(([name,rows])=>[[name],...rows,[]]))}>Exportar indicadores contábeis CSV</Button><Button variant="secondary" onClick={print}>Preparar apresentação contábil / PDF</Button></>}/>
  {message&&<Alert><AlertDescription>{message}</AlertDescription></Alert>}
  <WorkspaceNavigation label="Seções dos indicadores contábeis" items={[{id:'summary',label:'Resumo contábil'},{id:'bases',label:'Bases e conferência'},{id:'memory',label:'Memória contábil'}]} active={section} onChange={value=>update({section:value})}/>
  <FilterBar label="Base dos indicadores contábeis" layout="grid"><Select label="Base contábil" value={selected?.id||''} onChange={event=>{update({selected:event.target.value});setCoverage(false);setReconciliation('');}} options={available.map(row=>({value:row.id,label:`${date(row.end)} · revisão ${row.revision} · ${row.status==='conferida'?'Conferida':'Rascunho'} · ${row.document}`}))} placeholder={available.length?undefined:'Nenhuma base até a referência'}/></FilterBar>
  {selected?<p>{selected.entity} · {date(selected.start)} a {date(selected.end)} · revisão {selected.revision} · {selected.status==='conferida'?`Conferida por ${selected.reviewedBy} em ${date(selected.reviewedOn)}.`:'Rascunho sem indicadores liberados.'} Origem: {selected.document} · {selected.sourceFile}.</p>:<Alert variant="warning"><AlertDescription>Sem base contábil neste recorte. Em Bases e conferência, importe o balancete da entidade e confira os saldos. O caixa e os títulos do ERP não substituem o balanço completo.</AlertDescription></Alert>}
  <section hidden={section!=='summary'} aria-label="Resumo contábil">
   <div className="financial-reports__totals" aria-label="Resumo dos indicadores contábeis"><SummaryCard label="Margem líquida" value={accountingMetricText(metrics.net)} detail={metrics.net.reason||'Lucro líquido / receita líquida do período'}/><SummaryCard label="Liquidez corrente" value={accountingMetricText(metrics.current)} detail={metrics.current.reason||'Ativo circulante / passivo circulante'}/><SummaryCard label="Capital de terceiros / ativo" value={accountingMetricText(metrics.debt_assets)} detail={metrics.debt_assets.reason||'Passivo exigível total / ativo total'}/></div>
   <p>{report.ready?'Os indicadores usam a mesma entidade, período e revisão conferida.':report.reason}</p>
   {['Rentabilidade','Liquidez','Endividamento'].map(family=><ReportTable key={family} title={`Indicadores de ${family.toLowerCase()}`} headers={['Indicador','Resultado','Numerador','Denominador','Fórmula']} rows={report.metrics.filter(row=>row.family===family).map(row=>[row.label,accountingMetricText(row),money(row.numerator),money(row.denominator),`${row.formula}${row.reason?` · ${row.reason}`:''}`])}/>)}
   <p>Rentabilidade corresponde ao período escolhido, sem anualização. ROA e ROE usam saldos finais explicitamente; não são retornos sobre médias. Liquidez seca restrita considera somente caixa e recebíveis financeiros de curto prazo. Compare bases de mesmo período e classificação; não há meta universal presumida.</p>
  </section>
  <section hidden={section!=='bases'} aria-label="Bases e conferência contábil">
   <details><summary>Importar balancete</summary><FormSection title="Documento de origem" description="CSV UTF-8, separador ponto e vírgula, somente contas analíticas; saldos devedores positivos e credores negativos. Use movimentação antes dos lançamentos de encerramento do resultado.">
    <Button variant="secondary" onClick={()=>download('modelo-balancete-marcell.csv',ACCOUNTING_HEADERS.join(';')+'\n'+ACCOUNTING_GROUPS.map((group,index)=>`${index+1};${group.label};${group.id};0;0;0;0`).join('\n'))}>Baixar modelo do balancete CSV</Button>
    <FilePicker accept=".csv,text/csv" buttonLabel="Selecionar balancete CSV" inputProps={{'aria-label':'Arquivo do balancete CSV'}} onChange={selectFile}/>
    <p>{form.filename||'Nenhum arquivo selecionado.'} {parsed?.ok?`${parsed.accounts.length} contas analíticas lidas; totais serão calculados automaticamente.`:''}</p>
    {parsed&&!parsed.ok&&<Alert variant="destructive"><AlertDescription>{parsed.reason}</AlertDescription></Alert>}
    <FilterBar label="Identificação do balancete" layout="grid"><Input label="Entidade do balancete" value={form.entity} onChange={event=>setForm({...form,entity:event.target.value})}/><Input label="Documento de origem contábil" value={form.document} onChange={event=>setForm({...form,document:event.target.value})}/><Input label="Início do período contábil" type="date" value={form.start} onChange={event=>setForm({...form,start:event.target.value})}/><Input label="Fim do período contábil" type="date" value={form.end} max={end} onChange={event=>setForm({...form,end:event.target.value})}/></FilterBar>
    <Textarea label="Justificativa da importação ou revisão" value={form.note} onChange={event=>setForm({...form,note:event.target.value})} description="Identifique a origem ou o motivo da revisão, com pelo menos 10 caracteres."/>
    <Button disabled={busy||!parsed?.ok||form.note.trim().length<10||form.entity.trim().length<3||form.document.trim().length<3} onClick={()=>execute(ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED)}>Importar base contábil</Button>
    <details><summary>Guia dos grupos contábeis do CSV</summary><ReportTable title="Classificação das contas para os indicadores" headers={['Grupo no CSV','Classificação']} rows={ACCOUNTING_GROUPS.map(group=>[group.id,group.label])}/><p>A classificação deve corresponder à natureza e ao prazo contábil. Contas redutoras mantêm o sinal; não envie contas sintéticas e analíticas juntas. O modelo contém zeros ilustrativos: substitua pelas contas reais exportadas da contabilidade.</p></details>
   </FormSection></details>
   {selected&&<>
    <ReportTable title="Conferência dos saldos contábeis" headers={['Controle','Valor','Base']} rows={[
     ['Soma de saldos iniciais',money(report.statement.totals.opening),'Devedores positivos e credores negativos: deve fechar em zero.'],['Total de débitos',money(report.statement.totals.debit),'Movimentação do período, sem encerramento do resultado.'],['Total de créditos',money(report.statement.totals.credit),'Deve coincidir com o total de débitos.'],['Soma de saldos finais',money(report.statement.totals.closing),'Deve fechar em zero.'],['Pendências detectadas',report.statement.issues.length,'Confira também a cobertura e a origem, mesmo quando não há divergências.'],
    ]}/>
    <ReportTable title="Pendências da base contábil" headers={['Origem','Linha do CSV','Pendência']} rows={report.statement.issues.map(issue=>[issue.source,issue.line||'Subtotal',issue.message])}/>
    <ReportTable title="Comparação contabilidade e ERP" headers={['Base','Resultado','Leitura']} rows={[
     ['Contabilidade',money(report.statement.income?.net),'Lucro ou prejuízo líquido da base importada.'],['ERP operacional',money(comparisonShown?.result),`${comparisonShown?.eventCount??0} eventos do razão nas competências do período; não comprova cobertura contábil integral.`],['Diferença contabilidade − ERP',money(difference),'Não cria lançamento nem ajusta a contabilidade ou o ERP.'],
    ]}/>
    {selected.status==='conferida'?<><p>Comparação registrada na conferência: {selected.reconciliationNote||'Sem diferença identificada nos valores comparáveis.'}</p>{selected.erpComparison?.fingerprint!==comparison?.fingerprint&&<Alert variant="warning"><AlertDescription>Os fatos do ERP mudaram desde a conferência. A base contábil e a comparação registradas foram preservadas; confira se é necessária uma revisão.</AlertDescription></Alert>}</>:<>
     <Textarea label="Justificativa da conciliação com o ERP" value={reconciliation} onChange={event=>setReconciliation(event.target.value)} description="Explique diferenças, ajustes contábeis, cobertura ou ausência de base comparável. Obrigatória quando há diferença ou pendência do ERP."/>
     <Checkbox label="Confirmei a entidade, todas as contas analíticas e a classificação; o balancete está antes do encerramento do resultado e os saldos foram conferidos." checked={coverage} onChange={event=>setCoverage(event.target.checked)}/>
     <Button disabled={busy||!coverage||report.statement.issues.length>0||((difference!==0||comparison?.issues>0)&&reconciliation.trim().length<10)} onClick={()=>execute(ACCOUNTING_COMMAND.ACCOUNTING_BASE_REVIEWED)}>Conferir base e liberar indicadores</Button>
    </>}
    <details><summary>Histórico das bases contábeis</summary><ReportTable title="Revisões contábeis preservadas" headers={['Documento / revisão','Período','Situação','Responsável','Justificativa']} rows={available.map(row=>[`${row.document} · revisão ${row.revision} · ${row.id}`,`${date(row.start)} a ${date(row.end)}`,row.status,row.reviewedBy||row.createdBy,row.note])}/><p>Importar uma revisão não apaga a anterior. Bases conferidas são preservadas; corrija o arquivo na origem e importe outra revisão para mudar os valores.</p></details>
   </>}
  </section>
  <section hidden={section!=='memory'} aria-label="Memória contábil">
   <ReportTable title="Balanço de conferência" headers={['Componente','Saldo final']} rows={Object.entries(ACCOUNTING_BALANCE_LABELS).map(([key,label])=>[label,money(report.statement.balance?.[key])])}/>
   <p>O patrimônio líquido dos indicadores inclui as contas de PL e o resultado acumulado ainda não encerrado. A base exige saldos com essa apresentação; isso evita somar o lucro duas vezes ou omiti-lo.</p>
   <ReportTable title="DRE contábil do período" headers={['Componente','Movimentação do período']} rows={Object.entries(ACCOUNTING_INCOME_LABELS).map(([key,label])=>[label,money(report.statement.income?.[key])])}/>
   <ReportTable title="Memória das contas contábeis" headers={['Código / conta','Grupo','Saldo inicial','Débitos','Créditos','Saldo final','Linha do CSV']} rows={(selected?.accounts||[]).map(row=>[`${row.code} · ${row.name}`,ACCOUNTING_GROUPS.find(group=>group.id===row.group)?.label,money(row.opening),money(row.debit),money(row.credit),money(row.closing),row.sourceLine])}/>
  </section>
  <details><summary>Critérios dos indicadores contábeis</summary><p>A conferência interna não equivale a auditoria, parecer ou publicação das demonstrações contábeis. O responsável deve validar a origem, a entidade, a classificação, a abrangência e o tratamento do resultado. O ERP não transforma títulos a receber e a pagar em um balanço completo. Consultar e exportar não gravam lançamentos. As bases usam os documentos carregados; a referência não reconstrói o que era conhecido no passado.</p></details>
 </>;
}
