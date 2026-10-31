import { useCallback, useEffect, useRef, useState } from "react";
import { chamarPontoEletronico } from "../../api";

export function useEquipeObras() {
  const [snapshot, setSnapshot] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const ocupado = useRef(false);
  const ativo = useRef(false);
  const carregar = useCallback(async () => {
    if (ocupado.current || !navigator.onLine) return;
    ocupado.current = true; setCarregando(true);
    try {
      const r = await chamarPontoEletronico("ponto-equipe-obras");
      if (!r.ok) {
        if (ativo.current && [401, 403].includes(r.status)) setSnapshot(null);
        throw new Error(r.error || "Não foi possível atualizar a equipe.");
      }
      // HTTP 200 não garante um snapshot utilizável. Publicar um corpo
      // incompleto aqui faz a view falhar em .find/.length/.map e derruba o app.
      if (!Array.isArray(r.pessoas) || !Array.isArray(r.obras) || !Array.isArray(r.limitacoes)) {
        throw new Error("A consulta da equipe retornou uma resposta inválida. Tente atualizar novamente.");
      }
      if (ativo.current) { setSnapshot(r); setErro(""); }
    } catch (e) { if (ativo.current) setErro(e.message || "Falha de conexão."); }
    finally { ocupado.current = false; if (ativo.current) setCarregando(false); }
  }, []);
  useEffect(() => {
    ativo.current = true; carregar();
    const reconectar = () => { setOnline(navigator.onLine); if (navigator.onLine) carregar(); };
    const visibilidade = () => { if (document.visibilityState === "visible") carregar(); };
    const timer = setInterval(visibilidade, 20000);
    window.addEventListener("online", reconectar); window.addEventListener("offline", reconectar);
    document.addEventListener("visibilitychange", visibilidade);
    return () => { ativo.current = false; clearInterval(timer); window.removeEventListener("online", reconectar); window.removeEventListener("offline", reconectar); document.removeEventListener("visibilitychange", visibilidade); };
  }, [carregar]);
  return { snapshot, erro, carregando, online, carregar };
}
