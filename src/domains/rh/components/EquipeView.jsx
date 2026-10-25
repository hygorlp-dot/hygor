// ===================================================================
// EquipeView — tela "Equipes" (cadastro/gestão de funcionários),
// extraída de src/LegacyApp.jsx em 2026-08-20, mesma técnica já usada
// para os módulos anteriores (verbatim, mesma camada de dados, sem
// nova migration/RLS). Ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md.
// ===================================================================

import { useEffect, useRef, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Badge, Btn, C, Divider, Ic, Inp, Modal, PageHero, Sel, TYPO,
  fmt, fmtDate, fmtDateFull, gerarFichaFuncionarioPDF, today, uid,
} from "../../../LegacyApp";
import { overdue } from "../../seguranca/calculations";
import { WORKER_TRAINING_TYPES } from "../../seguranca/constants";
import { employeeComplianceStatus } from "../compliance";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { buildAdvanceInstallments } from "../advance-commands";
import {employeeEditDraft} from '../employee-edit-draft.js';
import './employee-edit.css';
import { employeeLifecycleStatus } from "../employee-commands";

// Estado inicial dos documentos/certificações de cada funcionário: um mapa
// key->{expiresAt} com uma entrada por NR do catálogo (ver
// domains/seguranca/constants.js). Compartilhado como referência inicial
// (nunca mutado in-place; toda edição gera um objeto novo via spread) e
// usado também para preencher NRs que um cadastro antigo ainda não tinha.
const EMPTY_TRAININGS = Object.fromEntries(WORKER_TRAINING_TYPES.map(t => [t.key, { expiresAt: "" }]));

const fmtCPF = value => {
  const v = String(value || "").replace(/\D/g, "").slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const fmtPhone = value => {
  const v = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
};

// Mapa Equipe -> Rescisão: o motivo de desligamento registrado em Equipe usa
// um vocabulário próprio (5 opções) que precisa ser traduzido para o
// vocabulário de RESCISSION_TYPES (6 opções) usado em Rescisão, para poder
// ser herdado sem inventar um terceiro vocabulário. "outro" não tem
// equivalente direto e cai no mesmo padrão que Rescisão já usa
// (sem_justa_causa).
const DISMISSAL_TO_RESCISSION_TYPE = {
  demissao_sem_justa_causa: "sem_justa_causa",
  demissao_justa_causa: "justa_causa",
  pedido_demissao: "pedido_demissao",
  termino_contrato: "termino_contrato",
  outro: "sem_justa_causa",
};
// Inverso do mapa acima, usado só para reabrir o formulário de Equipe (ex.:
// "Corrigir agendamento") a partir de um terminationType já salvo no
// vocabulário de RESCISSION_TYPES. Valores que só existem em Rescisão
// (acordo_mutuo/acordo_interno) não têm equivalente em Equipe e caem em
// "outro".
const RESCISSION_TYPE_TO_DISMISSAL = {
  sem_justa_causa: "demissao_sem_justa_causa",
  justa_causa: "demissao_justa_causa",
  pedido_demissao: "pedido_demissao",
  termino_contrato: "termino_contrato",
  acordo_mutuo: "outro",
  acordo_interno: "outro",
};

function Equipe({ data, update, showToast, obraIdFixo="", dispatchCommand, currentUser=null, onTab=null }) {
  const { formGrid } = useBreakpoint();
  const emptyEmp = {
    id: "",
    name: "",
    role: "",
    workArea: "campo",
    cpf: "",
    phone: "",
    pixKey: "",
    pixType: "",
    pixHolder: "",
    dailyRate: "",
    remunerationMode: "daily",
    monthlySalary: "",
    remunerationEffectiveFrom: "",
    vtDaily: "",
    vrDaily: "",
    workdayHours: "8",
    workStart: "07:00",
    overtimeAdditionalPercent: "50",
    obra: "",
    active: true,
    startDate: "",
    endDate: "",
    terminationReason: "",
    lastObra: "",
    examExpiresAt: "",
    trainings: EMPTY_TRAININGS,
  };
  const setTraining = key => value => setForm(f => ({ ...f, trainings: { ...(f.trainings || EMPTY_TRAININGS), [key]: { expiresAt: value } } }));

  const [modal, setModal] = useState(false);
  const [advModal, setAdvModal] = useState(null);
  const [form, setForm] = useState(emptyEmp);
  const [search, setSearch] = useState("");
  const [filterObra, setFilterObra] = useState(obraIdFixo||"all");
  const [statusFilter, setStatusFilter] = useState("ativo");
  const [expandedId, setExpandedId] = useState(null);
  const [dismissalModal, setDismissalModal] = useState(null);
  const [dismissalForm, setDismissalForm] = useState({ endDate:today(), reason:"demissao_sem_justa_causa", notes:"" });
  const [archiveModal, setArchiveModal] = useState(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [unlinkModal, setUnlinkModal] = useState(null);
  const [advCancelModal, setAdvCancelModal] = useState(null);
  const [advCancelReason, setAdvCancelReason] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [savingEmployee,setSavingEmployee]=useState(false);
  const [employeeSaveError,setEmployeeSaveError]=useState('');
  const nameInputRef = useRef(null);
  const [advForm, setAdvForm] = useState({
    amount:"",description:"",date:today(),installmentCount:"1",
    frequency:"quinzenal",firstDueDate:today(),
  });

  useEffect(() => {
    const empId = window.sessionStorage.getItem("arcd_editar_funcionario");
    if (!empId) return;
    const employee = (data.employees || []).find(e => e.id === empId);
    window.sessionStorage.removeItem("arcd_editar_funcionario");
    if (!employee) return;
    setStatusFilter(employeeLifecycleStatus(employee, today()));
    setForm({...employeeEditDraft(employee),trainings:{...EMPTY_TRAININGS,...(employee.trainings||{})}});
    setModal(true);
    setEmployeeSaveError('');
  }, [data.employees]);

  const F = key => value => setForm(f => ({ ...f, [key]: value }));
  const obraName = id => data.obras.find(o => o.id === id)?.name || "-";
  const advanceActive = advance => !["cancelado","cancelada","estornado","estornada"]
    .includes(String(advance?.status||"").toLowerCase());
  const empAdvances = id => (data.advances||[]).filter(a => a.empId === id)
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));

  const saveEmp = async () => {
    if(savingEmployee)return;
    setEmployeeSaveError('');
    const errors={};
    if (!form.name.trim()) errors.name="Informe o nome completo.";
    if (!(Number(form.dailyRate)>0)) errors.dailyRate="Informe uma diária positiva para o custeio do ponto.";
    if (form.remunerationMode==="clt"&&!(Number(form.monthlySalary)>0)) errors.monthlySalary="Informe o salário contratual mensal.";
    if (!form.startDate) errors.startDate="Informe a admissão.";
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setEmployeeSaveError(Object.values(errors).join(' '));
      window.setTimeout(()=>nameInputRef.current?.focus(),0);
      return;
    }

    const before = data.employees.find(e => e.id === form.id);
    const payload = {
      ...form,
      id: form.id || uid(),
      dailyRate: Number(form.dailyRate || 0),
      remunerationMode: form.remunerationMode==="clt"?"clt":"daily",
      monthlySalary: Number(form.monthlySalary || 0),
      vtDaily: Number(form.vtDaily || 0),
      vrDaily: Number(form.vrDaily || 0),
      workdayHours: Math.max(1, Number(form.workdayHours || 8)),
      workStart: form.workStart || "07:00",
      overtimeAdditionalPercent: Math.max(0, Number(form.overtimeAdditionalPercent ?? 50)),
      examExpiresAt: form.examExpiresAt || "",
      trainings: form.trainings || EMPTY_TRAININGS,
      active: before?.active !== false,
      workArea:form.workArea==="administrativo"?"administrativo":"campo",
      obra:form.workArea==="administrativo"?"":form.obra,
      status:before?.status || "ativo",
      endDate: before?.endDate || "",
      terminationReason: before?.terminationReason || "",
      lastObra: form.lastObra || before?.lastObra || "",
    };

    setSavingEmployee(true);
    try{
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.employees||[]).find(item=>item.id===payload.id);
      return {
        type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
        idempotencyKey:`funcionario-salvar-${payload.id}-${uid()}`,
        expectedVersion:Number(form.version??before?.version??0),
        payload:{employee:{...(vigente||{}),...payload}},
      };
    });
    if(!result?.ok){
      const message=result?.reason||result?.error||"O funcionário não foi confirmado pelo servidor.";
      setEmployeeSaveError(message);
      return;
    }
    setModal(false); setFormErrors({});
    showToast(form.id ? "Funcionário atualizado." : "Funcionário cadastrado.");
    }catch(error){const message=error?.message||'Falha ao salvar. Seus dados continuam no formulário.';setEmployeeSaveError(message);}
    finally{setSavingEmployee(false);}
  };

  const archiveEmp = id => {
    const emp = data.employees.find(e => e.id === id);
    if (!emp) return;
    setDismissalModal(emp);
    setDismissalForm({endDate:today(),reason:"demissao_sem_justa_causa",notes:""});
  };

  const confirmDismissal = async () => {
    const emp=dismissalModal;
    if(!emp)return;
    if (!dismissalForm.endDate) { showToast("Informe a data do desligamento.", "error"); return; }
    if(dismissalForm.endDate<emp.startDate){showToast("O último dia não pode anteceder a admissão.","error");return;}
    if(dismissalForm.reason==="outro"&&!String(dismissalForm.notes||"").trim()){
      showToast("Descreva o motivo quando selecionar Outro motivo.","error");return;
    }
    const reasonLabels={
      demissao_sem_justa_causa:"Demissão sem justa causa",
      pedido_demissao:"Pedido de demissão",
      demissao_justa_causa:"Demissão por justa causa",
      termino_contrato:"Término de contrato",
      outro:"Outro motivo",
    };
    const terminationReason=reasonLabels[dismissalForm.reason]||"Desligamento";

    const scheduled=dismissalForm.endDate>today();
    setPendingAction("dismissal");
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.employees||[]).find(item=>item.id===emp.id);
      return {
        type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
        idempotencyKey:`funcionario-demitir-${emp.id}-${uid()}`,
        expectedVersion:Number(emp.version||0),
        payload:{employee:{
          ...vigente,active:scheduled,status:scheduled?"desligamento_agendado":"desligado",endDate:dismissalForm.endDate,
          terminationReason,terminationType:DISMISSAL_TO_RESCISSION_TYPE[dismissalForm.reason]||"sem_justa_causa",
          terminationNotes:String(dismissalForm.notes||"").trim(),
          lastObra:vigente?.obra||vigente?.lastObra||"",
          terminationRegisteredBy:currentUser?.nome||"Usuário autenticado",
          terminationRegisteredAt:new Date().toISOString(),
        }},
      };
    });
    setPendingAction("");
    if(!result?.ok){showToast(result?.reason||"O desligamento não foi confirmado pelo servidor.","error");return;}
    setDismissalModal(null);
    setExpandedId(null);
    setStatusFilter(scheduled?"desligamento_agendado":"desligado");
    showToast(scheduled?`Desligamento de ${emp.name} agendado. Último dia: ${fmtDateFull(dismissalForm.endDate)}.`:`${emp.name} desligado. Último dia trabalhado: ${fmtDateFull(dismissalForm.endDate)}.`);
  };

  // Mesmo cadastros indevidos podem já ter sido referenciados por ponto,
  // pagamentos ou conciliação. Arquivar substitui a exclusão física.
  const deleteEmp = async () => {
    const emp = archiveModal;
    if (!emp) return;
    if(!archiveReason.trim()){showToast("Informe o motivo do arquivamento.","error");return;}
    setPendingAction("archive");
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.employees||[]).find(item=>item.id===emp.id);
      return {
        type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
        idempotencyKey:`funcionario-arquivar-${emp.id}-${uid()}`,
        expectedVersion:Number(emp.version||0),
        payload:{employee:{
          ...vigente,status:"arquivado",active:false,
          endDate:vigente?.endDate||today(),
          terminationReason:archiveReason.trim(),
          motivoCancelamento:archiveReason.trim(),
          lastObra:vigente?.obra||vigente?.lastObra||"",
        }},
      };
    });
    setPendingAction("");
    if(!result?.ok){showToast(result?.reason||"O cadastro não foi arquivado.","error");return;}
    setArchiveModal(null); setArchiveReason(""); setStatusFilter("arquivado");
    setExpandedId(null);
    showToast(`${emp.name} arquivado com histórico preservado.`);
  };

  // Desvincula da obra sem mexer em mais nada: o funcionario fica "Sem obra"
  // e some das listas por obra, mas continua no cadastro e no historico.
  const desvincularObra = async () => {
    const emp = unlinkModal;
    if (!emp || !emp.obra) return;
    setPendingAction("unlink");
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.employees||[]).find(item=>item.id===emp.id);
      return {
        type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
        idempotencyKey:`funcionario-desvincular-${emp.id}-${uid()}`,
        expectedVersion:Number(emp.version||0),
        payload:{employee:{...vigente,obra:"",lastObra:vigente?.obra||vigente?.lastObra||""}},
      };
    });
    setPendingAction("");
    if(!result?.ok){showToast(result?.reason||"O funcionário não foi desvinculado.","error");return;}
    setUnlinkModal(null);
    showToast(`${emp.name} desvinculado da obra.`);
  };

  const reactivateEmp=async emp=>{
    setPendingAction(`reactivate-${emp.id}`);
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.employees||[]).find(item=>item.id===emp.id);
      return {type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,idempotencyKey:`funcionario-reativar-${emp.id}-${uid()}`,expectedVersion:Number(emp.version||0),payload:{employee:{...vigente,active:true,status:"ativo",endDate:"",terminationReason:"",terminationType:"",terminationNotes:""}}};
    });
    setPendingAction("");
    if(!result?.ok){showToast(result?.reason||"A reativação não foi confirmada.","error");return;}
    setStatusFilter("ativo"); setExpandedId(emp.id); showToast(`${emp.name} reativado com histórico preservado.`);
  };

  const saveAdv = async () => {
    if (!(Number(advForm.amount)>0)) {
      showToast("Valor do adiantamento inválido.", "error");
      return;
    }
    const installmentCount=Number(advForm.installmentCount||1);
    if(!Number.isInteger(installmentCount)||installmentCount<1||installmentCount>24){
      showToast("Informe entre 1 e 24 parcelas.","error");
      return;
    }
    const advanceId=uid();
    const result=await dispatchCommand({
      type:OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED,
      idempotencyKey:`adiantamento-criar-${advanceId}-${uid()}`,
      expectedVersion:0,
      payload:{advance:{
        id:advanceId,empId:advModal,date:advForm.date||today(),
        amount:Number(advForm.amount),description:advForm.description||"Adiantamento",
        installmentCount,frequency:advForm.frequency,
        firstDueDate:advForm.firstDueDate||advForm.date||today(),
      }},
    });
    if(!result?.ok){
      showToast(result?.reason||"O adiantamento não foi confirmado pelo servidor.","error");
      return;
    }
    setAdvModal(null);
    setAdvForm({amount:"",description:"",date:today(),installmentCount:"1",frequency:"quinzenal",firstDueDate:today()});
    showToast(`Adiantamento registrado em ${installmentCount} parcela(s).`);
  };

  const removeAdv = advance => { setAdvCancelModal(advance); setAdvCancelReason(""); };

  const confirmRemoveAdv = async () => {
    const advance = advCancelModal;
    if (!advance) return;
    if(!advCancelReason.trim()){showToast("Informe o motivo do cancelamento.","error");return;}
    setPendingAction("advCancel");
    const result=await dispatchCommand({
      type:OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CANCELLED,
      idempotencyKey:`adiantamento-cancelar-${advance.id}-${uid()}`,
      expectedVersion:Number(advance.version||0),
      payload:{advanceId:advance.id,reason:advCancelReason.trim()},
    });
    setPendingAction("");
    if(!result?.ok){
      showToast(result?.reason||"O cancelamento não foi confirmado pelo servidor.","error");
      return;
    }
    setAdvCancelModal(null); setAdvCancelReason("");
    showToast("Adiantamento cancelado e preservado para auditoria.");
  };

  const lifecycleOf=e=>employeeLifecycleStatus(e,today());
  const list = data.employees
    .filter(e => statusFilter === "todos" || lifecycleOf(e) === statusFilter)
    .filter(e => filterObra === "all"
      || (filterObra==="__administrativo__"&&e.workArea==="administrativo")
      || (filterObra==="__sem_obra__"&&!e.obra&&e.workArea!=="administrativo")
      || e.obra === filterObra || e.lastObra === filterObra)
    .filter(e => [e.name, e.role, e.cpf, e.phone].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const ativos = data.employees.filter(e=>lifecycleOf(e)==="ativo");
  const semObra = ativos.filter(e=>!e.obra).length;
  const administrativos = ativos.filter(e=>e.workArea==="administrativo").length;
  const lifecycleCounts=(data.employees||[]).reduce((acc,e)=>({...acc,[lifecycleOf(e)]:(acc[lifecycleOf(e)]||0)+1}),{});
  const clearFilters=()=>{setSearch("");setFilterObra(obraIdFixo||"all");setStatusFilter("ativo");};
  const lifecycleLabel={ativo:"Ativo",desligamento_agendado:"Desligamento agendado",desligado:"Desligado",arquivado:"Arquivado"};
  const lifecycleColor={ativo:C.green,desligamento_agendado:C.orange,desligado:C.muted,arquivado:C.red};

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth:1280, margin:"0 auto" }}>
      <PageHero
        eyebrow="Recursos Humanos"
        title="Equipes"
        description="Pessoas, lotação e dados trabalhistas em uma visão única."
        actions={<Btn onClick={() => { setForm({ ...emptyEmp, obra: obraIdFixo||data.obras[0]?.id || "" }); setFormErrors({}); setModal(true); }}><Ic n="plus" /> Cadastrar funcionário</Btn>}
      />

      <div className="team-summary" aria-label="Resumo e filtros por situação">
        {[
          ["ativo","Ativos",lifecycleCounts.ativo||0],
          ["desligamento_agendado","Agendados",lifecycleCounts.desligamento_agendado||0],
          ["desligado","Desligados",lifecycleCounts.desligado||0],
          ["arquivado","Arquivados",lifecycleCounts.arquivado||0],
          ["todos","Todas as situações",(data.employees||[]).length],
        ].map(([value,label,count])=><button key={value} type="button" className={`team-summary__item${statusFilter===value?" is-active":""}`} onClick={()=>setStatusFilter(value)} aria-pressed={statusFilter===value}><span>{label}</span><strong>{count}</strong></button>)}
        <button type="button" className={`team-summary__item${filterObra==="__sem_obra__"?" is-active":""}`} onClick={()=>{setFilterObra("__sem_obra__");setStatusFilter("ativo");}} aria-pressed={filterObra==="__sem_obra__"}><span>Sem lotação</span><strong>{semObra-administrativos}</strong></button>
      </div>

      <div className="team-toolbar">
        <Inp label="Pesquisar na equipe" value={search} onChange={setSearch} placeholder="Nome, função, CPF ou telefone" />
        {obraIdFixo?<Inp label="Lotação" value={data.obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>:<Sel label="Filtrar por lotação" value={filterObra} onChange={setFilterObra} options={[{v:"all",l:"Todas as lotações"},{v:"__administrativo__",l:"Administrativo"},{v:"__sem_obra__",l:"Sem lotação"},...data.obras.map(o=>({v:o.id,l:o.name}))]} />}
      </div>

      <div className="team-list-head" aria-hidden="true"><span>Funcionário</span><span>Função</span><span>Lotação</span><span>Pendências</span><span>Situação</span><span>Ações</span></div>
      {list.length === 0 && <div className="team-empty"><strong>{(data.employees||[]).length?"Nenhum resultado com estes filtros.":"Nenhum funcionário cadastrado."}</strong><p>{(data.employees||[]).length?"Limpe os filtros ou selecione outra situação.":"Cadastre o primeiro funcionário para iniciar a gestão da equipe."}</p>{(data.employees||[]).length?<Btn v="ghost" onClick={clearFilters}>Limpar filtros</Btn>:<Btn onClick={()=>{setForm({...emptyEmp,obra:obraIdFixo||data.obras[0]?.id||""});setModal(true);}}>Cadastrar funcionário</Btn>}</div>}

      {list.map(e => {
        const advs = empAdvances(e.id);
        const totalAdv = advs.filter(advanceActive).reduce((s, a) => s + Number(a.amount || 0), 0);
        const compliance = employeeComplianceStatus(e, today());
        const exp = expandedId === e.id;
        const lifecycle=lifecycleOf(e);
        const detailId=`employee-detail-${e.id}`;
        return (
          <article key={e.id} className={`team-row team-row--${lifecycle}`}>
            <div className="team-row__main">
              <button type="button" className="team-row__employee" onClick={() => setExpandedId(exp ? null : e.id)} aria-expanded={exp} aria-controls={detailId}>
                <span className="team-row__initials">{e.name.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span><strong>{e.name}</strong><small>{fmt(e.dailyRate)}/dia</small></span><Ic n={exp?"chevronUp":"chevronDown"} s={13}/>
              </button>
              <span className="team-row__cell" data-label="Função">{e.role||"Não informada"}</span>
              <span className="team-row__cell" data-label="Lotação">{e.workArea==="administrativo"?"Administrativo":(e.obra?obraName(e.obra):"Sem lotação")}</span>
              <span className="team-row__cell" data-label="Pendências">
                <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-start"}}>
                  {totalAdv>0&&<Badge color={C.red}>Adiant. {fmt(totalAdv)}</Badge>}
                  {compliance.expired.length>0&&<Badge color={C.orange}>{compliance.expired.length===1?"1 doc. vencido":`${compliance.expired.length} docs. vencidos`}</Badge>}
                  {totalAdv<=0&&compliance.expired.length===0&&<span className="team-row__none">Nenhuma</span>}
                </div>
              </span>
              <span className="team-row__cell" data-label="Situação"><Badge color={lifecycleColor[lifecycle]}>{lifecycleLabel[lifecycle]}</Badge></span>
              <div className="team-row__actions"><Btn v="ghost" size="sm" onClick={() => gerarFichaFuncionarioPDF(data, e, showToast)}><Ic n="file"/> Ficha</Btn><Btn v="ghost" size="sm" onClick={() => { setForm({...employeeEditDraft(e),trainings:{...EMPTY_TRAININGS,...(e.trainings||{})}}); setFormErrors({}); setEmployeeSaveError(''); setModal(true); }}><Ic n="edit"/> Editar</Btn></div>
            </div>

            {exp && (
              <div id={detailId} className="team-row__detail">
                <div className="team-detail-grid">
                  <p style={{ color: C.subtle, fontSize: "var(--arcd-type-body)" }}>CPF: {e.cpf || "-"}</p>
                  <p style={{ color: C.subtle, fontSize: "var(--arcd-type-body)" }}>Telefone: {e.phone || "-"}</p>
                  <p style={{ color: C.subtle, fontSize: "var(--arcd-type-body)" }}>PIX: {e.pixKey || "-"}</p>
                  <p style={{ color: C.subtle, fontSize: "var(--arcd-type-body)" }}>Admissão: {fmtDateFull(e.startDate)}</p>
                  {e.endDate && <p style={{ color: lifecycle==="desligamento_agendado"?C.orange:C.red, fontSize: "var(--arcd-type-body)" }}>Último dia trabalhado: {fmtDateFull(e.endDate)}</p>}
                  {e.terminationReason&&<p style={{color:C.subtle,fontSize:"var(--arcd-type-body)"}}>Tipo: {e.terminationReason}</p>}
                  {e.terminationNotes&&<p style={{color:C.subtle,fontSize:"var(--arcd-type-body)"}}>Observações: {e.terminationNotes}</p>}
                  {e.terminationRegisteredBy&&<p style={{color:C.subtle,fontSize:"var(--arcd-type-body)"}}>Registrado por: {e.terminationRegisteredBy}</p>}
                  {e.examExpiresAt&&<p style={{color:overdue(e.examExpiresAt,today())?C.red:C.subtle,fontSize:"var(--arcd-type-body)"}}>ASO (exame ocupacional): {fmtDateFull(e.examExpiresAt)}{overdue(e.examExpiresAt,today())?" · vencido":""}</p>}
                  {WORKER_TRAINING_TYPES.filter(t=>e.trainings?.[t.key]?.expiresAt).map(t=>(
                    <p key={t.key} style={{color:overdue(e.trainings[t.key].expiresAt,today())?C.red:C.subtle,fontSize:"var(--arcd-type-body)"}}>{t.label}: {fmtDateFull(e.trainings[t.key].expiresAt)}{overdue(e.trainings[t.key].expiresAt,today())?" · vencido":""}</p>
                  ))}
                </div>

                <div className="team-detail-actions">
                  {e.obra && lifecycle==="ativo" && <Btn v="ghost" size="sm" onClick={() => setUnlinkModal(e)}><Ic n="x" /> Desvincular da obra</Btn>}
                  {lifecycle==="ativo" && <Btn v="danger" size="sm" onClick={() => archiveEmp(e.id)}><Ic n="x" /> Registrar desligamento</Btn>}
                  {lifecycle==="desligamento_agendado"&&<Btn v="warning" size="sm" onClick={()=>{setDismissalModal(e);setDismissalForm({endDate:e.endDate,reason:RESCISSION_TYPE_TO_DISMISSAL[e.terminationType]||"outro",notes:e.terminationNotes||""});}}><Ic n="edit"/> Corrigir agendamento</Btn>}
                  {["desligado","desligamento_agendado"].includes(lifecycle)&&<Btn v="success" size="sm" loading={pendingAction===`reactivate-${e.id}`} onClick={()=>reactivateEmp(e)}><Ic n="refresh"/> Reativar</Btn>}
                  {lifecycle!=="arquivado"&&<Btn v="danger" size="sm" onClick={() => {setArchiveModal(e);setArchiveReason("");}}><Ic n="trash" /> Arquivar cadastro</Btn>}
                </div>

                <Divider />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ color: C.yellow, fontFamily:"var(--arcd-font-sans)", fontWeight:600, textTransform: "uppercase" }}>Adiantamentos</p>
                  <Btn v="warning" size="sm" onClick={() => setAdvModal(e.id)}><Ic n="plus" /> Novo</Btn>
                </div>
                {advs.length === 0 && <p style={{ color: C.muted, fontSize: "var(--arcd-type-body)" }}>Nenhum adiantamento.</p>}
                {advs.map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, padding: "7px 0",opacity:advanceActive(a)?1:.55 }}>
                    <div>
                      <p style={{ fontWeight:600, fontSize: "var(--arcd-type-body)" }}>{a.description}</p>
                      <p style={{ color: C.muted, fontSize:"var(--arcd-type-label)" }}>{fmtDateFull(a.date)} · {a.installmentCount||1}x {a.frequency==="mensal"?"mensal":"quinzenal"}{!advanceActive(a)?" · cancelado":""}</p>
                      {advanceActive(a)&&(a.installments||[]).length>0&&<p style={{color:C.subtle,fontSize:"var(--arcd-type-label)",marginTop:2}}>{a.installments.map(item=>`${item.number}ª ${fmt(item.amount)} em ${fmtDate(item.dueDate)}`).join(" · ")}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: C.red, fontWeight:600 }}>{fmt(a.amount)}</span>
                      {advanceActive(a)&&<Btn v="danger" size="sm" ariaLabel={`Cancelar adiantamento ${a.description}`} title={`Cancelar adiantamento ${a.description}`} onClick={() => removeAdv(a)}><Ic n="trash" /></Btn>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}

      {modal && (
        <Modal title={form.id ? "Editar funcionário" : "Novo funcionário"} onClose={() => {if(!savingEmployee)setModal(false);}} wide panelClass="employee-edit-modal" footer={<><p className="employee-edit-feedback" role={employeeSaveError?'alert':'status'}>{employeeSaveError||(savingEmployee?'Salvando funcionário…':'')}</p><div className="employee-edit-actions"><Btn v="ghost" disabled={savingEmployee} onClick={()=>setModal(false)}>Cancelar</Btn><Btn disabled={savingEmployee} onClick={saveEmp}><Ic n="check"/> {savingEmployee?'Salvando…':'Salvar'}</Btn></div></>}>
          <fieldset disabled={savingEmployee} style={{border:0,padding:0,margin:0,minWidth:0}} aria-label="Dados do funcionário">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={TYPO.eyebrow}>Identificação</p>
              <div style={{ display: "grid", gridTemplateColumns:formGrid(2), gap: 12 }}>
                <div style={{ gridColumn: "1/-1" }}><Inp label="Nome completo *" value={form.name} onChange={F("name")} inputRef={nameInputRef} error={formErrors.name}/></div>
                <Inp label="Função" value={form.role} onChange={F("role")} />
                <Inp label="CPF" value={form.cpf} onChange={v => F("cpf")(fmtCPF(v))} />
                <Inp label="Telefone" value={form.phone} onChange={v => F("phone")(fmtPhone(v))} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={TYPO.eyebrow}>Lotação</p>
              <div style={{ display: "grid", gridTemplateColumns:formGrid(2), gap: 12 }}>
                <Sel label="Área de atuação" value={form.workArea||"campo"} onChange={value=>setForm(current=>({...current,workArea:value,...(value==="administrativo"?{obra:""}:{})}))} options={[{v:"campo",l:"Campo / obra"},{v:"administrativo",l:"Administrativo"}]}/>
                <Inp label="Admissão *" type="date" value={form.startDate} onChange={F("startDate")} error={formErrors.startDate}/>
                {form.workArea!=="administrativo"
                  ?<Sel label="Obra" value={form.obra} onChange={F("obra")} options={[{ v: "", l: "Sem obra (desvinculado)" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]} />
                  :<Inp label="Lotação" value="Administrativo da empresa" onChange={()=>{}} disabled/>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={TYPO.eyebrow}>Remuneração</p><p className="employee-edit-hint">Valores cadastrados são mantidos, inclusive zero. Dados salvos no perfil do holerite são reaproveitados. Salário mensal, matrícula e CBO sem registro ficam em branco; a diária não é convertida em salário mensal.</p>
              <div style={{ display: "grid", gridTemplateColumns:formGrid(2), gap: 12 }}>
                <Sel label="Modalidade de remuneração" value={form.remunerationMode||"daily"} onChange={v=>setForm(f=>({...f,remunerationMode:v,remunerationEffectiveFrom:today()}))} options={[{v:"daily",l:"Diária"},{v:"clt",l:"CLT mensal"}]}/>
                {(!form.id||(form.remunerationMode||"daily")!==(data.employees.find(e=>e.id===form.id)?.remunerationMode||"daily"))?<Inp label="Modalidade válida a partir de" type="date" value={form.remunerationEffectiveFrom||""} onChange={F("remunerationEffectiveFrom")}/>:<p className="employee-edit-hint">Modalidade atual preservada. Para mudar, selecione outra modalidade e informe a vigência.</p>}
                <Inp label={form.remunerationMode==="clt"?"Salário contratual mensal *":"Salário mensal para opção CLT"} type="number" value={String(form.monthlySalary||"")} onChange={F("monthlySalary")} error={formErrors.monthlySalary}/>
                <Inp label="Matrícula do funcionário" value={form.cltPayroll?.profile?.registration||""} onChange={v=>setForm(f=>({...f,cltPayroll:{...f.cltPayroll,profile:{...f.cltPayroll?.profile,registration:v}}}))}/>
                <Inp label="CBO do funcionário" value={form.cltPayroll?.profile?.cbo||""} onChange={v=>setForm(f=>({...f,cltPayroll:{...f.cltPayroll,profile:{...f.cltPayroll?.profile,cbo:v}}}))}/>
                <Sel label="Categoria contratual na CCT" value={form.cltPayroll?.profile?.category||""} onChange={v=>setForm(f=>({...f,cltPayroll:{...f.cltPayroll,profile:{...f.cltPayroll?.profile,category:v}}}))} options={[{v:"",l:"Selecione"},{v:"professional",l:"Profissional"},{v:"helper",l:"Servente / ajudante"}]}/>
                <Inp label={form.remunerationMode==="clt"?"Diária de referência para custeio do ponto *":"Diária *"} type="number" value={form.dailyRate} onChange={F("dailyRate")} error={formErrors.dailyRate}/>
                <Inp label="VT diário" type="number" value={form.vtDaily} onChange={F("vtDaily")} />
                <Inp label="VR diário" type="number" value={form.vrDaily} onChange={F("vrDaily")} />
                <Inp label="Jornada padrão (horas)" type="number" min="1" max="24" value={form.workdayHours} onChange={F("workdayHours")} />
                <Inp label="Início previsto da jornada" type="time" value={form.workStart} onChange={F("workStart")} />
                <Inp label="Adicional de hora extra (%)" type="number" min="0" value={form.overtimeAdditionalPercent} onChange={F("overtimeAdditionalPercent")} />
              </div>
              {form.remunerationMode==="clt"&&<p style={{color:C.subtle,fontSize:"var(--arcd-type-label)"}}>O salário contratual alimenta o holerite mensal. A diária de referência mantém o custeio dos apontamentos no DRE; não define o salário CLT nem representa um novo pagamento. Alterar a modalidade não recalcula folhas anteriores.</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={TYPO.eyebrow}>PIX</p>
              <div style={{ display: "grid", gridTemplateColumns:formGrid(2), gap: 12 }}>
                <Inp label="Instruções de pagamento (se não usar PIX)" value={form.paymentInstructions||""} onChange={F("paymentInstructions")}/>
                <Inp label="Tipo PIX" value={form.pixType} onChange={F("pixType")} />
                <Inp label="Titular PIX" value={form.pixHolder} onChange={F("pixHolder")} />
                <div style={{ gridColumn: "1/-1" }}><Inp label="Chave PIX" value={form.pixKey} onChange={F("pixKey")} /></div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={TYPO.eyebrow}>Documentos e certificações</p>
              <div style={{ display: "grid", gridTemplateColumns:formGrid(2), gap: 12 }}>
                <Inp label="Validade do ASO (exame ocupacional)" type="date" value={form.examExpiresAt} onChange={F("examExpiresAt")} />
                {WORKER_TRAINING_TYPES.map(t => (
                  <Inp key={t.key} label={`Validade ${t.label}`} type="date" value={form.trainings?.[t.key]?.expiresAt || ""} onChange={setTraining(t.key)} />
                ))}
              </div>
            </div>
          </div>
          </fieldset>
        </Modal>
      )}

      {dismissalModal && (()=>{
        const openAdvances=empAdvances(dismissalModal.id).filter(advanceActive);
        const openAdvanceTotal=openAdvances.reduce((sum,item)=>sum+Number(item.amount||0),0);
        return <Modal title={dismissalModal.status==="desligamento_agendado"?"Corrigir desligamento":"Registrar desligamento"} onClose={()=>setDismissalModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{border:`1px solid ${C.red}55`,background:`${C.red}0A`,padding:"11px 12px",borderRadius:8}}>
              <p style={{fontSize:"var(--arcd-type-body)",fontWeight:600,color:C.text}}>{dismissalModal.name}</p>
              <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:2}}>{dismissalModal.role||"Função não informada"} · {dismissalModal.workArea==="administrativo"?"Administrativo":obraName(dismissalModal.obra)}</p>
            </div>
            <Inp label="Último dia trabalhado *" type="date" min={dismissalModal.startDate} value={dismissalForm.endDate} onChange={value=>setDismissalForm(form=>({...form,endDate:value}))}/>
            <Sel label="Tipo de desligamento *" value={dismissalForm.reason} onChange={value=>setDismissalForm(form=>({...form,reason:value}))} options={[
              {v:"demissao_sem_justa_causa",l:"Demissão sem justa causa"},
              {v:"pedido_demissao",l:"Pedido de demissão"},
              {v:"demissao_justa_causa",l:"Demissão por justa causa"},
              {v:"termino_contrato",l:"Término de contrato"},
              {v:"outro",l:"Outro motivo"},
            ]}/>
            <Inp label={dismissalForm.reason==="outro"?"Observações *":"Observações"} value={dismissalForm.notes} onChange={value=>setDismissalForm(form=>({...form,notes:value}))} multiline placeholder="Aviso-prévio, documentos pendentes ou referência interna"/>
            {openAdvanceTotal>0&&<div style={{border:`1px solid ${C.orange}66`,background:`${C.orange}0A`,padding:"9px 10px",borderRadius:7}}>
              <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.orange}}>Atenção: existem {openAdvances.length} adiantamento(s), totalizando {fmt(openAdvanceTotal)}.</p>
              <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>Os lançamentos serão preservados para conferência no acerto da rescisão.</p>{onTab&&<Btn v="ghost" size="sm" onClick={()=>{setDismissalModal(null);onTab("resc");}}>Ir para Rescisões</Btn>}
            </div>}
            <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,lineHeight:1.5}}>A data informada é inclusiva. O funcionário permanece na folha e no ponto até o último dia trabalhado e sai a partir do dia seguinte. Datas futuras ficam agendadas. Todo o histórico é preservado.</p>
            <div style={{display:"flex",gap:8}}><Btn v="ghost" full onClick={()=>setDismissalModal(null)}>Cancelar</Btn><Btn v="danger" full loading={pendingAction==="dismissal"} onClick={confirmDismissal}><Ic n="check"/> Confirmar desligamento</Btn></div>
          </div>
        </Modal>;
      })()}

      {unlinkModal&&<Modal title="Desvincular da obra" onClose={()=>setUnlinkModal(null)}><div className="team-confirm"><p><strong>{unlinkModal.name}</strong> será removido da obra {obraName(unlinkModal.obra)}, mas continuará ativo e disponível para nova lotação.</p><div><Btn v="ghost" full onClick={()=>setUnlinkModal(null)}>Cancelar</Btn><Btn v="warning" full loading={pendingAction==="unlink"} onClick={desvincularObra}>Confirmar desvinculação</Btn></div></div></Modal>}

      {archiveModal&&<Modal title="Arquivar cadastro" onClose={()=>setArchiveModal(null)}><div className="team-confirm"><p>Arquive <strong>{archiveModal.name}</strong> somente em caso de cadastro duplicado ou indevido. Frequência, pagamentos e auditoria serão preservados.</p><Inp label="Motivo do arquivamento *" value={archiveReason} onChange={setArchiveReason} multiline placeholder="Explique por que este cadastro não deve permanecer nas listas"/><div><Btn v="ghost" full onClick={()=>setArchiveModal(null)}>Cancelar</Btn><Btn v="danger" full loading={pendingAction==="archive"} onClick={deleteEmp}>Arquivar cadastro</Btn></div></div></Modal>}

      {advCancelModal&&<Modal title="Cancelar adiantamento" onClose={()=>setAdvCancelModal(null)}><div className="team-confirm"><p>Cancele o adiantamento de <strong>{fmt(Number(advCancelModal.amount||0))}</strong>{advCancelModal.description?` (${advCancelModal.description})`:""}. O lançamento é preservado para auditoria.</p><Inp label="Motivo do cancelamento *" value={advCancelReason} onChange={setAdvCancelReason} multiline placeholder="Explique por que este adiantamento está sendo cancelado"/><div><Btn v="ghost" full onClick={()=>setAdvCancelModal(null)}>Cancelar</Btn><Btn v="danger" full loading={pendingAction==="advCancel"} onClick={confirmRemoveAdv}>Confirmar cancelamento</Btn></div></div></Modal>}

      {advModal && (
        <Modal title="Solicitar ou registrar adiantamento" onClose={() => setAdvModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp label="Valor *" type="number" value={advForm.amount} onChange={v => setAdvForm(f => ({ ...f, amount: v }))} />
            <Inp label="Descrição" value={advForm.description} onChange={v => setAdvForm(f => ({ ...f, description: v }))} />
            <Inp label="Data da solicitação/liberação" type="date" value={advForm.date} onChange={v => setAdvForm(f => ({ ...f, date: v }))} />
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
              <Inp label="Quantidade de parcelas" type="number" min="1" max="24" value={advForm.installmentCount} onChange={v=>setAdvForm(f=>({...f,installmentCount:v}))}/>
              <Sel label="Frequência do desconto" value={advForm.frequency} onChange={v=>setAdvForm(f=>({...f,frequency:v}))} options={[{v:"quinzenal",l:"A cada quinzena"},{v:"mensal",l:"Uma vez por mês"}]}/>
              <Inp label="Primeiro desconto na folha" type="date" value={advForm.firstDueDate} onChange={v=>setAdvForm(f=>({...f,firstDueDate:v}))}/>
            </div>
            {Number(advForm.amount)>0&&Number(advForm.installmentCount)>0&&<div style={{padding:"9px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6}}>
              <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:C.muted,textTransform:"uppercase"}}>Programação dos descontos</p>
              <p style={{fontSize:"var(--arcd-type-label)",color:C.text,marginTop:4,lineHeight:1.55}}>{buildAdvanceInstallments({
                advanceId:"previa",amount:Number(advForm.amount),installmentCount:Number(advForm.installmentCount),
                firstDueDate:advForm.firstDueDate,frequency:advForm.frequency,
              }).map(item=>`${item.number}ª ${fmt(item.amount)} · ${fmtDate(item.dueDate)}`).join("  |  ")||"Informe uma data válida."}</p>
            </div>}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="ghost" onClick={() => setAdvModal(null)} full>Cancelar</Btn>
              <Btn v="warning" onClick={saveAdv} full><Ic n="check" /> Confirmar parcelamento</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Equipe;
