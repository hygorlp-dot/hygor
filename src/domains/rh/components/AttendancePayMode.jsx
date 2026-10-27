import {useRef,useState} from 'react';
import {Btn,Modal,Inp,Sel,today,uid} from '../../../LegacyApp';
import {executarComandoPonto} from '../../../api.js';
import {OPERATIONAL_COMMAND} from '../../sync/operational-commands.js';
import {payModeRegistrationIssues,latestClosedPayrollDate} from '../attendance-pay-mode.js';
import {remunerationModeOnDate} from '../remuneration-mode.js';
import {PAYROLL_HANDOFF_KEY} from '../payroll-handoff.js';
import {formatTimeBankMinutes,timeBankBalanceMinutes,timeBankStatement} from '../../ponto/time-bank.js';
import '../../ponto/components/clt-payslips.css';

export function AttendancePayMode({data,currentUser,dispatchCommand,showToast,onTab}){
  const [open,setOpen]=useState(false),[employeeId,setEmployeeId]=useState(''),[mode,setMode]=useState('daily'),[date,setDate]=useState(today()),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
  const [bankOpen,setBankOpen]=useState(false),[bankEmployeeId,setBankEmployeeId]=useState('');
  const [bankAction,setBankAction]=useState({date:today(),minutes:'',reason:''}),[bankSaving,setBankSaving]=useState(false),[bankStatus,setBankStatus]=useState(''),[bankLocalEntries,setBankLocalEntries]=useState([]);
  const bankOperationId=useRef('');
  if(!['admin','rh'].includes(currentUser?.role))return null;
  const employee=(data.employees||[]).find(e=>String(e.id)===employeeId);
  const missing=payModeRegistrationIssues(employee,mode,date),closed=employee?latestClosedPayrollDate(data,employee):'';
  const select=id=>{setEmployeeId(id);setMode(data.employees.find(e=>String(e.id)===id)?.remunerationMode||'daily');setReason('');setConfirmed(false);setStatus('');};
  const save=async()=>{
    setSaving(true);setStatus('Salvando…');
    try{const result=await dispatchCommand({type:OPERATIONAL_COMMAND.EMPLOYEE_PAY_MODE_SET,idempotencyKey:`pay-mode-${uid()}`,expectedVersion:Number(employee.version||0),actorId:currentUser.id,actorName:currentUser.nome,payload:{employeeId,mode,effectiveFrom:date,reason}});if(!result?.ok)throw Error(result?.reason||'Servidor não confirmou.');setStatus('Modalidade salva. Folhas anteriores e pagamentos preservados.');setConfirmed(false);showToast('Modalidade salva com vigência e histórico.');}catch(error){setStatus(`Falha ao salvar: ${error.message}`);showToast(error.message,'error');}finally{setSaving(false);}
  };
  const persistedBankIds=new Set((data.timeBankAdjustments||[]).map(item=>String(item?.id||"")));
  const pendingLocalBankEntries=bankLocalEntries.filter(item=>!persistedBankIds.has(String(item?.id||"")));
  const bankData=pendingLocalBankEntries.length?{...data,timeBankAdjustments:[...(data.timeBankAdjustments||[]),...pendingLocalBankEntries]}:data;
  const bankEmployees=(data.employees||[]).filter(e=>e.active!==false&&e.timeBankEnabled===true);
  const bankEmployee=bankEmployees.find(e=>String(e.id)===bankEmployeeId);
  const bankBalance=bankEmployee?timeBankBalanceMinutes(bankData,bankEmployee.id):0;
  const bankEntries=bankEmployee?[...timeBankStatement(bankData,bankEmployee.id)].reverse():[];
  const saveBankAdjustment=async()=>{
    if(!bankEmployee)return;
    const minutes=Number(bankAction.minutes),reason=bankAction.reason.trim();
    if(!Number.isInteger(minutes)||minutes===0||minutes<-10080||minutes>10080){setBankStatus('Informe minutos inteiros diferentes de zero, entre -10080 e 10080.');return;}
    if(reason.length<10){setBankStatus('Informe um motivo com ao menos 10 caracteres.');return;}
    if(!bankAction.date){setBankStatus('Informe a data de referência.');return;}
    if(!bankOperationId.current)bankOperationId.current=crypto.randomUUID();
    setBankSaving(true);setBankStatus('Salvando movimento…');
    try{
      const response=await executarComandoPonto({action:'attendance-time-bank-adjust',operationId:bankOperationId.current,employeeId:String(bankEmployee.id),date:bankAction.date,minutes,reason});
      if(!response?.ok)throw Error(response?.error||'Servidor não confirmou o movimento.');
      const entry=response.result?.timeBankAdjustment;
      if(entry)setBankLocalEntries(current=>current.some(item=>item.id===entry.id)?current:[...current,entry]);
      bankOperationId.current='';
      setBankAction(current=>({...current,minutes:'',reason:''}));
      const nextBalance=response.result?.timeBankBalanceMinutes??bankBalance+minutes;
      setBankStatus('Movimento registrado. Novo saldo: '+formatTimeBankMinutes(nextBalance)+'.');
      showToast(minutes<0?'Compensação registrada no banco de horas.':'Ajuste de crédito registrado no banco de horas.');
    }catch(error){setBankStatus('Falha: '+error.message);showToast(error.message,'error');}
    finally{setBankSaving(false);}
  };
  return <><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Btn v="secondary" onClick={()=>setOpen(true)}>Definir diária ou CLT pelo ponto</Btn><Btn v="secondary" onClick={()=>setBankOpen(true)}>Banco de horas</Btn></div>{open&&<Modal title="Modalidade de pagamento do funcionário" wide onClose={()=>{if(!saving)setOpen(false);}}><section className="clt-payslips"><p>O ponto alimenta o cálculo; a modalidade segue o cadastro e sua vigência. Esta é uma alteração real do contrato no sistema. A simulação mensal continua separada em Folha.</p><fieldset disabled={saving}><div className="clt-grid"><Sel label="Funcionário para definir pagamento" value={employeeId} onChange={select} options={[{v:'',l:'Selecione'},...(data.employees||[]).filter(e=>e.active!==false).map(e=>({v:String(e.id),l:e.name}))]}/><Sel label="Pagar por" value={mode} onChange={v=>{setMode(v);setConfirmed(false);}} options={[{v:'daily',l:'Diária'},{v:'clt',l:'CLT mensal'}]}/><Inp label="Vigência da modalidade pelo ponto" type="date" value={date} onChange={v=>{setDate(v);setConfirmed(false);}}/></div>
      {employee&&<><p>Na data escolhida: {remunerationModeOnDate(employee,date)==='clt'?'CLT mensal':'Diária'} · salário mensal cadastrado: {employee.monthlySalary||'Não informado'} · diária cadastrada: {employee.dailyRate||'Não informada'}.</p>{closed&&<p>Último fechamento protegido: {closed}. A nova vigência deve ser posterior.</p>}{missing.length>0?<div role="status"><p>Complete o cadastro antes de definir esta modalidade:</p><ul>{missing.map(item=><li key={item}>{item}</li>)}</ul></div>:<p>Cadastro necessário para esta modalidade preenchido. Confira contratos e documentação no prontuário.</p>}<Btn v="secondary" onClick={()=>{window.sessionStorage.setItem('arcd_editar_funcionario',employee.id);setOpen(false);onTab?.('equipe');}}>Completar cadastro de {employee.name}</Btn></>}
      <Inp label="Justificativa da modalidade pelo ponto" value={reason} onChange={v=>{setReason(v);setConfirmed(false);}}/>
      <label className="clt-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Conferi cadastro, documentação e condições contratuais. Diária não elimina obrigações de vínculo trabalhista.</label>
      <p role="status">{status}</p><div className="clt-actions"><Btn v="secondary" onClick={()=>setOpen(false)}>Fechar</Btn><Btn disabled={!employee||missing.length>0||!confirmed||reason.trim().length<10||mode===(employee?.remunerationMode||'daily')||!date||!!closed&&date<=closed} onClick={save}>Salvar modalidade pelo ponto</Btn></div>
      {employee&&onTab&&<Btn v="secondary" disabled={missing.length>0||!date||mode!==remunerationModeOnDate(employee,date)} onClick={()=>{window.sessionStorage.setItem(PAYROLL_HANDOFF_KEY,JSON.stringify({employeeId,mode,competence:date.slice(0,7)}));setOpen(false);onTab('folha');}}>Abrir {mode==='clt'?'holerite CLT':'folha por diária'} deste funcionário</Btn>}
      {employee?.payModeDecisions?.length>0&&<details><summary>Histórico das escolhas pelo ponto</summary>{employee.payModeDecisions.map((d,i)=><p key={i}>{d.effectiveFrom} · {d.mode==='clt'?'CLT mensal':'Diária'} · {d.reason} · registrado por {d.changedBy} em {d.changedAt}</p>)}</details>}
    </fieldset></section></Modal>}{bankOpen&&<Modal title="Banco de horas" wide onClose={()=>setBankOpen(false)}><section className="clt-payslips">
      <p>Saldo formado por dias conferidos na Gestão do ponto e por compensações auditáveis. Hora extra paga não é creditada novamente no banco.</p>
      {!bankEmployees.length?<p>Nenhum funcionário ativo está com banco de horas habilitado. Ative a política no cadastro do funcionário.</p>:<>
        <Sel label="Funcionário" value={bankEmployeeId} onChange={setBankEmployeeId} options={[{v:'',l:'Selecione'},...bankEmployees.map(e=>({v:String(e.id),l:e.name}))]}/>
        {bankEmployee&&<><div className="clt-grid"><div><small>Saldo atual</small><p><strong>{formatTimeBankMinutes(bankBalance)}</strong></p></div><div><small>Política de marcação</small><p>{bankEmployee.attendancePunchMode==='entry_exit'?'Entrada e saída · intervalo pré-assinalado':'4 batidas · intervalo registrado'}</p></div></div>
          {!bankEntries.length?<p>Sem movimentos no banco.</p>:<div style={{overflowX:'auto'}}><table><caption>Extrato do banco de horas</caption><thead><tr><th>Data</th><th>Movimento</th><th>Origem</th><th>Motivo</th></tr></thead><tbody>{bankEntries.map(item=><tr key={item.id}><td>{String(item.date||'').split('-').reverse().join('/')}</td><td><strong>{formatTimeBankMinutes(item.minutes)}</strong></td><td>{item.source==='attendance'?'Ponto conferido':'Compensação / ajuste'}</td><td>{item.reason||'—'}</td></tr>)}</tbody></table></div>}
          <p>Crédito/débito do dia é decidido na conferência das batidas. Compensações avulsas ficam registradas separadamente e nunca criam presença ou alteram o REP-P.</p>
          <fieldset disabled={bankSaving}><legend>Compensação / ajuste manual</legend>
            <div className="clt-grid">
              <Inp label="Data de referência" type="date" value={bankAction.date} onChange={v=>{setBankAction(a=>({...a,date:v}));bankOperationId.current='';}}/>
              <Inp label="Minutos (+ crédito / − compensação)" type="number" value={bankAction.minutes} onChange={v=>{setBankAction(a=>({...a,minutes:v}));bankOperationId.current='';}}/>
            </div>
            <Inp label="Motivo obrigatório" value={bankAction.reason} onChange={v=>{setBankAction(a=>({...a,reason:v}));bankOperationId.current='';}}/>
            <p role="status">{bankStatus}</p>
            <Btn disabled={!bankAction.date||!bankAction.minutes||bankAction.reason.trim().length<10} onClick={saveBankAdjustment}>{bankSaving?'Salvando…':'Registrar movimento no banco'}</Btn>
          </fieldset>
          {onTab&&<Btn v="secondary" onClick={()=>{setBankOpen(false);onTab('ponto');}}>Abrir ponto eletrônico para conferir batidas</Btn>}
        </>}
      </>}
    </section></Modal>}</>;
}
