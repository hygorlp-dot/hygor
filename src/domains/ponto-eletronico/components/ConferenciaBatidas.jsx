import {calculateScheduledBreak} from '../../ponto/timekeeping.js';
import { useMemo, useState } from "react";
import {Badge, Btn, Inp, Modal, Sel} from "../../../legacy/ui.jsx";
import {C} from "../../../legacy/palette.js";
import { Alert, AlertDescription } from "../../../components/ui/alert.jsx";
import { inspectDay, CLOCK_FIELDS, CLOCK_LABELS, EVENT_TYPES, localClock, sourceSignature, recordSignature } from "../conferencia.js";
import { calculateTimekeeping, formatMinutes } from "../../ponto/timekeeping.js";
const pointOperationId = () => crypto.randomUUID();
import "./conferencia-batidas.css";

function Review({ person, date, data, obraId, dispatchAttendanceCommand, onClose, showToast }) {
  const day=person.day;
  const current=data.attendance?.[person.id]?.[date];
  // Congela a versão exibida: atualizações em segundo plano exigem nova conferência.
  const [expectedRecord]=useState(()=>recordSignature(current));
  const [clocks,setClocks]=useState(()=>Object.fromEntries(CLOCK_FIELDS.map(k=>[k,current?.[k] || day.clocks[k]])));
  const [reason,setReason]=useState("");
  const [status,setStatus]=useState(current?.status==="M"?"M":"P");
  const [selectedObraId,setObra]=useState(current?.obraId || obraId);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const scheduledBreak=day.batidas.length<=2 && !current?.intervaloSaida && !current?.intervaloRetorno;
  const fields=scheduledBreak?['entrada','saida']:CLOCK_FIELDS;
  const calculation=scheduledBreak?calculateScheduledBreak(clocks.entrada,clocks.saida,day.schedule):calculateTimekeeping({...clocks,jornadaInicio:day.schedule?.entrada});
  const ordered=fields.every((k,i)=>clocks[k] && (!i || clocks[k]>clocks[fields[i-1]]));
  const needsReason=!!current || day.warnings.length>0 || CLOCK_FIELDS.some(k=>clocks[k]!==day.clocks[k]);
  const save=async()=>{
    setBusy(true);setError("");
    try {
      const result=await dispatchAttendanceCommand({action:"attendance-review-punches",operationId:pointOperationId(),
        employeeId:person.id,date,selectedObraId,status,clocks,reason,expectedRecord,breakMode:scheduledBreak?'schedule':'recorded',
        sourceSignature:sourceSignature(day.batidas),scheduleSignature:JSON.stringify(day.schedule)});
      if(!result?.ok){setError(result?.reason || "Não foi possível integrar. Tente novamente.");return;}
      showToast?.("Conferência salva e integrada à Gestão do ponto.");onClose();
    } catch {setError("Integração não confirmada. Atualize e tente novamente.");}
    finally {setBusy(false);}
  };
  return <Modal wide title={`Conferir ponto de ${person.name}`} onClose={()=>!busy&&onClose()}>
    <div className="punch-review">
      <p>{date.split("-").reverse().join("/")} · A confirmação integra o dia à Gestão do ponto.</p>
      {day.warnings.length>0 && <Alert variant="warning"><AlertDescription><ul>{day.warnings.map(w=><li key={w}>{w}</li>)}</ul></AlertDescription></Alert>}
      <p><strong>Batidas originais recebidas:</strong> {day.batidas.map(b=>`${localClock(b.marcadoEm)} (${CLOCK_LABELS[EVENT_TYPES.indexOf(b.tipoEvento)] || "sem tipo"})`).join(" · ")}</p>
      <fieldset className="punch-review__clocks"><legend>Horários tratados pelo RH</legend>
        {fields.map(k=><div key={k}><Inp label={CLOCK_LABELS[CLOCK_FIELDS.indexOf(k)]} type="time" value={clocks[k]} onChange={v=>setClocks(c=>({...c,[k]:v}))}/><p className="punch-caption">Previsto: {day.schedule?.[k] || "—"}</p></div>)}
      </fieldset>
      {scheduledBreak&&<p>Intervalo previsto: {day.schedule?.intervaloSaida}–{day.schedule?.intervaloRetorno}, descontado automaticamente. Não exige batida.</p>}
      <Sel label="Situação confirmada pelo RH" value={status} onChange={setStatus} options={[{v:"P",l:"Presença"},{v:"M",l:"Meio dia"}]}/>
      <Sel label="Obra do lançamento" value={selectedObraId} onChange={setObra} options={(data.obras||[]).map(o=>({v:String(o.id),l:o.name}))}/>
      {current && <Alert variant="warning"><AlertDescription>Ao confirmar, o lançamento existente será substituído e preservado na auditoria.</AlertDescription></Alert>}
      <Inp label={needsReason?"Justificativa obrigatória":"Observação da conferência"} value={reason} onChange={setReason}/>
      {ordered && calculation.valid && <p>Trabalhado: <strong>{formatMinutes(calculation.workedMinutes)}</strong> · Previsto: {formatMinutes(day.schedule?.minutes)} · Excedente: {formatMinutes(Math.max(0,calculation.workedMinutes-(day.schedule?.minutes||0)))} · Atraso de entrada: {formatMinutes(calculation.delayMinutes)}</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Btn onClick={save} loading={busy} disabled={busy || !day.schedule?.working || !ordered || !calculation.valid || !selectedObraId || (needsReason&&reason.trim().length<5)}>Confirmar e integrar à Gestão do ponto</Btn>
    </div>
  </Modal>;
}

export default function ConferenciaBatidas({ data, events, date, obraId, currentUser, dispatchAttendanceCommand, onTab, abrirDetalhe, disabled=false, showToast }) {
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("");
  const [review,setReview]=useState(null);
  const canReview=["admin","rh"].includes(currentUser?.role);
  const people=useMemo(()=>{
    const ids=new Set((data.employees||[]).filter(e=>String(e.obra)===String(obraId)&&e.active!==false).map(e=>String(e.id)));
    events.filter(e=>e.tipoRegistro==="ponto"&&String(e.obraId)===String(obraId)).forEach(e=>ids.add(String(e.employeeId)));
    return [...ids].map(id=>{
      const employee=(data.employees||[]).find(e=>String(e.id)===id);
      const day=inspectDay(events.filter(e=>String(e.employeeId)===id),employee,date);
      const record=data.attendance?.[id]?.[date];
      const review=record?.pontoReview;
      const integrated=review?.sourceSignature===sourceSignature(day.batidas) && JSON.stringify(review?.schedule)===JSON.stringify(day.schedule);
      const state=review ? (integrated?"integrado":"reconferir") : day.situacao;
      return {id,name:employee?.name||"Funcionário não encontrado",role:employee?.role,day,record,state};
    }).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  },[data.employees,data.attendance,events,date,obraId]);
  const labels={integrado:"Integrado à Gestão do ponto",reconferir:"Batidas ou escala alteradas",conferir:"Registros a conferir",aguardando_rh:"Aguardando RH",sem_batida:"Sem batida recebida"};
  const filtered=people.filter(p=>(!filter||p.state===filter)&&`${p.name} ${p.role||""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="punch-conference" aria-labelledby="punch-title">
    <div className="punch-conference__heading"><h3 id="punch-title">Batidas de {date.split("-").reverse().join("/")}</h3>{onTab&&<Btn v="ghost" onClick={()=>onTab("ponto_geral")}>Abrir Gestão do ponto</Btn>}</div>
    <p className="pe-day-totals">Batidas recebidas: {people.reduce((n,p)=>n+p.day.batidas.length,0)}</p>
    <p>Integração automática conforme a escala. Pendências exigem RH.</p>
    <div className="punch-conference__filters"><Inp label="Buscar funcionário" value={search} onChange={setSearch} placeholder="Nome ou função"/><Sel label="Situação da conferência" value={filter} onChange={setFilter} options={[{v:"",l:`Todos (${people.length})`},...Object.entries(labels).map(([v,l])=>({v,l:`${l} (${people.filter(p=>p.state===v).length})`}))]}/></div>
    {filtered.length===0?<p role="status">Nenhum funcionário encontrado.</p>:<div className="punch-conference__table"><table>
      <caption className="pe-sr-only">Batidas na obra {(data.obras||[]).find(o=>String(o.id)===String(obraId))?.name} em {date.split("-").reverse().join("/")}</caption>
      <thead><tr><th scope="col">Funcionário e escala</th><th scope="col">Batidas recebidas</th><th scope="col">Conferência e integração</th></tr></thead>
      <tbody>{filtered.map(p=><tr key={p.id}>
        <th scope="row"><strong>{p.name}</strong><p>{p.role}</p><p className="punch-caption">{!p.day.schedule?"Escala pendente no RH":p.day.schedule.working?`${p.day.schedule.entrada}–${p.day.schedule.intervaloSaida} / ${p.day.schedule.intervaloRetorno}–${p.day.schedule.saida}`:"Sem expediente previsto"}</p>{!p.day.schedule&&canReview&&onTab&&<Btn v="ghost" size="sm" onClick={()=>{sessionStorage.setItem("arcd_editar_funcionario",p.id);onTab("equipe");}}>Definir escala no RH</Btn>}</th>
        <td><div className="punch-conference__events">{p.day.batidas.map(b=><Btn key={b.eventId||b.id} v="ghost" size="sm" ariaLabel={`Ver batida de ${p.name} às ${localClock(b.marcadoEm)} em ${date.split("-").reverse().join("/")}${p.day.duplicidades.some(d=>d.repetida===b)?' · possível repetição':''}`} onClick={()=>abrirDetalhe(b)}>{localClock(b.marcadoEm)} · {CLOCK_LABELS[EVENT_TYPES.indexOf(b.tipoEvento)] || "Sem tipo"}{p.day.duplicidades.some(d=>d.repetida===b)?' · Possível repetição':''}</Btn>)}</div>{p.day.duplicidades.length>0&&<p className="punch-caption">Possível batida duplicada. Confira no RH; não gera jornada automaticamente.</p>}{!p.day.batidas.length&&<span>Sem registro recebido; não confirma falta.</span>}</td>
        <td><Badge color={p.state==="integrado"?C.green:p.state==="sem_batida"?C.muted:C.orange}>{labels[p.state]}</Badge>
          {p.record?.pontoReview&&<p className="punch-caption">{p.record.pontoReview.automatic?"Integrado automaticamente":"Conferido por "+p.record.pontoReview.reviewedByName} em {new Date(p.record.pontoReview.reviewedAt).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}</p>}
          {canReview&&p.day.batidas.length>0&&<Btn v="ghost" size="sm" disabled={disabled||!p.day.schedule?.working||!dispatchAttendanceCommand} onClick={()=>setReview(p)}>{p.record?.pontoReview?"Revisar conferência":"Conferir e integrar"}</Btn>}
        </td>
      </tr>)}</tbody>
    </table></div>}
    {review&&<Review key={`${review.id}-${date}`} person={review} date={date} data={data} obraId={obraId} dispatchAttendanceCommand={dispatchAttendanceCommand} onClose={()=>setReview(null)} showToast={showToast}/>}
  </section>;
}
