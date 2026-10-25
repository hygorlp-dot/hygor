import {useCallback,useEffect,useState} from 'react';
import {Btn,Inp,Modal,fmt,fmtDateFull} from '../../../LegacyApp';
import {employeeDocumentsRequest,carregarQuinzenaArquivada} from '../../../api.js';
import {EmployeeDossier} from './EmployeeDossier.jsx';
import {EmployeeEngineering} from './EmployeeEngineering.jsx';
import ReceivedPointReview from '../../ponto-eletronico/components/ReceivedPointReview.jsx';
import {employeeDossierStatus} from '../employee-dossier-status.js';
import {employeeComplianceStatus} from '../compliance.js';
import {employeeLifecycleStatus} from '../employee-commands.js';
import {employmentRelationshipOnDate} from '../employment-relationship.js';
import {remunerationModeOnDate} from '../remuneration-mode.js';
import {getAtt,getDays,getQ,isEmployeeEmployedOnDate} from '../../ponto/attendance-engine.js';
import {resolveEmployeeAttendanceObraId} from '../../ponto/permissions.js';
import {active} from '../../financeiro/ledger.js';
import {resumoTituloFolha} from '../../conciliacao/payroll.js';
import {advancePaymentStatus} from '../advance-settlements.js';
import {calculateLaborProvision,laborProvisionDraftForEmployee} from '../../ponto/labor-provisions.js';
import {isCltPayrollOnDate} from '../payroll-classification.js';
import {employeeEngineeringBusinessDate,employeeEngineeringCurrentObra} from '../employee-engineering.js';
import './employee-file.css';

const statusLabel={ativo:'Ativo',desligamento_agendado:'Desligamento agendado',desligado:'Desligado',arquivado:'Arquivado'};
const pointStatus={P:'Presente',M:'Meia jornada',F:'Falta',A:'Atestado',J:'Justificada',FE:'Férias',FO:'Folga'};
const field=(label,value)=><div key={label}><dt>{label}</dt><dd>{value==null||value===''?'Não informado':value}</dd></div>;

export function EmployeeFile({employee,data,currentUser,dispatchCommand,showToast,onClose,onEdit,onExport,onNavigate}){
  const [section,setSection]=useState('summary'),[competence,setCompetence]=useState(employeeEngineeringBusinessDate().slice(0,7)),[reviewDay,setReviewDay]=useState('');
  const [documents,setDocuments]=useState({loaded:false,items:[],error:''});
  const [archives,setArchives]=useState({}),[archiveBusy,setArchiveBusy]=useState(''),[archiveError,setArchiveError]=useState('');
  const privateAccess=['admin','rh'].includes(currentUser?.role),canPoint=!employee.engineeringHistoryOnly&&['admin','rh','engenheiro'].includes(currentUser?.role),asOf=employeeEngineeringBusinessDate();
  const onDocumentsChanged=useCallback(items=>setDocuments({loaded:true,items,error:''}),[]);
  useEffect(()=>{
    if(!privateAccess)return;
    let live=true;setDocuments({loaded:false,items:[],error:''});
    employeeDocumentsRequest({employeeId:employee.id,documentAction:'list'}).then(result=>{
      if(!live)return;
      if(!result.ok)throw Error(result.error||'Não foi possível consultar o prontuário.');
      setDocuments({loaded:true,items:result.documents||[],error:''});
    }).catch(error=>{if(live)setDocuments({loaded:false,items:[],error:error.message});});
    return()=>{live=false;};
  },[employee.id,privateAccess]);
  const checklist=privateAccess?employeeDossierStatus(employee,documents.items,asOf):null;
  const expired=employeeComplianceStatus(employee,asOf).expired;
  const engineering=(data.employeeEngineeringRecords||[]).filter(record=>String(record.employeeId)===String(employee.id));
  const pendingEngineering=engineering.filter(record=>['pending','acknowledged'].includes(record.status));
  const advances=(data.advances||[]).filter(advance=>String(advance.empId)===String(employee.id));
  const pendingAdvances=privateAccess?advances.filter(advance=>advance.paymentTitleId&&['pending','partial'].includes(advancePaymentStatus(advance,data).status)):[];
  const provision=privateAccess&&isCltPayrollOnDate(employee,asOf)?calculateLaborProvision(laborProvisionDraftForEmployee(employee,competence)):null;
  const notices=[
    ...(privateAccess&&checklist.registrationIssues.length?[{tab:'data',label:`${checklist.registrationIssues.length} dado(s) do cadastro para conferir`}]:[]),
    ...(privateAccess&&documents.loaded&&checklist.pending.length?[{tab:'documents',label:`${checklist.pending.length} item(ns) do prontuário para conferir`}]:[]),
    ...(!privateAccess&&expired.length?[{tab:'data',label:`${expired.length} validade(s) de ASO ou treinamento vencida(s)`}]:[]),
    ...(pendingAdvances.length?[{tab:'payments',label:`${pendingAdvances.length} adiantamento(s) com pagamento pendente`}]:[]),
    ...(provision?.errors.length?[{tab:'payments',label:'Reserva trabalhista com apuração pendente'}]:[]),
    ...(pendingEngineering.length?[{tab:'engineering',label:`${pendingEngineering.length} aviso(s) de engenharia em aberto`}]:[]),
  ];
  const tabs=[['summary','Resumo e pendências'],['data','Dados'],...(privateAccess?[['documents','Documentos e fotos']]:[]),...(canPoint?[['point','Ponto']]:[]),...(privateAccess?[['payments','Pagamentos']]:[]),['history','Histórico'],['engineering','Engenharia']];
  const workName=id=>(data.obras||[]).find(obra=>String(obra.id)===String(id))?.name||id||'Sem lotação';
  const currentWork=employee.engineeringHistoryOnly?'Histórico nesta obra':workName(employeeEngineeringCurrentObra(data,employee,asOf));
  const navigate=tab=>{onClose();onNavigate?.(tab);};
  const [year,month]=competence.split('-').map(Number);
  const monthDays=getDays(year,month-1);
  const periodArchives=Object.entries(data.quinzenasArquivadas||{}).flatMap(([id,meta])=>{
    const match=/^(\d{4})-(\d{2})-Q([12])$/.exec(id);if(!match)return [];
    const cycles=getQ(Number(match[1]),Number(match[2])-1),dates=match[3]==='1'?cycles.q1:cycles.q2;
    const from=meta?.inicio||dates[0],to=meta?.fim||dates.at(-1);
    return from<=monthDays.at(-1)&&to>=monthDays[0]?[{id,from,to,label:meta?.label||id}]:[];
  });
  const loadArchive=async id=>{
    setArchiveBusy(id);setArchiveError('');
    try{
      const result=await carregarQuinzenaArquivada(id);if(!result.ok)throw Error(result.erro||'Não foi possível consultar o arquivo.');
      // Consulta local somente deste funcionário; nunca restaura nem mescla
      // a fotografia do arquivo no estado canônico usado pela folha/DRE.
      setArchives(current=>({...current,[id]:{attendance:result.arquivo?.attendance?.[employee.id]||{}}}));
    }catch(error){setArchiveError(error.message||'Falha ao consultar o arquivo.');}finally{setArchiveBusy('');}
  };
  const days=canPoint?getDays(year,month-1).filter(date=>date<=asOf&&isEmployeeEmployedOnDate(employee,date)).map(date=>{
    const current=getAtt(data,employee.id,date),archive=periodArchives.find(period=>period.from<=date&&period.to>=date),cached=archive&&archives[archive.id];
    const archivedRecord=cached?getAtt({attendance:{[employee.id]:cached.attendance}},employee.id,date):null;
    const record=current||archivedRecord||{},obraId=resolveEmployeeAttendanceObraId({data,employee,date,record});
    return {date,record,obraId,archivedPending:!current&&!!archive&&!cached,archivedLoaded:!current&&!!cached};
  }).filter(row=>currentUser.role==='admin'||!currentUser.obraId||String(currentUser.obraId)===String(row.obraId)):[];
  const titles=privateAccess?(data.titulosFolha||[]).filter(title=>String(title.employeeId)===String(employee.id)&&title.competencia===competence):[];
  const history=privateAccess?(data.changeLog||[]).filter(event=>String(event.empId||event.employeeId)===String(employee.id)):[];
  const mode=remunerationModeOnDate(employee,asOf),relationship=employmentRelationshipOnDate(employee,asOf);
  if(reviewDay)return <ReceivedPointReview employeeId={employee.id} name={employee.name} day={reviewDay} works={data.obras||[]} data={data} canEdit={false} onClose={()=>setReviewDay('')} onTab={onNavigate?navigate:undefined}/>;
  return <Modal title={`Ficha de ${employee.name}`} onClose={onClose} wide panelClass="worker-file-modal"><div className="worker-file">
    <header className="worker-file-header"><div><p className="worker-file-metadata">{employee.role||'Função não informada'} · {currentWork} · {employee.engineeringHistoryOnly?'Somente histórico':statusLabel[employeeLifecycleStatus(employee,asOf)]}</p><p>Admissão: {fmtDateFull(employee.startDate)}{employee.endDate?` · Último dia: ${fmtDateFull(employee.endDate)}`:''}</p></div><div className="worker-file-actions">{privateAccess&&<><Btn v="secondary" onClick={onEdit}>Editar cadastro</Btn><Btn v="ghost" onClick={onExport}>Ficha PDF</Btn></>}</div></header>
    <section aria-label="Pendências do operário" className="worker-file-pending"><h3>O que precisa de atenção</h3>{notices.length?<div className="worker-file-actions">{notices.map(notice=><button key={notice.label} type="button" onClick={()=>setSection(notice.tab)}>{notice.label}</button>)}</div>:<p>Nenhuma pendência encontrada nos dados consultados.</p>}{privateAccess&&!documents.loaded&&<p>{documents.error||'Consultando documentos privados…'} <button type="button" onClick={()=>setSection('documents')}>Conferir prontuário</button></p>}</section>
    <nav role="tablist" aria-label="Seções da ficha do operário" className="worker-file-tabs">{tabs.map(([id,label])=><button key={id} role="tab" id={`worker-tab-${id}`} aria-selected={section===id} aria-controls={`worker-panel-${id}`} onClick={()=>setSection(id)}>{label}</button>)}</nav>
    {section!=='engineering'&&<section role="tabpanel" id={`worker-panel-${section}`} aria-labelledby={`worker-tab-${section}`}>
      {section==='summary'&&<><h3>Visão do funcionário</h3><dl className="worker-file-grid">{field('Função',employee.role)}{field('Lotação',currentWork)}{field('Jornada',employee.workdayHours?`${employee.workdayHours}h · início ${employee.workStart||'não informado'}`:'')}{field('Avisos em aberto',pendingEngineering.length)}{privateAccess&&field('Vínculo',relationship==='clt'?'Empregado CLT':relationship==='autonomous'?'Prestador autônomo':relationship==='other'?'Outro vínculo informado':'Não informado')}{privateAccess&&field('Remuneração',mode==='clt'?'Mensal':'Por diária')}</dl><p>Esta ficha reúne os registros existentes. O ponto e os pagamentos continuam nos seus fluxos de conferência e aprovação.</p></>}
      {section==='data'&&<><h3>{privateAccess?'Cadastro completo':'Dados profissionais'}</h3><dl className="worker-file-grid">{field('Nome',employee.name)}{field('Função',employee.role)}{field('Admissão',fmtDateFull(employee.startDate))}{field('Lotação',currentWork)}{field('Validade do ASO',employee.examExpiresAt)}{Object.entries(employee.trainings||{}).filter(([,entry])=>entry?.expiresAt).map(([key,entry])=>field(`Validade ${key.toUpperCase()}`,entry.expiresAt))}{privateAccess&&<>{field('CPF',employee.cpf)}{field('Nascimento',employee.birthDate)}{field('Telefone',employee.phone)}{field('E-mail',employee.email)}{field('Estado civil',employee.maritalStatus)}{field('Matrícula',employee.cltPayroll?.profile?.registration)}{field('CBO',employee.cltPayroll?.profile?.cbo)}{field(mode==='clt'?'Salário mensal':'Diária contratual',(mode==='clt'?employee.monthlySalary:employee.dailyRate)?fmt(mode==='clt'?employee.monthlySalary:employee.dailyRate):'')}{field('Pagamento',employee.paymentInstructions||[employee.pixType,employee.pixHolder,employee.pixKey].filter(Boolean).join(' · '))}{field('Endereço',employee.address&&typeof employee.address==='object'?['street','number','district','city','state','postalCode'].map(key=>employee.address[key]).filter(Boolean).join(', '):employee.address)}{field('Contato de emergência',[employee.emergencyContact?.name,employee.emergencyContact?.phone].filter(Boolean).join(' · '))}</>}</dl>{privateAccess&&checklist.registrationIssues.length>0&&<p>Para completar: {checklist.registrationIssues.join('; ')}.</p>}{privateAccess&&<Btn onClick={onEdit}>Completar ou corrigir cadastro</Btn>}</>}
      {section==='documents'&&privateAccess&&<EmployeeDossier data={data} currentUser={currentUser} showToast={showToast} fixedEmployeeId={employee.id} onDocumentsChanged={onDocumentsChanged}/>}
      {section==='point'&&canPoint&&<><h3>Ponto do funcionário</h3><Inp label="Mês do ponto da ficha" type="month" value={competence} onChange={value=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value))setCompetence(value);}}/><p>Confira as batidas do aplicativo antes de tratar faltas. A consulta reúne os registros carregados e os arquivos consultados abaixo.</p>{!privateAccess&&<p>Períodos arquivados são consultados pelo RH na Gestão do ponto.</p>}{privateAccess&&periodArchives.length>0&&<section aria-label="Arquivos do ponto"><p>Há períodos arquivados neste mês. Consulte o arquivo para ver o histórico preservado.</p>{periodArchives.map(period=><Btn key={period.id} v="secondary" disabled={!!archiveBusy} onClick={()=>loadArchive(period.id)}>{archiveBusy===period.id?'Consultando arquivo…':`Consultar arquivo ${period.label}`}</Btn>)}{archiveError&&<p role="alert">{archiveError}</p>}</section>}<div className="worker-file-table"><table><thead><tr><th>Data</th><th>Situação</th><th>Horários</th><th>Obra</th><th>Origem</th><th>Conferência</th></tr></thead><tbody>{days.map(({date,record,obraId,archivedPending,archivedLoaded})=><tr key={date}><td>{fmtDateFull(date)}</td><td>{archivedPending?'Em arquivo — consultar':pointStatus[record.status]||record.status||(archivedLoaded?'Sem registro no arquivo':'Sem apontamento carregado')}</td><td>{[record.entrada,record.intervaloSaida,record.intervaloRetorno,record.saida].filter(Boolean).join(' · ')||'—'}</td><td>{workName(obraId)}</td><td>{archivedLoaded?'Arquivo consultado':archivedPending?'Arquivo não consultado':record.mobileSource?'App → ponto':record.status?'Gestão do ponto':'—'}</td><td>{privateAccess?<Btn v="ghost" onClick={()=>setReviewDay(date)}>Ver batidas de {date}</Btn>:record.note||'—'}</td></tr>)}</tbody></table></div>{!days.length&&<p>Nenhum dia do vínculo neste período e escopo.</p>}{onNavigate&&<Btn v="secondary" onClick={()=>navigate(privateAccess?'ponto_geral':'ponto')}>Abrir gestão do ponto</Btn>}</>}
      {section==='payments'&&privateAccess&&<><h3>Folha e pagamentos</h3><Inp label="Competência dos pagamentos da ficha" type="month" value={competence} onChange={value=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value))setCompetence(value);}}/><p>O título mostra o valor aprovado. As baixas comprovam quanto foi registrado como pago.</p><div className="worker-file-table"><table><thead><tr><th>Origem</th><th>Valor aprovado</th><th>Pago</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{titles.map(title=>{const row=resumoTituloFolha(title);return <tr key={title.id}><td>{title.snapshotCalculo?.kind==='advance'?'Adiantamento':'Folha'}<small>{title.periodoInicio} a {title.periodoFim}</small><details><summary>Baixas e histórico</summary>{(title.liquidacoes||[]).length?(title.liquidacoes||[]).map((payment,index)=><p key={payment.id||index}>{payment.data} · {fmt(payment.valor)} · {payment.status||'Registrada'} · {payment.createdByName||payment.operador||payment.createdBy||'Autor no histórico financeiro'}</p>):<p>Nenhuma baixa registrada.</p>}</details></td><td>{fmt(row.liquido)}</td><td>{fmt(row.valorPago)}</td><td>{active(title)?fmt(row.saldo):'Cancelado'}</td><td>{row.status}</td></tr>;})}</tbody></table></div>{!titles.length&&<p>Nenhum título de folha ou adiantamento nesta competência.</p>}{advances.filter(advance=>!advance.paymentTitleId&&advance.date?.startsWith(competence)).map(advance=><p key={advance.id}>Adiantamento antigo: {advance.date} · {fmt(advance.amount)} · {advance.description}. Consulte o comprovante no histórico.</p>)}{provision&&<p>Reserva gerencial: {provision.errors.length?'apuração pendente':fmt(provision.monthly)}. Não representa lançamento automático na DRE ou pagamento.</p>}{onNavigate&&<Btn onClick={()=>navigate('folha')}>Abrir folha e provisões</Btn>}</>}
      {section==='history'&&<><h3>Histórico do funcionário</h3><p>Cadastro criado em {employee.createdAt||'data não registrada'}{privateAccess&&employee.createdBy?` por ${employee.createdBy}`:''}. Atualização: {employee.updatedAt||'não registrada'}.</p>{history.map((event,index)=><article className="worker-file-card" key={event.id||index}><strong>{event.date} · {event.operador||'Autor não registrado'}</strong><p>{event.message||event.type}</p>{event.motivo&&<p>{event.motivo}</p>}</article>)}{privateAccess&&<><h4>Vigências contratuais</h4>{(employee.employmentRelationshipHistory||[]).map((event,index)=><p key={`contract-${index}`}>{event.date} · Vínculo: {event.relationship||'Não informado'} · {event.reason||event.source} · {event.changedBy||'Histórico preservado'}</p>)}{(employee.remunerationValuesHistory||[]).map((event,index)=><p key={`value-${index}`}>{event.date} · Valores e jornada · diária {fmt(event.dailyRate)}{event.monthlySalary?` · mensal ${fmt(event.monthlySalary)}`:''} · {event.reason||event.source} · {event.changedBy||'Histórico preservado'}</p>)}<h4>Documentos</h4>{documents.loaded?documents.items.map(document=><p key={document.id}>{document.createdAt} · {document.createdByName} · {document.name}{document.archivedAt?` · arquivado em ${document.archivedAt}: ${document.archiveReason}`:''}</p>):<p>Documentos ainda não consultados.</p>}</>}<p>{engineering.length} aviso(s) com histórico de autoria e providências na aba Engenharia.</p>{!history.length&&<p>Nenhum evento adicional de cadastro disponível neste escopo.</p>}</>}
    </section>}
    <div hidden={section!=='engineering'} id="worker-panel-engineering" role="tabpanel" aria-labelledby="worker-tab-engineering"><EmployeeEngineering employee={employee} data={data} currentUser={currentUser} dispatchCommand={dispatchCommand} showToast={showToast}/></div>
  </div></Modal>;
}
