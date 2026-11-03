import ScheduleIndicators from './ScheduleIndicators.jsx';
import {ForecastReportTable as ReportTable} from './ForecastReportTable.jsx';
import {Popover,PopoverTrigger,PopoverContent} from '../../../components/ui/popover.jsx';
import {PageHeader} from '../../../design-system/patterns/PageHeader.jsx';
import {SummaryCard} from '../../../design-system/patterns/SummaryCard.jsx';
import {useMemo,useState,useRef} from 'react';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {WorkspaceNavigation} from '../../../design-system/patterns/WorkspaceNavigation.jsx';
import {executiveDecisions} from '../../../domains/financeiro/executive-decisions.js';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {executiveWorkReport,executiveReportCsvRows} from '../../../domains/financeiro/executive-report.js';
import {executiveReportPrintHtml} from '../../../domains/financeiro/executive-report-export.js';
import {marcellReportHtml} from '../../../reports/marcell-report.js';
import {forecastMoney as money,forecastDate as date,forecastMonth as month} from './forecast-format.js';
import {contar} from '../../../design-system/copy.js';

const percent=value=>value==null||!Number.isFinite(value)?'Não disponível':`${(value*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const number=value=>value==null||!Number.isFinite(value)?'Não disponível':value.toLocaleString('pt-BR',{maximumFractionDigits:3});

function ExecutiveSection({visible,label,children}){return <section hidden={!visible} aria-label={label}><div className="financial-reports">{children}</div></section>;}

function WorkforceEvolution({evolution,type}){
 const own=type==='roles',label=own?'função':'terceirizado',monthly=own?evolution.roleMonths:evolution.thirdMonths,comparison=evolution[type];
 return <details><summary>Evolução e comparação dos gastos por {label}</summary>
  <p>Competências {month(evolution.currentStart)} a {month(evolution.currentEnd)}, comparadas com {month(evolution.previousStart)} a {month(evolution.previousEnd)}: {contar(evolution.monthCount,'mês','meses')} em cada período. Custos registrados, incluindo encargos e benefícios da equipe própria; pagamentos não entram nesta comparação.</p>
  {!evolution.completeMonths&&<Alert variant="warning"><AlertDescription>Mês de referência em andamento: valores provisórios. Diferença e variação ficam indisponíveis até o último dia do mês.</AlertDescription></Alert>}
  <ReportTable title={`Evolução mensal por ${label}`} headers={['Competência','Função / prestador','Custo registrado','Base']} rows={monthly.map(row=>[month(row.month),row.label,money(row.amountCents),row.source])}/>
  <ReportTable title={`Comparação de custos por ${label}`} headers={['Função / prestador','Período atual','Período anterior','Diferença','Variação']} rows={comparison.map(row=>[row.label,money(row.currentCents),money(row.previousCents),money(row.difference),percent(row.change)])}/>
  {!comparison.length&&<p>Sem registros de custo nos dois períodos das fontes carregadas.</p>}
  <p>Não disponível significa ausência de base ou comparação ainda não liberada. Ausência de registros não comprova custo zero. Percentual exige base anterior positiva. Diferença de gasto não mede produtividade ou economia; compare também equipe, produção e escopo. Mês encerrado no calendário não comprova fechamento contábil.</p>
 </details>;
}

export default function ExecutiveWorkReport({data,workIds,asOf,scope,includeCompany=false,state={},onChange,onExport}){
 const [exportError,setExportError]=useState('');
 const [exportsOpen,setExportsOpen]=useState(false);
 const decisionsRef=useRef(null);
 const sections=[{id:'summary',label:'Resumo do CEO'},{id:'cash',label:'Caixa'},{id:'costs',label:'Custos'},{id:'execution',label:'Execução'}];
 const section=sections.some(item=>item.id===state.section)?state.section:'summary';
 const start=state.start??`${asOf.slice(0,4)}-01-01`,opening=state.opening==null||String(state.opening).trim()===''?null:Math.round(Number(state.opening)*100);
 const openingCents=state.openingScope===scope&&Number.isSafeInteger(opening)?opening:null;
 const workScope=JSON.stringify(workIds);
 const report=useMemo(()=>executiveWorkReport(data,{workIds:JSON.parse(workScope),asOf,start,openingCents,includeCompany}),[data,workScope,asOf,start,openingCents,includeCompany]);
 const current=report.rows?.find(row=>row.work.id===state.detailWork)||report.rows?.[0];
 const update=patch=>onChange({...state,...patch});
 const decisions=report.error?[]:executiveDecisions(report);
 const lowest=report.error||!report.cash.hasOpening?null:Math.min(...report.cash.weeks.map(week=>week.lowest));
 const period=<>Custos e receitas: competências inteiras de {month(start.slice(0,7))} a {month(asOf.slice(0,7))}. Pagamentos e recebimentos realizados: {date(start)} a {date(asOf)}.</>;
 const showDecisions=()=>{if(decisionsRef.current){decisionsRef.current.open=true;decisionsRef.current.querySelector('summary')?.focus();decisionsRef.current.scrollIntoView({block:'start'});}};
 function print(){setExportError('');try{const popup=window.open('','_blank');if(!popup)throw new Error('Permita abrir a janela para imprimir ou salvar o PDF.');popup.opener=null;popup.document.open();popup.document.write(marcellReportHtml(executiveReportPrintHtml(report)));popup.document.close();}catch(error){setExportError(error.message||'Não foi possível preparar o relatório. Tente novamente.');}}
 return <>
  <PageHeader headingLevel={2} title="Relatório executivo por obra" secondaryActions={!report.error&&<Popover open={exportsOpen} onOpenChange={setExportsOpen}><PopoverTrigger asChild><Button variant="secondary">Exportar relatório</Button></PopoverTrigger><PopoverContent align="end" aria-label="Exportações do relatório"><div className="financial-reports__exports"><Button variant="secondary" onClick={()=>{onExport(executiveReportCsvRows(report));setExportsOpen(false);}}>Exportar relatório executivo CSV</Button><Button variant="secondary" onClick={()=>{print();setExportsOpen(false);}}>Preparar apresentação / PDF</Button></div></PopoverContent></Popover>}/>
  {exportError&&<Alert variant="destructive"><AlertDescription>{exportError}</AlertDescription></Alert>}
  <details className="financial-reports__options" open={Boolean(report.error)}><summary>Ajustar período e saldo</summary><FilterBar label="Recorte do relatório executivo" layout="grid" align="start"><Input label="Início do relatório executivo" type="date" value={start} max={asOf} onChange={event=>update({start:event.target.value})} description="Até 12 competências. Custos usam meses inteiros; pagamentos usam as datas exatas."/><Input label="Saldo inicial do caixa executivo (R$)" type="number" step="0.01" value={state.opening??''} onChange={event=>update({opening:event.target.value,openingScope:scope})} description="Opcional: saldo confirmado das obras deste recorte na referência. Não é consultado no banco."/></FilterBar></details>
  {report.error?<Alert variant="warning"><AlertDescription>{report.error}</AlertDescription></Alert>:<>
   <WorkspaceNavigation label="Seções do relatório executivo" active={section} onChange={value=>update({section:value})} items={sections}/>
   <ExecutiveSection visible={section==='summary'} label="Resumo do CEO">
   <div className="financial-reports__totals" role="group" aria-label="Resumo executivo da carteira">
    <SummaryCard label="Gastos incorridos acumulados" value={money(report.totals.incurred)}/>
    <SummaryCard label="Custo final previsto" value={money(report.totals.finalCost)}/>
    <SummaryCard label="Desvio previsto sobre orçamento" value={money(report.totals.deviation)}/>
   </div>
   <Alert variant={decisions.length||report.totals.completeWorks!==report.totals.workCount?'warning':'default'}><AlertDescription><strong>{decisions.length?'Revisar antes de apresentar':report.totals.completeWorks!==report.totals.workCount?'Cálculo incompleto':'Sem avisos detectados no cálculo'}</strong> · Custo final calculável em {report.totals.completeWorks} de {report.totals.workCount} obras · {contar(decisions.length,'aviso','avisos')} de conferência. A base carregada não comprova que todos os gastos foram registrados.</AlertDescription></Alert>
   <p>{contar(report.totals.workCount,'obra','obras')} · referência {date(asOf)}. Gastos acumulados até {month(asOf.slice(0,7))}, incluindo fatos anteriores ao início escolhido.</p>
   <p>Caixa de 13 semanas · necessidade máxima de cobertura: {money(report.cash.fundingNeed)} · menor saldo diário: {money(lowest)}. {!report.cash.hasOpening?'Saldo inicial não confirmado para este recorte: confirme em Ajustar período e saldo para calcular saldos e cobertura.':'Projeção condicional aos títulos existentes e ao saldo informado.'}</p>
   <div className="financial-reports__exports"><Button variant="secondary" onClick={showDecisions}>Conferir pendências · {decisions.length}</Button></div>
   {report.totals.completeWorks!==report.totals.workCount&&<Alert variant="warning"><AlertDescription>Custo final calculável em {report.totals.completeWorks} de {report.totals.workCount} obras. Subtotal das obras calculáveis: {money(report.totals.knownFinalCost)}. A carteira completa permanece indisponível; revise as pendências de cada obra.</AlertDescription></Alert>}

   <ReportTable title="Sinais financeiros da carteira" headers={['Indicador','Valor','Base de cálculo']} rows={[
    ['Saldo vencido a receber',`${money(report.managementKpis.overdueCents)} · ${percent(report.managementKpis.ratio)}`,'Percentual sobre saldos abertos com vencimento válido. Sem vencimento: '+money(report.managementKpis.undatedCents)],
    ['Compras comprometidas a faturar',money(report.managementKpis.openPurchaseCents),'Posição de pedidos na referência; títulos a pagar aparecem separados em Custos.'],
    ['Variação do custo executado · CV',money(report.managementKpis.cv),`${report.managementKpis.comparableWorks} de ${report.managementKpis.workCount} obras comparáveis; valor agregado menos custo incorrido. Confira Custos.`],
   ]}/>
   <ReportTable title="Comparativo executivo das obras" headers={['Obra','Orçado','Incorrido acumulado','Custo final','Desvio previsto','Avanço pelo diário','Avanço oficial da medição','Base']} rows={report.rows.map(row=>[row.work.name,money(row.budget),money(row.incurred),money(row.finalCost),`${money(row.deviation)} · ${percent(row.deviationRatio)}`,percent(row.physical),percent(row.officialPhysical),row.finalCost===null?'Pendências de cálculo':row.cost.status])}/>
   <ReportTable title="Sinais de prazo por obra" headers={['Obra','Vencidas com saldo confirmado','Vencidas sem medição','Entregas em 7 dias','Cobertura do diário','SPI','Base']} rows={report.rows.map(row=>[row.work.name,row.schedule.available?row.schedule.overdue:'Não disponível',row.schedule.available?row.schedule.unverified:'Não disponível',row.schedule.available?row.schedule.upcoming:'Não disponível',percent(row.schedule.coverage),number(row.schedule.spi),row.schedule.available?`${row.schedule.total} atividades; ${row.schedule.invalidDates} com datas ou identificação inválidas`:row.schedule.reason])}/>
   <details ref={decisionsRef}><summary>Pendências para decisão · {contar(decisions.length,'aviso','avisos')}</summary>
    {!decisions.length&&<p>Sem pendências detectadas no cálculo. Confirme a completude das fontes antes da apresentação.</p>}
    {report.rows.map(row=><div key={row.work.id}><h4>{row.work.name}</h4>{['Custos da obra','Títulos e caixa','Equipe e produção','Prazo da obra','Base financeira'].map(area=>{const items=decisions.filter(item=>item.obraId===row.work.id&&item.area===area);return items.length?<ReportTable key={area} title={area} headers={['Data / registro','Pendência','Providência']} rows={items.map(item=>[`${item.date?date(item.date):'Data não informada'} · ${item.source||'Aviso de cobertura da obra'}`,item.message,item.action])}/>:null;})}</div>)}
    {decisions.filter(item=>!report.rows.some(row=>row.work.id===item.obraId)).map((item,index)=><p key={index}>{item.work}: {item.message} {item.action}</p>)}
   </details>
   </ExecutiveSection>
   <ExecutiveSection visible={section==='cash'} label="Caixa do relatório executivo"><p>{period} Resultado e margem são realizados; não representam lucro final do contrato.</p>
   <h3>Inadimplência por obra</h3><p>Posição em {date(asOf)}: saldo ainda aberto com vencimento anterior à referência. Vence hoje e a vencer não são atraso. O percentual divide o vencido pelos saldos abertos com vencimento válido; títulos sem data ficam fora dessa proporção. Não mede todo o faturamento nem a liquidez contábil da empresa.</p>
   <ReportTable title="Posição da inadimplência" headers={['Obra','Vencido a receber','Saldo com vencimento válido','Percentual vencido','Sem vencimento válido']} rows={report.rows.map(row=>[row.work.name,money(row.managementKpis.receivables.overdueCents),money(row.managementKpis.receivables.datedCents),percent(row.managementKpis.receivables.ratio),money(row.managementKpis.receivables.undatedCents)])}/>
   {report.managementKpis.undatedCount>0&&<Alert variant="warning"><AlertDescription>{contar(report.managementKpis.undatedCount,'título','títulos')} a receber sem vencimento válido. Confira a data na origem; esses saldos não são classificados como em dia ou atrasados.</AlertDescription></Alert>}
   <details><summary>Conferir atrasos e títulos a receber</summary>
    <ReportTable title="Faixas de atraso dos recebíveis" headers={['Obra / faixa','Saldo vencido','Títulos']} rows={report.rows.flatMap(row=>row.managementKpis.receivables.aging.map(item=>[`${row.work.name} · ${item.label}`,money(item.amountCents),item.count]))}/>
    <ReportTable title="Memória dos recebíveis" headers={['Obra / origem','Vencimento','Saldo aberto','Dias em atraso','Situação']} rows={report.rows.flatMap(row=>row.managementKpis.receivables.titles.map(item=>[`${row.work.name} · ${item.documentNumber||item.description} · ${item.sourceType}:${item.sourceId}`,date(item.dueDate),money(item.amountCents),item.overdueDays??'Não disponível',item.bucket]))}/>
   </details>
   <ReportTable title="Resultado e caixa realizado no período" headers={['Obra','Receita reconhecida','Custo por competência','Resultado','Margem','Saída de caixa','Cliente direto ao fornecedor']} rows={report.rows.map(row=>[row.work.name,money(row.revenue),money(row.periodCost),money(row.result),percent(row.margin),money(row.periodPaid),money(row.periodClientPaid)])}/>
   <ReportTable title="Evolução mensal da carteira" headers={['Competência','Receita','Custo','Resultado','Pagamentos por data','Recebimentos por data']} rows={report.trend.map(row=>[month(row.month),money(row.revenue),money(row.cost),money(row.result),money(row.paid),money(row.received)])}/>
   <h3>Caixa previsto de 13 semanas</h3><p>Entradas {money(report.cash.incoming)} · saídas {money(report.cash.outgoing)} · necessidade máxima de cobertura {money(report.cash.fundingNeed)}. {contar(report.cash.overdue.length,'título vencido','títulos vencidos')}, {report.cash.undated.length} sem vencimento e {report.cash.beyondHorizon.length} além do horizonte ficam separados.</p>
   {!report.cash.hasOpening&&<Alert variant="warning"><AlertDescription>Saldo inicial não confirmado para este recorte: entradas e saídas estão disponíveis; saldo e necessidade de cobertura permanecem indisponíveis. O caixa inclui títulos existentes, sem estimar automaticamente folha futura, tributos ou serviços ainda sem obrigação cadastrada.</AlertDescription></Alert>}
   <details><summary>Conferir as 13 semanas do caixa</summary><ReportTable title="Caixa executivo semanal" headers={['Semana','Entradas','Saídas','Saldo final','Menor saldo diário']} rows={report.cash.weeks.map(week=>[`${week.index} · ${date(week.start)}`,money(week.incoming),money(week.outgoing),money(week.closing),money(week.lowest)])}/></details>
   </ExecutiveSection>
   <ExecutiveSection visible={section==='costs'||section==='execution'} label="Conferência por obra">
   <h3>Detalhamento por obra</h3><Select label="Obra do detalhamento executivo" value={current.work.id} onChange={event=>update({detailWork:event.target.value})} options={report.rows.map(row=>({value:row.work.id,label:row.work.name}))}/>
   <h4>{current.work.name}</h4>
   </ExecutiveSection>
   <ExecutiveSection visible={section==='costs'} label="Custos do relatório executivo"><p>{period} Categorias, funções e etapas mostram gastos acumulados até {month(asOf.slice(0,7))}.</p>
   <h3>Compromissos e variação de custo</h3><p>Posições de compras a faturar e títulos a pagar em {date(asOf)}. Títulos já reconhecidos não são novas compras. A previsão considera compras pendentes pelo critério de Custos por etapa; não acrescente esta posição ao custo final. Contratos sem medição, folha futura e serviços sem obrigação cadastrada não representam compromissos completos nesta consulta.</p>
   <ReportTable title="Compromissos financeiros da obra" headers={['Obra','Compras a faturar','Títulos a pagar','Incorrido acumulado','Orçamento']} rows={[[current.work.name,money(current.managementKpis.purchases.openCents),money(current.managementKpis.purchases.payableCents),money(current.incurred),money(current.budget)]]}/>
   <details><summary>Conferir compras a faturar</summary><ReportTable title="Memória dos compromissos de compra" headers={['Pedido / origem','Descrição','Saldo a faturar']} rows={current.managementKpis.purchases.items.map(item=>[`${item.documentNumber||item.sourceId} · ${item.sourceType}:${item.sourceId}`,item.description,money(item.amountCents)])}/>{!current.managementKpis.purchases.items.length&&<p>Sem compras a faturar nas fontes carregadas deste recorte. Isso não comprova ausência de contratos futuros.</p>}</details>
   <ReportTable title="Variação de custo por valor agregado" headers={['Indicador','Valor','Leitura']} rows={[
    ['Valor agregado · EV',money(current.managementKpis.variance.earned),'Orçamento correspondente ao avanço medido no mesmo escopo e corte.'],
    ['Custo incorrido · AC',money(current.managementKpis.variance.actual),'Custo acumulado por competência, incluindo os mesmos fatos do razão.'],
    ['Variação de custo · CV',money(current.managementKpis.variance.cv),current.managementKpis.variance.reason||'EV − AC. Negativo: custo acima do valor agregado; positivo não comprova lucro.'],
    ['Variação ao término · VAC',money(current.managementKpis.variance.vac),current.managementKpis.variance.forecastReason||'Orçamento − custo final previsto. Negativo: previsão acima do orçamento.'],
   ]}/>
   <p>CV exige os mesmos critérios de comparabilidade do CPI, índice de eficiência de custo: referência no último dia do mês, medição integral e base de custos compatível. O Desvio previsto sobre orçamento usa custo final menos orçamento, sinal inverso ao VAC. Estes indicadores não são somados aos gastos ou ao caixa.</p>
   <ReportTable title="Gastos acumulados por categoria" headers={['Categoria','Valor incorrido','Participação no custo líquido','Eventos']} rows={current.categories.map(row=>[row.label,money(row.amountCents),percent(current.incurred>0?row.amountCents/current.incurred:null),row.count])}/>
   {!current.categories.length&&<p>Sem gastos registrados nas fontes carregadas desta obra. Confira a cobertura antes de interpretar como custo zero.</p>}
   <h3>Gastos da equipe própria por função</h3><p>Acumulado por competência, incluindo encargos e benefícios do mesmo motor do DRE. A função usa o registro do dia quando disponível e, na falta dele, o cadastro atual. Arquivos sem função ficam separados. Estes valores já compõem Gastos acumulados por categoria; não devem ser somados novamente.</p>
   <ReportTable title="Gastos incorridos por função" headers={['Função','Mão de obra e encargos','Benefícios','Total incorrido','Base']} rows={current.roleCosts.rows.map(row=>[row.role,money(row.laborCents),money(row.benefitCents),money(row.totalCents),row.source])}/>
   <p>Conferência por função: {money(current.roleCosts.totalCents)} · mão de obra e benefícios no razão: {money(current.roleCosts.expected)} · {current.roleCosts.reconciled?'Valores conciliados':'Divergência a conferir'}.</p>
   {!current.roleCosts.rows.length&&<p>Sem custo de equipe própria reconhecido nas fontes carregadas. Presença ou previsão de horas não são transformadas em gasto sem apuração.</p>}
   <WorkforceEvolution evolution={current.workforceEvolution} type="roles"/>
   <h3>Terceirizados por prestador e contrato</h3><p>Custo incorrido vem de medições e documentos reconhecidos. Contrato cadastrado sem medição não comprova gasto realizado. Pagamentos no período e saldo a pagar são outras visões dos mesmos fatos; uma nota vinculada à medição não gera custo em dobro.</p>
   <ReportTable title="Gastos e pagamentos de terceirizados" headers={['Prestador / contrato','Especialidade','Incorrido acumulado','Pago no período','Cliente direto no período','Saldo a pagar','Base']} rows={current.thirdParties.map(row=>[`${row.name} · ${row.contractId||'Sem vínculo de contrato'}`,row.specialty,money(row.incurred),money(row.paid),money(row.clientPaid),money(row.payable),row.hasCost?'Custo reconhecido':'Sem custo reconhecido nas fontes'])}/>
   {!current.thirdParties.length&&<p>Nenhum contrato, medição ou gasto de terceiro foi encontrado para esta obra nas fontes carregadas. Confira Terceirizados e os vínculos dos documentos; a ausência de registro não comprova ausência de gasto.</p>}
   <WorkforceEvolution evolution={current.workforceEvolution} type="thirdParties"/>
   <ReportTable title="Orçamento e previsão por etapa" headers={['Etapa','Orçado','Incorrido','Compras a faturar (incluídas)','Restante','Risco e mudanças','Custo final']} rows={current.cost.report.rows.map(row=>[row.label,money(row.budget),money(row.incurred),money(row.openCommitted),money(row.remaining),money(row.contingency+row.changeImpact),current.finalCost===null?'Subtotal pendente':money(row.forecast)])}/>
   </ExecutiveSection>
   <ExecutiveSection visible={section==='execution'} label="Execução do relatório executivo">
   <h3>Equipe prevista e indicadores de execução</h3><p>Dimensionamento automático de {date(current.laborSource.start)} a {date(current.laborSource.end)}, com calendário integrado. Última equipe observada: {date(current.laborSource.rosterDate)}; não garante disponibilidade futura. A estimativa de mão de obra não é somada novamente ao custo final.</p>
   <ReportTable title="Previsão executiva de mão de obra" headers={['Função','Horas restantes','Pessoas necessárias','Última equipe observada','Déficit','Custo estimado']} rows={current.labor.groups.map(group=>[group.role,group.partial?'Parcial':number(group.hours),number(group.people),number(group.available),number(group.deficit),money(group.costCents)])}/>
   {(!current.labor.complete||current.laborSource.issues.length>0)&&<Alert variant="warning"><AlertDescription>Há pendências na previsão de equipe. Confira levantamento, ponto, jornada e custo-hora na origem; serviços ainda sem base não estão representados como demanda zero.</AlertDescription></Alert>}
   <ReportTable title="KPIs executivos da obra" headers={['Indicador','Resultado','Leitura']} rows={[
    ['Avanço pelo diário',percent(current.physical),'Produção revisada dos diários, ponderada pelo orçamento; é a base do valor agregado e do CPI. Exige medição integral do orçamento.'],['Avanço oficial da medição',percent(current.officialPhysical),'Medição técnica aprovada ou, sem ela, o percentual de cobrança. É o avanço da DRE e do painel; pode diferir do avanço pelo diário.'],
    ['PPC das semanas verificadas',percent(current.performance.planning?.value),'Cumpridos no prazo / elegíveis de semanas completas verificadas; bloqueados separados.'],
    ['Cobertura dos diários',percent(current.performance.coverage?.ratio),'Diários concluídos e revisados / dias com presença confirmada.'],
    ['Apropriação de horas',percent(current.performance.coverage?.linkedRatio),'Horas em amostras válidas / horas completas do ponto.'],
    ['CPI · eficiência de custo',number(current.cpi),current.cpiReason||'Valor agregado / custo incorrido, no mesmo corte e escopo. Menor que 1 indica custo superior ao valor agregado.'],
    ['SPI · eficiência de prazo',number(current.schedule.spi),current.schedule.earnedSchedule.reason||'Valor agregado / valor planejado da mesma versão aprovada.'],
   ]}/>
   <ScheduleIndicators report={current.schedule} planning={current.performance.planning} asOf={asOf}/>
   <details><summary>Produtividade e dispersão da obra</summary><ReportTable title="Produtividade executiva por serviço e função" headers={['Serviço / função','RUP Hh/unidade','Variação anterior','Dias','Desvio amostral','CV']} rows={(current.performance.productivity||[]).map(row=>[`${row.name} · ${row.role} · ${row.unit}`,number(row.hhPerUnit),percent(row.change),row.stats.count,number(row.stats.sampleDeviation),percent(row.stats.variationCoefficient)])}/><p>Comparação com período anterior de mesma duração. Estatísticas descritivas não comprovam capacidade preditiva. Quantidades compartilhadas entre funções e unidades diferentes não são somadas.</p></details>
   </ExecutiveSection>
   <ExecutiveSection visible={section==='costs'} label="Memória para conferência">
   <details><summary>Todos os gastos registrados · {contar(current.entries.length,'evento','eventos')}</summary><p>Memória acumulada por competência. Estornos têm sinal negativo. Gastos por categoria e etapa são agrupamentos destes mesmos fatos; pagamentos são outra visão e não são acrescentados ao custo.</p><ReportTable title="Memória completa dos gastos da obra" headers={['Competência / origem','Descrição','Categoria','Documento / contraparte','Custo líquido']} rows={current.entries.map(entry=>[`${entry.competence?month(entry.competence):'Sem competência'} · ${entry.sourceType}:${entry.sourceId}`,entry.description,entry.categoryLabel,`${entry.documentNumber||'Sem número'} · ${entry.counterparty||'Não informada'}`,money(entry.amountCents)])}/></details>
   <details><summary>Títulos em aberto e pagamentos do período</summary><ReportTable title="Títulos executivos em aberto" headers={['Direção / origem','Vencimento','Descrição','Saldo']} rows={[...current.payable.map(item=>({...item,direction:'A pagar'})),...current.receivable.map(item=>({...item,direction:'A receber'}))].map(item=>[`${item.direction} · ${item.sourceType}:${item.sourceId}`,date(item.dueDate),item.description,money(item.amountCents)])}/><ReportTable title="Pagamentos executivos realizados" headers={['Data / origem','Descrição','Forma','Valor']} rows={current.payments.map(entry=>[`${date(entry.date)} · ${entry.sourceType}:${entry.sourceId}`,entry.description,entry.direct?'Cliente direto':'Caixa',money(entry.amountCents)])}/></details>

   </ExecutiveSection>
   <details><summary>Critérios do relatório para a diretoria</summary><p>{report.includeCompany?`Despesas da empresa sem rateio no período: ${money(report.companyCost)}, fora dos custos atribuídos às obras.`:'Recorte por obra: despesas administrativas da empresa não são rateadas automaticamente.'} Confira também despesas ainda sem cadastro, arquivos históricos, folha, encargos, equipamentos e terceiros. O relatório cobre os fatos carregados; ausência de registro não comprova ausência de gasto.</p><p>{report.source}</p><p>Custo final = incorrido + restante + reserva de risco + mudanças adicionais. Restante já inclui compras pendentes. Revisão desatualizada, base inválida ou reconciliação divergente deixam o total indisponível. Cenário de caixa fica nesta sessão e não grava saldo bancário.</p><p>Resultado = receita reconhecida − custo incorrido do período; margem = resultado / receita positiva. Não projeta receita contratual ou lucro final. CPI exige custo e avanço do mesmo escopo no último dia do mês, medição integral e custo completo. Não substitui validação de engenharia ou fechamento contábil. Não há probabilidades ou previsão estatística validada.</p><p>A apresentação e o CSV incluem todas as obras do recorte, ainda que o detalhamento da tela esteja em outra obra. Consultar, exportar e imprimir não alteram registros.</p></details>
  </>}
 </>;
}
