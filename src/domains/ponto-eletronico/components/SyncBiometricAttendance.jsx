import {useState} from 'react';
import {Modal} from '../../../LegacyApp';
import {chamarPontoEletronico} from '../../../api';
import {Button} from '../../../components/ui/button';
import {Alert,AlertDescription} from '../../../components/ui/alert';
import './biometric-sync.css';
import {ATTENDANCE_STATUS_LABEL} from '../../ponto/attendance-status.js';

export function SyncBiometricAttendance({days,selectedObraId='all',laborArea='all',obraName,dispatchAttendanceCommand,newOperationId,showToast}){
  const [items,setItems]=useState(null),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false);
  const [range,setRange]=useState(null),[error,setError]=useState(''),[done,setDone]=useState(0);
  const ready=(items||[]).filter(i=>i.state==='ready');
  const works=[...new Set((items||[]).map(i=>i.obraId))];
  async function load(){
    if(!days.length)return;
    setBusy(true);setError('');setDone(0);
    const next={startsOn:days[0],endsOn:days.at(-1),obraId:selectedObraId,laborArea};setRange(next);
    try{
      const result=await chamarPontoEletronico('attendance-preview-punches',next);
      if(!result.ok)throw new Error(result.error||'Não foi possível consultar as batidas.');
      setItems(result.items||[]);
    }catch(e){setError(e.message);setItems([]);}finally{setBusy(false);}
  }
  async function sync(){
    setSaving(true);setError('');
    try{
      const result=await dispatchAttendanceCommand({action:'attendance-sync-punches',operationId:newOperationId(),...range,
        items:ready.slice(0,500).map(({employeeId,date,sourceSignature,expectedRecord,scheduleSignature})=>({employeeId,date,sourceSignature,expectedRecord,scheduleSignature}))});
      if(!result?.ok)throw new Error(result?.reason||'A sincronização não foi confirmada. Atualize a consulta antes de tentar novamente.');
      const count=result.result?.attendance?.length||ready.slice(0,500).length;
      setDone(count);showToast(`${count} dia(s) sincronizado(s) e protegido(s).`);
      const refreshed=await chamarPontoEletronico('attendance-preview-punches',range);
      if(!refreshed.ok)throw new Error('O lote foi gravado, mas a consulta não atualizou. Feche e consulte novamente.');
      setItems(refreshed.items||[]);
    }catch(e){setError(e.message);}finally{setSaving(false);}
  }
  const actions=<div className="biometric-sync__actions"><Button type="button" disabled={saving||!ready.length||!!error} onClick={sync}>{saving?'Sincronizando…':`Sincronizar ${Math.min(500,ready.length)} dia(s) e proteger`}</Button>
    <Button type="button" variant="outline" disabled={saving||busy} onClick={load}>Atualizar consulta</Button>
    <Button type="button" variant="ghost" disabled={saving} onClick={()=>setItems(null)}>Fechar</Button></div>;
  return <>
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={load}>{busy?'Consultando batidas…':'Sincronizar batidas do app'}</Button>
    {items!==null&&<Modal title="Sincronizar batidas biométricas" onClose={()=>{if(!saving)setItems(null);}} wide panelClass="biometric-sync-modal" footer={actions}>
      <div className="biometric-sync">
        <p>{range.startsOn} a {range.endsOn} · {works.length} obra(s) com registros recebidos</p>
        <Alert role="note"><AlertDescription>Batidas biométricas válidas substituirão os registros manuais. A engenharia não poderá alterá-los; ajustes posteriores exigem conferência do RH.</AlertDescription></Alert>
        <p>Inclui as batidas recebidas de todos os funcionários do recorte de área e obra, independentemente da busca na grade.</p>
        {error&&<p role="alert">{error}</p>}
        {done>0&&<p role="status">{done} dia(s) gravado(s). Os registros anteriores permanecem na auditoria.</p>}
        <p>{ready.length} dia(s) para sincronizar · {(items||[]).filter(i=>i.state==='pending').length} pendência(s) · {(items||[]).filter(i=>i.state==='synced').length} já sincronizado(s)</p>
        {!items.length&&!error&&<p>Nenhuma batida recebida neste período e recorte de obra.</p>}
        <div className="biometric-sync__list">{works.map(obraId=><section key={obraId||'unknown'} aria-label={obraName(obraId)||'Obra não identificada'}>
          <h3>{obraName(obraId)||'Obra não identificada'}</h3>
          <ul>{items.filter(i=>i.obraId===obraId).map(i=><li key={`${i.employeeId}__${i.date}`}>
            <div><strong>{i.name}</strong> · {i.date}</div>
            {i.state==='ready'?<p>{i.previous?`Substituir ${ATTENDANCE_STATUS_LABEL[i.previous.status]||'registro manual'}`:'Novo registro'} → {ATTENDANCE_STATUS_LABEL[i.record.status]} · entrada {i.record.entrada} · intervalo {i.record.intervaloSaida||'—'} / {i.record.intervaloRetorno||'—'} · saída {i.record.saida} · {i.record.workedMinutes} minutos · protegido para engenharia</p>:
              i.state==='synced'?<p>Já sincronizado e protegido</p>:<ul>{i.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
          </li>)}</ul>
        </section>)}</div>
        <p>Pendências exigem conferência no Ponto eletrônico. Fechamentos e pagamentos permanecem preservados.</p>
        {ready.length>500&&<p>Serão processados 500 dias neste lote. Depois, sincronize os restantes.</p>}
      </div>
    </Modal>}
  </>;
}
