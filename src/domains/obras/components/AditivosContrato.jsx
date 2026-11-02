import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import ForecastReviewHistory from '../../../features/financeiro/ForecastReviewHistory.jsx';
import ForecastDuplicationWarnings from '../../../features/financeiro/ForecastDuplicationWarnings.jsx';
import {forecastDuplicationWarnings} from '../../financeiro/forecast-duplication.js';
// Aditivos do contrato do cliente (Onda 4.1). Registrar e cancelar: quem
// cuida do contrato (admin, engenharia, financeiro); registrar a decisão do
// cliente, enquanto o portal não aprova sozinho (4.3): administrador.
import "./amendments.css";
import {HelpButton} from "../../../features/help/HelpButton.jsx";
import {costControlStages} from "../../financeiro/cost-control.js";
import {amendmentWarnings} from "../contract-amendments.js";
import { useState } from "react";
import { Btn, Inp, Modal } from "../../../legacy/ui.jsx";
import { C } from "../../../legacy/palette.js";
import { fmt, fmtDate, uid } from "../../../legacy/format.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { AMENDMENT_STATUS, fimContratoVigente, valorContratoVigente } from "../contract-amendments";

const ROTULO = { proposto:"Aguardando cliente", aprovado:"Aprovado", recusado:"Recusado", cancelado:"Cancelado" };

export function AditivosContrato({ obra, data={}, currentUser, dispatchCommand, showToast }) {

  const [notice,setNotice]=useState("");
  const toast=(message,type)=>{setNotice(message);showToast?.(message,type);};
  const {stages,budget}=costControlStages(data,obra.id);
  const duplicationWarnings=forecastDuplicationWarnings(obra,budget);
  const [form, setForm] = useState(null);
  const [decisao, setDecisao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const COR = { proposto:C.orange, aprovado:C.green, recusado:C.red, cancelado:C.muted };
  const papel = currentUser?.role;
  const podeRegistrar = ["admin", "engenheiro", "financeiro"].includes(papel);
  const podeDecidir = papel === "admin";
  const podeCancelar = ["admin", "financeiro"].includes(papel);
  const aditivos = Array.isArray(obra?.aditivosContrato) ? obra.aditivosContrato : [];

  const enviar = async (command, ok) => {
    if(salvando)return false;
    if (!dispatchCommand) { toast("Registro indisponível nesta sessão.", "error"); return false; }
    setSalvando(true);
    try {
      const result = await dispatchCommand({ ...command, actorId:currentUser?.id,actorName:currentUser?.nome,idempotencyKey:`aditivo-${uid()}` });
      if (!result?.ok) { toast(result?.reason || "O servidor não confirmou o aditivo.", "error"); return false; }
      toast([ok,...(result.summary?.workflowWarnings||[]).map(w=>w.message)].join(' '));return true;
    }catch(error){toast(error.message||'Não foi possível registrar. Tente novamente.','error');return false;}
    finally{setSalvando(false);}
  };

  const salvar = async () => {
    const feito = await enviar({
      type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_SAVED, expectedVersion:form.version || 0,
      payload:{ obraId:obra.id, operationalOnly:form.operationalOnly===true, amendment:{ id:form.id, descricao:form.descricao, justificativa:form.justificativa, valor:Number(form.valor || 0), prazoDias:Number(form.prazoDias || 0),evidenciaDecisao:form.evidenciaDecisao,responsavel:form.responsavel||"",etapaId:form.etapaId||"",execucaoStatus:form.execucaoStatus||"planejada",impactoCustoRestante:form.impactoCustoRestante,impactoNaPrevisao:form.impactoNaPrevisao||"nao_incluir" } },
    }, "Mudança registrada. Somente a aprovação atualiza o contrato; o impacto de custo segue a opção de previsão escolhida.");
    if (feito) setForm(null);
  };

  const decidir = async () => {
    const feito = await enviar({
      type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_DECIDED,
      payload:{ obraId:obra.id, amendmentId:decisao.item.id, expectedVersion:decisao.item.version, decision:decisao.decision, origem:"interno", evidencia:decisao.evidencia },
    }, decisao.decision === AMENDMENT_STATUS.APPROVED ? "Aditivo aprovado: o contrato vigente foi atualizado." : "Aditivo registrado como recusado.");
    if (feito) setDecisao(null);
  };

  const cancelar = async item => {
    const motivo = window.prompt("Motivo do cancelamento do aditivo:");
    if (motivo === null) return;
    await enviar({ type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_CANCELLED, payload:{ obraId:obra.id, amendmentId:item.id, expectedVersion:item.version, reason:motivo } }, "Aditivo cancelado.");
  };

  return <section className="amendment-workspace" style={{ background:"var(--arcd-surface-card)", border:"1px solid var(--arcd-border-default)", borderRadius:8, padding:"var(--arcd-space-3)", display:"flex", flexDirection:"column", gap:"var(--arcd-space-2)" }} aria-label="Mudanças e aditivos">
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"var(--arcd-space-2)", flexWrap:"wrap" }}>
      <div>
        <p style={{ fontSize:"var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color:"var(--arcd-text-primary)" }}>Mudanças e aditivos</p>
        <p style={{ fontSize:"var(--arcd-type-label)", color:"var(--arcd-text-secondary)" }}>Contrato vigente {fmt(valorContratoVigente(obra))} (original {fmt(obra?.contractValue || 0)}){fimContratoVigente(obra) ? ` · término ${fmtDate(fimContratoVigente(obra))}` : ""}</p>
      </div>
      <HelpButton pageId="obra_aditivos" allowedTabs={["obras","fin"]} label="Ajuda de mudanças"/>
      {podeRegistrar && <Btn v="ghost" size="sm" onClick={() => setForm({ id:uid(), descricao:"", justificativa:"", valor:"", prazoDias:"" })}>Nova mudança ou aditivo</Btn>}
    </div>
    {notice&&<p role="status">{notice}</p>}
    <p style={{color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-label)"}}>Contrato e custo são valores diferentes. Informe apenas o custo que ainda falta incorrer. Se já estiver na previsão da etapa, escolha Já incluído. Pendências geram avisos e permitem continuar.</p>
    <ForecastDuplicationWarnings warnings={duplicationWarnings}/>
    {aditivos.length === 0 && <p style={{ fontSize:"var(--arcd-type-label)", color:"var(--arcd-text-secondary)" }}>Nenhum aditivo registrado. Mudança de escopo, valor ou prazo pedida pelo cliente entra aqui.</p>}
    {aditivos.map(item => <div key={item.id} style={{ display:"flex", justifyContent:"space-between", gap:"var(--arcd-space-2)", flexWrap:"wrap", borderTop:"1px solid var(--arcd-border-default)", paddingTop:"var(--arcd-space-2)" }}>
      <div style={{ minWidth:0 }}>
        <p style={{ fontSize:"var(--arcd-type-label)", color:"var(--arcd-text-primary)" }}><b>Aditivo {item.numero}</b> · {item.descricao}</p>
        <p style={{ fontSize:"var(--arcd-type-caption)", color:"var(--arcd-text-secondary)" }}>{fmt(item.valor)}{item.prazoDias ? ` · ${item.prazoDias > 0 ? "+" : ""}${item.prazoDias} dia(s)` : ""} · <span style={{ color:COR[item.status] }}>{ROTULO[item.status] || item.status}</span>{item.evidenciaDecisao ? ` · ${item.evidenciaDecisao}` : ""}</p>
        <p style={{color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-caption)"}}>Execução: {({planejada:"Planejada",em_andamento:"Em andamento",concluida:"Concluída"})[item.execucaoStatus]||"Planejada"} · {item.responsavel||"Sem responsável"} · Custo restante: {item.impactoCustoRestante==null?"A estimar":fmt(item.impactoCustoRestante)} · {({adicional:"Adicional na previsão",ja_incluido:"Já incluído na previsão",nao_incluir:"Fora da previsão"})[item.impactoNaPrevisao]||"Fora da previsão"}</p>
        {amendmentWarnings(item).map((w,i)=><p role="status" key={i} style={{color:"var(--arcd-warning-text)",fontSize:"var(--arcd-type-caption)"}}>{w.message}</p>)}
      </div>
      <div style={{ display:"flex", gap:"var(--arcd-space-1)",flexWrap:"wrap" }}>
        {podeRegistrar && item.status!==AMENDMENT_STATUS.PROPOSED&&<Btn v="ghost" size="sm" onClick={()=>setForm({...item,operationalOnly:true})}>Atualizar acompanhamento</Btn>}
        {item.status === AMENDMENT_STATUS.PROPOSED && podeRegistrar && <Btn v="ghost" size="sm" onClick={() => setForm({ ...item, valor:String(item.valor), prazoDias:String(item.prazoDias || "") })}>Editar</Btn>}
        {item.status === AMENDMENT_STATUS.PROPOSED && podeDecidir && <Btn size="sm" onClick={() => setDecisao({ item, decision:AMENDMENT_STATUS.APPROVED, evidencia:"" })}>Registrar decisão</Btn>}
        {item.status !== AMENDMENT_STATUS.CANCELLED && podeCancelar && <Btn v="ghost" size="sm" onClick={() => cancelar(item)}>Cancelar</Btn>}
      </div>
    </div>)}

    <ForecastReviewHistory work={obra}/>

    {form && <Modal title={form.operationalOnly?"Atualizar acompanhamento":form.version ? `Editar aditivo ${form.numero}` : "Nova mudança ou aditivo"} onClose={() => setForm(null)}>
      <div style={{ display:"flex", flexDirection:"column", gap:"var(--arcd-space-2)" }}>
        <Inp disabled={form.operationalOnly} label="O que muda *" value={form.descricao} onChange={v => setForm(f => ({ ...f, descricao:v }))} placeholder="Troca do piso da sala por porcelanato 90×90"/>
        <Inp disabled={form.operationalOnly} label="Impacto no contrato (R$) — negativo para supressão" type="number" value={form.valor} onChange={v => setForm(f => ({ ...f, valor:v }))}/>
        <Inp disabled={form.operationalOnly} label="Prazo (dias) — + acréscimo, − redução" type="number" value={form.prazoDias} onChange={v => setForm(f => ({ ...f, prazoDias:v }))}/>
        <Inp disabled={form.operationalOnly} label="Justificativa" value={form.justificativa} onChange={v => setForm(f => ({ ...f, justificativa:v }))}/>
        {form.operationalOnly&&<Inp label="Evidência da decisão do cliente" value={form.evidenciaDecisao||""} onChange={v=>setForm(f=>({...f,evidenciaDecisao:v}))}/>}
        <Inp label="Responsável pelo acompanhamento" value={form.responsavel||""} onChange={v=>setForm(f=>({...f,responsavel:v}))}/>
        <label>Etapa de custo<SelectControl value={form.etapaId||""} onChange={e=>setForm(f=>({...f,etapaId:e.target.value}))}><option value="">Sem apropriação</option>{form.etapaId&&!stages.some(s=>s.id===form.etapaId)&&<option value={form.etapaId}>Etapa anterior — reconferir</option>}{stages.map(s=><option key={s.id} value={s.id}>{s.nome||s.id}</option>)}</SelectControl></label>
        <label>Situação da execução<SelectControl value={form.execucaoStatus||"planejada"} onChange={e=>setForm(f=>({...f,execucaoStatus:e.target.value}))}><option value="planejada">Planejada</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></SelectControl></label>
        <Inp label="Impacto no custo restante (R$) — negativo para economia" type="number" value={form.impactoCustoRestante??""} onChange={v=>setForm(f=>({...f,impactoCustoRestante:v}))}/>
        <label>Como considerar na previsão<SelectControl value={form.impactoNaPrevisao||"nao_incluir"} onChange={e=>setForm(f=>({...f,impactoNaPrevisao:e.target.value}))}><option value="nao_incluir">Não incluir — apenas acompanhar</option><option value="adicional">Somar como custo restante adicional</option><option value="ja_incluido">Já incluído no restante da etapa</option></SelectControl></label>
        <p role="status">A falta de responsável, etapa ou evidência gera aviso. Uma mudança pode ser acompanhada sem alterar o valor ou prazo contratual.</p>
        <div style={{ display:"flex", gap:"var(--arcd-space-2)" }}><Btn v="ghost" full onClick={() => setForm(null)}>Cancelar</Btn><Btn full disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar mudança"}</Btn></div>
      </div>
    </Modal>}

    {decisao && <Modal title={`Decisão do cliente · aditivo ${decisao.item.numero}`} onClose={() => setDecisao(null)}>
      <div style={{ display:"flex", flexDirection:"column", gap:"var(--arcd-space-2)" }}>
        <label>Decisão do cliente<SelectControl value={decisao.decision} onChange={e=>setDecisao(d=>({...d,decision:e.target.value}))}><option value="aprovado">Cliente aprovou</option><option value="recusado">Cliente recusou</option></SelectControl></label>
        <Inp label="Como o cliente decidiu" value={decisao.evidencia} onChange={v => setDecisao(d => ({ ...d, evidencia:v }))} placeholder="E-mail de 28/10, documento assinado, reunião…"/>
        {!decisao.evidencia.trim()&&<p role="status">Sem evidência: a decisão pode ser registrada; complemente o acompanhamento depois.</p>}
        <Btn full disabled={salvando} onClick={decidir}>{salvando ? "Registrando…" : "Registrar decisão"}</Btn>
      </div>
    </Modal>}
  </section>;
}
