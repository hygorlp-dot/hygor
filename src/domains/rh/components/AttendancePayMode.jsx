import {useState} from 'react';
import {Btn,Modal,Inp,Sel,today,uid} from '../../../LegacyApp';
import {OPERATIONAL_COMMAND} from '../../sync/operational-commands.js';
import {payModeRegistrationIssues,latestClosedPayrollDate} from '../attendance-pay-mode.js';
import {remunerationModeOnDate} from '../remuneration-mode.js';
import {PAYROLL_HANDOFF_KEY} from '../payroll-handoff.js';
import '../../ponto/components/clt-payslips.css';

export function AttendancePayMode({data,currentUser,dispatchCommand,showToast,onTab}){
  const [open,setOpen]=useState(false),[employeeId,setEmployeeId]=useState(''),[mode,setMode]=useState('daily'),[date,setDate]=useState(today()),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
  if(!['admin','rh'].includes(currentUser?.role))return null;
  const employee=(data.employees||[]).find(e=>String(e.id)===employeeId);
  const missing=payModeRegistrationIssues(employee,mode,date),closed=employee?latestClosedPayrollDate(data,employee):'';
  const select=id=>{setEmployeeId(id);setMode(data.employees.find(e=>String(e.id)===id)?.remunerationMode||'daily');setReason('');setConfirmed(false);setStatus('');};
  const save=async()=>{
    setSaving(true);setStatus('Salvando…');
    try{const result=await dispatchCommand({type:OPERATIONAL_COMMAND.EMPLOYEE_PAY_MODE_SET,idempotencyKey:`pay-mode-${uid()}`,expectedVersion:Number(employee.version||0),actorId:currentUser.id,actorName:currentUser.nome,payload:{employeeId,mode,effectiveFrom:date,reason}});if(!result?.ok)throw Error(result?.reason||'Servidor não confirmou.');setStatus('Modalidade salva. Folhas anteriores e pagamentos preservados.');setConfirmed(false);showToast('Modalidade salva com vigência e histórico.');}catch(error){setStatus(`Falha ao salvar: ${error.message}`);showToast(error.message,'error');}finally{setSaving(false);}
  };
  return <><Btn v="secondary" onClick={()=>setOpen(true)}>Definir diária ou CLT pelo ponto</Btn>{open&&<Modal title="Modalidade de pagamento do funcionário" wide onClose={()=>{if(!saving)setOpen(false);}}><section className="clt-payslips"><p>O ponto alimenta o cálculo; a modalidade segue o cadastro e sua vigência. Esta é uma alteração real do contrato no sistema. A simulação mensal continua separada em Folha.</p><fieldset disabled={saving}><div className="clt-grid"><Sel label="Funcionário para definir pagamento" value={employeeId} onChange={select} options={[{v:'',l:'Selecione'},...(data.employees||[]).filter(e=>e.active!==false).map(e=>({v:String(e.id),l:e.name}))]}/><Sel label="Pagar por" value={mode} onChange={v=>{setMode(v);setConfirmed(false);}} options={[{v:'daily',l:'Diária'},{v:'clt',l:'CLT mensal'}]}/><Inp label="Vigência da modalidade pelo ponto" type="date" value={date} onChange={v=>{setDate(v);setConfirmed(false);}}/></div>
      {employee&&<><p>Na data escolhida: {remunerationModeOnDate(employee,date)==='clt'?'CLT mensal':'Diária'} · salário mensal cadastrado: {employee.monthlySalary||'Não informado'} · diária cadastrada: {employee.dailyRate||'Não informada'}.</p>{closed&&<p>Último fechamento protegido: {closed}. A nova vigência deve ser posterior.</p>}{missing.length>0?<div role="status"><p>Complete o cadastro antes de definir esta modalidade:</p><ul>{missing.map(item=><li key={item}>{item}</li>)}</ul></div>:<p>Cadastro necessário para esta modalidade preenchido. Confira contratos e documentação no prontuário.</p>}<Btn v="secondary" onClick={()=>{window.sessionStorage.setItem('arcd_editar_funcionario',employee.id);setOpen(false);onTab?.('equipe');}}>Completar cadastro de {employee.name}</Btn></>}
      <Inp label="Justificativa da modalidade pelo ponto" value={reason} onChange={v=>{setReason(v);setConfirmed(false);}}/>
      <label className="clt-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Conferi cadastro, documentação e condições contratuais. Diária não elimina obrigações de vínculo trabalhista.</label>
      <p role="status">{status}</p><div className="clt-actions"><Btn v="secondary" onClick={()=>setOpen(false)}>Fechar</Btn><Btn disabled={!employee||missing.length>0||!confirmed||reason.trim().length<10||mode===(employee?.remunerationMode||'daily')||!date||!!closed&&date<=closed} onClick={save}>Salvar modalidade pelo ponto</Btn></div>
      {employee&&onTab&&<Btn v="secondary" disabled={missing.length>0||!date||mode!==remunerationModeOnDate(employee,date)} onClick={()=>{window.sessionStorage.setItem(PAYROLL_HANDOFF_KEY,JSON.stringify({employeeId,mode,competence:date.slice(0,7)}));setOpen(false);onTab('folha');}}>Abrir {mode==='clt'?'holerite CLT':'folha por diária'} deste funcionário</Btn>}
      {employee?.payModeDecisions?.length>0&&<details><summary>Histórico das escolhas pelo ponto</summary>{employee.payModeDecisions.map((d,i)=><p key={i}>{d.effectiveFrom} · {d.mode==='clt'?'CLT mensal':'Diária'} · {d.reason} · registrado por {d.changedBy} em {d.changedAt}</p>)}</details>}
    </fieldset></section></Modal>}</>;
}
