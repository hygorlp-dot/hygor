import {useState} from "react";
import {Btn,Inp,Sel,fmt,uid} from "../../../LegacyApp";
import {OPERATIONAL_COMMAND} from "../../sync/operational-commands.js";
import {getAtt} from "../attendance-engine.js";
import {attendanceDaysInMonth,monthEnd,newPayModeSimulation,simulatePayMode,summarizePayModeSimulation} from "../pay-mode-simulation.js";
import {resolveHistoricalEmployeeObraId} from "../permissions.js";
import "./clt-payslips.css";

const CHOICES=[{v:"daily",l:"Diária"},{v:"clt",l:"CLT"}];

export function PayModeSimulation({data,currentUser,dispatchCommand,showToast,year,month}) {
  const [competence,setCompetence]=useState(`${year}-${String(month+1).padStart(2,"0")}`);
  const [obra,setObra]=useState("all"),[edits,setEdits]=useState({}),[selected,setSelected]=useState(""),[saving,setSaving]=useState(false),[status,setStatus]=useState("");
  const canEdit=["admin","rh"].includes(currentUser?.role);
  const referenceDate=monthEnd(competence);
  const employees=(data.employees||[]).filter(e=>e.active!==false||e.endDate>=`${competence}-01`).filter(e=>e.startDate<=referenceDate).filter(e=>obra==="all"||resolveHistoricalEmployeeObraId({employee:e,date:referenceDate,transferEvents:data.changeLog,obras:data.obras})===obra);
  const saved=e=>e.payModeSimulations?.[competence];
  const baseSim=e=>saved(e)||newPayModeSimulation(e,competence,{workedDays:attendanceDaysInMonth(date=>getAtt(data,e.id,date),competence)});
  const rows=employees.map(employee=>{const sim=edits[employee.id]||baseSim(employee);return {employee,sim,result:simulatePayMode(employee,sim)};});
  const summary=summarizePayModeSimulation(rows);
  const dirtyIds=Object.keys(edits);
  const discard=()=>!dirtyIds.length||window.confirm("Descartar a simulação não salva?");
  const change=(employee,key,value)=>{setEdits(all=>({...all,[employee.id]:{...(all[employee.id]||baseSim(employee)),[key]:value}}));setStatus("Simulação não salva");};
  const changePeriod=value=>{if(!/^\d{4}-\d{2}$/.test(value)||!discard())return;setCompetence(value);setEdits({});setSelected("");setStatus("");};
  const save=async()=>{setSaving(true);setStatus("Salvando…");let done=0;try{
    for(const id of dirtyIds){
      const response=await dispatchCommand(current=>{const employee=current.employees.find(e=>e.id===id);return {type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,idempotencyKey:`simulacao-${uid()}`,expectedVersion:Number(employee?.version||0),actorId:currentUser?.id,actorName:currentUser?.nome,payload:{employee:{...employee,payModeSimulations:{...employee.payModeSimulations,[competence]:{...edits[id],updatedAt:new Date().toISOString(),updatedBy:currentUser?.id}}}}};});
      if(!response?.ok)throw new Error(response?.reason||"O servidor não confirmou o salvamento.");
      done++;setEdits(all=>{const next={...all};delete next[id];return next;});
    }
    setStatus("Simulação salva");showToast("Simulação salva. O cadastro, a folha, os holerites e o DRE não foram alterados.");
  }catch(error){setStatus(`Falha ao salvar (${done} de ${dirtyIds.length} salvos)`);showToast(error.message,"error");}finally{setSaving(false);}};
  const current=rows.find(r=>r.employee.id===selected);
  const number=(key,label)=><Inp key={key} label={label} type="number" value={String(current.sim[key]??"")} onChange={v=>change(current.employee,key,v)}/>;
  const cell=scenario=>scenario.errors.length?<td colSpan={2}>Informar dados</td>:<><td>{fmt(scenario.net)}</td><td>{fmt(scenario.cost)}{scenario.costComplete===false&&<small>sem encargos patronais</small>}</td></>;
  return <section className="clt-payslips" aria-label="Simulação CLT ou diária"><header><h3>Simular o mês: CLT ou diária</h3><p>Escolha, para cada funcionário, como o mês seria pago e compare o líquido e o custo da empresa. É só uma simulação: não muda o cadastro, a folha, os holerites nem o DRE.</p></header>
    <div className="clt-grid"><Inp label="Competência da simulação" type="month" value={competence} onChange={changePeriod}/><Sel label="Obra da simulação" value={obra} onChange={v=>{if(!discard())return;setObra(v);setEdits({});setSelected("");}} options={[{v:"all",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/></div>
    <div className="clt-totals" aria-live="polite"><div>Custo do cenário escolhido{summary.missing||summary.chargesMissing?" (parcial)":""}<strong>{fmt(summary.cost)}</strong></div><div>Líquido aos funcionários<strong>{fmt(summary.net)}</strong></div><div>Equipe toda por diária<strong>{fmt(summary.allDailyCost)}</strong></div><div>Equipe toda CLT<strong>{fmt(summary.allCltCost)}</strong></div></div>
    <p>{summary.daily} por diária e {summary.clt} CLT. {summary.missing} sem dados suficientes, fora do total. As referências "equipe toda" somam os {summary.comparable} funcionário(s) calculáveis nas duas modalidades.{summary.chargesMissing?` ${summary.chargesMissing} cenário(s) CLT sem encargos patronais informados.`:""}</p>
    <div className="provisions-table" role="region" aria-label="Comparativo por funcionário" tabIndex={0}><table><thead><tr><th rowSpan={2}>Funcionário</th><th colSpan={2}>Diária</th><th colSpan={2}>CLT</th><th rowSpan={2}>CLT − diária (custo)</th><th rowSpan={2}>Pagar o mês como</th><th rowSpan={2}>Ajustar</th></tr><tr><th>Líquido</th><th>Custo</th><th>Líquido</th><th>Custo</th></tr></thead>
      <tbody>{rows.map(({employee:e,sim,result:r})=>{const both=!r.daily.errors.length&&!r.clt.errors.length;const diff=both?r.clt.cost-r.daily.cost:null;return <tr key={e.id}><td>{e.name}<small>{edits[e.id]?"Não salvo":saved(e)?"Simulação salva":"Sugestão"}</small></td>{cell(r.daily)}{cell(r.clt)}<td data-tone={diff>0?"deficit":undefined}>{diff===null?"—":`${diff>0?"+":""}${fmt(diff)}`}</td>
        <td><div role="radiogroup" aria-label={`Modalidade de ${e.name}`} className="pay-mode-choice">{CHOICES.map(c=><label key={c.v}><input type="radio" name={`pay-mode-${e.id}`} value={c.v} checked={sim.choice===c.v} disabled={!canEdit||saving} onChange={()=>change(e,"choice",c.v)}/>{c.l}</label>)}</div></td>
        <td><Btn v="secondary" onClick={()=>setSelected(e.id)}>{canEdit?"Ajustar":"Consultar"} {e.name}</Btn></td></tr>;})}</tbody></table></div>
    {!employees.length&&<p>Nenhum funcionário neste filtro.</p>}
    {current&&<><h3>Premissas de {current.employee.name}</h3><fieldset disabled={!canEdit||saving}><legend>Dias e valores do mês</legend>
      <div className="clt-grid">{number("workedDays","Dias trabalhados no mês")}{number("paidHolidays","Feriados pagos na diária")}{number("dailyRate","Valor da diária (R$)")}{number("salary","Salário CLT mensal (R$)")}<Sel label="Categoria na CCT" value={current.sim.category} onChange={v=>change(current.employee,"category",v)} options={[{v:"professional",l:"Profissional"},{v:"helper",l:"Servente / ajudante"}]}/>{number("employerChargesPercent","Encargos patronais sobre o bruto CLT (%)")}</div>
      <p>Os dias vêm do ponto do mês (meio período = 0,5) e podem ser ajustados para projetar o mês. VT e VR usam os valores diários do cadastro. Na CLT, o VT é descontado até 6% do salário. Os encargos patronais (INSS, RAT, terceiros) dependem do regime da empresa: informe o percentual da contabilidade. Sem ele, o custo CLT sai sem esses encargos.</p>
      <Inp label="Observações da simulação" value={current.sim.notes} onChange={v=>change(current.employee,"notes",v)}/></fieldset>
      <div className="clt-grid pay-mode-detail"><div><h4>Diária</h4><p>Bruto {fmt(current.result.daily.gross)} · VT/VR {fmt(current.result.daily.benefits)} · custo {fmt(current.result.daily.cost)}. Sem INSS/IRRF retidos e sem provisões, como na folha por diária.</p></div>
        <div><h4>CLT</h4><p>Bruto {fmt(current.result.clt.gross)} · INSS {fmt(current.result.clt.inss||0)} · IRRF {fmt(current.result.clt.irrf||0)} · FGTS {fmt(current.result.clt.fgts||0)} · provisões {fmt(current.result.clt.provisions)} · VT/VR {fmt(current.result.clt.benefits)}{current.result.clt.charges!==null?` · encargos ${fmt(current.result.clt.charges)}`:""} · custo {fmt(current.result.clt.cost)}.</p></div></div>
      {[...current.result.daily.errors.map(e=>`Diária: ${e}`),...current.result.clt.errors.map(e=>`CLT: ${e}`)].length>0&&<div className="clt-issues" role="status">{[...current.result.daily.errors.map(e=>`Diária: ${e}`),...current.result.clt.errors.map(e=>`CLT: ${e}`)].map(error=><p key={error}>{error}</p>)}</div>}</>}
    <p>CLT considera mês integral sem faltas, horas extras ou adiantamentos, com provisões de 13º, férias + 1/3, FGTS dessas verbas e multa de 40% como no módulo de provisões. Para aplicar uma modalidade de verdade, altere o cadastro do funcionário com a data de vigência.</p>
    <div className="clt-actions"><span role="status">{status}</span><Btn v="secondary" disabled={!canEdit||saving||!dirtyIds.length} onClick={()=>{if(window.confirm("Descartar as alterações desta simulação?")){setEdits({});setStatus("");}}}>Descartar</Btn><Btn disabled={!canEdit||saving||!dirtyIds.length} onClick={save}>{saving?"Salvando…":`Salvar simulação${dirtyIds.length?` (${dirtyIds.length})`:""}`}</Btn></div>
  </section>;
}
