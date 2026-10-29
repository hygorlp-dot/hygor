import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useEquipeObras } from "../useEquipeObras";
import { SITUACOES_EQUIPE } from "../equipe-obras";
import { Avatar } from "./EquipeObrasView";
import "./equipe-obras-tv.css";

// Obra do último registro não significa presença confirmada (APK sem tipo).
function paginasDaEquipe(snapshot, porPagina) {
  if (!snapshot) return [];
  const grupos = new Map(snapshot.obras.map(o => [o.id, { id: o.id, nome: o.name, pessoas: [] }]));
  const fora = { id: "fora", nome: "Sem registro de obra / ausências", pessoas: [] };
  for (const pessoa of snapshot.pessoas) {
    const obra = pessoa.obraId || pessoa.eventos.at(-1)?.obraId;
    (grupos.get(obra) || fora).pessoas.push(pessoa);
  }
  return [...grupos.values(), ...(fora.pessoas.length ? [fora] : [])].flatMap(grupo => {
    const total = Math.max(1, Math.ceil(grupo.pessoas.length / porPagina));
    return Array.from({ length: total }, (_, i) => ({ ...grupo, pagina: i + 1, total, pessoas: grupo.pessoas.slice(i * porPagina, i * porPagina + porPagina) }));
  });
}

export default function EquipeObrasTV() {
  const { snapshot, erro, online, carregando, carregar } = useEquipeObras();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const capacidade = () => window.innerWidth >= 1100 && window.innerHeight < 850 ? 3 : 6;
  const [porPagina, setPorPagina] = useState(capacidade);
  useEffect(() => {
    const ajustar = () => setPorPagina(capacidade());
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);
  const paginas = useMemo(() => paginasDaEquipe(snapshot, porPagina), [snapshot, porPagina]);
  const quantidade = paginas.length;
  const atual = paginas[indice % (quantidade || 1)];
  useEffect(() => {
    if (pausado || quantidade < 2) return;
    const timer = setInterval(() => setIndice(i => (i + 1) % quantidade), 12000);
    return () => clearInterval(timer);
  }, [pausado, quantidade]);
  const mover = passo => setIndice(i => (i + passo + quantidade) % quantidade);
  const hora = valor => new Date(valor).toLocaleTimeString("pt-BR", { timeZone: snapshot.fuso, hour: "2-digit", minute: "2-digit" });
  return <section className="equipe-tv" aria-label="Equipe nas Obras no Modo TV">
    <div className="equipe-tv__resumo">
      <span><strong>{snapshot?.pessoas.length ?? "—"}</strong> funcionários</span>
      <span><strong>{snapshot?.pessoas.filter(p => p.situacao === "atividade").length ?? "—"}</strong> em atividade</span>
      <span><strong>{snapshot?.pessoas.filter(p => p.situacao === "conferir").length ?? "—"}</strong> para conferir</span>
      <span><strong>{snapshot?.pessoas.filter(p => p.situacao === "falta").length ?? "—"}</strong> faltas confirmadas</span>
    </div>
    <p className="equipe-tv__aviso" role="status">{!online ? "Sem conexão — exibindo a última consulta." : erro ? "Falha na atualização. " + erro : snapshot ? `Atualizado às ${hora(snapshot.servidorMs)} · Consulta a cada 20 segundos` : "Carregando equipe…"}</p>
    <p className="equipe-tv__nota">Obra do último registro recebido. Batidas sem tipo exigem conferência e não confirmam presença.</p>
    {atual ? <section className="equipe-tv__obra" aria-label="Página da equipe">
      <header><h2>{atual.nome}</h2><span>{atual.pagina}/{atual.total} · {atual.pessoas.length} nesta página</span></header>
      <div className="equipe-tv__grade">{atual.pessoas.map(p => <article key={p.id} className="equipe-tv__pessoa">
        <Avatar pessoa={p} /><div><h3>{p.nome}</h3><p>{p.funcao || "Função não informada"}</p><p className="equipe-tv__situacao">{SITUACOES_EQUIPE[p.situacao]}</p>{p.horario && <p>Última batida: <time dateTime={p.horario}>{hora(p.horario)}</time></p>}</div>
      </article>)}</div>
      {!atual.pessoas.length && <p>Nenhum funcionário com registro associado a esta obra.</p>}
    </section> : snapshot && <p>Nenhuma equipe disponível para seu acesso.</p>}
    <footer className="equipe-tv__controles">
      <span>{quantidade ? `${indice % quantidade + 1} de ${quantidade} páginas` : "Sem páginas"} · {pausado ? "Troca de páginas pausada" : "Troca automática a cada 12 segundos"}</span>
      <div><Button variant="outline" onClick={() => mover(-1)} disabled={quantidade < 2} aria-label="Página anterior da equipe"><ChevronLeft size={20} /></Button>
        <Button variant="outline" onClick={() => setPausado(p => !p)} aria-pressed={pausado}>{pausado ? <Play size={18} /> : <Pause size={18} />}{pausado ? "Retomar páginas" : "Pausar páginas"}</Button>
        <Button variant="outline" onClick={() => mover(1)} disabled={quantidade < 2} aria-label="Próxima página da equipe"><ChevronRight size={20} /></Button>
        <Button variant="outline" onClick={carregar} disabled={!online || carregando}><RefreshCw size={18} /> Atualizar equipe</Button></div>
    </footer>
  </section>;
}
