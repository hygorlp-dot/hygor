import {useState} from 'react';
import {Btn,Inp,Sel} from '../../../LegacyApp';
import {buildAttendanceImport} from '../clt-attendance.js';

export function CltAttendanceImport({data,employee,draft,onImport,onManual,disabled,allowManualOverride=true}){
  const [options,setOptions]=useState(draft.attendanceSource?.options||{classifications:{},dsrPolicy:'',reviewed:false,saturdays:false});
  const [reason,setReason]=useState('');
  const result=buildAttendanceImport(data,employee,draft.competence,options);
  const change=(key,value)=>setOptions(v=>({...v,[key]:value,reviewed:key==='reviewed'?value:false}));
  const classify=(date,key,value)=>change('classifications',{...options.classifications,[date]:{...options.classifications[date],[key]:value}});
  return <details className="clt-attendance"><summary>Importar ponto aprovado do mês</summary>
    <p>Importa presenças, faltas classificadas e horas extras. Dias sem registro não viram faltas. Todos os dias previstos precisam ter o ponto fechado na obra. Horários e compensações devem ser analisados pelo RH.</p>
    <fieldset disabled={disabled}><label className="clt-check"><input type="checkbox" checked={options.saturdays} onChange={e=>change('saturdays',e.target.checked)}/>Sábado é dia previsto de trabalho neste contrato</label>
      <Sel label="Tratamento do DSR das faltas" value={options.dsrPolicy} onChange={v=>change('dsrPolicy',v)} options={[{v:'',l:'Selecione após analisar as justificativas'},{v:'none',l:'Sem desconto de DSR neste mês'},{v:'weekly',l:'Um DSR por semana com falta injustificada (domingo no mês)'}]}/>
      <p>DSR de semana que atravessa a competência e escalas especiais exigem ajuste justificado. A importação não determina automaticamente a justificativa nem o direito a desconto.</p>
      <Inp label="Decisão sobre atrasos, horários incompletos e compensações" value={options.timeReview||''} onChange={v=>change('timeReview',v)} placeholder="Ex.: atraso justificado; ou desconto incluído em rubrica adicional"/>
      <div className="provisions-table"><table><caption>Ponto por dia · {draft.competence}</caption><thead><tr><th>Data / obra</th><th>Situação</th><th>Fechamento</th><th>Ausência</th><th>HE normal / especial</th></tr></thead><tbody>{result.rows.filter(r=>r.scheduled||r.record?.status).map(r=><tr key={r.date}><td>{r.date}<small>{data.obras?.find(o=>o.id===r.obraId)?.name||'Administrativo / sem obra'}</small></td><td>{r.record?.status||'Sem registro'}{r.record?.note&&<small>{r.record.note}</small>}</td><td>{r.approved?'Fechado':'Aberto'}</td><td>{['F','M'].includes(r.record?.status)?<Sel label={`Ausência ${r.date}`} value={options.classifications?.[r.date]?.absence||''} onChange={v=>classify(r.date,'absence',v)} options={[{v:'',l:'Classificar'},{v:'justified',l:'Justificada / remunerada'},{v:'unjustified',l:'Não justificada'}]}/>: '—'}</td><td>{Number(r.record?.ot)>0?<div className="clt-grid"><Inp label={`HE normal ${r.date}`} type="number" value={options.classifications?.[r.date]?.normal??''} onChange={v=>classify(r.date,'normal',v)}/><Inp label={`HE especial ${r.date}`} type="number" value={options.classifications?.[r.date]?.special??''} onChange={v=>classify(r.date,'special',v)}/><small>Total no ponto: {r.record.ot} h</small></div>:'—'}</td></tr>)}</tbody></table></div>
      <label className="clt-check"><input type="checkbox" checked={options.reviewed} onChange={e=>change('reviewed',e.target.checked)}/>Revisei justificativas, atrasos, compensações, jornada e adicionais da CCT.</label>
      <p>Prévia: {result.fields.workedDays} dias trabalhados · {result.fields.absenceDays} faltas · {result.fields.dsrLostDays} DSR · {result.fields.overtimeHours} h normais · {result.fields.extraordinaryHours} h especiais.</p>
      {result.errors.length>0&&<p role="status">{result.errors.length} pendência(s). {result.errors.slice(0,3).join(' ')}</p>}
      <Btn disabled={result.errors.length>0} onClick={()=>onImport({...result,options})}>Aplicar ponto ao holerite</Btn>
      {draft.attendanceSource&&<><p>Origem registrada em {draft.attendanceSource.importedAt} por {draft.attendanceSource.importedBy}. {draft.attendanceSource.manualReason&&`Ajuste manual: ${draft.attendanceSource.manualReason}`}</p>{allowManualOverride?<><Inp label="Justificativa para ajustar os eventos manualmente" value={reason} onChange={setReason}/><Btn v="secondary" disabled={reason.trim().length<10} onClick={()=>onManual(reason.trim())}>Registrar ajuste e liberar campos</Btn></>:<p>Para corrigir dias ou horários, revise o ponto na origem e importe novamente. Registre os efeitos financeiros na memória de apuração.</p>}</>}
    </fieldset>
  </details>;
}
