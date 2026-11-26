// @ts-check
import { useCallback, useEffect, useMemo, useState } from "react";
import { adicionarAjusteRanking, listarAjustesRanking, removerAjusteRanking } from "../../api.js";
import { contar } from "../../design-system/copy.js";
import { TaskDisclosure } from "../../design-system/patterns/TaskDisclosure.jsx";
import { getObraAttendanceSummary } from "../../domains/ponto/attendance-engine.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { fmtDateFull, today } from "../../legacy/format.js";
import { C } from "../../legacy/palette.js";
import { Btn, Ic, Inp, Modal, PageHero, TabRow } from "../../legacy/ui.jsx";
import { SectorTasks } from "./SectorTasks.jsx";

/** @typedef {import("./communication-contract").RankingAdjustment} RankingAdjustment */
/** @typedef {import("./communication-contract").CommunicationUser} CommunicationUser */

/** @param {import("./communication-contract").CommunicationProps} props */
export function Comunicacao({ data, currentUser, showToast }) {
  const {isMobile}=useBreakpoint();
  const [aba, setAba] = useState("notificacoes");
  const ehAdmin = currentUser?.role === "admin";

  //  Notificações: checklist de prioridades por engenheiro de campo
  const engenheiros = useMemo(() => (data.usuarios || []).filter(u => u.active !== false && u.role === "engenheiro"), [data.usuarios]);
  const hoje = today();
  /** @type {{obraId: string, hasTeam: boolean, completed: boolean}[]} */
  const resumoAtendimento = useMemo(() => getObraAttendanceSummary(data, hoje), [data, hoje]);

  const checklistPorUsuario = useMemo(() => engenheiros.map(u => {
    const obrasDele = (data.obras || []).filter(o => o.engineerId === u.id && o.status !== "done");
    const pontoOk = obrasDele.every(o => {
      const s = resumoAtendimento.find(x => x.obraId === o.id);
      return !s || !s.hasTeam || s.completed;
    });
    const diarioOk = obrasDele.every(o => (data.rdos || []).some(r => r.obraId === o.id && r.data === hoje));
    const pendenciasAbertas = (data.conferencias || []).filter(c=>c.status!=="cancelada").flatMap(c => (c.pendencias || [])
      .filter(p => !["resolvida","cancelada"].includes(p.status) && p.responsavelAjusteId === u.id));
    return { usuario: u, pontoOk, diarioOk, conferenciasOk: pendenciasAbertas.length === 0, pendenciasAbertas: pendenciasAbertas.length };
  }), [engenheiros, data.obras, data.rdos, data.conferencias, resumoAtendimento, hoje]);

  //  Ranking
  const [ajustes, setAjustes] = useState(/** @type {RankingAdjustment[]} */ ([]));
  const [ajusteModal, setAjusteModal] = useState(/** @type {{usuario: CommunicationUser} | null} */ (null));
  const [pontosForm, setPontosForm] = useState("");
  const [motivoForm, setMotivoForm] = useState("");

  const carregarRanking = useCallback(async () => {
    /** @type {import("./communication-contract").RankingListResult} */
    const r = await listarAjustesRanking();
    if (r.ok) setAjustes(r.ajustes || []);
  }, []);

  useEffect(() => { if (aba === "ranking" || aba === "notificacoes") carregarRanking(); }, [aba, carregarRanking]);

  const ranking = useMemo(() => checklistPorUsuario.map(c => {
    const meusAjustes = ajustes.filter(a => a.userId === c.usuario.id);
    const pontosManual = meusAjustes.reduce((s, a) => s + Number(a.pontos || 0), 0);
    const pontosAutomaticos = (c.pontoOk ? 10 : 0) + (c.diarioOk ? 10 : 0) + (c.conferenciasOk ? 10 : 0);
    return { ...c, pontosManual, pontosAutomaticos, total: pontosAutomaticos + pontosManual };
  }).sort((a, b) => b.total - a.total), [checklistPorUsuario, ajustes]);

  const salvarAjuste = async () => {
    if (!ajusteModal) return;
    const pts = Number(pontosForm);
    if (!pts) { showToast("Informe os pontos.", "error"); return; }
    if (!motivoForm.trim()) { showToast("Justifique o ajuste.", "error"); return; }
    /** @type {import("./communication-contract").RankingWriteResult} */
    const r = await adicionarAjusteRanking(ajusteModal.usuario.id, pts, motivoForm.trim());
    if (!r.ok) { showToast(r.error || "Não foi possível salvar.", "error"); return; }
    setAjusteModal(null); setPontosForm(""); setMotivoForm("");
    carregarRanking();
    showToast("Ajuste registrado.");
  };

  /** @param {string} id */
  const removerAjuste = async (id) => {
    if (!window.confirm("Remover este ajuste?")) return;
    /** @type {import("./communication-contract").RankingWriteResult} */
    const r = await removerAjusteRanking(id);
    if (!r.ok) { showToast(r.error || "Não foi possível remover.", "error"); return; }
    carregarRanking();
  };

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-3)" }}>
      <PageHero
        title="Comunicação"
        description="Prioridades do dia e tarefas da equipe, com acesso aos registros de origem."
      />
      <TabRow equal tabs={[["notificacoes", "Notificações"], ["ranking", "Ranking"]]} active={aba} onChange={setAba}/>

      {aba === "notificacoes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-2)" }}>
          <SectorTasks data={data} user={currentUser}/>
          <TaskDisclosure enabled={isMobile} summary="Prioridades da equipe">
          <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>Prioridades do dia por engenheiro de campo: ponto, diário de obra e conferências.</p>
          {!checklistPorUsuario.length && <p style={{ padding: "var(--arcd-space-5)", textAlign: "center", color: "var(--arcd-text-secondary)", fontSize:"var(--arcd-type-label)" }}>Nenhum engenheiro de campo cadastrado.</p>}
          {checklistPorUsuario.map(c => (
            <div key={c.usuario.id} style={{ background: "var(--arcd-surface-card)", border: `var(--arcd-border-width) solid var(--arcd-border-default)`, borderRadius: "var(--arcd-box-radius)", padding: "var(--arcd-space-3) var(--arcd-space-3)" }}>
              <p style={{ fontSize:"var(--arcd-type-label)", fontWeight:600, color: "var(--arcd-text-primary)" }}>{c.usuario.nome}</p>
              <div style={{ display: "flex", gap: "var(--arcd-space-3)", marginTop: "var(--arcd-space-1)", flexWrap: "wrap" }}>
                {/** @type {const} */ ([["Ponto", c.pontoOk], ["Diário de obra", c.diarioOk], ["Conferências", c.conferenciasOk]]).map(([l, ok]) => (
                  <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: "var(--arcd-space-1)", fontSize:"var(--arcd-type-label)", color: ok ? C.green : C.red, fontWeight:600 }}>
                    <Ic n={ok ? "check" : "alert"} s={12} color={ok ? C.green : C.red} />{l}
                  </span>
                ))}
              </div>
              {!c.conferenciasOk && <p style={{ fontSize:"var(--arcd-type-caption)", color: C.red, marginTop: "var(--arcd-space-1)" }}>{contar(c.pendenciasAbertas,"pendência","pendências")} de conferência em aberto.</p>}
            </div>
          ))}
          </TaskDisclosure>
        </div>
      )}

      {aba === "ranking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-2)" }}>
          <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>10 pontos por item do checklist de hoje (ponto, diário, conferências) + ajustes manuais do administrador.</p>
          {ranking.map((r, idx) => (
            <div key={r.usuario.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--arcd-space-2)", background: "var(--arcd-surface-card)", border: `var(--arcd-border-width) solid ${idx === 0 ? C.yellow : C.border}`, borderRadius: "var(--arcd-box-radius)", padding: "var(--arcd-space-2) var(--arcd-space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--arcd-space-2)", minWidth: 0 }}>
                <span style={{ fontSize: "var(--arcd-type-body)", fontWeight:600, color: idx < 3 ? C.yellowD : "var(--arcd-text-secondary)", width: 20 }}>{idx + 1}º</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize:"var(--arcd-type-label)", fontWeight:600, color: "var(--arcd-text-primary)" }}>{r.usuario.nome}</p>
                  <p style={{ fontSize:"var(--arcd-type-caption)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-half)" }}>{r.pontosAutomaticos} pts checklist{r.pontosManual ? ` · ${r.pontosManual > 0 ? "+" : ""}${r.pontosManual} ajuste` : ""}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--arcd-space-2)", flexShrink: 0 }}>
                <b style={{ fontSize: "var(--arcd-type-card-title)", color: "var(--arcd-text-primary)" }}>{r.total}</b>
                {ehAdmin && <Btn size="sm" v="ghost" onClick={() => setAjusteModal({ usuario: r.usuario })}><Ic n="edit" s={11} /> Ajustar</Btn>}
              </div>
            </div>
          ))}
          {ehAdmin && !!ajustes.length && (
            <div style={{ marginTop: "var(--arcd-space-2)" }}>
              <p style={{ fontSize:"var(--arcd-type-label)", fontWeight:600, color: "var(--arcd-text-secondary)", textTransform: "uppercase", letterSpacing: .6, marginBottom: "var(--arcd-space-1)" }}>Histórico de ajustes</p>
              {ajustes.map(a => {
                const u = (data.usuarios || []).find(x => x.id === a.userId);
                return (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--arcd-space-2)", alignItems: "center", padding: "var(--arcd-space-2) 0", borderTop: `var(--arcd-border-width) solid var(--arcd-border-subtle)` }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize:"var(--arcd-type-label)" }}><b>{u?.nome || "Usuário"}</b> {a.pontos > 0 ? "+" : ""}{a.pontos} pts · {a.motivo}</p>
                      <p style={{ fontSize:"var(--arcd-type-caption)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-half)" }}>{a.criadoPor} · {fmtDateFull(String(a.criadoEm || "").slice(0, 10))}</p>
                    </div>
                    <Btn size="sm" v="ghost" iconOnly title="Remover ajuste" ariaLabel="Remover ajuste" onClick={() => removerAjuste(a.id)}><Ic n="trash" s={11} /></Btn>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {ajusteModal && (
        <Modal title={`Ajustar ranking · ${ajusteModal.usuario.nome}`} onClose={() => setAjusteModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-2)" }}>
            <Inp label="Pontos (use negativo para descontar) *" type="number" value={pontosForm} onChange={setPontosForm} placeholder="Ex.: 10 ou -5" />
            <Inp label="Justificativa *" value={motivoForm} onChange={setMotivoForm} multiline placeholder="Ex.: Entregou o diário atrasado três vezes na semana." />
            <div style={{ display: "flex", gap: "var(--arcd-space-2)" }}>
              <Btn v="ghost" onClick={() => setAjusteModal(null)} full>Cancelar</Btn>
              <Btn onClick={salvarAjuste} full>Salvar ajuste</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
