import { useEffect,useState } from "react";
import { Btn, Inp, Sel, fmt, uid } from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { advanceDeductionForPeriod, isAdvanceActive } from "../../rh/advance-commands.js";
import { calculateCltPayslip, CLT_SOURCES } from "../clt-payslip.js";
import { cltAdvanceHtml, cltPayslipHtml } from "../clt-report.js";
import { remunerationModeOnDate } from "../../rh/remuneration-mode.js";
import "./clt-payslips.css";
import {ATTENDANCE_FIELDS,attendanceImportIssues,hasPartialContractMonth} from '../clt-attendance.js';
import {CltAttendanceImport} from './CltAttendanceImport.jsx';
import {prepareMonthlyPayslip} from '../clt-preparation.js';
import {CltClosingSummary} from './CltClosingSummary.jsx';
import {readPayrollHandoff,PAYROLL_HANDOFF_KEY} from '../../rh/payroll-handoff.js';

export function CltPayslips({data,currentUser,dispatchCommand,showToast,year,month}) {
  const [entry]=useState(()=>{const handoff=readPayrollHandoff();return handoff?.mode==='clt'&&(data.employees||[]).some(e=>String(e.id)===handoff.employeeId)?handoff:null;});
  const initialEmployee=(data.employees||[]).find(e=>String(e.id)===entry?.employeeId);
  const initialCompetence=entry?.competence||`${year}-${String(month+1).padStart(2,"0")}`;
  const [employeeId,setEmployeeId]=useState(entry?.employeeId||'');
  const [competence,setCompetence]=useState(initialCompetence);
  const [draft,setDraft]=useState(()=>initialEmployee?prepareMonthlyPayslip(data,initialEmployee,initialCompetence,{advances:false}).draft:null);
  const [revision,setRevision]=useState(Number(initialEmployee?.version||0));
  const [status,setStatus]=useState(initialEmployee?.cltPayroll?.drafts?.[initialCompetence]?'Salvo':'Novo demonstrativo');
  useEffect(()=>{if(entry)window.sessionStorage.removeItem(PAYROLL_HANDOFF_KEY);},[entry]);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [prepareTransport,setPrepareTransport]=useState(false);
  const [prepareAdvances,setPrepareAdvances]=useState(true);
  const employee=(data.employees||[]).find(e=>String(e.id)===employeeId);
  const canEdit=["admin","rh"].includes(currentUser?.role);
  const load=(id,period)=>{
    if(dirty&&!window.confirm("Há alterações não salvas. Deseja descartá-las?"))return;
    const emp=(data.employees||[]).find(e=>String(e.id)===id);
    setEmployeeId(id);setCompetence(period);setRevision(Number(emp?.version||0));
    setDraft(emp?prepareMonthlyPayslip(data,emp,period,{advances:false}).draft:null);
    setStatus(emp?.cltPayroll?.drafts?.[period]?"Salvo":"Novo demonstrativo");setDirty(false);
  };
  const update=(key,value)=>{setDraft(d=>({...d,[key]:value,confirmed:key==="confirmed"?value:false}));setDirty(true);setStatus("Alterações não salvas");};
  const rule=(key,value)=>update("rules",{...draft.rules,[key]:value});
  const periodEnd=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
  const advances=(data.advances||[]).filter(a=>String(a.empId)===employeeId&&isAdvanceActive(a));
  const candidates=advances.map(a=>({...a,amount:advanceDeductionForPeriod(a,`${competence}-01`,periodEnd)})).filter(a=>a.amount>0);
  const selected=draft?[...new Set(draft.advanceIds||[])].map(id=>candidates.find(a=>a.id===id)).filter(Boolean):[];
  const missingAdvance=draft&&(draft.advanceIds||[]).some(id=>!candidates.some(a=>a.id===id));
  const changedAdvance=draft?.advances?.some(saved=>{const current=selected.find(a=>a.id===saved.id);return current&&(current.amount!==saved.amount||current.date!==saved.date);});
  const calculation=draft?calculateCltPayslip({...draft,advances:selected}):null;
  const errors=calculation?[...calculation.errors,...(!data.config?.companyName||!data.config?.cnpj?["Complete a razão social e o CNPJ nas configurações da empresa."]:[]),...(!employee?.cpf?["Informe o CPF no cadastro do funcionário."]:[]),...(!draft.registration||!draft.cbo?["Informe matrícula e CBO."]:[]),...(missingAdvance?["Um adiantamento selecionado foi cancelado ou alterado; confira os vínculos."]:[])]:[];
  if(draft)errors.push(...attendanceImportIssues(data,employee,draft));
  if(changedAdvance&&!dirty)errors.push("O valor ou a data de um adiantamento mudou. Confira, confirme e salve novamente.");
  if(calculation&&remunerationModeOnDate(employee,periodEnd)!=="clt")errors.push("O RH precisa selecionar CLT mensal com vigência nesta competência no cadastro do funcionário.");
  const save=async()=>{
    if(draft.attendanceSource&&attendanceImportIssues(data,employee,draft).length){showToast('Atualize o ponto importado antes de salvar.','error');return;}
    setSaving(true);setStatus("Salvando…");
    try{
      const result=await dispatchCommand(current=>{
        const emp=(current.employees||[]).find(e=>String(e.id)===employeeId);
        return {type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,idempotencyKey:`holerite-${uid()}`,expectedVersion:revision,actorId:currentUser?.id,actorName:currentUser?.nome,payload:{employee:{...emp,cltPayroll:{...emp.cltPayroll,
          profile:{...emp.cltPayroll?.profile,salary:draft.salary,category:draft.category,cbo:draft.cbo,registration:draft.registration,rules:draft.rules,recurringRubrics:(draft.custom||[]).filter(r=>r.recurring),...(draft.attendanceSource&&!draft.attendanceSource.manualReason?{attendancePolicy:{saturdays:draft.attendanceSource.options.saturdays,dsrPolicy:draft.attendanceSource.options.dsrPolicy}}:{})},
          drafts:{...emp.cltPayroll?.drafts,[competence]:{...draft,advances:selected.map(a=>({id:a.id,amount:a.amount,date:a.date})),calculated:calculation,updatedAt:new Date().toISOString(),updatedBy:currentUser?.id}}}}}};
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o salvamento.");
      setRevision(v=>v+1);setDraft(d=>({...d,advances:selected.map(a=>({id:a.id,amount:a.amount,date:a.date}))}));setDirty(false);setStatus("Salvo");showToast("Demonstrativo salvo. Pagamentos e DRE preservados.");
    }catch(error){setStatus("Falha ao salvar");showToast(error.message,"error");}finally{setSaving(false);}
  };
  const print=html=>{const popup=window.open("","_blank");if(!popup){showToast("Permita abrir a janela do relatório.","error");return;}popup.document.write(html);popup.document.close();};
  const number=(key,label)=><Inp key={key} label={label} type="number" disabled={!!draft.attendanceSource&&!draft.attendanceSource.manualReason&&ATTENDANCE_FIELDS.includes(key)} value={String(draft[key]??"")} onChange={v=>update(key,v)}/>;
  const toggle=(key,label)=><label className="clt-check"><input type="checkbox" checked={!!draft[key]} onChange={e=>update(key,e.target.checked)}/>{label}</label>;
  return <section className="clt-payslips" aria-label="Holerites CLT">
    <header><h3>Holerite mensal e adiantamentos</h3><p>Selecione o funcionário e preencha os eventos do mês. Os valores ficam separados da folha por diária e dos pagamentos.</p>{employee&&<p>Modalidade no cadastro: {employee.remunerationMode==="clt"?"CLT mensal":"Diária"}. A alteração é feita pelo RH em Pessoas e terceiros → Equipe.</p>}</header>
    <div className="clt-grid"><Sel label="Funcionário do holerite" disabled={saving} value={employeeId} onChange={v=>load(v,competence)} options={[{v:"",l:"Selecione um funcionário"},...(data.employees||[]).map(e=>({v:String(e.id),l:`${e.name} · ${e.role||"Sem função"}`}))]}/><Inp label="Competência mensal" type="month" disabled={saving} value={competence} onChange={v=>{if(/^\d{4}-\d{2}$/.test(v))load(employeeId,v);}}/></div>
    {!canEdit&&<p role="status">Consulta e exportação. Somente RH e administradores podem alterar ou salvar demonstrativos.</p>}
    <CltClosingSummary data={data} competence={competence} onSelect={load} showToast={showToast} dirty={dirty} currentUser={currentUser} dispatchCommand={dispatchCommand} onBusy={setSaving}/>
    {draft&&<>
      <fieldset disabled={!canEdit||saving}><legend>Preparação automática</legend><p>Reutiliza contrato, perfil e rubricas recorrentes. Traz o ponto completo e fechado quando houver regra salva e nenhuma exceção. Faltas sem classificação, horários a analisar e dados ausentes permanecem como pendências para o RH.</p>
        <label className="clt-check"><input type="checkbox" checked={prepareAdvances} onChange={e=>setPrepareAdvances(e.target.checked)}/>Selecionar os adiantamentos registrados com parcelas nesta competência</label>
        <label className="clt-check"><input type="checkbox" checked={prepareTransport} onChange={e=>setPrepareTransport(e.target.checked)}/>Sugerir VT pelo valor diário cadastrado × dias com presença (inclusive meio período)</label>
        <Btn v="secondary" onClick={()=>{const prepared=prepareMonthlyPayslip(data,employee,competence,{transport:prepareTransport,advances:prepareAdvances});const next={...draft,advanceIds:prepared.draft.advanceIds,transportCost:prepareTransport?prepared.draft.transportCost:draft.transportCost,confirmed:false};if(prepared.hasPolicy&&!prepared.point.errors.length){Object.assign(next,prepared.point.fields,{attendanceSource:{signature:prepared.point.signature,options:prepared.options,importedAt:new Date().toISOString(),importedBy:currentUser.nome||currentUser.id}});}setDraft(next);setDirty(true);setStatus(prepared.hasPolicy&&!prepared.point.errors.length?'Preparado com ponto aprovado · revise e confirme':'Dados preparados · revise as pendências do ponto');}}>Preparar dados do mês</Btn>
      </fieldset>
      <CltAttendanceImport key={`${employeeId}-${competence}`} data={data} employee={employee} draft={draft} disabled={!canEdit||saving} onImport={result=>{setDraft(d=>({...d,...result.fields,attendanceSource:{signature:result.signature,options:result.options,importedAt:new Date().toISOString(),importedBy:currentUser.nome||currentUser.id},confirmed:false}));setDirty(true);setStatus('Ponto importado · salvar demonstrativo');}} onManual={reason=>update('attendanceSource',{...draft.attendanceSource,manualReason:reason,adjustedBy:currentUser.id,adjustedAt:new Date().toISOString()})}/>
      <fieldset disabled={!canEdit||saving}><legend>1. Contrato e competência</legend><p>Informe o salário mensal contratado, sem conversão da diária. Para férias, 13º, rescisão, múltiplos vínculos ou situações especiais, utilize a apuração contábil.</p><div className="clt-grid">
        {number("salary","Salário contratual mensal (R$)")}<Sel label="Categoria do piso" value={draft.category} onChange={v=>update("category",v)} options={[{v:"professional",l:"Profissional / qualificado"},{v:"helper",l:"Servente / não qualificado"}]}/>
        <Inp label="Matrícula" value={draft.registration} onChange={v=>update("registration",v)}/><Inp label="CBO" value={draft.cbo} onChange={v=>update("cbo",v)}/><Inp label="Data prevista de pagamento" type="date" value={draft.paymentDate} onChange={v=>update("paymentDate",v)}/>
        {number("days","Dias de salário (base 30)")}{number("workedDays","Dias efetivamente trabalhados")}{number("absenceDays","Faltas não justificadas (dias)")}{number("dsrLostDays","DSR perdido (dias)")}
      </div>{hasPartialContractMonth(employee,competence)&&toggle('contractPeriodReviewed','Revisei a proporcionalidade e os dias de salário neste mês de admissão, desligamento ou mudança de modalidade.')}</fieldset>
      <fieldset disabled={!canEdit||saving}><legend>2. Eventos e benefícios</legend><div className="clt-grid">
        {number("overtimeHours",`Horas extras com adicional de ${draft.rules.overtimePercent}%`)}{number("extraordinaryHours",`Horas extras com adicional de ${draft.rules.extraordinaryPercent}%`)}{number("dsrWorkingDays","Dias úteis para DSR de extras")}{number("dsrRestDays","Domingos e feriados para DSR de extras")}
        {number("transportCost","Custo do vale-transporte concedido (R$)")}{number("transportDays","Dias de salário-base para limite VT (30 no mês integral)")}
      </div><p>Primeiras duas horas extras de segunda a sábado: 70%. A partir da terceira, domingos, feriados não compensados e sábados após o segundo do mês: 100%. Classifique os eventos antes de informar. O DSR do salário mensal já está incluído; aqui se calcula somente o reflexo das extras.</p>
        {toggle("trainingEligible","Curso e elegibilidade comprovados — incentivo de formação (cl. 14)")}
        {toggle("basketEligible","Cesta devida neste pagamento: canteiro, salário até R$ 4.500, após experiência, 15 dias trabalhados, sem falta injustificada ou advertência de segurança (cl. 18)")}
        {toggle("unionAuthorized","Aplicabilidade e direito de oposição conferidos — taxa assistencial mensal (cl. 72)")}
        <p>O limite do VT usa dias de base salarial, até o período de salário informado, e não o número de viagens; o desconto nunca excede o custo concedido. Alimentação fornecida não é salário em dinheiro. Registre tickets e refeições como informativos. Mensalidade associativa e taxa negocial não são descontadas automaticamente.</p>
      </fieldset>
      <fieldset disabled={!canEdit||saving}><legend>3. Rubricas adicionais</legend><p>Produção, adicionais, benefícios e descontos específicos. Confira as incidências com a contabilidade.</p>
        {(draft.custom||[]).map((item,index)=><div className="clt-custom" key={index}>
          <Inp label={`Descrição da rubrica ${index+1}`} value={item.label} onChange={v=>update("custom",draft.custom.map((r,i)=>i===index?{...r,label:v}:r))}/>
          <Sel label={`Tipo da rubrica ${index+1}`} value={item.kind} onChange={v=>update("custom",draft.custom.map((r,i)=>i===index?{...r,kind:v}:r))} options={[{v:"earning",l:"Provento"},{v:"deduction",l:"Desconto"},{v:"info",l:"Somente informativo"}]}/>
          <Inp label={`Valor da rubrica ${index+1} (R$)`} type="number" value={String(item.amount)} onChange={v=>update("custom",draft.custom.map((r,i)=>i===index?{...r,amount:v}:r))}/>
          <div>{["inss","irrf","fgts"].map(flag=><label className="clt-check" key={flag}><input type="checkbox" checked={!!item[flag]} onChange={e=>update("custom",draft.custom.map((r,i)=>i===index?{...r,[flag]:e.target.checked}:r))}/>Compõe base {flag.toUpperCase()}{item.kind==="deduction"?" (reduz)":""}</label>)}</div>
          <Btn v="ghost" onClick={()=>update("custom",draft.custom.filter((_,i)=>i!==index))}>Remover rubrica {index+1}</Btn>
          <label className="clt-check"><input type="checkbox" checked={!!item.recurring} onChange={e=>update('custom',draft.custom.map((r,i)=>i===index?{...r,recurring:e.target.checked}:r))}/>Reutilizar esta rubrica nos próximos meses (revisar valor e incidências)</label>
        </div>)}<Btn v="secondary" onClick={()=>update("custom",[...draft.custom,{label:"",kind:"earning",amount:"",inss:false,irrf:false,fgts:false}])}>Adicionar rubrica</Btn>
      </fieldset>
      <fieldset disabled={!canEdit||saving}><legend>4. Tributos e deduções</legend><div className="clt-grid"><Sel label="Apuração de INSS e IRRF" value={draft.fiscalMode} onChange={v=>update("fiscalMode",v)} options={[{v:"automatic",l:"Automática · mensal ordinária 2026"},{v:"manual",l:"Valores apurados pela contabilidade"}]}/>
        {number("dependents","Dependentes válidos para IRRF")}{number("alimony","Pensão judicial dedutível e descontada aqui (R$)")}{number("otherTaxable","Outros rendimentos tributáveis da mesma fonte no mês do pagamento (R$)")}{number("otherDeductions","Deduções legais dos outros pagamentos do mês (R$)")}{number("previousIrrf","IRRF já retido pela mesma fonte no mês do pagamento (R$)")}
        {draft.fiscalMode==="manual"&&<>{number("manualInss","INSS apurado (R$)")}{number("manualIrrf","IRRF apurado (R$)")}{number("manualIrrfBase","Base do IRRF apurada (R$)")}<Inp label="Responsável e referência da apuração contábil" value={draft.manualReason} onChange={v=>update("manualReason",v)}/></>}
      </div><p>IRRF considera o mês de pagamento e a dedução mais favorável entre legais e simplificada. Adiantamentos e saldo pagos em meses diferentes exigem apuração contábil pelo regime de caixa. Múltiplos vínculos exigem ajuste contábil do INSS.</p><p><a href={CLT_SOURCES.inss} target="_blank" rel="noreferrer">Tabela INSS 2026</a> · <a href={CLT_SOURCES.irrf} target="_blank" rel="noreferrer">Tabela IRRF 2026</a></p></fieldset>
      <fieldset disabled={!canEdit||saving}><legend>5. Compensar adiantamentos</legend><p>Selecione parcelas com desconto previsto nesta competência. O total é abatido uma vez, sem repetir saída no caixa ou no DRE.</p>
        {candidates.length?candidates.map(a=><label className="clt-check" key={a.id}><input type="checkbox" checked={draft.advanceIds.includes(a.id)} onChange={e=>update("advanceIds",e.target.checked?[...draft.advanceIds,a.id]:draft.advanceIds.filter(id=>id!==a.id))}/>{a.date} · {a.description} · parcela(s): {fmt(a.amount)} · registro {a.id}</label>):<p>Nenhuma parcela registrada para este mês.</p>}
      </fieldset>
      <details><summary>Perfil reutilizável da CCT e regras</summary><fieldset disabled={!canEdit||saving}><legend>Regras deste funcionário</legend><p>{CLT_SOURCES.cct}. Abrangência: construção civil de Caruaru/PE. Regras sugeridas nos próximos meses; competências já salvas mantêm seu perfil.</p><div className="clt-grid"><Inp label="Nome do perfil" value={draft.rules.name} onChange={v=>rule("name",v)}/><Inp label="Vigência econômica inicial" type="date" value={draft.rules.effectiveFrom} onChange={v=>rule("effectiveFrom",v)}/><Inp label="Vigência econômica final" type="date" value={draft.rules.effectiveTo} onChange={v=>rule("effectiveTo",v)}/>
        {[["helperFloor","Piso não qualificado (R$)"],["professionalFloor","Piso profissional (R$)"],["divisor","Divisor mensal de horas"],["overtimePercent","Adicional HE ordinária (%)"],["extraordinaryPercent","Adicional HE especial (%)"],["fgtsPercent","FGTS (%)"],["trainingPercent","Formação — percentual do piso (%)"],["transportPercent","Limite de desconto VT (%)"],["unionPercent","Taxa assistencial (%)"],["unionCap","Teto da taxa assistencial (R$)"]].map(([key,label])=><Inp key={key} label={label} type="number" value={String(draft.rules[key])} onChange={v=>rule(key,v)}/>)}</div></fieldset></details>
      <fieldset disabled={!canEdit||saving}><legend>6. Conferência e exportação</legend><Inp label="Observações do demonstrativo" value={draft.notes} onChange={v=>update("notes",v)}/>{toggle("confirmed","Confirmo contrato, enquadramento na CCT, eventos, incidências e pagamentos da mesma fonte neste mês. Situações especiais foram apuradas pela contabilidade.")}</fieldset>
      <div className="clt-totals" aria-live="polite"><div>Proventos<strong>{fmt(calculation.gross)}</strong></div><div>Descontos<strong>{fmt(calculation.deductions)}</strong></div><div>Líquido a pagar<strong>{fmt(calculation.net)}</strong></div><div>FGTS do empregador<strong>{fmt(calculation.fgts)}</strong></div></div>
      {errors.length>0&&<div className="clt-issues" role="status"><p>Antes de exportar:</p><ul>{errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
      <div className="clt-actions"><span role="status">{status}</span><Btn v="secondary" disabled={!canEdit||saving||!dirty} onClick={save}>{saving?"Salvando…":"Salvar demonstrativo"}</Btn><Btn disabled={errors.length>0||dirty||saving} onClick={()=>print(cltPayslipHtml({company:data.config,employee,draft,result:calculation}))}>Exportar holerite PDF</Btn></div>
      <details><summary>Recibos dos adiantamentos quinzenais registrados</summary><p>Gerar recibo não confirma pagamento. A declaração depende de assinatura ou comprovante bancário.</p>{advances.length?advances.map(a=><div className="clt-receipt" key={a.id}><span>{a.date} · {a.description} · {fmt(a.amount)}</span><Btn v="secondary" disabled={!data.config?.cnpj||!employee.cpf} onClick={()=>print(cltAdvanceHtml({company:data.config,employee,advance:a}))}>Recibo {a.date}</Btn></div>):<p>Nenhum adiantamento registrado.</p>}</details>
    </>}
  </section>;
}
