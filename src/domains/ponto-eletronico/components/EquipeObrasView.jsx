import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, RefreshCw, Wifi, WifiOff, UserRound, Clock, AlertCircle } from "lucide-react";
import { chamarPontoEletronico } from "../../../api";
import { Card } from "../../../components/ui/card";
import { Button, Input, Select, Dialog } from "../../../design-system/primitives";
import { PageHeader, SummaryCard } from "../../../design-system/patterns";
import { filtrarEquipeObras, SITUACOES_EQUIPE } from "../equipe-obras";
import { TIPOS_EVENTO_JORNADA } from "../evento";
import "./equipe-obras.css";

const GRUPOS = ["falta", "sem_registro", "conferir", "sem_obra", "aguardando", "encerrada"];
const TITULOS = { falta: "Faltas confirmadas", sem_registro: "Sem registro / verificar ausência", conferir: "Registros pendentes de conferência", sem_obra: SITUACOES_EQUIPE.sem_obra, aguardando: SITUACOES_EQUIPE.aguardando, encerrada: SITUACOES_EQUIPE.encerrada };
const hora = (iso, fuso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" }) : "";

function Avatar({ pessoa }) {
  const [falhou, setFalhou] = useState(false);
  const nomes = pessoa.nome.trim().split(/\s+/);
  const iniciais = `${nomes[0]?.[0] || ""}${nomes.length > 1 ? nomes.at(-1)[0] : ""}`.toUpperCase();
  useEffect(() => setFalhou(false), [pessoa.fotoUrl]);
  return pessoa.fotoUrl && !falhou ? <img className="equipe-obras__avatar" src={pessoa.fotoUrl} alt="" loading="lazy" onError={() => setFalhou(true)} />
    : <span className="equipe-obras__avatar" aria-hidden="true">{iniciais}</span>;
}
function Pessoa({ pessoa, fuso, onOpen }) {
  return <button type="button" className="equipe-obras__pessoa" onClick={() => onOpen(pessoa.id)} aria-label={`Ver jornada de ${pessoa.nome}: ${SITUACOES_EQUIPE[pessoa.situacao]}`}>
    <Avatar pessoa={pessoa} /><strong>{pessoa.nome}</strong><span>{pessoa.funcao || "Função não informada"}</span>
    <span key={`${pessoa.situacao}:${pessoa.horario}`} className="equipe-obras__status" data-status={pessoa.situacao}>{SITUACOES_EQUIPE[pessoa.situacao]}</span>
    {pessoa.horario && <time dateTime={pessoa.horario}>{hora(pessoa.horario, fuso)}</time>}
    {pessoa.pendencias.length > 0 && <span><AlertCircle size={14} aria-hidden="true" /> Conferência pendente</span>}
  </button>;
}

export default function EquipeObrasView({ onTab, allowedTabs = [] }) {
  const [snapshot, setSnapshot] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [busca, setBusca] = useState("");
  const [obraId, setObraId] = useState("");
  const [situacao, setSituacao] = useState("");
  const [selecionado, setSelecionado] = useState(null);
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
  const filtrado = useMemo(() => filtrarEquipeObras(snapshot?.pessoas || [], snapshot?.obras || [], { busca, obraId, situacao }), [snapshot, busca, obraId, situacao]);
  const porObra = useMemo(() => {
    const mapa = new Map();
    for (const p of filtrado.pessoas) if (p.obraId) { if (!mapa.has(p.obraId)) mapa.set(p.obraId, []); mapa.get(p.obraId).push(p); }
    return mapa;
  }, [filtrado]);
  const detalhe = snapshot?.pessoas.find(p => p.id === selecionado);
  const detalheAberto = !!detalhe;
  useEffect(() => {
    if (!detalheAberto) return;
    const dialog = document.querySelector(".equipe-obras__dialog");
    const conterFoco = e => {
      if (e.key !== "Tab") return;
      const alvos = [...(dialog?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])];
      const primeiro = alvos[0], ultimo = alvos.at(-1);
      if (!primeiro) { e.preventDefault(); dialog?.focus(); }
      else if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === dialog)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    dialog?.addEventListener("keydown", conterFoco);
    return () => dialog?.removeEventListener("keydown", conterFoco);
  }, [detalheAberto]);
  const nomeObra = id => snapshot?.obras.find(o => o.id === id)?.name || "Não identificada";
  const contar = status => filtrado.pessoas.filter(p => p.situacao === status).length;
  const abrir = id => setSelecionado(id);
  const mudarDetalhe = useCallback(aberto => { if (!aberto) setSelecionado(null); }, []);
  const data = snapshot ? new Date(`${snapshot.dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: snapshot.fuso, weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "Carregando data do servidor";
  return <div className="equipe-obras">
    <PageHeader title="Equipe nas Obras" description={data} primaryAction={<Button variant="secondary" onClick={carregar} loading={carregando} disabled={!online}><RefreshCw size={16} /> Atualizar</Button>} />
    <div className="equipe-obras__conexao" role="status">{online && !erro ? <Wifi size={16} /> : <WifiOff size={16} />}<span>{!online ? "Sem conexão — os dados podem estar desatualizados" : erro ? "Falha na atualização — mantendo a última consulta" : "Consulta automática a cada 20 segundos"}{snapshot && ` · Atualizado às ${hora(snapshot.servidorMs, snapshot.fuso)}`}</span></div>
    <p className="equipe-obras__nota">Posição baseada na obra dos registros de ponto recebidos. Batidas offline aparecem após a sincronização.</p>
    {erro && <div role="alert" className="equipe-obras__erro">{erro} <Button variant="ghost" onClick={carregar} disabled={!online}>Tentar novamente</Button></div>}
    <div className="equipe-obras__filtros">
      <Input label="Buscar funcionário ou obra" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do funcionário ou da obra" type="search" />
      <Select label="Obra" value={obraId} onChange={e => setObraId(e.target.value)} options={[{ value: "", label: "Todas as obras" }, ...(snapshot?.obras || []).map(o => ({ value: o.id, label: o.name }))]} />
      <Select label="Situação" value={situacao} onChange={e => setSituacao(e.target.value)} options={[{ value: "", label: "Todas as situações" }, ...Object.entries(SITUACOES_EQUIPE).map(([value, label]) => ({ value, label }))]} />
    </div>
    <div className="equipe-obras__indicadores">
      <SummaryCard label="Em atividade" value={snapshot ? contar("atividade") : "—"} detail="Entrada ou retorno válido" icon={<UserRound size={16} />} />
      <SummaryCard label="Em intervalo" value={snapshot ? contar("intervalo") : "—"} detail="Não inclui a equipe em atividade" icon={<Clock size={16} />} />
      <SummaryCard label="Sem registro" value={snapshot ? contar("sem_registro") : "—"} detail="Verificar ausência; escala não disponível" />
      <SummaryCard label="Faltas confirmadas" value={snapshot ? contar("falta") : "—"} detail="Confirmadas na gestão do ponto" />
      <SummaryCard label="Obras em atividade" value={snapshot ? new Set(filtrado.pessoas.filter(p => p.situacao === "atividade").map(p => p.obraId)).size : "—"} detail="Conforme os filtros aplicados" />
    </div>
    {!snapshot && <p role="status">{online ? carregando ? "Carregando obras e jornadas…" : "Aguardando consulta. Use Atualizar para tentar novamente." : "Conecte-se para carregar a equipe."}</p>}
    {snapshot && <>
      {!snapshot.obras.length && <p>Nenhuma obra disponível para seu acesso.</p>}
      {!snapshot.pessoas.length && <p>Nenhum funcionário disponível para seu acesso.</p>}
      {!!snapshot.pessoas.length && !filtrado.pessoas.length && <p>Nenhum funcionário corresponde à busca e aos filtros.</p>}
      <div className="equipe-obras__grade">{filtrado.obras.map(o => {
        const equipe = porObra.get(o.id) || [];
        return <Card key={o.id} className="equipe-obras__obra">
          <header>{o.fotoUrl ? <img src={o.fotoUrl} alt="" className="equipe-obras__capa" /> : <Building2 size={28} aria-hidden="true" />}<div><h2>{o.name}</h2>{o.complemento && <p>{o.complemento}</p>}<p>{equipe.filter(p => p.situacao === "atividade").length} em atividade · {equipe.filter(p => p.situacao === "intervalo").length} em intervalo</p></div></header>
          {equipe.length ? <div className="equipe-obras__pessoas">{equipe.map(p => <Pessoa key={p.id} pessoa={p} fuso={snapshot.fuso} onOpen={abrir} />)}</div> : <p className="equipe-obras__vazio">Sem funcionários em atividade</p>}
        </Card>;
      })}</div>
      <section className="equipe-obras__fora"><h2>Ausências e funcionários fora das obras</h2>
        {GRUPOS.map(grupo => {
          const pessoas = filtrado.pessoas.filter(p => p.situacao === grupo);
          if (!pessoas.length) return null;
          return <details key={grupo} open={["falta", "sem_registro", "conferir", "sem_obra"].includes(grupo)}><summary>{TITULOS[grupo]} <span>({pessoas.length})</span></summary><div className="equipe-obras__pessoas">{pessoas.map(p => <div key={p.id}><Pessoa pessoa={p} fuso={snapshot.fuso} onOpen={abrir} />{p.obraPrevistaId && <p className="equipe-obras__nota">Obra prevista: {nomeObra(p.obraPrevistaId)}</p>}</div>)}</div></details>;
        })}
        {!filtrado.pessoas.some(p => !p.obraId) && <p>Nenhum funcionário fora das obras nos filtros atuais.</p>}
      </section>
      <details className="equipe-obras__limites"><summary>Como este painel interpreta os registros</summary><ul>{snapshot.limitacoes.map(l => <li key={l}>{l}</li>)}</ul></details>
    </>}
    <Dialog className="equipe-obras__dialog" open={detalheAberto} onOpenChange={mudarDetalhe} title={detalhe?.nome || "Jornada"}>
      {detalhe && <div className="equipe-obras__detalhe"><Avatar pessoa={detalhe} /><p>{detalhe.funcao}</p><strong>{SITUACOES_EQUIPE[detalhe.situacao]}</strong><p>Obra registrada: {nomeObra(detalhe.obraRegistradaId)}</p>
        {detalhe.pendencias.length > 0 && <ul>{detalhe.pendencias.map(p => <li key={p}>{p}</li>)}</ul>}
        <h3>Registros da jornada</h3>{!detalhe.eventos.length ? <p>Sem batidas recebidas nesta jornada.</p> : <ol>{detalhe.eventos.map(m => <li key={m.eventId}><strong>{TIPOS_EVENTO_JORNADA[m.tipoEvento] || "Tipo não informado"}</strong><br /><time dateTime={m.marcadoEm}>{new Date(m.marcadoEm).toLocaleString("pt-BR", { timeZone: snapshot.fuso })}</time> · {nomeObra(m.obraId)}</li>)}</ol>}
        <div className="equipe-obras__acoes">{allowedTabs.includes("equipe") && <Button variant="secondary" onClick={() => onTab?.("equipe")}>Abrir cadastro de funcionários</Button>}{allowedTabs.includes("ponto_app") && <Button variant="secondary" onClick={() => onTab?.("ponto_app")}>Consultar ponto eletrônico</Button>}</div>
      </div>}
    </Dialog>
  </div>;
}
