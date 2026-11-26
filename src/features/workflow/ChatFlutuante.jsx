// @ts-check
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  apagarMensagemChat, dessilenciarUsuarioChat, enviarMensagemChat, listarMensagensChat,
  silenciarUsuarioChat, subirAnexoChat,
} from "../../api.js";
import { CompanyAssetImage, CompanyAssetLink } from "../../components/CompanyAsset.jsx";
import { contar } from "../../design-system/copy.js";
import { Button as DesignSystemButton } from "../../design-system/primitives/Button.jsx";
import { resolveMentionsInText, splitMentionText } from "../../domains/chat/mentions.js";
import { playChatMentionSound, playChatMessageSound } from "../../domains/chat/notification-sounds.js";
import { criarPollingAdaptativo } from "../../domains/sync/polling.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { arquivoComoDataUrl, comprimirImagem } from "../../legacy/files.js";
import { Btn, Ic } from "../../legacy/ui.jsx";

/** @typedef {import("../../domains/chat/contracts").ChatAttachment} ChatAttachment */
/** @typedef {import("../../domains/chat/contracts").ChatMessage} ChatMessage */
/** @typedef {import("../../domains/chat/contracts").ChatParticipant} ChatParticipant */
/** @typedef {import("../../domains/chat/contracts").ChatMute} ChatMute */

// O lançador usa o espaço do cabeçalho quando disponível. O chat acompanha toda a área autenticada.
const WA = {
  header: "#075E54",
  bubbleMine: "#DCF8C6",
  bubbleTheirs: "#FFFFFF",
  bg: "#ECE5DD",
  green: "#25D366",
  mentionBg: "rgba(7,94,84,.14)",
};

function IconeChat({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.02 2 11c0 2.4 1.05 4.58 2.77 6.2L4 22l5.1-1.53C10.03 20.8 11 21 12 21c5.52 0 10-4.02 10-9s-4.48-10-10-10z" fill="currentColor"/>
    </svg>
  );
}

/** @param {import("../../domains/chat/contracts").FloatingChatProps} props */
export function ChatFlutuante({ currentUser, usuarios, showToast, bottomOffset=20 }) {
  const {isMobile}=useBreakpoint();
  // O botão mora no topo, ao lado de Ajuda. Sem o topo (ex.: Modo TV), volta a flutuar.
  const [launcherTarget,setLauncherTarget]=useState(/** @type {Element | null} */ (null));
  useLayoutEffect(()=>setLauncherTarget(document.querySelector('[data-chat-launcher-slot]')),[isMobile]);
  const [aberto, setAberto] = useState(false);
  const [gestaoAberta, setGestaoAberta] = useState(false);
  const [mensagens, setMensagens] = useState(/** @type {ChatMessage[]} */ ([]));
  const [mutados, setMutados] = useState(/** @type {ChatMute[]} */ ([]));
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [temMencaoNaoLida, setTemMencaoNaoLida] = useState(false);
  const [mencaoParaAbrirId, setMencaoParaAbrirId] = useState(/** @type {string | null} */ (null));
  const [mencaoDestacadaId, setMencaoDestacadaId] = useState(/** @type {string | null} */ (null));
  const [mencaoQuery, setMencaoQuery] = useState(/** @type {string | null} */ (null));
  const [anexoPendente, setAnexoPendente] = useState(/** @type {ChatAttachment | null} */ (null));
  const [subindoAnexo, setSubindoAnexo] = useState(false);
  const scrollRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const ultimoIdRef = useRef(/** @type {string | null} */ (null));
  const primeiraCargaRef = useRef(true);
  const abertoRef = useRef(false);
  useEffect(() => { abertoRef.current = aberto; }, [aberto]);

  const ehAdmin = currentUser?.role === "admin";
  const usuariosMencionaveis = (usuarios || []).filter(u => u.active !== false && u.id !== currentUser?.id);

  /** @param {string} t */
  const mencoesNoTexto = t => resolveMentionsInText(t, usuariosMencionaveis);

  const carregarChat = useCallback(async () => {
    /** @type {import("../../domains/chat/contracts").ChatListResult} */
    const r = await listarMensagensChat();
    if (!r.ok) return;
    const lista = r.mensagens || [];
    setMensagens(lista);
    setMutados(r.mutados || []);

    const ultima = lista[lista.length - 1];
    if (ultima && ultima.id !== ultimoIdRef.current) {
      const novas = ultimoIdRef.current
        ? lista.slice(lista.findIndex(m => m.id === ultimoIdRef.current) + 1)
        : [];
      const novasDeOutros = novas.filter(m => m.userId !== currentUser?.id && !m.deletedAt);
      if (novasDeOutros.length && !primeiraCargaRef.current) {
        const mencaoRecebida = novasDeOutros.find(m => (m.mentions || []).some(mm => mm.id === currentUser?.id));
        if (mencaoRecebida) {
          playChatMentionSound();
          showToast?.(`${mencaoRecebida.userName} mencionou você no chat.`, "info");
          if (!abertoRef.current) { setNaoLidas(n => n + novasDeOutros.length); setTemMencaoNaoLida(true); }
          setMencaoParaAbrirId(mencaoRecebida.id);
        } else {
          playChatMessageSound();
          if (!abertoRef.current) setNaoLidas(n => n + novasDeOutros.length);
        }
      }
      ultimoIdRef.current = ultima.id;
    }
    primeiraCargaRef.current = false;
  }, [currentUser?.id, showToast]);

  // 8 s com a aba visível; oculta, 60 s (ver domains/sync/polling.js).
  useEffect(() => {
    if (!currentUser) return undefined;
    const polling = criarPollingAdaptativo({ tarefa: carregarChat, visivelMs: 8000, ocultoMs: 60000 });
    polling.iniciar();
    return polling.parar;
  }, [carregarChat, currentUser]);

  useEffect(() => {
    if (aberto && scrollRef.current && !mencaoParaAbrirId) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens, aberto, mencaoParaAbrirId]);

  // Ao abrir o painel com uma menção pendente, pula direto para ela em vez de
  // rolar para o fim - é o motivo de o usuário ter clicado no sino.
  useEffect(() => {
    if (!aberto || !mencaoParaAbrirId) return;
    const el = scrollRef.current?.querySelector(`[data-msg-id="${mencaoParaAbrirId}"]`);
    el?.scrollIntoView({ block: "center" });
    setMencaoDestacadaId(mencaoParaAbrirId);
    setMencaoParaAbrirId(null);
    const t = setTimeout(() => setMencaoDestacadaId(null), 2400);
    return () => clearTimeout(t);
  }, [aberto, mencaoParaAbrirId, mensagens]);

  const abrirPainel = () => { setAberto(true); setNaoLidas(0); setTemMencaoNaoLida(false); };

  const euEstouMutado = mutados.some(m => m.userId === currentUser?.id);

  /** @param {string} valor */
  const aoDigitar = valor => {
    setTexto(valor);
    const m = /@([^\s@]*)$/.exec(valor);
    setMencaoQuery(m ? m[1] : null);
  };

  /** @param {ChatParticipant} u */
  const escolherMencao = u => {
    setTexto(t => t.replace(/@([^\s@]*)$/, `@${u.nome} `));
    setMencaoQuery(null);
    inputRef.current?.focus();
  };

  const sugestoesMencao = mencaoQuery === null ? [] : usuariosMencionaveis
    .filter(u => String(u.nome || "").toLowerCase().includes(mencaoQuery.toLowerCase()))
    .slice(0, 6);

  /** @param {import("react").ChangeEvent<HTMLInputElement>} e */
  const escolherArquivo = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubindoAnexo(true);
    try {
      const ehImagem = String(file.type || "").startsWith("image/");
      if (!ehImagem && file.size > 4 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 4MB).");
      const dataUrl = ehImagem ? await comprimirImagem(file) : await arquivoComoDataUrl(file);
      const ext = (file.name.split(".").pop() || "").slice(0, 8);
      /** @type {import("../../domains/chat/contracts").ChatUploadResult} */
      const r = await subirAnexoChat({ dataUrl, ext });
      if (!r.ok || !r.url) throw new Error(r.error || "Falha ao enviar o arquivo.");
      setAnexoPendente({ url: r.url, name: file.name, type: file.type || "", size: file.size || 0 });
    } catch (err) {
      showToast?.(/** @type {Error} */ (err).message || "Falha ao enviar o arquivo.", "error");
    } finally {
      setSubindoAnexo(false);
    }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t && !anexoPendente) return;
    setEnviando(true);
    /** @type {import("../../domains/chat/contracts").ChatWriteResult} */
    const r = await enviarMensagemChat(t, { mentions: mencoesNoTexto(t), attachment: anexoPendente });
    setEnviando(false);
    if (!r.ok) { showToast?.(r.error || "Não foi possível enviar a mensagem.", "error"); return; }
    setTexto(""); setAnexoPendente(null); setMencaoQuery(null);
    carregarChat();
  };

  /** @param {string} id */
  const apagar = async (id) => {
    if (!window.confirm("Apagar esta mensagem para todos?")) return;
    /** @type {import("../../domains/chat/contracts").ChatWriteResult} */
    const r = await apagarMensagemChat(id);
    if (!r.ok) { showToast?.(r.error || "Não foi possível apagar.", "error"); return; }
    carregarChat();
  };

  /** @param {string} userId @param {boolean} mutadoAgora */
  const alternarMudo = async (userId, mutadoAgora) => {
    /** @type {import("../../domains/chat/contracts").ChatWriteResult} */
    const r = mutadoAgora ? await dessilenciarUsuarioChat(userId) : await silenciarUsuarioChat(userId);
    if (!r.ok) { showToast?.(r.error || "Não foi possível atualizar.", "error"); return; }
    carregarChat();
  };

  if (!currentUser) return null;
  const launcher=(
      <DesignSystemButton variant="secondary" size="icon" onClick={() => (aberto ? setAberto(false) : abrirPainel())} title="Comunicação da equipe" aria-label={aberto?"Fechar chat da equipe":"Abrir chat da equipe"} aria-expanded={aberto}
        className={["arcd-chat-launcher",launcherTarget?"":"arcd-chat-launcher--floating",temMencaoNaoLida?"chat-mention-pulse":""].filter(Boolean).join(" ")}>
        <IconeChat size={20} />
        {naoLidas > 0 && <span className="arcd-chat-launcher__count">{naoLidas > 99 ? "99+" : naoLidas}</span>}
      </DesignSystemButton>
  );

  return (
    <div className="no-print arcd-team-chat" style={/** @type {import("react").CSSProperties & {"--chat-bottom": string}} */ ({ "--chat-bottom":typeof bottomOffset==="number"?`${bottomOffset}px`:bottomOffset,position: "fixed", right: 20, bottom: bottomOffset, zIndex: 1300, display: "flex", flexDirection: "column", alignItems: "flex-end", fontFamily: "var(--arcd-font-sans)" })}>
      {aberto && (
        <div style={{
          width: "min(360px, calc(100vw - 32px))", height: "min(520px, calc(100dvh - var(--chat-bottom) - 88px))",
          background: WA.bg, borderRadius: "var(--arcd-box-radius)", overflow: "hidden", marginBottom: "var(--arcd-space-3)",
          boxShadow: "var(--arcd-shadow-hairline)", display: "flex", flexDirection: "column",
          border: "var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-border-strong) 8%, transparent)",
        }}>
          {/* Cabeçalho estilo WhatsApp */}
          <div style={{ background: WA.header, color: "var(--arcd-text-inverse)", padding: "var(--arcd-space-3) var(--arcd-space-3)", display: "flex", alignItems: "center", gap: "var(--arcd-space-2)", flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: "var(--arcd-radius-pill)", background: "color-mix(in srgb, var(--arcd-surface-elevated) 18%, transparent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <IconeChat size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Comunicação da equipe</p>
              <p style={{ fontSize:"var(--arcd-type-label)", opacity: .8 }}>{contar((usuarios || []).filter(u => u.active !== false).length,"participante","participantes")}</p>
            </div>
            {ehAdmin && (
              <button onClick={() => setGestaoAberta(v => !v)} title="Gerenciar grupo" aria-label="Gerenciar grupo"
                style={{ background: "transparent", border: 0, color: "var(--arcd-text-inverse)", opacity: .85, cursor: "pointer", padding: "var(--arcd-space-1)" }}>
                <Ic n="settings" s={16} />
              </button>
            )}
            <button onClick={() => setAberto(false)} title="Minimizar" aria-label="Minimizar"
              style={{ background: "transparent", border: 0, color: "var(--arcd-text-inverse)", cursor: "pointer", padding: "var(--arcd-space-1)" }}>
              <Ic n="chevron" s={16} />
            </button>
          </div>

          {gestaoAberta ? (
            <div style={{ flex: 1, overflowY: "auto", background: "var(--arcd-surface-elevated)", padding: "var(--arcd-space-3)" }}>
              <button onClick={() => setGestaoAberta(false)} style={{ background: "transparent", border: 0, color: WA.header, fontSize:"var(--arcd-type-control)", fontWeight:600, cursor: "pointer", marginBottom: "var(--arcd-space-2)" }}>← Voltar para a conversa</button>
              <p style={{ fontSize:"var(--arcd-type-label)", fontWeight:600, color: "var(--arcd-text-secondary)", textTransform: "uppercase", letterSpacing: .6, marginBottom: "var(--arcd-space-2)" }}>Silenciar participantes</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-1)" }}>
                {(usuarios || []).filter(u => u.active !== false && u.id !== currentUser?.id).map(u => {
                  const mutado = mutados.some(m => m.userId === u.id);
                  return (
                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--arcd-space-2)", padding: "var(--arcd-space-2) 0", borderTop: "var(--arcd-border-width) solid var(--arcd-border-default)" }}>
                      <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-primary)" }}>{u.nome}</span>
                      <Btn size="sm" v={mutado ? "danger" : "ghost"} onClick={() => alternarMudo(u.id, mutado)}>{mutado ? "Dessilenciar" : "Silenciar"}</Btn>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--arcd-space-1)", padding: "var(--arcd-space-2) var(--arcd-space-2)" }}>
                {!mensagens.length && <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", textAlign: "center", marginTop: "var(--arcd-space-5)" }}>Nenhuma mensagem ainda. Comece a conversa.</p>}
                {mensagens.map(m => {
                  const minha = m.userId === currentUser?.id;
                  const apagada = !!m.deletedAt;
                  const destacada = mencaoDestacadaId === m.id;
                  return (
                    <div key={m.id} data-msg-id={m.id} style={{ alignSelf: minha ? "flex-end" : "flex-start", maxWidth: "82%", display: "flex", alignItems: "flex-end", gap: "var(--arcd-space-1)" }}>
                      <div className={destacada ? "chat-msg-flash" : ""} style={{
                        padding: "var(--arcd-space-1) var(--arcd-space-2)", borderRadius: "var(--arcd-box-radius)", background: apagada ? "var(--arcd-surface-subtle)" : (minha ? WA.bubbleMine : WA.bubbleTheirs),
                        boxShadow: "var(--arcd-shadow-hairline)",
                      }}>
                        {!minha && !apagada && <p style={{ fontSize:"var(--arcd-type-caption)", fontWeight:600, color: "var(--arcd-info-text)", marginBottom: 1 }}>{m.userName}</p>}
                        {!apagada && m.attachment && (
                          m.attachment.type?.startsWith("image/") ? (
                            <CompanyAssetLink href={m.attachment.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: m.text ? "var(--arcd-space-1)" : "var(--arcd-space-half)" }}>
                              <CompanyAssetImage src={m.attachment.url} alt={m.attachment.name} style={{ maxWidth: "100%", maxHeight: 180, borderRadius: "var(--arcd-radius-control)", display: "block" }} />
                            </CompanyAssetLink>
                          ) : (
                            <CompanyAssetLink href={m.attachment.url} target="_blank" rel="noopener noreferrer" style={{
                              display: "flex", alignItems: "center", gap: "var(--arcd-space-1)", padding: "var(--arcd-space-1) var(--arcd-space-2)", borderRadius: "var(--arcd-radius-control)",
                              background: "color-mix(in srgb, var(--arcd-surface-inverse) 5%, transparent)", marginBottom: m.text ? "var(--arcd-space-1)" : "var(--arcd-space-half)", textDecoration: "none",
                            }}>
                              <Ic n="file" s={16} color="#666" />
                              <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-primary)", fontWeight:600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m.attachment.name}</span>
                              <Ic n="download" s={13} color="#888" />
                            </CompanyAssetLink>
                          )
                        )}
                        {(m.text || apagada) && <p style={{ fontSize: "var(--arcd-type-body)", color: apagada ? "var(--arcd-text-secondary)" : "var(--arcd-text-primary)", fontStyle: apagada ? "italic" : "normal", lineHeight: 1.35, wordBreak: "break-word" }}>
                          {apagada ? "Mensagem apagada pelo administrador" : splitMentionText(m.text, m.mentions).map((part, index) => part.mentioned
                            ? <b key={index} style={{ color: WA.header, background: WA.mentionBg, borderRadius:"var(--arcd-radius-control)", padding:"0 var(--arcd-space-half)" }}>{part.text}</b>
                            : <span key={index}>{part.text}</span>)}
                        </p>}
                        <p style={{ fontSize:"var(--arcd-type-caption)", color: "var(--arcd-text-secondary)", textAlign: "right", marginTop: "var(--arcd-space-half)" }}>
                          {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {ehAdmin && !apagada && (
                        <button onClick={() => apagar(m.id)} title="Apagar mensagem" aria-label="Apagar mensagem"
                          style={{ background: "transparent", border: 0, color: "var(--arcd-danger-text)", cursor: "pointer", padding: "var(--arcd-space-half)", flexShrink: 0 }}>
                          <Ic n="trash" s={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "var(--arcd-space-2)", background: "var(--arcd-surface-subtle)", flexShrink: 0, position: "relative" }}>
                {sugestoesMencao.length > 0 && (
                  <div style={{
                    position: "absolute", left: 8, right: 8, bottom: "100%", marginBottom: "var(--arcd-space-1)", background: "var(--arcd-surface-elevated)",
                    borderRadius: "var(--arcd-box-radius)", boxShadow: "var(--arcd-shadow-hairline)", border: "var(--arcd-border-width) solid var(--arcd-border-default)", overflow: "hidden", zIndex: 2,
                  }}>
                    {sugestoesMencao.map(u => (
                      <button key={u.id} onClick={() => escolherMencao(u)} style={{
                        display: "flex", alignItems: "center", gap: "var(--arcd-space-2)", width: "100%", padding: "var(--arcd-space-2) var(--arcd-space-2)",
                        border: 0, background: "transparent", cursor: "pointer", textAlign: "left",
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: "var(--arcd-radius-pill)", background: WA.header, color: "var(--arcd-text-inverse)",
                          fontSize:"var(--arcd-type-label)", fontWeight:600, display: "grid", placeItems: "center", flexShrink: 0,
                        }}>{(u.nome || "?").slice(0, 1).toUpperCase()}</span>
                        <span style={{ fontSize: "var(--arcd-type-body)", color: "var(--arcd-text-primary)", fontWeight:600 }}>{u.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
                {anexoPendente && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--arcd-space-2)", marginBottom: "var(--arcd-space-2)", padding: "var(--arcd-space-1) var(--arcd-space-2)", background: "var(--arcd-surface-elevated)", borderRadius: "var(--arcd-box-radius)", border: "var(--arcd-border-width) solid var(--arcd-border-default)" }}>
                    {anexoPendente.type?.startsWith("image/")
                      ? <img src={anexoPendente.url} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: "var(--arcd-radius-control)" }} />
                      : <Ic n="file" s={16} color="#666" />}
                    <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-primary)", fontWeight:600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{anexoPendente.name}</span>
                    <button onClick={() => setAnexoPendente(null)} title="Remover anexo" aria-label="Remover anexo"
                      style={{ background: "transparent", border: 0, color: "var(--arcd-text-secondary)", cursor: "pointer", padding: "var(--arcd-space-half)" }}>
                      <Ic n="x" s={13} />
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", gap: "var(--arcd-space-2)" }}>
                  <input ref={fileInputRef} type="file" onChange={escolherArquivo} style={{ display: "none" }}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={euEstouMutado || subindoAnexo}
                    title="Anexar arquivo" aria-label="Anexar arquivo" style={{
                      width: 36, height: 36, borderRadius: "var(--arcd-radius-pill)", border: 0, flexShrink: 0, background: "var(--arcd-surface-elevated)", color: "var(--arcd-text-secondary)",
                      display: "grid", placeItems: "center", cursor: euEstouMutado ? "default" : "pointer", opacity: subindoAnexo ? .6 : 1,
                    }}>
                    {subindoAnexo
                      ? <div style={{ width: 14, height: 14, border: "2px solid var(--arcd-border-default)", borderTopColor: WA.header, borderRadius: "var(--arcd-radius-pill)", animation: "spin 1s linear infinite" }} />
                      : <Ic n="attach" s={16} />}
                  </button>
                  <input ref={inputRef} value={texto} onChange={e => aoDigitar(e.target.value)} disabled={euEstouMutado || enviando}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                      if (e.key === "Escape") setMencaoQuery(null);
                    }}
                    placeholder={euEstouMutado ? "Você foi silenciado" : "Mensagem · use @ para marcar alguém"}
                    style={{ flex: 1, height: 36, border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-box-radius)", background: "var(--arcd-surface-elevated)", color: "var(--arcd-text-primary)", padding: "0 var(--arcd-space-3)", fontSize: "var(--arcd-type-control)", outline: "none" }} />
                  <button onClick={enviar} disabled={euEstouMutado || enviando || (!texto.trim() && !anexoPendente)} title="Enviar" aria-label="Enviar"
                    style={{
                      width: 36, height: 36, borderRadius: "var(--arcd-radius-pill)", border: 0, flexShrink: 0,
                      background: (euEstouMutado || (!texto.trim() && !anexoPendente)) ? "var(--arcd-success-surface)" : WA.green, color: "var(--arcd-text-inverse)",
                      display: "grid", placeItems: "center", cursor: (euEstouMutado || (!texto.trim() && !anexoPendente)) ? "default" : "pointer",
                    }}>
                    <Ic n="chevR" s={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {launcherTarget?createPortal(launcher,launcherTarget):launcher}
    </div>
  );
}
