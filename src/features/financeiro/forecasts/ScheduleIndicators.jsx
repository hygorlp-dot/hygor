import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {ForecastReportTable as ReportTable} from './ForecastReportTable.jsx';
import {forecastMoney as money,forecastDate as date} from './forecast-format.js';
import {contar} from '../../../design-system/copy.js';
const percent=value=>value==null||!Number.isFinite(value)?'Não disponível':`${(value*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
export default function ScheduleIndicators({report,planning,asOf}){return <>
   <h3>Prazo da obra</h3>
   <p>Datas do Planejamento e último avanço acumulado em diário concluído e revisado, até {date(asOf)}. Uma atividade sem medição fica separada; ausência de registro não comprova atraso nem conclusão. O progresso editado no planejamento não substitui a evidência do diário neste relatório.</p>
   <ReportTable title="Indicadores de prazo da obra" headers={['Indicador','Resultado','Base de cálculo']} rows={[
    ['Atividades vencidas com saldo confirmado',report.available?report.overdue:'Não disponível','Fim anterior à referência e avanço revisado menor que 100%.'],
    ['Vencidas sem medição confirmada',report.available?report.unverified:'Não disponível','Exigem levantamento; não são classificadas como execução atrasada.'],
    ['Maior atraso ainda aberto',report.maxOpenDelay===null?'Não disponível':`${contar(report.maxOpenDelay,'dia','dias')}`,'Dias corridos desde o fim vigente; não são atraso previsto da obra.'],
    ['Entregas nos próximos 7 dias',report.available?report.upcoming:'Não disponível','Inclui vencimento hoje e até sete dias depois, sem conclusão confirmada.'],
    ['Conclusões registradas / após prazo',report.available?`${report.completed} / ${report.lateCompleted}`:'Não disponível','Primeiro diário com 100% do ciclo atual; data do registro pode ser posterior à execução.'],
    ['Cobertura das atividades pelo diário',percent(report.coverage),`${report.measured} de ${report.total} atividades com avanço acumulado revisado.`],
    ['Fim vigente das atividades',date(report.finish),'Maior fim do planejamento, somente com todas as datas válidas. Não é previsão calculada de conclusão.'],
    ['Desvio do fim contra a base salva',report.finishDrift===null?'Não disponível':`${contar(report.finishDrift,'dia','dias')}`,report.baselineDate?`Fotografia de ${date(report.baselineDate)}; positivo indica postergação das datas. Não mede atraso realizado.`:report.reason||'Sem fotografia válida e integral na referência.'],
   ]}/>
   {!report.available&&<Alert variant="warning"><AlertDescription>{report.reason} Cadastre e confira as atividades em Planejamento para acompanhar os prazos.</AlertDescription></Alert>}
   {report.invalidDates>0&&<Alert variant="warning"><AlertDescription>{contar(report.invalidDates,'atividade','atividades')} sem datas ou identificação válidas. As contagens de vencimento e entregas cobrem somente as atividades com datas válidas; confira o Planejamento antes de decidir.</AlertDescription></Alert>}
   <h3>SPI por valor agregado</h3>
   <p>SPI compara o valor agregado do avanço revisado com o valor planejado até a referência, usando os pesos da mesma versão aprovada. Abaixo de 1 significa valor agregado inferior ao planejado; acima de 1, superior. Não estima dias de atraso ou data de conclusão.</p>
   <ReportTable title="SPI da obra" headers={['Indicador','Resultado','Base de cálculo']} rows={[
    ['Versão aprovada',report.earnedSchedule.baselineId?`V${report.earnedSchedule.number} · ${report.earnedSchedule.baselineId}`:'Não disponível',report.earnedSchedule.approvedAt?`${report.earnedSchedule.approvedBy} · ${date(report.earnedSchedule.approvedOn)}`:'Prepare e aprove a linha de base no Planejamento.'],
    ['Valor planejado · PV',money(report.earnedSchedule.pv),'Orçamento distribuído linearmente pelos dias trabalhados do calendário congelado.'],
    ['Valor agregado · EV',money(report.earnedSchedule.ev),'Pesos congelados multiplicados pelo avanço revisado dos mesmos itens.'],
    ['SPI · EV / PV',report.spi===null?'Não disponível':report.spi.toLocaleString('pt-BR',{maximumFractionDigits:3}),report.earnedSchedule.reason||'Mesmo escopo e pesos aprovados; não depende de custo incorrido.'],
    ['Variação de prazo em valor · SV',money(report.earnedSchedule.sv),'EV menos PV, em reais orçamentários; negativo indica valor agregado inferior ao planejado.'],
    ['Cobertura da medição da base',percent(report.earnedSchedule.coverage),'Proporção do orçamento congelado com medição compatível; SPI exige cobertura integral.'],
   ]}/>
   <details><summary>Conferir memória do SPI</summary>
    <ReportTable title="Memória do SPI por item" headers={['Item / atividade','Valor orçado','Valor planejado','Valor agregado','Avanço revisado','Diário / medição','Base']} rows={report.earnedSchedule.rows.map(item=>[`${item.name} · ${item.id} / ${item.taskId}`,money(item.budgetCents),money(item.plannedCents),money(item.earnedCents),percent(item.progress===null?null:item.progress/100),`${item.sourceId||'Sem diário'} · ${date(item.sourceDate)}`,item.reason||`${item.elapsedDays} de ${item.plannedDays} dias trabalhados`])}/>
    <p>A versão aprovada preserva datas, calendário e orçamento. Revisões posteriores não alteram seu conteúdo. A consulta automática usa a última aprovação até a referência; o histórico no Planejamento permite consultar versões anteriores. Os diários são os registros atualmente carregados, sem reconstrução do que era conhecido no passado. Medição ausente, incompatível ou duplicada não é presumida como zero.</p>
   </details>
   <details><summary>Conferir atividades, marcos e semanas</summary>
    <ReportTable title="Memória do prazo por atividade" headers={['Atividade / origem','Início','Fim','Avanço revisado','Situação','Dias de atraso','Diário / medição','Desvio da data contra base']} rows={report.rows.map(item=>[`${item.name} · ${item.id}`,date(item.start),date(item.finish),percent(item.progress===null?null:item.progress/100),item.state,item.lateDays??'Não disponível',item.sourceId?`${item.sourceId} · ${date(item.sourceDate)}`:item.reason,item.finishDrift===null?'Não disponível':`${contar(item.finishDrift,'dia','dias')}`])}/>
    <ReportTable title="Marcos do planejamento" headers={['Marco / origem','Data','Situação']} rows={report.milestones.map(item=>[`${item.name} · ${item.id||'Sem identificação'}`,date(item.date),item.state])}/>
    <p>Marcos com data passada exigem confirmação na origem; o cadastro de uma data não comprova a entrega. A base salva atual pode ser substituída no Planejamento e não reconstrói versões anteriores.</p>
    <ReportTable title="Confiabilidade semanal do planejamento" headers={['Semana','PPC','Elegíveis','No prazo','Bloqueados','Pendentes','Situação']} rows={(planning?.weeks||[]).map(week=>[`${date(week.start)} a ${date(week.end)}`,percent(week.value),week.total,week.completed,week.blocked,week.pending,week.state])}/>
    <p>PPC é o percentual de compromissos elegíveis cumpridos no prazo, nas semanas inteiras encerradas e verificadas do período. Bloqueados ficam separados. PPC e contagem de atividades não medem atraso em dias da obra e não substituem o SPI.</p>
   </details>

</>;}
