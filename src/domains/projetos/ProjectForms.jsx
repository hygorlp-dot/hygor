import {ChoiceControl} from '../../design-system/primitives/ChoiceControl.jsx';
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../design-system/primitives/Input.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";
import { Textarea } from "../../design-system/primitives/Textarea.jsx";
import { PROJECT_STAGES, PROJECT_DISCIPLINES, PROJECT_STATUSES } from "./model.js";
import { TASK_STATUSES, TASK_PRIORITIES } from "./kanban-model.js";

const options = values => values.map(value => ({ value, label: value }));
export function ProjectForm({ project, data, currentUser, busy, onSave, onCancel }) {
  const [form, setForm] = useState(() => project || { name: "", client: "", obraId: currentUser.obraId || "", responsibleId: currentUser.id, discipline: "Arquitetura", stage: "Levantamento", deadline: "", plannedHours: "", description: "", status: "ativo", kanbanLimits: { em_andamento: 3, em_revisao: 2 }, requireApprovedDeliveries: false });
  const field = name => ({ value: form[name] ?? "", onChange: event => setForm(previous => ({ ...previous, [name]: event.target.value, ...(name === "stage" && event.target.value === "Concluído" ? { status: "concluido" } : name === "status" && event.target.value === "ativo" && previous.stage === "Concluído" ? { stage: "Executivo" } : {}) })) });
  return <form className="engineering-form" onSubmit={event => { event.preventDefault(); onSave(form); }} aria-label={project ? "Editar projeto" : "Novo projeto"}>
    <h2>{project ? "Editar projeto" : "Novo projeto"}</h2>
    <fieldset disabled={busy} className="engineering-fields">
      <Input label="Nome do projeto" required autoFocus maxLength={200} {...field("name")} />
      <Input label="Cliente" maxLength={200} {...field("client")} />
      <Select label="Obra vinculada" disabled={Boolean(project) || Boolean(currentUser.obraId && currentUser.role !== "admin")} description={project ? "O vínculo é preservado para manter o histórico." : undefined} {...field("obraId")}>
        {(!currentUser.obraId || currentUser.role === "admin") && <option value="">Projeto de escritório, sem obra</option>}
        {(data.obras || []).map(obra => <option key={obra.id} value={obra.id}>{obra.name}</option>)}
      </Select>
      <Select label="Responsável" required {...field("responsibleId")} options={(data.usuarios || []).filter(user => user.active !== false).map(user => ({ value: user.id, label: user.nome }))} />
      <Select label="Disciplina" {...field("discipline")} options={options(PROJECT_DISCIPLINES)} />
      <Select label="Etapa" {...field("stage")} options={options(PROJECT_STAGES)} />
      <Input label="Prazo de entrega" type="date" {...field("deadline")} />
      <Input label="Horas previstas" type="number" min="0" max="1000000" step="0.25" {...field("plannedHours")} />
      <Select label="Situação" {...field("status")} options={Object.entries(PROJECT_STATUSES).map(([value, label]) => ({ value, label }))} />
      <Input label="Limite em produção" description="Zero significa sem limite de atividades." type="number" min="0" max="1000" step="1" value={form.kanbanLimits?.em_andamento || 0} onChange={event => setForm(previous => ({ ...previous, kanbanLimits: { ...previous.kanbanLimits, em_andamento: event.target.value } }))} />
      <Input label="Limite em revisão técnica" description="A capacidade é verificada ao mover ou criar cartões." type="number" min="0" max="1000" step="1" value={form.kanbanLimits?.em_revisao || 0} onChange={event => setForm(previous => ({ ...previous, kanbanLimits: { ...previous.kanbanLimits, em_revisao: event.target.value } }))} />
      <label className="engineering-checkbox engineering-wide"><ChoiceControl type="checkbox" checked={Boolean(form.requireApprovedDeliveries)} onChange={event => setForm(previous => ({ ...previous, requireApprovedDeliveries: event.target.checked }))} /><span>Exigir aprovação da última revisão das entregas submetidas para concluir o projeto</span></label>
      <div className="engineering-wide"><Textarea label="Descrição e escopo" maxLength={4000} {...field("description")} /></div>
    </fieldset>
    <div className="engineering-actions"><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar projeto"}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
  </form>;
}

export function RecordForm({ kind, project, record, data, currentUser, busy, onSave, onCancel }) {
  const formRef = useRef(null);
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "nearest" });
    formRef.current?.querySelector("input,select,textarea")?.focus({ preventScroll: true });
  }, []);
  const [form, setForm] = useState(() => {
    if (kind === "task") return { title: "", responsibleId: currentUser.id, deadline: "", status: "pendente", priority: "normal", plannedHours: "", description: "", checklist: [], dependencies: [], blockedReason: "", linkId: "", requireReview: false, ...(record || {}) };
    if (kind === "revision") return { linkId: project.links?.[0]?.id || "", url: "", description: "" };
    if (kind === "review") return { status: "aprovada", comment: "" };
    if (kind === "adjust") return { minutes: "", reason: "" };
    return { title: "", url: "" };
  });
  const field = name => ({ value: form[name] ?? "", onChange: event => setForm(previous => ({ ...previous, [name]: event.target.value })) });
  const title = { task: record ? "Editar atividade" : "Nova atividade", link: "Adicionar link", revision: "Enviar revisão", review: "Registrar parecer", adjust: "Ajustar horas" }[kind];
  return <form ref={formRef} className="engineering-form" aria-label={title} onSubmit={event => { event.preventDefault(); onSave(form); }}>
    <h3>{title}</h3>
    <fieldset disabled={busy} className="engineering-fields">
      {["task", "link"].includes(kind) && <Input label="Título" required maxLength={200} {...field("title")} />}
      {kind === "task" && <>
        <Select label="Responsável da atividade" {...field("responsibleId")} options={(data.usuarios || []).filter(user => user.active !== false).map(user => ({ value: user.id, label: user.nome }))} />
        <Input label="Prazo da atividade" type="date" {...field("deadline")} />
        <Select label="Situação da atividade" {...field("status")} options={Object.entries(TASK_STATUSES).map(([value, label]) => ({ value, label }))} />
        <Select label="Prioridade da atividade" {...field("priority")} options={Object.entries(TASK_PRIORITIES).map(([value, label]) => ({ value, label }))} />
        <Input label="Horas previstas da atividade" type="number" min="0" max="1000000" step="0.25" {...field("plannedHours")} />
        <div className="engineering-wide"><Textarea label="Descrição da atividade" maxLength={4000} {...field("description")} /></div>
        <div className="engineering-wide"><Textarea label="Checklist (um item por linha)" maxLength={20000} value={(form.checklist || []).map(item => item.text).join("\n")} onChange={event => setForm(previous => ({ ...previous, checklist: event.target.value.split("\n").map((line, index) => ({ id: previous.checklist?.[index]?.id || crypto.randomUUID(), text: line, done: previous.checklist?.[index]?.text === line ? Boolean(previous.checklist[index].done) : false })) }))} description="Até 50 itens. Marque os itens no cartão após salvar." /></div>
        <Input label="Motivo de bloqueio" description="Deixe vazio para desbloquear a atividade." maxLength={1000} {...field("blockedReason")} />
        <Select label="Entrega vinculada" {...field("linkId")}><option value="">Sem entrega vinculada</option>{(project.links || []).map(link => <option key={link.id} value={link.id}>{link.title}</option>)}</Select>
        <label className="engineering-checkbox engineering-wide"><ChoiceControl type="checkbox" checked={Boolean(form.requireReview)} onChange={event => setForm(previous => ({ ...previous, requireReview: event.target.checked }))} /><span>Exigir aprovação da última revisão da entrega para concluir esta atividade</span></label>
        {(project.tasks || []).some(task => task.id !== record?.id) && <fieldset className="engineering-predecessors engineering-wide"><legend>Atividades predecessoras</legend>{(project.tasks || []).filter(task => task.id !== record?.id).map(task => <label key={task.id}><ChoiceControl type="checkbox" checked={(form.dependencies || []).includes(task.id)} onChange={event => setForm(previous => ({ ...previous, dependencies: event.target.checked ? [...(previous.dependencies || []), task.id] : (previous.dependencies || []).filter(id => id !== task.id) }))} /><span>{task.title}</span></label>)}</fieldset>}
      </>}
      {kind === "revision" && <Select label="Entrega" required {...field("linkId")} options={(project.links || []).map(link => ({ value: link.id, label: link.title }))} />}
      {["link", "revision"].includes(kind) && <Input label={kind === "revision" ? "Link desta versão" : "Endereço do link"} description="HTTP ou HTTPS. O acesso ao arquivo depende das permissões no serviço de origem." type="url" required maxLength={2048} {...field("url")} />}
      {kind === "revision" && <div className="engineering-wide"><Textarea label="O que mudou nesta revisão?" required maxLength={4000} {...field("description")} /></div>}
      {kind === "review" && <>
        <Select label="Parecer" {...field("status")} options={[{ value: "aprovada", label: "Aprovar revisão" }, { value: "ajustes", label: "Solicitar ajustes" }]} />
        <Textarea label="Justificativa do parecer" required maxLength={4000} {...field("comment")} />
      </>}
      {kind === "adjust" && <>
        <Input label="Duração corrigida em minutos" description="Substitui o total desta sessão; o valor anterior permanece na auditoria." type="number" min="0" max="525600" step="1" required {...field("minutes")} />
        <Textarea label="Motivo do ajuste" required maxLength={1000} {...field("reason")} />
      </>}
    </fieldset>
    <div className="engineering-actions"><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar registro"}</Button><Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button></div>
  </form>;
}
