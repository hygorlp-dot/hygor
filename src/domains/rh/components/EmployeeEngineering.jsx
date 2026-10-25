import {useRef,useState} from 'react';
import {Btn,Inp,Sel,uid} from '../../../LegacyApp';
import {EMPLOYEE_ENGINEERING_COMMAND,ENGINEERING_KINDS,ENGINEERING_STATUSES,employeeEngineeringCurrentObra} from '../employee-engineering.js';

export function EmployeeEngineering({employee,data,currentUser,dispatchCommand,showToast}){
  const [form,setForm]=useState({kind:'orientation',title:'',message:''}),[notes,setNotes]=useState({}),[busy,setBusy]=useState('');
  const pending=useRef(null),statusRequests=useRef(new Map());
  const canWrite=['admin','rh','engenheiro'].includes(currentUser?.role),canCancel=['admin','rh'].includes(currentUser?.role);
  const records=(data.employeeEngineeringRecords||[]).filter(record=>String(record.employeeId)===String(employee.id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const obraId=employeeEngineeringCurrentObra(data,employee),obra=(data.obras||[]).find(row=>String(row.id)===obraId);
  const change=(key,value)=>{setForm(current=>({...current,[key]:value}));pending.current=null;};
  const create=async()=>{
    setBusy('create');
    try{
      pending.current??={type:EMPLOYEE_ENGINEERING_COMMAND.EMPLOYEE_ENGINEERING_CREATED,idempotencyKey:`aviso-criar-${uid()}`,expectedVersion:0,
        payload:{record:{id:`aviso-${uid()}`,employeeId:employee.id,obraId,...form}}};
      const result=await dispatchCommand(pending.current);
      if(!result?.ok)throw Error(result?.error||result?.reason||'O servidor não confirmou o aviso.');
      pending.current=null;setForm({kind:'orientation',title:'',message:''});showToast('Aviso registrado para a engenharia da obra.');
    }catch(error){showToast(error.message,'error');}finally{setBusy('');}
  };
  const transition=async(record,status)=>{
    setBusy(record.id);
    try{
      const key=`${record.id}:${record.version}:${status}:${notes[record.id]||''}`;
      if(!statusRequests.current.has(key))statusRequests.current.set(key,{type:EMPLOYEE_ENGINEERING_COMMAND.EMPLOYEE_ENGINEERING_STATUS_SET,
        idempotencyKey:`aviso-situacao-${uid()}`,expectedVersion:record.version,payload:{recordId:record.id,status,note:notes[record.id]||''}});
      const result=await dispatchCommand(statusRequests.current.get(key));
      if(!result?.ok)throw Error(result?.error||result?.reason||'O servidor não confirmou a providência.');
      statusRequests.current.delete(key);setNotes(current=>({...current,[record.id]:''}));showToast('Providência registrada no histórico.');
    }catch(error){showToast(error.message,'error');}finally{setBusy('');}
  };
  return <section aria-label="Registros da engenharia"><h3>Engenharia</h3><p>Avisos operacionais ficam disponíveis nesta ficha e na equipe da obra. Atestados e informações de saúde devem ser guardados em Documentos pelo RH.</p>
    {canWrite&&<fieldset disabled={!!busy||!obra}><legend>Novo aviso para {obra?.name||'obra não definida'}</legend><div className="worker-file-grid"><Sel label="Tipo de aviso" value={form.kind} onChange={value=>change('kind',value)} options={Object.entries(ENGINEERING_KINDS).map(([v,l])=>({v,l}))}/><Inp label="Título do aviso" value={form.title} onChange={value=>change('title',value)}/></div><Inp label="Descrição do aviso operacional" multiline value={form.message} onChange={value=>change('message',value)}/><Btn disabled={!!busy||!obra||form.title.trim().length<3||form.message.trim().length<10} onClick={create}>{busy==='create'?'Registrando…':'Registrar aviso'}</Btn></fieldset>}
    {!records.length&&<p>Nenhum aviso de engenharia registrado para este funcionário.</p>}
    {records.map(record=><article key={record.id} className="worker-file-card"><h4>{record.title} · {ENGINEERING_STATUSES[record.status]||record.status}</h4><p className="worker-file-metadata">{ENGINEERING_KINDS[record.kind]} · {(data.obras||[]).find(row=>String(row.id)===String(record.obraId))?.name||record.obraId} · {record.createdByName} · {record.createdAt}</p><p className="worker-file-pre">{record.message}</p>
      <details><summary>Histórico do aviso</summary>{(record.history||[]).map((event,index)=><p key={index}>{event.at} · {event.actorName} · {ENGINEERING_STATUSES[event.status]}: {event.note}</p>)}</details>
      {canWrite&&['pending','acknowledged'].includes(record.status)&&<fieldset disabled={!!busy}><legend>Registrar providência</legend><Inp label={`Providência para ${record.title}`} multiline value={notes[record.id]||''} onChange={value=>setNotes(current=>({...current,[record.id]:value}))}/><div className="worker-file-actions">{record.status==='pending'&&<Btn v="secondary" disabled={(notes[record.id]||'').trim().length<10} onClick={()=>transition(record,'acknowledged')}>Marcar ciente</Btn>}<Btn disabled={(notes[record.id]||'').trim().length<10} onClick={()=>transition(record,'resolved')}>Resolver aviso</Btn>{canCancel&&<Btn v="ghost" disabled={(notes[record.id]||'').trim().length<10} onClick={()=>transition(record,'cancelled')}>Cancelar aviso</Btn>}</div></fieldset>}
    </article>)}
  </section>;
}
