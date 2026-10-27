import {useEffect,useRef,useState} from 'react';
import {chamarPontoEletronico} from '../../../api.js';
import {Btn,Inp,Modal,Sel} from '../../../LegacyApp';
import {appropriationReview,defaultReviewInterval,intervalKey,receivedClockPreview,mobileAttendanceImportReview} from '../tratamento.js';
import {suggestedTimeBankMinutes} from '../../ponto/attendance-policy.js';
import {formatTimeBankMinutes} from '../../ponto/time-bank.js';
import {horaLocal} from '../painel.js';
import './received-point.css';

export default function ReceivedPointReview({employeeId,name,day,works,onClose,onSaved,canEdit,canManageBank=false,onTab,data={},dispatchAttendanceCommand,request=chamarPontoEletronico}){
  const [proposal,setProposal]=useState(null),[saved,setSaved]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[decisions,setDecisions]=useState({}),[confirmed,setConfirmed]=useState(false),[history,setHistory]=useState(null);
  const [classification,setClassification]=useState({status:'',ot:'0',atrasoMin:'0',bankMinutes:'0',note:''}),[importConfirmed,setImportConfirmed]=useState(false),[imported,setImported]=useState(false);
  const importCommand=useRef(null);
  useEffect(()=>{let live=true;setLoading(true);setError('');Promise.all([request('ponto-apropriacao-propor',{employeeId,data:day}),request('ponto-apropriacoes',{employeeId,de:day,ate:day})]).then(([p,a])=>{if(!live)return;if(!p.ok||!a.ok)throw Error(p.error||a.error||'Não foi possível conferir as marcações.');setProposal(p);setSaved(a.apropriacoes||[]);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[employeeId,day,request]);
  const employee=(data.employees||[]).find(item=>String(item.id)===String(employeeId))||{};
  const review=appropriationReview(proposal||{},saved);
  const preview=receivedClockPreview(proposal||{},day,employee);
  const importReview=mobileAttendanceImportReview({proposal:proposal||{},saved,day,point:data.attendance?.[employeeId]?.[day],locks:data.attendanceLocks,employee});
  const suggestedBank=importReview.ok?suggestedTimeBankMinutes({employee,status:classification.status,workedMinutes:importReview.workedMinutes,paidOvertimeHours:Number(classification.ot||0)}):0;
  const changeClassification=(key,value)=>{setClassification(v=>({...v,[key]:value}));setImportConfirmed(false);importCommand.current=null;};
  const importDay=async()=>{
    if(!importReview.ok||!importConfirmed||!dispatchAttendanceCommand)return;
    setSaving('attendance');setError('');
    try{
      importCommand.current??={action:'attendance-import-mobile',operationId:crypto.randomUUID(),employeeId:String(employeeId),date:day,status:classification.status,ot:Number(classification.ot),atrasoMin:Number(classification.atrasoMin),bankMinutes:Number(classification.bankMinutes),note:classification.note,sourceEventIds:importReview.sourceEventIds,appropriationVersions:importReview.appropriationVersions};
      const result=await dispatchAttendanceCommand(importCommand.current);
      if(!result?.ok)throw Error(result?.reason||result?.error||'O servidor não confirmou a importação.');
      setImported(true);setImportConfirmed(false);onSaved?.();
    }catch(e){setError(e.message);}finally{setSaving('');}
  };
  const resolveInterval=interval=>({...defaultReviewInterval(interval,employeeId,day),...(decisions[intervalKey(interval)]||{})});
  const change=(interval,key,value)=>{setDecisions(v=>({...v,[intervalKey(interval)]:{...v[intervalKey(interval)],[key]:value}}));setConfirmed(false);};
  const save=async interval=>{
    const key=intervalKey(interval),appropriation=resolveInterval(interval);setSaving(key);setError('');
    try{
      // Refresh immediately before creating: if a response was lost, the
      // existing interval is reused, not blindly resent with a new ID.
      const latest=await request('ponto-apropriacoes',{employeeId,de:day,ate:day});if(!latest.ok)throw Error(latest.error||'Não foi possível verificar os intervalos existentes.');
      const duplicate=(latest.apropriacoes||[]).find(a=>!['cancelado','cancelada'].includes(a.status)&&intervalKey(a)===intervalKey(appropriation));
      if(duplicate){setSaved(latest.apropriacoes||[]);setConfirmed(false);return;}
      const r=await request('ponto-apropriacao-salvar',{apropriacao:appropriation});if(!r.ok)throw Error(r.error||'O servidor não confirmou a apropriação.');
      setSaved(v=>[...v,{...appropriation,id:r.id,version:r.version,status:'ativa'}]);setConfirmed(false);onSaved?.();
    }catch(e){setError(`${e.message} Atualize a lista antes de repetir a ação.`);}finally{setSaving('');}
  };
  const showHistory=async interval=>{setError('');const r=await request('ponto-apropriacao-auditoria',{id:interval.id});if(!r.ok){setError(r.error||'Não foi possível carregar o histórico.');return;}setHistory(r.auditoria||[]);};
  return <Modal title={`Conferir ponto de ${name}`} onClose={()=>{if(!saving)onClose();}} wide><section aria-label="Conferência de marcações recebidas">
    <p>{day} · Marcações originais permanecem intactas. A obra de captura não muda; a conferência define a obra que receberá o intervalo de trabalho.</p>
    <p>Confira os intervalos e depois aprove o envio do dia ao ponto. Isso não fecha a folha nem confirma pagamento. Nenhuma batida ausente é transformada em falta.</p>
    {loading&&<p role="status">Buscando todas as marcações e intervalos deste funcionário no dia…</p>}{error&&<p role="alert">{error}</p>}
    {!loading&&proposal&&<>
      <p>{proposal.marcacoes?.length||0} marcação(ões) recebida(s) · {review.activeSaved.length} intervalo(s) já conferido(s).</p>
      <details open><summary>Prévia dos horários recebidos</summary>{preview.ok?<><p>{preview.status} · {preview.date}.</p><p>Entrada {preview.entrada} · {preview.intervaloSaida?`${preview.breakSource==='preassigned'?'intervalo pré-assinalado':'saída para intervalo'} ${preview.intervaloSaida} · ${preview.breakSource==='preassigned'?'retorno previsto':'retorno'} ${preview.intervaloRetorno} · `:''}saída {preview.saida}. Trabalho líquido: {Math.floor(preview.workedMinutes/60)}h{String(preview.workedMinutes%60).padStart(2,'0')}.</p><p>Não define diária inteira/meia diária, horas extras, falta ou desconto. Jornada, justificativas e compensações precisam ser conferidas. Esta prévia ainda não foi enviada à folha.</p></>:<p>{preview.reason}</p>}</details>
      {review.warnings.map(w=><p role="status" key={w}>{w}</p>)}
      <div className="received-point-table"><table><caption>Intervalos sugeridos pelas capturas</caption><thead><tr><th>Horário / captura</th><th>Obra de apropriação</th><th>Motivo</th><th>Ação</th></tr></thead><tbody>{review.candidates.map(interval=>{const value=resolveInterval(interval),key=intervalKey(interval);return <tr key={key}><td data-label="Horário / captura">{horaLocal(interval.inicio)} a {horaLocal(interval.fim)}<small>Origem: {works.find(w=>String(w.id)===String(interval.obraApropriadaId))?.name||interval.obraApropriadaId}{interval.mudouDeObra?' · houve mudança de obra':''}</small></td><td data-label="Obra de apropriação">{interval.existing?'Já conferido':<Sel label={`Obra do intervalo ${horaLocal(interval.inicio)}`} disabled={!canEdit||!!saving} value={value.obraApropriadaId} onChange={v=>change(interval,'obraApropriadaId',v)} options={works.map(w=>({v:String(w.id),l:w.name}))}/>}</td><td data-label="Motivo">{interval.existing?interval.existing.motivo:<Inp label={`Motivo do intervalo ${horaLocal(interval.inicio)}`} disabled={!canEdit||!!saving} value={value.motivo} onChange={v=>change(interval,'motivo',v)}/>}</td><td data-label="Ação">{interval.existing?<Btn v="secondary" disabled={!!saving} onClick={()=>showHistory(interval.existing)}>Ver histórico</Btn>:<Btn disabled={!canEdit||!confirmed||!!saving||!value.motivo.trim()||!value.obraApropriadaId} onClick={()=>save(interval)}>{saving===key?'Salvando…':'Conferir intervalo'}</Btn>}</td></tr>;})}</tbody></table></div>
      {review.activeSaved.length>0&&<details><summary>Intervalos já registrados</summary>{review.activeSaved.map(a=><p key={a.id}>{horaLocal(a.inicio)} a {horaLocal(a.fim)} · {works.find(w=>String(w.id)===String(a.obraApropriadaId))?.name||a.obraApropriadaId} · versão {a.version} · {a.motivo} <Btn v="ghost" onClick={()=>showHistory(a)}>Histórico do intervalo</Btn></p>)}</details>}
      {canEdit&&review.pending.length>0&&<label className="clt-check"><input type="checkbox" checked={confirmed} disabled={!!saving} onChange={e=>setConfirmed(e.target.checked)}/>Conferi as batidas, os intervalos e a obra de apropriação. A folha ainda precisa de conferência própria.</label>}
      {dispatchAttendanceCommand&&<fieldset className="received-point-import"><legend>Levar o dia conferido para a Gestão do ponto</legend>{imported?<p role="status">Dia registrado no ponto com os horários originais e referência das capturas. Fechamento e pagamento continuam separados.</p>:!importReview.ok?<p role="status">{importReview.reason}</p>:<>
        <p>{works.find(w=>String(w.id)===importReview.obraId)?.name||importReview.obraId} · {importReview.workedMinutes} minutos entre pares. Os horários serão lidos novamente no servidor; não é preciso digitá-los.</p>
        {canEdit&&<><div className="received-point-classification">
          <Sel label="Presença a registrar" value={classification.status} disabled={!!saving} onChange={v=>changeClassification('status',v)} options={[{v:'',l:'Escolha após conferir'},{v:'P',l:'Presente — jornada integral'},{v:'M',l:'Meia jornada'}]}/>
          <Inp label="Horas extras a pagar" type="number" value={classification.ot} disabled={!!saving} onChange={v=>changeClassification('ot',v)}/>
          <Inp label="Banco de horas (minutos)" type="number" value={classification.bankMinutes} disabled={!!saving||employee.timeBankEnabled!==true||!canManageBank} onChange={v=>changeClassification('bankMinutes',v)}/>
          <Inp label="Atraso conferido (minutos)" type="number" value={classification.atrasoMin} disabled={!!saving} onChange={v=>changeClassification('atrasoMin',v)}/>
          <Inp label="Justificativa da conferência" value={classification.note} disabled={!!saving} onChange={v=>changeClassification('note',v)}/>
        </div><p>Presença, horas extras e atraso dependem da jornada e das justificativas. {employee.timeBankEnabled===true?(canManageBank?`Sugestão de banco para a combinação atual: ${formatTimeBankMinutes(suggestedBank)}. O RH pode destinar menos ao banco, mas hora extra paga + crédito positivo não podem superar o excedente apurado.`:'Banco de horas ativo; somente RH/Admin pode decidir crédito ou débito. Esta conferência seguirá com movimento zero.'):'Banco de horas desativado neste cadastro; ative-o no funcionário antes de lançar saldo.'}</p>
        <label className="clt-check"><input type="checkbox" checked={importConfirmed} disabled={!!saving} onChange={e=>setImportConfirmed(e.target.checked)}/>Conferi jornada, presença, horas extras, atraso e obra. Autorizo registrar este único dia no ponto.</label>
        <Btn disabled={!!saving||!importConfirmed||!classification.status||!classification.note.trim()||classification.ot===''||classification.atrasoMin===''||classification.bankMinutes===''} onClick={importDay}>{saving==='attendance'?'Registrando…':'Aprovar e registrar no ponto'}</Btn></>}
      </>}</fieldset>}
      {history&&<details open><summary>Histórico de conferência</summary>{history.length?history.map((h,i)=><p key={i}>{h.em} · {h.acao} · responsável {h.responsavelId} · {h.motivo||'Sem observação'}</p>):<p>Nenhuma alteração registrada.</p>}</details>}
      {onTab&&<Btn v="secondary" disabled={!!saving} onClick={()=>{onClose();onTab('ponto_geral');}}>Abrir Gestão do ponto</Btn>}
    </>}
  </section></Modal>;
}
