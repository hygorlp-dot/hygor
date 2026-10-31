import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../design-system/primitives/Input.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";
import { Textarea } from "../../design-system/primitives/Textarea.jsx";
import { PROJECT_STAGES, PROJECT_DISCIPLINES, PROJECT_STATUSES } from "./model.js";

const options = values => values.map(value => ({ value, label: value }));
export function ProjectForm({ project, data, currentUser, busy, onSave, onCancel }) {
  const [form, setForm] = useState(() => project || { name: "", client: "", obraId: currentUser.obraId || "", responsibleId: currentUser.id, discipline: "Arquitetura", stage: "Levantamento", deadline: "", plannedHours: "", description: "", status: "ativo" });
  const field = name => ({ value: form[name] ?? "", onChange: event => setForm(previous => ({ ...previous, [name]: event.target.value })) });
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
    if (kind === "task") return record || { title: "", responsibleId: currentUser.id, deadline: "", status: "pendente" };
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
        <Select label="Situação da atividade" {...field("status")} options={[{ value: "pendente", label: "Pendente" }, { value: "em_andamento", label: "Em andamento" }, { value: "concluida", label: "Concluída" }]} />
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
