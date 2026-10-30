import { useMemo, useState } from "react";
import { Badge, Btn, Inp, Modal, Sel, C } from "../../../LegacyApp";
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
  const calculation=calculateTimekeeping({...clocks,jornadaInicio:day.schedule?.entrada});
  const ordered=CLOCK_FIELDS.every((k,i)=>clocks[k] && (!i || clocks[k]>clocks[CLOCK_FIELDS[i-1]]));
  const needsReason=!!current || day.warnings.length>0 || CLOCK_FIELDS.some(k=>clocks[k]!==day.clocks[k]);
  const save=async()=>{
    setBusy(true);setError("");
    try {
      const result=await dispatchAttendanceCommand({action:"attendance-review-punches",operationId:pointOperationId(),
        employeeId:person.id,date,selectedObraId,status,clocks,reason,expectedRecord,
        sourceSignature:sourceSignature(day.batidas),scheduleSignature:JSON.stringify(day.schedule)});
      if(!result?.ok){setError(result?.reason || "Não foi possível integrar. Tente novamente.");return;}
      showToast?.("Conferência salva e integrada à Gestão do ponto.");onClose();
    } catch {setError("Não foi possível confirmar a integração. Atualize antes de tentar novamente.");}
    finally {setBusy(false);}
  };
  return <Modal wide title={`Conferir ponto de ${person.name}`} onClose={()=>!busy&&onClose()}>
    <div className="punch-review">
      <p>{date.split("-").reverse().join("/")} · A conferência gera um lançamento na Gestão do ponto e passa a compor seus cálculos.</p>
      {day.warnings.length>0 && <Alert variant="warning"><AlertDescription><ul>{day.warnings.map(w=><li key={w}>{w}</li>)}</ul></AlertDescription></Alert>}
      <p><strong>Batidas originais recebidas:</strong> {day.batidas.map(b=>`${localClock(b.marcadoEm)} (${CLOCK_LABELS[EVENT_TYPES.indexOf(b.tipoEvento)] || "sem tipo"})`).join(" · ")}</p>
      <fieldset className="punch-review__clocks"><legend>Horários tratados pelo RH</legend>
        {CLOCK_FIELDS.map((k,i)=><div key={k}><Inp label={CLOCK_LABELS[i]} type="time" value={clocks[k]} onChange={v=>setClocks(c=>({...c,[k]:v}))}/><p className="punch-caption">Previsto: {day.schedule?.[k] || "—"}</p></div>)}
      </fieldset>
      <Sel label="Situação confirmada pelo RH" value={status} onChange={setStatus} options={[{v:"P",l:"Presença"},{v:"M",l:"Meio dia"}]}/>
      <Sel label="Obra do lançamento" value={selectedObraId} onChange={setObra} options={(data.obras||[]).map(o=>({v:String(o.id),l:o.name}))}/>
      {current && <Alert variant="warning"><AlertDescription>Já existe um lançamento neste dia. A conferência substituirá esse lançamento, com histórico na auditoria.</AlertDescription></Alert>}
      <Inp label={needsReason?"Justificativa obrigatória":"Observação da conferência"} value={reason} onChange={setReason}/>
      {ordered && calculation.valid && <p>Trabalhado: <strong>{formatMinutes(calculation.workedMinutes)}</strong> · Previsto: {formatMinutes(day.schedule?.minutes)} · Excedente: {formatMinutes(Math.max(0,calculation.workedMinutes-(day.schedule?.minutes||0)))} · Atraso de entrada: {formatMinutes(calculation.delayMinutes)}</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <p className="punch-caption">Os horários tratados ficam separados das batidas originais. Horários ausentes não são preenchidos automaticamente.</p>
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
  const labels={integrado:"Conferido e integrado",reconferir:"Batidas ou escala alteradas: reconferir",conferir:"Registros a conferir",aguardando_rh:"Aguardando RH",sem_batida:"Sem batida recebida"};
  const filtered=people.filter(p=>(!filter||p.state===filter)&&`${p.name} ${p.role||""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="punch-conference" aria-labelledby="punch-title">
    <div className="punch-conference__heading"><h3 id="punch-title">Batidas de {date.split("-").reverse().join("/")}</h3>{onTab&&<Btn v="ghost" onClick={()=>onTab("ponto_geral")}>Abrir Gestão do ponto</Btn>}</div>
    <p className="pe-day-totals">Batidas recebidas: {people.reduce((n,p)=>n+p.day.batidas.length,0)}</p>
    <p>Confira as batidas com a escala definida no RH. Somente a confirmação do RH integra o dia à Gestão do ponto.</p>
    <div className="punch-conference__filters"><Inp label="Buscar funcionário" value={search} onChange={setSearch} placeholder="Nome ou função"/><Sel label="Situação da conferência" value={filter} onChange={setFilter} options={[{v:"",l:`Todos (${people.length})`},...Object.entries(labels).map(([v,l])=>({v,l:`${l} (${people.filter(p=>p.state===v).length})`}))]}/></div>
    {filtered.length===0?<p role="status">Nenhum funcionário encontrado para os filtros selecionados.</p>:<div className="punch-conference__table"><table>
      <caption className="pe-sr-only">Batidas na obra {(data.obras||[]).find(o=>String(o.id)===String(obraId))?.name} em {date.split("-").reverse().join("/")}</caption>
      <thead><tr><th scope="col">Funcionário e escala</th><th scope="col">Batidas recebidas</th><th scope="col">Conferência e integração</th></tr></thead>
      <tbody>{filtered.map(p=><tr key={p.id}>
        <th scope="row"><strong>{p.name}</strong><p>{p.role}</p><p className="punch-caption">{!p.day.schedule?"Escala pendente no RH":p.day.schedule.working?`${p.day.schedule.entrada}–${p.day.schedule.intervaloSaida} / ${p.day.schedule.intervaloRetorno}–${p.day.schedule.saida}`:"Sem expediente previsto"}</p>{!p.day.schedule&&canReview&&onTab&&<Btn v="ghost" size="sm" onClick={()=>{sessionStorage.setItem("arcd_editar_funcionario",p.id);onTab("equipe");}}>Definir escala no RH</Btn>}</th>
        <td><div className="punch-conference__events">{p.day.batidas.map(b=><Btn key={b.eventId||b.id} v="ghost" size="sm" ariaLabel={`Ver batida de ${p.name} às ${localClock(b.marcadoEm)} em ${date.split("-").reverse().join("/")}`} onClick={()=>abrirDetalhe(b)}>{localClock(b.marcadoEm)} · {CLOCK_LABELS[EVENT_TYPES.indexOf(b.tipoEvento)] || "Sem tipo"}</Btn>)}</div>{!p.day.batidas.length&&<span>Sem registro recebido; não confirma falta.</span>}</td>
        <td><Badge color={p.state==="integrado"?C.green:p.state==="sem_batida"?C.muted:C.orange}>{labels[p.state]}</Badge>
          {p.record?.pontoReview&&<p className="punch-caption">Conferido por {p.record.pontoReview.reviewedByName} em {new Date(p.record.pontoReview.reviewedAt).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}</p>}
          {canReview&&p.day.batidas.length>0&&<Btn v="ghost" size="sm" disabled={disabled||!p.day.schedule?.working||!dispatchAttendanceCommand} onClick={()=>setReview(p)}>{p.record?.pontoReview?"Revisar conferência":"Conferir e integrar"}</Btn>}
        </td>
      </tr>)}</tbody>
    </table></div>}
    {review&&<Review key={`${review.id}-${date}`} person={review} date={date} data={data} obraId={obraId} dispatchAttendanceCommand={dispatchAttendanceCommand} onClose={()=>setReview(null)} showToast={showToast}/>}
  </section>;
}
