import { useEffect, useRef, useState } from "react";
import { Pause } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { ENGINEERING_COMMAND } from "./commands.js";
import { activeProjectSession, formatDuration, sessionSeconds } from "./model.js";
import "./projetos.css";

export default function ProjectTimerStatus({ projects, currentUser, dispatchCommand, onOpen }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const retryKey = useRef(null);
  const active = activeProjectSession(projects, currentUser.id);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!active) return null;
  async function pause() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    if (retryKey.current?.sessionId !== active.session.id) retryKey.current = { sessionId: active.session.id, key: crypto.randomUUID() };
    try {
      const result = await dispatchCommand({ type: ENGINEERING_COMMAND.ENG_TIMER_STOPPED, idempotencyKey: retryKey.current.key, payload: { projectId: active.project.id, sessionId: active.session.id }, actorId: currentUser.id, actorName: currentUser.nome });
      if (!result?.ok) setError(result?.reason || "Não foi possível pausar. Abra Projetos e atualize os dados.");
    } catch { setError("Não foi possível pausar. Verifique a conexão e tente novamente."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <aside className="engineering-workspace" aria-label="Cronômetro ativo" style={{ marginBottom: 20 }}><div className="engineering-active"><div><strong>{active.project.name}</strong><p>Seu cronômetro continua ativo · <span className="engineering-duration">{formatDuration(sessionSeconds(active.session, now))}</span></p></div><div className="engineering-actions"><Button variant="outline" onClick={onOpen}>Abrir projetos</Button><Button disabled={busy} onClick={pause}><Pause size={16} data-icon="inline-start" />{busy ? "Pausando…" : "Pausar cronômetro"}</Button></div></div>{error && <p role="alert">{error}</p>}</aside>;
}
