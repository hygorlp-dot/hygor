import {useMemo,useState} from 'react';
import {Btn,fmt,uid} from '../../../LegacyApp';
import {reviewMonthlyPayslip,cltBatchReport} from '../clt-closing.js';
import {remunerationModeOnDate} from '../../rh/remuneration-mode.js';
import {prepareMonthlyPayslip} from '../clt-preparation.js';
import {OPERATIONAL_COMMAND} from '../../sync/operational-commands.js';
import {employmentRelationshipOnDate} from '../../rh/employment-relationship.js';

export function CltClosingSummary({data,competence,onSelect,showToast,dirty,currentUser,dispatchCommand,onBusy}){
  const [preparing,setPreparing]=useState(false),[progress,setProgress]=useState('');
  const reviews=useMemo(()=>(data.employees||[]).filter(e=>(remunerationModeOnDate(e,competence+'-31')==='clt'||employmentRelationshipOnDate(e,competence+'-31')==='clt')&&(!e.endDate||e.endDate>=competence+'-01')&&e.startDate<=competence+'-31').map(e=>reviewMonthlyPayslip(data,e,competence)),[data,competence]);
  const ready=reviews.filter(r=>!r.errors.length),gross=ready.reduce((s,r)=>s+r.result.gross,0),net=ready.reduce((s,r)=>s+r.result.net,0);
  const print=()=>{try{const html=cltBatchReport(data,reviews),popup=window.open('','_blank');if(!popup)throw Error('Permita abrir a janela de impressão.');popup.document.write(html);popup.document.close();}catch(e){showToast(e.message,'error');}};
  const prepareTeam=async()=>{
    const missing=reviews.filter(r=>!r.draft);let saved=0;const failed=[];
    setPreparing(true);onBusy(true);
    try{for(const item of missing){
      setProgress(`Preparando ${item.employee.name}…`);
      try{
        const response=await dispatchCommand(current=>{
          const employee=current.employees.find(e=>String(e.id)===String(item.employee.id));
          if(employee.cltPayroll?.drafts?.[competence])throw Error('Já existe demonstrativo; preservado.');
          const prepared=prepareMonthlyPayslip(current,employee,competence),draft=prepared.draft;
          if(prepared.hasPolicy&&!prepared.point.errors.length)Object.assign(draft,prepared.point.fields,{attendanceSource:{signature:prepared.point.signature,options:prepared.options,importedAt:new Date().toISOString(),importedBy:currentUser.nome||currentUser.id}});
          draft.confirmed=false;
          return {type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,expectedVersion:Number(employee.version||0),idempotencyKey:`clt-prepare-${uid()}`,actorId:currentUser.id,actorName:currentUser.nome,payload:{employee:{...employee,cltPayroll:{...employee.cltPayroll,drafts:{...employee.cltPayroll?.drafts,[competence]:draft}}}}};
        });
        if(!response?.ok)throw Error(response?.reason||'Servidor não confirmou.');saved++;
      }catch(error){failed.push(`${item.employee.name}: ${error.message}`);}
    }}finally{setPreparing(false);onBusy(false);setProgress(`${saved} rascunho(s) preparado(s). ${failed.length} pendência(s). ${failed.join(' ')}`);}
  };
  return <details><summary>Fechamento do mês · {ready.length} de {reviews.length} holerites prontos</summary><p>Somente demonstrativos salvos, confirmados e sem divergências entram no lote. Alterações não salvas devem ser concluídas antes de imprimir. A aprovação não realiza pagamento nem transmite obrigações fiscais.</p><p>Proventos aprovados: {fmt(gross)} · Líquido aprovado: {fmt(net)} · {reviews.length-ready.length} com pendências.</p>
    <div className="provisions-table"><table><caption>Conferência da equipe · {competence}</caption><thead><tr><th>Funcionário</th><th>Situação</th><th>Eventos do ponto</th><th>Líquido</th><th>Ação</th></tr></thead><tbody>{reviews.map(r=><tr key={r.employee.id}><td>{r.employee.name}</td><td>{r.errors.length?r.errors.join(' '):'Pronto para impressão'}</td><td>{r.draft?.attendanceSource?(r.draft.attendanceSource.manualReason?'Ajuste justificado':'Ponto importado'):'Preenchimento manual / não preparado'}</td><td>{r.result?fmt(r.result.net):'Não apurado'}</td><td><Btn v="secondary" onClick={()=>onSelect(String(r.employee.id),competence)}>Revisar {r.employee.name}</Btn></td></tr>)}</tbody></table></div>
    {['admin','rh'].includes(currentUser?.role)&&<><p>Preparar a equipe cria apenas rascunhos ainda inexistentes, sem sobrescrever demonstrativos salvos. Usa os dados conhecidos e mantém pendências para revisão; não aprova nem paga.</p><Btn v="secondary" disabled={preparing||dirty||!reviews.some(r=>!r.draft)} onClick={prepareTeam}>Preparar rascunhos da equipe</Btn><p role="status">{progress}</p></>}
    <Btn disabled={!ready.length||dirty||preparing} onClick={print}>Imprimir holerites aprovados em lote</Btn>
  </details>;
}
