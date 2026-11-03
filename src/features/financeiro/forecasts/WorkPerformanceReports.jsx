import ScheduleIndicators from './ScheduleIndicators.jsx';
import {useMemo} from 'react';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {EmptyState} from '../../../design-system/patterns/FeedbackState.jsx';
import {workPerformanceReport,workPerformanceCsv} from '../../../domains/obras/performance-reports.js';
import {shiftDay} from '../../../domains/financeiro/cash-forecast.js';
import {forecastMoney as money,forecastDate as date} from './forecast-format.js';
import {contar} from '../../../design-system/copy.js';

const number=value=>value===null||value===undefined||!Number.isFinite(value)?'Não disponível':value.toLocaleString('pt-BR',{maximumFractionDigits:4});
const percent=value=>value===null||value===undefined?'Não disponível':`${(value*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const status={concluido:'Cumprido no prazo',nao_concluido:'Não cumprido no prazo',bloqueado:'Bloqueado',aberto:'Evidência ou fechamento pendente'};

export default function WorkPerformanceReports({data,workId,asOf,state={},onChange,onExport}){
 const start=state.start??shiftDay(asOf,-27);
 const report=useMemo(()=>workPerformanceReport(data,{obraId:workId,start,end:asOf}),[data,workId,start,asOf]);
 const shortcut=[7,28,90].find(days=>shiftDay(asOf,1-days)===start)||'custom';
 return <>
  <h3>Indicadores e relatórios da obra</h3>
  <p>Produção, planejamento e qualidade dos registros, com atualização pelos dados de origem carregados. Cada taxa usa sua própria base verificável.</p>
  <FilterBar label="Período dos indicadores" layout="grid">
   <Select label="Janela dos indicadores" value={String(shortcut)} onChange={event=>{if(event.target.value!=='custom')onChange({...state,start:shiftDay(asOf,1-Number(event.target.value))});}} options={[{value:'7',label:'Últimos 7 dias'},{value:'28',label:'Últimos 28 dias'},{value:'90',label:'Últimos 90 dias'},{value:'custom',label:'Período personalizado'}]}/>
   <Input label="Período inicial dos indicadores" type="date" value={start} min={shiftDay(asOf,-365)} max={asOf} onChange={event=>onChange({...state,start:event.target.value})} description="O término é a Data de referência da previsão. Limite de 366 dias."/>
  </FilterBar>
  {report.error?<Alert variant="warning"><AlertDescription>{report.error}</AlertDescription></Alert>:<>
   <dl className="financial-reports__totals" aria-label="Indicadores principais da obra">
    <div><dt>Avanço ponderado do orçamento</dt><dd>{percent(report.physical.progress)}</dd></div>
    <div><dt>PPC das semanas verificadas</dt><dd>{percent(report.planning.value)}</dd></div>
    <div><dt>Cobertura dos diários nos dias com presença</dt><dd>{percent(report.coverage.ratio)}</dd></div>
   </dl>
   <p>{date(start)} a {date(asOf)}. Comparação da produtividade: {date(report.previousStart)} a {date(report.previousEnd)}, com a mesma duração.</p>
   <p>Diários revisados em {report.coverage.reviewedDays} de {report.coverage.daysWithPresence} dias com presença confirmada. A cobertura não mede todos os dias previstos da obra. Horas vinculadas em amostras válidas: {number(report.coverage.linkedHours)} de {number(report.coverage.knownHours)} Hh completas de ponto ({percent(report.coverage.linkedRatio)}); {contar(report.coverage.incompletePeopleDays,'presença','presenças')} de pessoa/dia com horários incompletos.</p>
   {(report.physical.progress===null||report.planning.partial||report.coverage.incompletePeopleDays>0)&&<Alert variant="warning"><AlertDescription>
    {report.physical.progress===null&&<p>Avanço total indisponível: falta orçamento válido ou medição de parte dos itens. Cobertura do valor orçado medido: {percent(report.physical.coverage)}. No escopo com medição, o avanço ponderado é {percent(report.physical.measuredProgress)}; esse subtotal não representa toda a obra.</p>}
    {report.planning.partial&&<p>Há semanas encerradas com fechamento pendente. O PPC do resumo usa apenas semanas completas e verificadas; consulte as pendências antes de comparar resultados.</p>}
    {report.coverage.incompletePeopleDays>0&&<p>As horas incompletas não foram presumidas como zero nem como jornada integral. A cobertura de apropriação considera somente horas conhecidas.</p>}
   </AlertDescription></Alert>}
   <Button variant="secondary" onClick={()=>onExport(workPerformanceCsv(report))}>Exportar indicadores da obra</Button>

   <ScheduleIndicators report={report.schedule} planning={report.planning} asOf={asOf}/>
   <h3>Produtividade por serviço e função</h3>
   <p>RUP significa razão unitária de produção: soma das horas-pessoa dividida pela produção dos mesmos dias válidos. Uma RUP menor usa menos horas por unidade. Quantidades de unidades diferentes não são somadas.</p>
   {report.productivity.length?<>
    <div className="scroll-x" role="region" aria-label="Produtividade observada por serviço" tabIndex={0}><table><caption>Somente amostras com diário concluído, revisão técnica e ponto completo; não é previsão estatística</caption><thead><tr>{['Serviço','Função','Produção na amostra','Horas-pessoa','RUP (Hh/unidade)','Variação da RUP','Dias com produção'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{report.productivity.map(row=><tr key={row.id}><th scope="row">{row.name}</th><td data-label="Função">{row.role}</td><td data-label="Produção na amostra">{number(row.quantity)} {row.unit}</td><td data-label="Horas-pessoa">{number(row.hours)}</td><td data-label="RUP (Hh/unidade)">{number(row.hhPerUnit)}</td><td data-label="Variação da RUP">{percent(row.change)}</td><td data-label="Dias com produção">{row.stats.count}</td></tr>)}</tbody></table></div>
    {report.productivity.map(row=><details key={row.id}><summary>Amostra · {row.name} · {row.role}</summary>
     <p>Produção por hora: {number(row.productivity)} {row.unit}/Hh. RUP do período anterior: {number(row.previousRup)} Hh/{row.unit}. Variação negativa indica redução de horas por unidade; não comprova causa ou ganho estatisticamente significativo.</p>
     <p>RUP diária: mínimo {number(row.stats.min)}, máximo {number(row.stats.max)}, média simples {number(row.stats.mean)}; desvio padrão amostral {number(row.stats.sampleDeviation)}; coeficiente de variação (CV) {percent(row.stats.variationCoefficient)}. Desvio e CV exigem ao menos dois dias com produção e média positiva. A RUP agregada é ponderada pela quantidade e pode diferir dessa média simples.</p>
     <p>{contar(row.zeroProductionDays,'dia','dias')} com produção zero: suas horas entram na RUP agregada, mas esses dias ficam fora da dispersão de razões diárias. Funções presentes na mesma atividade compartilham a quantidade de referência; não some a produção entre funções.</p>
     <ul>{row.days.map(day=><li key={`${day.reportId}:${day.date}`}>{date(day.date)} · diário {day.reportId}: {number(day.quantity)} {row.unit}, {number(day.hours)} Hh.<details><summary>Ponto de origem</summary><ul>{day.points.map(point=><li key={point.employeeId}>{data.employees?.find(person=>person.id===point.employeeId)?.name||point.employeeId} · {number(point.hours)} Hh apropriadas · registro {point.employeeId}@{day.date}</li>)}</ul><p>Os horários completos de origem acompanham o CSV exportado.</p></details></li>)}</ul>
    </details>)}
   </>:<EmptyState title="Produtividade ainda não disponível" description="O engenheiro deve registrar produção, vínculo orçamentário e equipe no diário; o ponto precisa de horários completos. Após revisão e conclusão, as amostras válidas aparecem aqui."/>}

   <h3>Avanço acumulado com peso do orçamento</h3>
   <p>O peso de cada item é quantidade orçada × custo unitário. O último avanço acumulado revisado fornece sua medição; percentuais de dias diferentes não são somados. Itens com valor zero não compõem a ponderação.</p>
   {report.physical.rows.length?<div className="scroll-x" role="region" aria-label="Memória do avanço ponderado" tabIndex={0}><table><caption>Pesos e medições da base de controle atual · {report.budgetId}</caption><thead><tr>{['Item','Peso orçado','Avanço acumulado','Diário de origem','Data da medição'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{report.physical.rows.map(row=><tr key={row.id}><th scope="row">{row.name}</th><td data-label="Peso orçado">{money(row.weight)}</td><td data-label="Avanço acumulado">{percent(row.progress)}</td><td data-label="Diário de origem">{row.sourceId||'Não disponível'}</td><td data-label="Data da medição">{date(row.sourceDate)}</td></tr>)}</tbody></table></div>:<EmptyState title="Orçamento de controle indisponível" description="Defina a base de controle da obra no Orçamento para ponderar as medições. A ausência de orçamento não impede a consulta das outras fontes disponíveis."/>}

   <h3>Cumprimento do planejamento semanal</h3>
   <p>PPC é o percentual de compromissos cumpridos como prometido. Este relatório verifica as quantidades de avanços confirmados até a data prometida, na mesma obra e atividade. Entrega posterior ao prazo não conta como cumprimento no prazo. Registros de produção do planejamento e do diário não são somados entre si.</p>
   <p>Somente semanas de segunda a domingo inteiras no recorte e já encerradas recebem PPC definitivo, com fechamento de todos os elegíveis. Bloqueados ficam separados e fora da base, conforme a política atual do Planejamento; não estão classificados como compromissos liberados. Semanas verificadas: {report.planning.coveredWeeks}.</p>
   {report.planning.weeks.length?<>
    <div className="scroll-x" role="region" aria-label="PPC semanal verificado" tabIndex={0}><table><caption>Concluídos no prazo ÷ elegíveis; sem evidência suficiente, o resultado fica indisponível</caption><thead><tr>{['Semana','PPC','No prazo / elegíveis','Bloqueados fora da base','Pendentes','Situação'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{report.planning.weeks.map(week=><tr key={week.start}><th scope="row">{date(week.start)} a {date(week.end)}</th><td data-label="PPC">{percent(week.value)}</td><td data-label="No prazo / elegíveis">{week.completed} / {week.total}</td><td data-label="Bloqueados fora da base">{week.blocked}</td><td data-label="Pendentes">{week.pending}</td><td data-label="Situação">{week.state}</td></tr>)}</tbody></table></div>
    {report.planning.weeks.map(week=><details key={week.start}><summary>Compromissos e motivos · {date(week.start)} a {date(week.end)}</summary><ul>{week.items.map(item=><li key={item.id}>{item.name} · {item.id} · prometido para {date(item.due)}: meta {number(item.promised)}, produzido no prazo {number(item.producedOnTime)} · {status[item.status]}. {item.cause} Avanços de origem: {item.evidenceIds||'Não disponíveis'}.</li>)}</ul><p>Motivos de não cumprimento: {week.causes.map(cause=>`${cause.cause} (${cause.count})`).join('; ')||'Nenhum motivo registrado neste recorte.'}</p></details>)}
   </>:<EmptyState title="Sem compromissos semanais no recorte" description="Registre compromissos com data e meta no Planejamento e confirme os avanços vinculados. A ausência de plano não é PPC zero."/>}

   <h3>Registro diário e pendências</h3>
   {report.coverage.rows.length?<div className="scroll-x" role="region" aria-label="Cobertura diária de ponto e diário" tabIndex={0}><table><caption>Dias com ponto ou diário carregado para a obra</caption><thead><tr>{['Dia','Pessoas presentes','Horas completas','Horas vinculadas','Diário revisado','Origem / pendências'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{report.coverage.rows.map(row=><tr key={row.date}><th scope="row">{date(row.date)}</th><td data-label="Pessoas presentes">{row.present}</td><td data-label="Horas completas">{number(row.completeHours)}</td><td data-label="Horas vinculadas">{number(row.linkedHours)}</td><td data-label="Diário revisado">{row.reviewed?'Sim':'Não'}</td><td data-label="Origem / pendências">{row.reportIds||'Sem diário'}{row.messages.length?` · ${row.messages.join(' ')}`:''}</td></tr>)}</tbody></table></div>:<p>Sem ponto ou diário da obra no período. Nenhuma presença ou jornada foi presumida.</p>}
   <details><summary>Pendências e exclusões da base ({report.issues.length})</summary>{report.issues.length?<ul>{report.issues.map((issue,index)=><li key={index}>{issue.date?`${date(issue.date)} · `:''}{issue.source}: {issue.message}</li>)}</ul>:<p>Sem pendências detectadas nas fontes verificadas.</p>}</details>
   <details><summary>Memória, fórmulas e limites dos indicadores</summary><p>Avanço = soma de peso orçado × avanço acumulado ÷ valor total dos itens com custo positivo. Sem medição de todo esse escopo ou com base orçamentária inválida, o avanço total fica indisponível. A medição é acumulada até a referência; produtividade e cobertura usam o período selecionado.</p><p>Cobertura dos diários = dias com diário único concluído e revisado ÷ dias com presença confirmada no ponto. Apropriação = horas em amostras válidas de serviços ÷ horas completas do ponto. Horas incompletas, revisões pendentes e terceiros sem apropriação reduzem a base observável; não significam produtividade zero.</p><p>PPC do resumo é ponderado pela quantidade de compromissos das semanas verificadas; não é média simples das porcentagens semanais. CV = desvio padrão amostral das RUP diárias ÷ média simples dessas razões. Estatísticas descritivas não comprovam previsão, causalidade ou significância estatística.</p><p>Dados e correções são os atualmente carregados. Histórico arquivado não disponível nesta consulta e fechamento conhecido no passado não são reconstruídos. Os CSVs guardam fontes e premissas para conferência. Consultar e exportar não grava ponto, diário, produção nem lançamentos financeiros.</p><p>Referência do PPC: <a href="https://leanconstruction.org/glossary/" target="_blank" rel="noreferrer">Lean Construction Institute</a>.</p></details>
  </>}
 </>;
}
