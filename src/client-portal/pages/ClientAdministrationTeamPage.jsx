import {useEffect,useState} from 'react';
import {PageHeader} from '../../design-system/patterns/PageHeader.jsx';
import {WorkspaceNavigation} from '../../design-system/patterns/WorkspaceNavigation.jsx';
import {EmptyState,LoadingState} from '../../design-system/patterns/FeedbackState.jsx';
import {DataTable} from '../../design-system/data/DataTable.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Button} from '../../design-system/primitives/Button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {readClientPortalDashboard} from '../services/clientPortalApi.js';
import {portalDate,portalMoney,portalPercent,portalPeriod} from '../format.js';
import {ClientStatementActions} from '../components/ClientStatementActions.jsx';

const value=amount=>amount==null?'Em apuração':portalMoney(amount);
const navigation=[{id:'payroll',label:'Folha detalhada'},{id:'provisions',label:'Provisionamentos'},{id:'attendance',label:'Folha de ponto'}];
const columns=[{key:'label',header:'Composição',hideable:false},{key:'amount',header:'Valor',hideable:false,render:row=>value(row.amount)}];
function MemberDetails({member,view}){
 const composition=view==='provisions'?[['13º salário',member.provisions.thirteenth],['Férias e adicional de 1/3',member.provisions.vacation],...(member.provisions.source==='referencia'?[['Encargos sobre 13º e férias',member.provisions.chargesOnReserve],['Aviso prévio indenizado',member.provisions.notice],['FGTS sobre aviso',member.provisions.noticeFgts],['Reflexos do aviso',member.provisions.noticeAccrual],['Reserva da multa do FGTS',member.provisions.fine],...(member.provisions.rounding?[['Arredondamento dos detalhes',member.provisions.rounding]]:[])]:[['FGTS sobre as reservas',member.provisions.fgts],['Reserva da multa do FGTS',member.provisions.fine],['Outras reservas cadastradas',member.provisions.other]]),['Reserva estimada do período',member.provisions.monthly],['Já incluído no custo',member.includedReserve],['Reserva adicional para repasse',member.additionalReserve]]:
  [['Remuneração apropriada à obra',member.gross],['Benefícios',member.benefits],['Encargos e provisões já incluídos',member.charges],['Custo reconhecido',member.recognized],['Encargos complementares previstos',member.additionalCharges],['Reserva adicional para repasse',member.additionalReserve],['Repasse previsto ao cliente',member.passThrough],['Líquido de folha fechada',member.closedNet]];
 return <details className="arcd-client-disclosure"><summary><div><strong>{member.name}</strong><span>Função no cadastro: {member.role}</span></div><span>{view==='attendance'?`${member.attendance.length} dias neste recorte`:value(view==='provisions'?member.provisions.monthly:member.passThrough)}</span><span>Ver detalhes</span></summary><div className="arcd-client-disclosure__body">
  {view==='attendance'?member.attendance.length?<DataTable rowKey="date" data={member.attendance} columns={[
   {key:'date',header:'Dia',render:row=>portalDate(row.date)},
   {key:'status',header:'Situação'},
   {key:'hours',header:'Horários registrados',render:row=><>{row.start||'—'} às {row.end||'—'}{(row.breakStart||row.breakEnd)&&<small> · intervalo {row.breakStart||'—'} às {row.breakEnd||'—'}</small>}</>},
   {key:'overtime',header:'Horas extras',render:row=>`${new Intl.NumberFormat('pt-BR').format(row.overtime)} h`},
  ].map(column=>({...column,hideable:false}))}/>:<p>Sem apontamento individual neste mês. O custo pode vir do contrato mensal ou de um fechamento.</p>:
  view==='provisions'&&!member.provisions.included?<p>Funcionário não incluído nas reservas deste mês no ERP. Isso não confirma ausência de obrigações; solicite a conferência à equipe.</p>:<><DataTable rowKey="label" data={composition.map(([label,amount])=>({label,amount}))} columns={columns}/>{view==='provisions'&&<p>{member.provisions.source==='referencia'?'Estimativa sobre a remuneração da obra, com os parâmetros de repasse do ERP.':member.provisions.source==='cadastrada'?'Reserva cadastrada no ERP.':'Estimativa com a configuração atual do ERP.'} Base incompleta permanece em apuração.</p>}</>}
 </div></details>;
}
export function ClientAdministrationTeamPage({data,permissions={}}){
 const initial=data.administrationTeam?.[0],projectId=data.project.id;
 const [month,setMonth]=useState(initial?.month||''),[view,setView]=useState('payroll'),[query,setQuery]=useState(''),[report,setReport]=useState(initial),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!initial||!month)return;
  const controller=new AbortController();setError('');
  if(month===initial.month){setReport(initial);return()=>controller.abort();}
  setReport(null);
  readClientPortalDashboard(projectId,{month,signal:controller.signal}).then(response=>{if(!controller.signal.aborted){const next=response.portal.administrationTeam?.[0];if(!next)throw new Error('Esta consulta não está mais liberada. Atualize o portal ou fale com a equipe.');setReport(next);}}).catch(failure=>{if(!controller.signal.aborted)setError(failure.message);});
  return()=>controller.abort();
 },[projectId,month,initial,retry]);
 const current=report?.id===`administracao-${projectId}-${month}`?report:null;
 const members=(current?.members||[]).filter(member=>`${member.name} ${member.role}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
 const administration=current?.administration,workforce=current?.workforce;
 return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Administração e equipe" description="Confira a administração do contrato e o repasse completo dos custos da equipe."/>
 {!initial?<EmptyState title="Administração e equipe ainda não liberados" description="A equipe precisa liberar esta consulta para sua obra e seu perfil."/>:<>
 <div className="arcd-client-actions"><Input label="Mês da consulta" type="month" max={initial.month} value={month} onChange={event=>{if(event.target.value)setMonth(event.target.value);}}/></div>
 {error?<Alert variant="destructive"><AlertDescription>{error} <Button variant="secondary" onClick={()=>setRetry(count=>count+1)}>Tentar novamente</Button></AlertDescription></Alert>:!current?<LoadingState label="administração e equipe"/>:!current.available?<EmptyState title="Valores em conferência" description="A equipe precisa conferir as fontes antes de apresentar o repasse completo."/>:<>
 <p>{portalPeriod(current.month)} · posição em {portalDate(current.asOf)}.{current.partial?' Mês em andamento; os valores podem mudar.':''}</p>
 <section className="arcd-client-section" aria-label="Taxa de administração"><h3>Administração do mês</h3>{!administration.applicable?<p>O contrato cadastrado não prevê taxa de administração.</p>:<>
 <div className="arcd-client-financial-grid"><article><span>Administração a emitir · estimativa</span><strong>{value(administration.toIssue)}</strong><small>A equipe precisa conferir e emitir a cobrança.</small></article><article><span>Taxa do contrato</span><strong>{administration.rate===null?'Conferir contrato':portalPercent(administration.rate)}</strong><small>Base prevista: {value(administration.base)}</small></article><article><span>Já emitido como administração</span><strong>{value(administration.issued)}</strong><small>Sobre o custo registrado: {value(administration.registeredCalculated)}</small></article></div>
 <details className="arcd-client-disclosure"><summary>Como chegamos ao valor</summary><div className="arcd-client-disclosure__body"><p>Base registrada no ERP {value(administration.registeredBase)}{administration.categories.labor?` + encargos complementares ${value(administration.additionalCharges)} + reserva adicional da equipe ${value(administration.additionalReserve)}`:''} = base prevista {value(administration.base)}. A taxa de {portalPercent(administration.rate)} é aplicada sobre essa base.</p><p>Entram conforme o contrato: {Object.entries({labor:'mão de obra e benefícios',materials:'materiais elegíveis',thirdParties:'terceirizados',equipment:'equipamentos e locação',fieldEngineering:'engenharia de campo',other:'demais custos'}).filter(([key])=>administration.categories[key]).map(([,label])=>label).join(', ')}.</p><p>A reserva já incluída no custo não é somada novamente. Valor já emitido não significa valor recebido.</p>{administration.aboveCalculated>0&&<p>O valor emitido supera a estimativa atual em {value(administration.aboveCalculated)}. A equipe precisa conferir; nenhum estorno é feito por esta consulta.</p>}</div></details>
 </>}</section>
 <section className="arcd-client-section" aria-label="Repasse da equipe"><h3>Custos da equipe para repasse</h3>{workforce.pendingReserves>0&&<Alert><AlertDescription>O custo já registrado está disponível. Faltam bases de provisionamento ou detalhes do histórico para concluir o repasse com todas as reservas. A equipe precisa conferir o cadastro; o total permanece em apuração.</AlertDescription></Alert>}<div className="arcd-client-financial-grid"><article><span>Repasse previsto ao cliente</span><strong>{value(workforce.passThrough)}</strong><small>Inclui todos os custos apropriados e a reserva adicional.</small></article><article><span>Custo já reconhecido</span><strong>{value(workforce.recognized)}</strong><small>Já contém encargos e provisões do ERP.</small></article><article><span>Complemento previsto para repasse</span><strong>{workforce.additionalReserve==null||workforce.additionalCharges==null?'Em apuração':value(workforce.additionalReserve+workforce.additionalCharges)}</strong><small>Encargos {value(workforce.additionalCharges)} e reserva {value(workforce.additionalReserve)}, ainda não incluídos no custo.</small></article></div>
 <p>O repasse da equipe e a taxa de administração são valores distintos. Líquido fechado não comprova pagamento. O modelo de repasse calcula as reservas sobre a remuneração apropriada no período. Reservas mensais individuais cadastradas seguem seu rateio entre obras. EPI e exames de admissão/demissão vêm das compras ou despesas reais, sem reserva automática.</p>
 {workforce.unassigned!==0&&<p>Custos sem detalhe por funcionário, histórico ou arredondamento: {value(workforce.unassigned)}. Esses valores, inclusive rescisões registradas, permanecem no repasse total.</p>}
 </section>
 {permissions.downloadDocuments&&permissions.viewCosts&&<ClientStatementActions projectId={projectId} month={month}/>}
 <WorkspaceNavigation label="Detalhes da equipe" items={navigation} active={view} onChange={setView}/>
 <Input label="Buscar funcionário ou função" type="search" value={query} onChange={event=>setQuery(event.target.value)}/>
 {view==='provisions'&&<p>Reserva estimada da equipe: {value(workforce.reserve)}. Já incluído no custo: {value(workforce.includedReserve)}. Apenas a diferença positiva entra como reserva adicional no repasse.</p>}
 <div className="arcd-client-stack">{members.length?members.map(member=><MemberDetails key={`${view}-${member.id}`} member={member} view={view}/>):<EmptyState title="Nenhum funcionário neste recorte" description="Confira o mês e a busca. Históricos sem detalhe individual continuam no total."/>}</div>
 {view==='attendance'&&<p>Somente registros e dias vinculados a esta obra. Campos vazios não confirmam jornada cumprida. Ausências aparecem sem motivo médico ou observação interna.</p>}
 </>}
 </>}
 </section>;
}
