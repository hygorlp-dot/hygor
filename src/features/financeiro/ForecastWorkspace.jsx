import AccountingIndicators from './forecasts/AccountingIndicators.jsx';
import {canUseCompanyAccounting} from '../../domains/financeiro/accounting-indicators.js';
import {useMemo,useState} from 'react';
import {Button} from '../../design-system/primitives/Button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {FilterBar} from '../../design-system/patterns/FilterBar.jsx';
import {PageHeader} from '../../design-system/patterns/PageHeader.jsx';
import {WorkspaceNavigation} from '../../design-system/patterns/WorkspaceNavigation.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {EmptyState} from '../../design-system/patterns/FeedbackState.jsx';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {createReportLedger} from '../../domains/financeiro/report-center.js';
import {cashThirteenWeeks,costAtCompletion,forecastCsv,FORECAST_VERSION} from '../../domains/financeiro/management-forecasts.js';
import {isFinancialDate} from '../../domains/financeiro/dates.js';
import CashThirteenWeeks from './forecasts/CashThirteenWeeks.jsx';
import CostAtCompletion from './forecasts/CostAtCompletion.jsx';
import LaborDemand from './forecasts/LaborDemand.jsx';
import WorkPerformanceReports from './forecasts/WorkPerformanceReports.jsx';
import ExecutiveWorkReport from './forecasts/ExecutiveWorkReport.jsx';
import './financial-reports.css';


const areas=[{id:'cash',label:'Caixa de 13 semanas'},{id:'cost',label:'Custo final por obra'},{id:'labor',label:'Previsão de mão de obra'},{id:'kpis',label:'Indicadores da obra'},{id:'executive',label:'Relatório para diretoria'},{id:'accounting',label:'Indicadores contábeis'}];
export default function ForecastWorkspace({data,currentUser,calcPeriod,today,view,onViewChange,obraId,onObraChange,onOpen,onCosts,dispatchCommand}){
  const [local,setLocal]=useState({area:'cash',asOf:today,cash:{},labor:{}}),[exportError,setExportError]=useState('');
  const state=view||local,setState=onViewChange||setLocal,area=areas.some(item=>item.id===state.area)?state.area:'cash';
  const update=patch=>setState(previous=>({...previous,...patch}));
  useHelpTopic('fin_previsoes',area==='accounting'&&state.accounting?.section==='bases'?'fin_previsoes_accounting_base':`fin_previsoes_${area}`);
  const allowed=['admin','financeiro'].includes(currentUser?.role)&&currentUser?.active!==false;
  const works=(data.obras||[]).filter(work=>!currentUser?.obraId||String(work.id)===String(currentUser.obraId));
  const work=currentUser?.obraId||obraId||'all',asOf=state.asOf??today,validDate=isFinancialDate(asOf)&&asOf<=today,validWork=work==='all'||works.some(item=>item.id===work);
  const ledger=useMemo(()=>allowed&&validDate&&validWork&&area==='cash'?createReportLedger(data,calcPeriod,{kind:'due',group:'work',start:asOf,end:asOf,asOf,obraId:work,account:'all',status:'all'}).ledger:null,[data,calcPeriod,allowed,validDate,validWork,asOf,work,area]);
  const costs=useMemo(()=>allowed&&validDate&&validWork&&['cost','labor'].includes(area)?costAtCompletion(data,{workIds:works.filter(item=>work==='all'||item.id===work).map(item=>item.id),asOf}):[],[data,allowed,validDate,validWork,area,work,asOf]);
  const cashState=state.cash||{},scope=JSON.stringify([work,asOf,cashState.account||'all']);
  const cents=cashState.opening==null||String(cashState.opening).trim()===''?null:Math.round(Number(cashState.opening)*100);
  const cash=useMemo(()=>allowed&&validDate&&validWork&&area==='cash'?cashThirteenWeeks(data,ledger,{today:asOf,obraId:work,account:cashState.account||'all',openingCents:cashState.openingScope===scope&&Number.isSafeInteger(cents)?cents:null,receiptDelay:Number(cashState.delay||0),includeOverdue:Boolean(cashState.overdue)}):null,[data,ledger,allowed,validDate,validWork,area,asOf,work,cashState.account,cashState.openingScope,scope,cents,cashState.delay,cashState.overdue]);
  const context=[['MARCELL','Previsões gerenciais'],['Metodologia',FORECAST_VERSION],['Referência',asOf],['Obra',work==='all'?'Todas as obras e empresa':works.find(item=>item.id===work)?.name||'Não disponível'],['Base',area==='accounting'?'Balancete importado, conferência e revisões preservadas; sem lançamentos financeiros':'Registros atuais; cenários pessoais da sessão, sem gravação financeira']];
  function exportRows(name,rows){setExportError('');try{const url=URL.createObjectURL(new Blob([forecastCsv([...context,...rows])],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`marcell-${name}-${asOf}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setExportError('Não foi possível exportar. Confira a permissão de download e tente novamente.');}}
  if(!allowed)return <EmptyState title="Consulta não disponível para este perfil" description="As previsões financeiras exigem um perfil administrador ou financeiro autorizado." />;
  return <section className="financial-reports" aria-label="Previsões gerenciais">
    {area!=='executive'&&<PageHeader headingLevel={2} title="Previsões gerenciais" description="Previsões e indicadores da obra e da empresa com fontes, premissas e memória de cálculo." />}
    <WorkspaceNavigation label="Consulta de previsões" active={area} onChange={value=>update({area:value})} items={areas}/>
    {area==='executive'?<details className="financial-reports__options" open={!validDate||!validWork}><summary>Obra e referência · {works.find(item=>item.id===work)?.name||'Todas as obras e empresa'} · {asOf.split('-').reverse().join('/')}</summary><FilterBar label="Contexto das previsões" layout="grid" align="start"><Select label="Obra da previsão" value={work} disabled={Boolean(currentUser?.obraId)} onChange={event=>onObraChange(event.target.value)}><option value="all">Todas as obras e empresa</option>{works.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</Select><Input label="Data de referência da previsão" type="date" max={today} value={asOf} onChange={event=>update({asOf:event.target.value})} description="Usa o cadastro atual; não reconstrói o que era conhecido no passado." /></FilterBar></details>:<FilterBar label="Contexto das previsões" layout="grid" align="start"><Select label="Obra da previsão" value={work} disabled={Boolean(currentUser?.obraId)} onChange={event=>onObraChange(event.target.value)}><option value="all">Todas as obras e empresa</option>{works.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</Select><Input label="Data de referência da previsão" type="date" max={today} value={asOf} onChange={event=>update({asOf:event.target.value})} description="Usa o cadastro atual; não reconstrói o que era conhecido no passado." /></FilterBar>}
    {exportError&&<Alert variant="destructive"><AlertDescription>{exportError}</AlertDescription></Alert>}
    {!validDate||!validWork?<Alert variant="warning"><AlertDescription>Confira a data de referência e selecione uma obra disponível para o seu perfil.</AlertDescription></Alert>:<>
      {area==='accounting'&&(work==='all'&&canUseCompanyAccounting(currentUser)?<AccountingIndicators data={data} asOf={asOf} state={state.accounting||{}} onChange={accounting=>update({accounting})} dispatchCommand={dispatchCommand} onExport={rows=>exportRows('indicadores-contabeis',rows)}/>:<EmptyState title="Selecione a posição da empresa" description="Rentabilidade contábil, liquidez e endividamento exigem o balancete completo da empresa. Use Todas as obras e empresa com um perfil administrador ou financeiro de acesso geral; estes índices não são rateados por obra."/>)}
      {area==='cash'&&cash&&<CashThirteenWeeks {...{data,cash,scope,onOpen,asOf}} state={cashState} onChange={patch=>update({cash:{...cashState,...patch}})} onExport={rows=>exportRows('caixa-13-semanas',rows)} />}
      {area==='cost'&&<CostAtCompletion reports={costs} onCosts={onCosts} onExport={rows=>exportRows('custo-final',rows)} />}
      {area==='executive'&&<ExecutiveWorkReport data={data} includeCompany={work==='all'&&!currentUser?.obraId} workIds={works.filter(item=>work==='all'||item.id===work).map(item=>item.id)} asOf={asOf} scope={JSON.stringify([work,asOf])} state={state.executive||{}} onChange={executive=>update({executive})} onExport={rows=>exportRows('relatorio-executivo',rows)} />}
      {area==='kpis'&&(work==='all'?<EmptyState title="Escolha uma obra para consultar os indicadores" description="Produtividade, medições e compromissos exigem uma obra definida para preservar as fontes e unidades."/>:<WorkPerformanceReports data={data} workId={work} asOf={asOf} state={state.performance||{}} onChange={performance=>update({performance})} onExport={rows=>exportRows('indicadores-obra',rows)} />)}
      {area==='labor'&&(work==='all'?<EmptyState title="Escolha uma obra para dimensionar a equipe" description="Quantidade restante, produtividade e disponibilidade são premissas da obra selecionada." />:<LaborDemand data={data} key={work} workId={work} asOf={asOf} budget={costs[0]?.report.budget} state={state.labor?.[work]} onChange={labor=>update({labor:{...state.labor,[work]:labor}})} onExport={rows=>exportRows('mao-de-obra',rows)} />)}
    </>}
    <details><summary>Fontes, premissas e alcance</summary><p>Caixa usa títulos em aberto e seus saldos canônicos. Custo final usa o acumulado por competência até o mês da referência, orçamento de controle e revisões das etapas. Mão de obra integra os levantamentos revisados do diário com o ponto e permite simulação manual separada; não substitui a projeção da folha. Indicadores da obra cruzam orçamento, diário, ponto e avanços confirmados do Planejamento; cada taxa informa sua base e suas exclusões.</p><p>Pagamentos, custos, pedidos e recebimento físico têm significados diferentes. Consultar previsões não altera datas, valores, pessoal ou cronograma. Em Indicadores contábeis, importar e conferir grava apenas a base contábil e sua revisão; não cria lançamentos financeiros. Referências automáticas e cenários não representam previsões estatísticas validadas.</p><p>Os cenários de previsão ficam na sessão aberta deste usuário. As bases contábeis importadas e conferidas ficam registradas no histórico da empresa. Recarregar a página ou sair do sistema descarta o cenário. Exporte a memória para guardar as premissas; nenhum relatório garante recebimento, disponibilidade de equipe ou cobertura integral dos custos futuros.</p></details>
  </section>;
}
