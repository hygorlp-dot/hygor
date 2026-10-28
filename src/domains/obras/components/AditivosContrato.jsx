// Aditivos do contrato do cliente (Onda 4.1). Registrar e cancelar: quem
// cuida do contrato (admin, engenharia, financeiro); registrar a decisão do
// cliente, enquanto o portal não aprova sozinho (4.3): administrador.
import { useEffect, useState } from "react";
import { consultarDecisoesAditivosPortal } from "../../../api";
import { evidenciaDoPortal } from "../portal-amendment-decisions";
import { Btn, C, Inp, Modal, fmt, fmtDate, uid } from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { AMENDMENT_STATUS, fimContratoVigente, valorContratoVigente } from "../contract-amendments";

const ROTULO = { proposto:"Aguardando cliente", aprovado:"Aprovado", recusado:"Recusado", cancelado:"Cancelado" };
const COR = { proposto:C.orange, aprovado:C.green, recusado:C.red, cancelado:C.muted };

export function AditivosContrato({ obra, currentUser, dispatchCommand, showToast }) {
  const [form, setForm] = useState(null);
  const [decisao, setDecisao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const papel = currentUser?.role;
  const podeRegistrar = ["admin", "engenheiro", "financeiro"].includes(papel);
  const podeDecidir = papel === "admin";
  const podeCancelar = ["admin", "financeiro"].includes(papel);
  const aditivos = Array.isArray(obra?.aditivosContrato) ? obra.aditivosContrato : [];
  // Decisões dadas pelo cliente no portal (4.3), ainda não efetivadas.
  const [doPortal, setDoPortal] = useState({});
  const temProposto = aditivos.some(item => item.status === AMENDMENT_STATUS.PROPOSED);
  useEffect(() => {
    if (!obra?.id || !temProposto || !podeRegistrar) return;
    let vivo = true;
    Promise.resolve(consultarDecisoesAditivosPortal(obra.id)).then(r => { if (vivo && r?.ok !== false) setDoPortal(r?.decisions || {}); }).catch(() => {});
    return () => { vivo = false; };
  }, [obra?.id, temProposto, podeRegistrar]);

  const enviar = async (command, ok) => {
    if (!dispatchCommand) { showToast("Registrar aditivo exige conexão com o servidor.", "error"); return false; }
    setSalvando(true);
    const result = await dispatchCommand({ ...command, idempotencyKey:`aditivo-${uid()}` });
    setSalvando(false);
    if (!result?.ok) { showToast(result?.reason || "O servidor não confirmou o aditivo.", "error"); return false; }
    showToast(ok); return true;
  };

  const salvar = async () => {
    const feito = await enviar({
      type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_SAVED, expectedVersion:form.version || 0,
      payload:{ obraId:obra.id, amendment:{ id:form.id, descricao:form.descricao, justificativa:form.justificativa, valor:Number(form.valor || 0), prazoDias:Number(form.prazoDias || 0) } },
    }, "Aditivo registrado. Ele só entra no contrato depois de aprovado pelo cliente.");
    if (feito) setForm(null);
  };

  const decidir = async () => {
    const feito = await enviar({
      type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_DECIDED,
      payload:{ obraId:obra.id, amendmentId:decisao.item.id, expectedVersion:decisao.item.version, decision:decisao.decision, origem:"interno", evidencia:decisao.evidencia },
    }, decisao.decision === AMENDMENT_STATUS.APPROVED ? "Aditivo aprovado: o contrato vigente foi atualizado." : "Aditivo registrado como recusado.");
    if (feito) setDecisao(null);
  };

  const efetivarDoPortal = async item => {
    const d = doPortal[item.id];
    await enviar({
      type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_DECIDED,
      payload:{ obraId:obra.id, amendmentId:item.id, expectedVersion:item.version, decision:d.decision, origem:"portal", evidencia:evidenciaDoPortal(d) },
    }, d.decision === AMENDMENT_STATUS.APPROVED ? "Aprovação do cliente efetivada: o contrato vigente foi atualizado." : "Recusa do cliente registrada.");
  };

  const cancelar = async item => {
    const motivo = window.prompt("Motivo do cancelamento do aditivo:");
    if (!String(motivo || "").trim()) return;
    await enviar({ type:OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_CANCELLED, payload:{ obraId:obra.id, amendmentId:item.id, expectedVersion:item.version, reason:motivo } }, "Aditivo cancelado.");
  };

  return <section style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }} aria-label="Aditivos do contrato">
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
      <div>
        <p style={{ fontSize:"var(--arcd-type-body)", fontWeight:600, color:C.text }}>Aditivos do contrato</p>
        <p style={{ fontSize:"var(--arcd-type-label)", color:C.muted }}>Contrato vigente {fmt(valorContratoVigente(obra))} (original {fmt(obra?.contractValue || 0)}){fimContratoVigente(obra) ? ` · término ${fmtDate(fimContratoVigente(obra))}` : ""}</p>
      </div>
      {podeRegistrar && <Btn v="ghost" size="sm" onClick={() => setForm({ id:uid(), descricao:"", justificativa:"", valor:"", prazoDias:"" })}>Novo aditivo</Btn>}
    </div>
    {aditivos.length === 0 && <p style={{ fontSize:"var(--arcd-type-label)", color:C.muted }}>Nenhum aditivo registrado. Mudança de escopo, valor ou prazo pedida pelo cliente entra aqui.</p>}
    {aditivos.map(item => <div key={item.id} style={{ display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap", borderTop:`1px solid ${C.line}`, paddingTop:8 }}>
      <div style={{ minWidth:0 }}>
        <p style={{ fontSize:"var(--arcd-type-label)", color:C.text }}><b>Aditivo {item.numero}</b> · {item.descricao}</p>
        {item.status === AMENDMENT_STATUS.PROPOSED && doPortal[item.id] && <p style={{ fontSize:"var(--arcd-type-caption)", fontWeight:600, color:doPortal[item.id].decision === AMENDMENT_STATUS.APPROVED ? C.green : C.red }}>Cliente {doPortal[item.id].decision === AMENDMENT_STATUS.APPROVED ? "aprovou" : "recusou"} pelo portal em {fmtDate(doPortal[item.id].at.slice(0, 10))}{doPortal[item.id].comment ? ` · "${doPortal[item.id].comment}"` : ""}</p>}
        <p style={{ fontSize:"var(--arcd-type-caption)", color:C.muted }}>{fmt(item.valor)}{item.prazoDias ? ` · ${item.prazoDias > 0 ? "+" : ""}${item.prazoDias} dia(s)` : ""} · <span style={{ color:COR[item.status] }}>{ROTULO[item.status] || item.status}</span>{item.evidenciaDecisao ? ` · ${item.evidenciaDecisao}` : ""}</p>
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {item.status === AMENDMENT_STATUS.PROPOSED && podeRegistrar && <Btn v="ghost" size="sm" onClick={() => setForm({ ...item, valor:String(item.valor), prazoDias:String(item.prazoDias || "") })}>Editar</Btn>}
        {item.status === AMENDMENT_STATUS.PROPOSED && podeDecidir && (doPortal[item.id]
          ? <Btn size="sm" disabled={salvando} onClick={() => efetivarDoPortal(item)}>Efetivar decisão do cliente</Btn>
          : <Btn size="sm" onClick={() => setDecisao({ item, decision:AMENDMENT_STATUS.APPROVED, evidencia:"" })}>Registrar decisão</Btn>)}
        {item.status !== AMENDMENT_STATUS.CANCELLED && podeCancelar && <Btn v="ghost" size="sm" onClick={() => cancelar(item)}>Cancelar</Btn>}
      </div>
    </div>)}

    {form && <Modal title={form.version ? `Editar aditivo ${form.numero}` : "Novo aditivo"} onClose={() => setForm(null)}>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <Inp label="O que muda *" value={form.descricao} onChange={v => setForm(f => ({ ...f, descricao:v }))} placeholder="Troca do piso da sala por porcelanato 90×90"/>
        <Inp label="Valor (R$) * — negativo para supressão" type="number" value={form.valor} onChange={v => setForm(f => ({ ...f, valor:v }))}/>
        <Inp label="Prazo (dias) — + acréscimo, − redução" type="number" value={form.prazoDias} onChange={v => setForm(f => ({ ...f, prazoDias:v }))}/>
        <Inp label="Justificativa" value={form.justificativa} onChange={v => setForm(f => ({ ...f, justificativa:v }))}/>
        <div style={{ display:"flex", gap:8 }}><Btn v="ghost" full onClick={() => setForm(null)}>Cancelar</Btn><Btn full disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Registrar aditivo"}</Btn></div>
      </div>
    </Modal>}

    {decisao && <Modal title={`Decisão do cliente · aditivo ${decisao.item.numero}`} onClose={() => setDecisao(null)}>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", gap:8 }}>
          {[AMENDMENT_STATUS.APPROVED, AMENDMENT_STATUS.REJECTED].map(opcao => <Btn key={opcao} v={decisao.decision === opcao ? "primary" : "ghost"} full onClick={() => setDecisao(d => ({ ...d, decision:opcao }))}>{opcao === AMENDMENT_STATUS.APPROVED ? "Cliente aprovou" : "Cliente recusou"}</Btn>)}
        </div>
        <Inp label="Como o cliente decidiu *" value={decisao.evidencia} onChange={v => setDecisao(d => ({ ...d, evidencia:v }))} placeholder="E-mail de 28/10, documento assinado, reunião…"/>
        <Btn full disabled={salvando || !decisao.evidencia.trim()} onClick={decidir}>{salvando ? "Registrando…" : "Registrar decisão"}</Btn>
      </div>
    </Modal>}
  </section>;
}
