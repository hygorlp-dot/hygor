// Registros do app Ponto de Obra. A leitura desta tela não altera a ARP,
// a Gestão do ponto nem a folha. Configurações continuam nas ações existentes.
import { useEffect, useMemo, useRef, useState } from "react";
import { chamarPontoEletronico } from "../../../api";
import { Badge, Btn, C, Ic, Inp, Modal, Sel } from "../../../LegacyApp";
import { funcionariosAtivos, funcionariosDaObra } from "../funcionarios.js";
import { FUSO_OBRA, dataLocal, horaLocal, resumoDoDia, situacaoAparelho } from "../painel.js";
import { usePontoEletronico } from "../usePontoEletronico.js";
import BancoHorasView from "./BancoHorasView.jsx";
import "./ponto-eletronico.css";

const VAZIO = Object.freeze([]);
const corDoTom = { ok: C.green, atencao: C.orange, critico: C.red, neutro: C.muted };
const corSituacao = { em_jornada: C.blue, fechada: C.green, sem_batida: C.muted };
const rotuloSituacao = { em_jornada: "Jornada em aberto", fechada: "Jornada fechada", sem_batida: "Sem batida recebida" };
const FILTROS = [
  { id: "todos", nome: "Todos" },
  { id: "sem_batida", nome: "Sem batida recebida" },
  { id: "conferir", nome: "A conferir" },
  { id: "em_jornada", nome: "Em aberto" },
];
const FUSOS = {
  "America/Recife": "Recife (UTC−3)",
  "America/Sao_Paulo": "Brasília / São Paulo (UTC−3)",
  "America/Manaus": "Manaus (UTC−4)",
  "America/Rio_Branco": "Rio Branco (UTC−5)",
  "America/Noronha": "Fernando de Noronha (UTC−2)",
};
const normalizarBusca = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const diaLegivel = dia => String(dia || "").split("-").reverse().join("/");
const instanteLegivel = iso => iso && Number.isFinite(Date.parse(iso))
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_OBRA, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  : "não informado";
const pedeConferencia = batida => !batida.horaConfiavel || batida.relogioAlterado || batida.metodo === "encarregado";
const quantidade = (valor, singular, plural) => `${valor} ${valor === 1 ? singular : plural}`;
const rotuloRecurso = (recurso, resumo) => !recurso.success
  ? (recurso.error ? "Não disponível" : "Carregando…")
  : recurso.error ? `${resumo} · atualização pendente` : resumo;

function EstadoRecurso({ recurso, nome }) {
  if (recurso.error) return <div className="pe-resource-message pe-resource-message--error" role="alert">
    <div>
      <strong>{recurso.success ? `Não foi possível atualizar ${nome}.` : `Não foi possível carregar ${nome}.`}</strong>
      <p>{recurso.error} {recurso.success ? `Exibindo a consulta de ${instanteLegivel(recurso.lastUpdated)}.` : "Tente novamente para consultar os registros."}</p>
    </div>
    <Btn v="ghost" onClick={() => recurso.refresh()} loading={recurso.loading ? "Tentando…" : false}>Tentar novamente</Btn>
  </div>;
  if (!recurso.success) return <div className="pe-empty" role="status">Carregando {nome}…</div>;
  return null;
}

function abrirSecao(ref) {
  const elemento = ref.current;
  if (!elemento) return;
  elemento.open = true;
  elemento.scrollIntoView?.({ block: "nearest" });
  elemento.querySelector("summary")?.focus();
}

export default function PontoEletronicoView({ data, showToast, currentUser }) {
  const obras = useMemo(() => (data?.obras || []).filter(o => o?.id && o?.name), [data?.obras]);
  const [obraId, setObraId] = useState(() => [...obras]
    .map(o => ({ id: String(o.id), n: funcionariosDaObra(data?.employees, o.id).length }))
    .sort((a, b) => b.n - a.n)[0]?.id || "");
  const [dia, setDia] = useState(() => dataLocal(new Date().toISOString()));
  const [aba, setAba] = useState("batidas");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [somenteBioPendente, setSomenteBioPendente] = useState(true);
  const [pareamento, setPareamento] = useState(null);
  const [pinModal, setPinModal] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [estabModal, setEstabModal] = useState(null);
  const [vinculoSelecionado, setVinculoSelecionado] = useState("");
  const [acaoEmCurso, setAcaoEmCurso] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const [agoraMs, setAgoraMs] = useState(Date.now);
  const mutacaoRef = useRef(false);
  const consultaFotoRef = useRef(0);
  const aparelhosRef = useRef(null);
  const fiscalRef = useRef(null);
  const batidasTabRef = useRef(null);
  const bancoTabRef = useRef(null);
  const podeGerir = ["admin", "rh", "engenheiro"].includes(currentUser?.role);
  const podeFiscal = ["admin", "rh"].includes(currentUser?.role);
  const ocupado = Boolean(acaoEmCurso);
  const { recursos, refresh, refreshGlobais, refreshRecurso, carregando } = usePontoEletronico({
    obraId, dia, podeGerir, scopeKey: `${currentUser?.id || ""}:${currentUser?.role || ""}`,
  });
  const dispositivos = recursos.dispositivos.data || VAZIO;
  const marcacoes = recursos.marcacoes.data || VAZIO;
  const biometrias = recursos.biometrias.data || VAZIO;
  const responsaveis = recursos.responsaveis.data || VAZIO;
  const estabelecimentos = recursos.estabelecimentos.data?.estabelecimentos || VAZIO;
  const repP = recursos.estabelecimentos.data?.repP;

  const funcionarios = useMemo(() => funcionariosDaObra(data?.employees, obraId), [data?.employees, obraId]);
  const nomeFuncionario = useMemo(() => new Map((data?.employees || []).map(e => [String(e.id), e.name])), [data?.employees]);
  const nomeTerceiro = useMemo(() => new Map((data?.terceirizados || []).map(t => [String(t.id), t.name])), [data?.terceirizados]);
  const nomeUsuario = useMemo(() => new Map((data?.usuarios || []).map(u => [String(u.id), u.nome || u.email])), [data?.usuarios]);
  const nomeObra = useMemo(() => new Map(obras.map(o => [String(o.id), o.name])), [obras]);
  const nomeEstab = useMemo(() => new Map(estabelecimentos.map(e => [String(e.id), e.nome])), [estabelecimentos]);
  const resumo = useMemo(() => resumoDoDia(marcacoes, funcionarios, funcionariosAtivos(data?.employees)), [marcacoes, funcionarios, data?.employees]);
  const acessosTerceiros = useMemo(() => marcacoes.filter(m => m.tipoRegistro === "acesso_terceiro"), [marcacoes]);
  const bioPorFuncionario = useMemo(() => new Map(biometrias.map(b => [String(b.employeeId), b])), [biometrias]);
  const semBiometria = funcionarios.filter(f => !bioPorFuncionario.has(String(f.id))).length;
  const funcionariosBio = somenteBioPendente ? funcionarios.filter(f => !bioPorFuncionario.has(String(f.id))) : funcionarios;
  const ativos = dispositivos.filter(d => d.status === "ativo");
  const online = ativos.filter(d => situacaoAparelho(d).tom === "ok").length;
  const ultimoContato = ativos.map(d => d.ultimoContatoEm).filter(v => Number.isFinite(Date.parse(v))).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const estabDaObra = estabelecimentos.find(e => (e.obras || []).some(id => String(id) === String(obraId))) || null;
  const contagens = {
    todos: resumo.length,
    sem_batida: resumo.filter(l => l.situacao === "sem_batida").length,
    conferir: resumo.filter(l => l.alertas > 0).length,
    em_jornada: resumo.filter(l => l.situacao === "em_jornada").length,
  };
  const resumoFiltrado = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    return resumo.filter(l => (!termo || normalizarBusca(`${l.nome} ${l.funcao}`).includes(termo))
      && (filtro === "todos" || (filtro === "conferir" ? l.alertas > 0 : l.situacao === filtro)));
  }, [resumo, busca, filtro]);
  const temAlertasVisiveis = resumoFiltrado.some(l => l.alertas > 0);
  const codigoExpirado = Boolean(pareamento?.codigo && Date.parse(pareamento.expiraEm) <= agoraMs);
  const nomeDaMarcacao = m => m.tipoRegistro === "acesso_terceiro"
    ? nomeTerceiro.get(String(m.terceiroId)) || "terceirizado"
    : nomeFuncionario.get(String(m.employeeId)) || "funcionário";

  useEffect(() => {
    if (obras.length && !obras.some(o => String(o.id) === String(obraId))) {
      const principal = [...obras].sort((a, b) => funcionariosDaObra(data?.employees, b.id).length - funcionariosDaObra(data?.employees, a.id).length)[0];
      setObraId(String(principal.id));
    }
  }, [obras, obraId, data?.employees]);
  useEffect(() => { setVinculoSelecionado(estabDaObra?.id || ""); }, [obraId, estabDaObra?.id]);
  useEffect(() => {
    consultaFotoRef.current += 1;
    setDetalhe(null);
    return () => { consultaFotoRef.current += 1; };
  }, [obraId, dia, currentUser?.id, currentUser?.role]);
  useEffect(() => {
    if (!pareamento?.codigo) return;
    setAgoraMs(Date.now());
    const timer = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pareamento?.codigo]);

  const falhaAcao = (resposta, mensagem) => {
    if (resposta.ok) return false;
    const erro = resposta.error || mensagem;
    setErroAcao(erro);
    showToast?.(erro, "error");
    return true;
  };
  // A trava síncrona também protege cliques/submit antes de o React renderizar
  // o estado de loading. Todas as mutações usam as permissões já existentes.
  const executarAcao = async (chave, tarefa) => {
    if (mutacaoRef.current) return;
    mutacaoRef.current = true;
    setAcaoEmCurso(chave);
    setErroAcao("");
    try { await tarefa(); }
    catch {
      const mensagem = "Não foi possível concluir a ação. Verifique a conexão e tente novamente.";
      setErroAcao(mensagem);
      showToast?.(mensagem, "error");
    } finally {
      mutacaoRef.current = false;
      setAcaoEmCurso("");
    }
  };
  const abrirPareamento = () => {
    setErroAcao("");
    setPareamento({ nome: "", obraId, obraNome: nomeObra.get(String(obraId)) });
  };
  const abrirPin = responsavel => {
    setErroAcao("");
    const obrasDoResponsavel = (responsavel?.obras || []).map(String);
    setPinModal({ userId: responsavel?.userId || "", pin: "", escopo: responsavel && !obrasDoResponsavel.length ? "todas" : "selecionadas", obras: responsavel ? obrasDoResponsavel : [String(obraId)] });
  };
  const abrirEstabelecimento = estabelecimento => {
    setErroAcao("");
    setEstabModal(estabelecimento
      ? { ...estabelecimento, obraId, obraNome: nomeObra.get(String(obraId)) }
      : { nome: "", tipoInscricao: "cnpj", numeroInscricao: "", cno: "", caepf: "", timezone: "America/Recife", ativo: true, vincular: !estabDaObra, obraId, obraNome: nomeObra.get(String(obraId)) });
  };
  const salvarEstabelecimento = () => {
    if (!podeFiscal || !String(estabModal?.nome || "").trim()) return;
    executarAcao("estabelecimento", async () => {
      const { vincular, obraId: obraDoFormulario, obraNome: _obraNome, ...estabelecimento } = estabModal;
      const r = await chamarPontoEletronico("ponto-estabelecimento-salvar", { estabelecimento });
      if (falhaAcao(r, "Não foi possível salvar o estabelecimento.")) return;
      if (vincular) {
        const v = await chamarPontoEletronico("ponto-estabelecimento-vincular-obra", { obraId: obraDoFormulario, estabelecimentoId: r.estabelecimento.id });
        if (!v.ok) {
          setEstabModal(atual => atual ? { ...atual, id: r.estabelecimento.id } : atual);
          falhaAcao({ ...v, error: `O estabelecimento foi salvo, mas a obra não foi vinculada. ${v.error || "Tente salvar novamente."}` });
          await refreshGlobais();
          return;
        }
      }
      showToast?.("Estabelecimento salvo.");
      setEstabModal(null);
      await refreshGlobais();
    });
  };
  const vincularObra = () => {
    if (!podeFiscal || !recursos.estabelecimentos.success || vinculoSelecionado === (estabDaObra?.id || "")) return;
    executarAcao("vinculo", async () => {
      const r = await chamarPontoEletronico("ponto-estabelecimento-vincular-obra", { obraId, estabelecimentoId: vinculoSelecionado });
      if (falhaAcao(r, "Não foi possível salvar o vínculo da obra.")) return;
      showToast?.(vinculoSelecionado ? "Obra vinculada ao estabelecimento. As batidas guardadas nos aparelhos chegam na próxima sincronização." : "Vínculo removido.");
      await refreshGlobais();
    });
  };
  const gerarCodigo = () => {
    if (!podeGerir || !pareamento) return;
    executarAcao("parear", async () => {
      const contexto = pareamento;
      const r = await chamarPontoEletronico("ponto-codigo-pareamento", { obraId: contexto.obraId, nome: contexto.nome.trim() || "Aparelho da obra" });
      if (falhaAcao(r, "Não foi possível gerar o código.")) return;
      setPareamento({ ...contexto, codigo: r.codigo, expiraEm: r.expiraEm, nome: r.nome || contexto.nome });
    });
  };
  const desativar = d => {
    if (!podeGerir || mutacaoRef.current) return;
    if (!window.confirm(`Desativar "${d.nome}"? O aparelho para de registrar e precisará ser pareado de novo. As marcações já feitas continuam guardadas.`)) return;
    executarAcao(`desativar:${d.id}`, async () => {
      const r = await chamarPontoEletronico("ponto-dispositivo-revogar", { dispositivoId: d.id });
      if (falhaAcao(r, "Não foi possível desativar o aparelho.")) return;
      showToast?.("Aparelho desativado.");
      await refreshRecurso("dispositivos");
    });
  };
  const salvarPin = () => {
    if (!podeGerir || !pinModal?.userId || !/^\d{4,8}$/.test(pinModal.pin) || (pinModal.escopo === "selecionadas" && !pinModal.obras.length)) return;
    executarAcao("pin", async () => {
      const r = await chamarPontoEletronico("ponto-responsavel-pin", { userId: pinModal.userId, pin: pinModal.pin, obras: pinModal.escopo === "todas" ? [] : pinModal.obras });
      if (falhaAcao(r, "Não foi possível salvar o PIN.")) return;
      showToast?.("PIN do app salvo. Ele chega aos aparelhos na próxima sincronização.");
      setPinModal(null);
      await refreshGlobais();
    });
  };
  const excluirBiometria = f => {
    if (!podeGerir || mutacaoRef.current) return;
    if (!window.confirm(`Excluir a biometria facial de ${f.nome}? Ele precisará ser cadastrado de novo no aparelho para bater ponto pelo rosto. As batidas já feitas continuam guardadas.`)) return;
    executarAcao(`biometria:${f.id}`, async () => {
      const r = await chamarPontoEletronico("ponto-biometria-excluir", { employeeId: f.id });
      if (falhaAcao(r, "Não foi possível excluir a biometria.")) return;
      showToast?.("Biometria excluída.");
      await refreshGlobais();
    });
  };
  const fecharDetalhe = () => {
    consultaFotoRef.current += 1;
    setDetalhe(null);
  };
  const abrirDetalhe = async m => {
    // O mesmo registro pode ser fechado e reaberto antes da resposta. O id
    // sozinho não distingue a consulta antiga da abertura mais recente.
    const consulta = ++consultaFotoRef.current;
    setDetalhe({ marcacao: m, fotoUrl: "", carregandoFoto: m.temFoto });
    if (!m.temFoto) return;
    try {
      const r = await chamarPontoEletronico("ponto-foto-url", { marcacaoId: m.id });
      setDetalhe(atual => consultaFotoRef.current === consulta && atual?.marcacao.id === m.id ? { ...atual, fotoUrl: r.ok ? r.url : "", carregandoFoto: false, erroFoto: r.ok ? "" : r.error || "Não foi possível carregar a foto." } : atual);
    } catch {
      setDetalhe(atual => consultaFotoRef.current === consulta && atual?.marcacao.id === m.id ? { ...atual, carregandoFoto: false, erroFoto: "Não foi possível carregar a foto. Tente novamente." } : atual);
    }
  };
  const navegarAbas = event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const proxima = event.key === "Home" ? "batidas" : event.key === "End" ? "banco" : aba === "batidas" ? "banco" : "batidas";
    setAba(proxima);
    (proxima === "batidas" ? batidasTabRef : bancoTabRef).current?.focus();
  };

  if (!obras.length) return <div className="pe-page"><h1>Ponto eletrônico</h1><div className="pe-empty">Cadastre uma obra no MARCELL para parear o primeiro aparelho de ponto.</div></div>;

  return <div className="pe-page">
    <header className="pe-header">
      <div className="pe-title-row"><h1>Ponto eletrônico</h1><Badge color={C.orange}>Em teste</Badge></div>
      <p className="pe-description">Registros recebidos do app Ponto de Obra.</p>
      <details className="pe-context-help">
        <summary>Uso dos registros e situação formal</summary>
        <div className="pe-help-copy">
          <p>Estes registros são separados da Gestão do ponto e da folha. O cadastro de obras, funcionários e usuários é compartilhado com o MARCELL.</p>
          {repP ? <p>{repP.rotulo}.{repP.pendencias?.length ? ` Pendências formais: ${repP.pendencias.join("; ")}.` : ""}</p>
            : <p>{recursos.estabelecimentos.error ? "Não foi possível consultar a situação formal. Tente atualizar os dados do estabelecimento fiscal." : "Consultando a situação formal…"}</p>}
        </div>
      </details>
    </header>

    <div className="pe-tabs" role="tablist" aria-label="Consultas do ponto eletrônico" onKeyDown={navegarAbas}>
      <button ref={batidasTabRef} id="pe-tab-batidas" type="button" role="tab" aria-selected={aba === "batidas"} aria-controls="pe-panel-batidas" tabIndex={aba === "batidas" ? 0 : -1} onClick={() => setAba("batidas")}>Batidas</button>
      <button ref={bancoTabRef} id="pe-tab-banco" type="button" role="tab" aria-selected={aba === "banco"} aria-controls="pe-panel-banco" tabIndex={aba === "banco" ? 0 : -1} onClick={() => setAba("banco")}>Banco de horas</button>
    </div>

    <div className="pe-context">
      <div className="pe-work-selector"><Sel label="Obra" value={obraId} onChange={setObraId} disabled={ocupado} options={obras.map(o => ({ v: String(o.id), l: o.name }))} /></div>
      {aba === "batidas" && <>
        <div className="pe-day-selector"><Inp label="Dia" type="date" value={dia} onChange={v => v && setDia(v)} disabled={ocupado} /></div>
        <div className="pe-update">
          <p role="status">{recursos.marcacoes.lastUpdated ? `Última consulta: ${instanteLegivel(recursos.marcacoes.lastUpdated)}` : recursos.marcacoes.error ? "Consulta ainda não concluída" : "Consultando as batidas…"}</p>
          <span>Horários de {FUSOS[FUSO_OBRA] || FUSO_OBRA}</span>
        </div>
        <Btn v="ghost" onClick={() => refresh()} loading={carregando ? "Atualizando…" : false} disabled={ocupado}><Ic n="refresh" /> Atualizar</Btn>
      </>}
    </div>

    <div id="pe-panel-banco" role="tabpanel" aria-labelledby="pe-tab-banco" tabIndex={0} hidden={aba !== "banco"}>
      {aba === "banco" && <BancoHorasView data={data} obraId={obraId} currentUser={currentUser} showToast={showToast} dia={dia} />}
    </div>
    <div id="pe-panel-batidas" className="pe-batidas-panel" role="tabpanel" aria-labelledby="pe-tab-batidas" tabIndex={0} hidden={aba !== "batidas"}>
      {erroAcao && !pareamento && !pinModal && !estabModal && <div className="pe-inline-error" role="alert">{erroAcao}</div>}
      <section className="pe-sync" aria-label="Recebimento e conexão dos aparelhos">
        <Ic n="smartphone" />
        <div className="pe-sync-copy">
          {!recursos.dispositivos.success ? <strong>{recursos.dispositivos.error ? "Conexão dos aparelhos indisponível" : "Consultando os aparelhos…"}</strong>
            : <>
              <strong>{ativos.length ? `${online} de ${quantidade(ativos.length, "aparelho ativo", "aparelhos ativos")} online` : "Nenhum aparelho ativo nesta obra"}</strong>
              <p>{ultimoContato ? `Último contato de um aparelho: ${instanteLegivel(ultimoContato)}.` : "Nenhum contato de aparelho ativo informado."} {ativos.length > online ? "Confira a internet dos aparelhos sem contato." : ""}</p>
            </>}
          <p>Batidas guardadas no aparelho aparecem aqui após a sincronização.{recursos.dispositivos.error && recursos.dispositivos.success ? " A consulta de aparelhos precisa ser atualizada." : ""}</p>
          {recursos.estabelecimentos.success && !estabDaObra && <p className="pe-warning">Vínculo fiscal pendente. As batidas ficam no aparelho até o estabelecimento ser vinculado.</p>}
        </div>
        <div className="pe-actions"><Btn v="ghost" onClick={() => abrirSecao(aparelhosRef)}>Ver aparelhos</Btn>{recursos.estabelecimentos.success && !estabDaObra && <Btn v="ghost" onClick={() => abrirSecao(fiscalRef)}>Ver vínculo fiscal</Btn>}</div>
      </section>

      <section className="pe-batidas" aria-labelledby="pe-batidas-heading" aria-busy={recursos.marcacoes.loading}>
        <div className="pe-section-heading">
          <h2 id="pe-batidas-heading">Batidas de {diaLegivel(dia)}</h2>
          {recursos.marcacoes.success && <div className="pe-day-totals">
            <span>Batidas recebidas: <strong>{marcacoes.filter(m => m.tipoRegistro === "ponto").length}</strong></span>
            <span>Jornadas em aberto no dia: <strong>{contagens.em_jornada}</strong></span>
          </div>}
        </div>
        <EstadoRecurso recurso={recursos.marcacoes} nome="as batidas deste dia" />
        {recursos.marcacoes.success && <>
          <div className="pe-filters">
            <div className="pe-search"><Inp label="Buscar funcionário" type="search" value={busca} onChange={setBusca} placeholder="Nome ou função" /></div>
            <div className="pe-filter-options" role="group" aria-label="Filtrar funcionários por situação">
              {FILTROS.map(item => <button type="button" key={item.id} aria-pressed={filtro === item.id} onClick={() => setFiltro(item.id)} aria-label={`${item.nome}: ${quantidade(contagens[item.id], "funcionário", "funcionários")}`}>
                {item.nome}<span className="pe-filter-count">{contagens[item.id]}</span>
              </button>)}
            </div>
          </div>
          <div className="pe-results-heading">
            <p role="status">{resumoFiltrado.length} de {resumo.length} funcionários{busca.trim() ? ` · busca por “${busca.trim()}”` : ""}</p>
            {(busca || filtro !== "todos") && <Btn v="ghost" onClick={() => { setBusca(""); setFiltro("todos"); }}>Limpar filtros</Btn>}
          </div>
          {!resumo.length ? <div className="pe-empty">Nenhum funcionário ativo lotado nesta obra e nenhuma batida de funcionário recebida neste dia.</div>
            : !resumoFiltrado.length ? <div className="pe-empty"><strong>Nenhum funcionário neste filtro.</strong><p>Altere a busca ou limpe os filtros para ver a equipe.</p></div>
              : <div className="pe-table-scroll"><table className="pe-table">
                <caption className="pe-sr-only">Batidas recebidas na obra {nomeObra.get(String(obraId))} em {diaLegivel(dia)}. Horários de {FUSOS[FUSO_OBRA] || FUSO_OBRA}.</caption>
                <thead><tr><th scope="col">Funcionário</th><th scope="col">Situação no dia</th><th scope="col">Batidas recebidas</th></tr></thead>
                <tbody>{resumoFiltrado.map(l => <tr key={l.employeeId}>
                  <th scope="row"><span className="pe-person-name">{l.nome}</span>{l.funcao && <span className="pe-person-meta">{l.funcao}</span>}{l.foraDaObra && <span className="pe-person-meta">Lotado em outra obra</span>}</th>
                  <td data-label="Situação no dia"><Badge color={corSituacao[l.situacao]}>{rotuloSituacao[l.situacao]}</Badge></td>
                  <td data-label="Batidas recebidas"><div className="pe-punches">
                    {l.batidas.length ? l.batidas.map(b => {
                      const atencao = pedeConferencia(b);
                      const horario = horaLocal(b.marcadoEm).slice(0, 5);
                      return <button key={b.id} type="button" className={`pe-punch${atencao ? " pe-punch--attention" : ""}`} onClick={() => abrirDetalhe(b)}
                        aria-label={`Ver batida de ${l.nome} às ${horario} em ${diaLegivel(dia)}${atencao ? ", a conferir" : ""}`} aria-describedby={atencao ? "pe-legenda-alerta" : undefined}>
                        {horario}{atencao && <span aria-hidden="true">!</span>}
                      </button>;
                    }) : <span className="pe-muted">Nenhuma recebida</span>}
                  </div></td>
                </tr>)}</tbody>
              </table></div>}
          {temAlertasVisiveis && <p id="pe-legenda-alerta" className="pe-legend"><strong>! A conferir:</strong> identificação pelo encarregado, hora não confirmada pelo servidor ou relógio do celular alterado. O sinal não invalida a batida.</p>}
          <details className="pe-reading-help"><summary>Como ler as situações do dia</summary><div className="pe-help-copy">
            <p>A tela organiza as batidas recebidas em pares: uma quantidade ímpar indica jornada em aberto no dia; uma quantidade par indica jornada fechada. Essa leitura não confirma se o funcionário está trabalhando agora.</p>
            <p>“Sem batida recebida” significa que ainda não chegou uma marcação desse funcionário para esta obra e este dia. Confira a conexão do aparelho antes de concluir que faltou uma batida.</p>
          </div></details>
          {!!acessosTerceiros.length && <details className="pe-thirdparty">
            <summary>Acessos de terceirizados ({acessosTerceiros.length})</summary>
            <ul className="pe-simple-list">{acessosTerceiros.map(a => <li key={a.id}><span>{nomeDaMarcacao(a)}</span><button type="button" className="pe-punch" onClick={() => abrirDetalhe(a)} aria-label={`Ver acesso de ${nomeDaMarcacao(a)} às ${horaLocal(a.marcadoEm).slice(0, 5)}`}>{horaLocal(a.marcadoEm).slice(0, 5)}</button></li>)}</ul>
          </details>}
        </>}
      </section>

      <section className="pe-settings" aria-labelledby="pe-settings-heading">
        <h2 id="pe-settings-heading">Configurações e cadastros</h2>
        <details className="pe-disclosure" id="pe-aparelhos" ref={aparelhosRef}>
          <summary><span className="pe-disclosure-title"><Ic n="smartphone" />Aparelhos da obra</span><span className="pe-disclosure-meta">{rotuloRecurso(recursos.dispositivos, `${ativos.length} ativos · ${ativos.length - online} sem contato recente`)}</span></summary>
          <div className="pe-disclosure-body">
            <EstadoRecurso recurso={recursos.dispositivos} nome="os aparelhos da obra" />
            {recursos.dispositivos.success && (!dispositivos.length ? <p className="pe-muted">Nenhum aparelho pareado nesta obra. Gere um código e digite-o no celular da obra para começar.</p>
              : <div className="pe-record-list">{dispositivos.map(d => {
                const s = situacaoAparelho(d);
                return <div key={d.id} className="pe-record">
                  <div className="pe-record-main"><strong>{d.nome}</strong><p>Último contato: {instanteLegivel(d.ultimoContatoEm)} · App {d.appVersao || "não informado"}</p>
                    <p>{d.aparelho?.modelo ? `${[d.aparelho.marca, d.aparelho.modelo].filter(Boolean).join(" ")} · ` : ""}{d.aparelho?.android ? `Android ${d.aparelho.android} · ` : ""}Sequência local {d.ultimaSequenciaLocal ?? "não informada"}{d.estabelecimentoId ? ` · ${nomeEstab.get(String(d.estabelecimentoId)) || "estabelecimento vinculado"}` : ""}{d.ultimoGps ? <> · <a href={`https://maps.google.com/?q=${d.ultimoGps.lat},${d.ultimoGps.lng}`} target="_blank" rel="noreferrer">Ver localização de {d.nome}</a></> : null}</p>
                  </div><Badge color={corDoTom[s.tom]}>{s.rotulo}</Badge>
                  {podeGerir && d.status === "ativo" && <Btn v="ghost" ariaLabel={`Desativar aparelho ${d.nome}`} disabled={ocupado} loading={acaoEmCurso === `desativar:${d.id}` ? "Desativando…" : false} onClick={() => desativar(d)}>Desativar</Btn>}
                </div>;
              })}</div>)}
            {podeGerir && <Btn onClick={abrirPareamento} disabled={ocupado || recursos.dispositivos.loading}><Ic n="plus" />Parear aparelho</Btn>}
          </div>
        </details>

        <details className="pe-disclosure" id="pe-biometria">
          <summary><span className="pe-disclosure-title"><Ic n="user" />Biometria facial</span><span className="pe-disclosure-meta">{rotuloRecurso(recursos.biometrias, quantidade(semBiometria, "cadastro pendente", "cadastros pendentes"))}</span></summary>
          <div className="pe-disclosure-body">
            <p className="pe-muted">O rosto é cadastrado no aparelho da obra por um responsável com PIN, com o consentimento do funcionário (LGPD).</p>
            <EstadoRecurso recurso={recursos.biometrias} nome="os cadastros de biometria" />
            {recursos.biometrias.success && <>
              <label className="pe-check"><input type="checkbox" checked={somenteBioPendente} onChange={event => setSomenteBioPendente(event.target.checked)} />Mostrar somente cadastros pendentes</label>
              {!funcionariosBio.length ? <p className="pe-empty">{funcionarios.length ? "Todos os funcionários lotados nesta obra têm biometria cadastrada." : "Nenhum funcionário ativo lotado nesta obra."}</p>
                : <div className="pe-record-list">{funcionariosBio.map(f => {
                  const b = bioPorFuncionario.get(String(f.id));
                  return <div key={f.id} className="pe-record"><div className="pe-record-main"><strong>{f.nome}</strong>{b && <p>Cadastrada em {new Date(b.cadastradaEm).toLocaleDateString("pt-BR", { timeZone: FUSO_OBRA })} por {nomeUsuario.get(String(b.cadastradoPor)) || "responsável"}</p>}</div>
                    {!b && <Badge color={C.orange}>Pendente</Badge>}
                    {b && podeGerir && <Btn v="ghost" ariaLabel={`Excluir biometria de ${f.nome}`} disabled={ocupado} loading={acaoEmCurso === `biometria:${f.id}` ? "Excluindo…" : false} onClick={() => excluirBiometria(f)}>Excluir biometria</Btn>}
                  </div>;
                })}</div>}
            </>}
          </div>
        </details>

        <details className="pe-disclosure" id="pe-fiscal" ref={fiscalRef}>
          <summary><span className="pe-disclosure-title"><Ic n="lock" />Estabelecimento fiscal</span><span className="pe-disclosure-meta">{rotuloRecurso(recursos.estabelecimentos, estabDaObra?.nome || "Vínculo pendente")}</span></summary>
          <div className="pe-disclosure-body">
            <EstadoRecurso recurso={recursos.estabelecimentos} nome="os estabelecimentos fiscais" />
            {recursos.estabelecimentos.success && <>
              {estabDaObra ? <div className="pe-fiscal-details"><p><strong>{estabDaObra.nome}</strong> · {estabDaObra.tipoInscricao ? `${estabDaObra.tipoInscricao.toUpperCase()} ${estabDaObra.numeroInscricao || "não informado"}` : "Inscrição não cadastrada"}{estabDaObra.cno ? ` · CNO ${estabDaObra.cno}` : ""} · Último NSR {estabDaObra.ultimoNsr}</p>
                <p>Obras neste estabelecimento: {(estabDaObra.obras || []).map(id => nomeObra.get(String(id)) || id).join(", ")}</p>
                {!!estabDaObra.pendencias?.length && <p className="pe-warning">Pendências: {estabDaObra.pendencias.join("; ")}.</p>}
              </div> : <div className="pe-notice"><strong>Obra sem estabelecimento fiscal.</strong><p>O NSR é contado por estabelecimento (CNPJ/CPF). Enquanto não houver vínculo, as batidas ficam guardadas nos aparelhos e não recebem NSR. {podeFiscal ? "Selecione ou cadastre um estabelecimento para esta obra." : "Peça ao RH ou ao administrador para fazer o vínculo."}</p></div>}
              {podeFiscal && <>
                <div className="pe-fiscal-form"><Sel label="Estabelecimento desta obra" value={vinculoSelecionado} onChange={setVinculoSelecionado} disabled={ocupado} options={[{ v: "", l: "Nenhum estabelecimento" }, ...estabelecimentos.map(e => ({ v: e.id, l: e.nome }))]} />
                  <Btn onClick={vincularObra} disabled={ocupado || vinculoSelecionado === (estabDaObra?.id || "")} loading={acaoEmCurso === "vinculo" ? "Salvando…" : false}>Salvar vínculo</Btn>
                </div>
                <p className="pe-muted pe-caption">A escolha só será aplicada ao salvar. Aparelhos que já têm registros em outro estabelecimento precisam ser pareados de novo antes da troca.</p>
                <div className="pe-actions">{estabDaObra && <Btn v="ghost" onClick={() => abrirEstabelecimento(estabDaObra)} disabled={ocupado}>Editar estabelecimento</Btn>}<Btn v="ghost" onClick={() => abrirEstabelecimento()} disabled={ocupado}><Ic n="plus" />Novo estabelecimento</Btn></div>
              </>}
            </>}
          </div>
        </details>
        {podeGerir && <details className="pe-disclosure" id="pe-responsaveis">
          <summary><span className="pe-disclosure-title"><Ic n="lock" />Responsáveis com PIN do app</span><span className="pe-disclosure-meta">{rotuloRecurso(recursos.responsaveis, quantidade(responsaveis.length, "responsável cadastrado", "responsáveis cadastrados"))}</span></summary>
          <div className="pe-disclosure-body"><p className="pe-muted">Responsáveis podem cadastrar rostos e identificar um funcionário quando o reconhecimento falhar. O PIN do app é separado do PIN do MARCELL.</p>
            <EstadoRecurso recurso={recursos.responsaveis} nome="os responsáveis com PIN" />
            {recursos.responsaveis.success && (!responsaveis.length ? <p className="pe-empty">Nenhum responsável com PIN do app cadastrado.</p>
              : <div className="pe-record-list">{responsaveis.map(r => <div key={r.userId} className="pe-record"><div className="pe-record-main"><strong>{r.nome}</strong><p>{r.obras?.length ? r.obras.map(id => nomeObra.get(String(id)) || id).join(", ") : "Todas as obras"}</p></div><Btn v="ghost" ariaLabel={`Trocar PIN de ${r.nome}`} onClick={() => abrirPin(r)} disabled={ocupado}>Trocar PIN</Btn></div>)}</div>)}
            <Btn v="ghost" onClick={() => abrirPin()} disabled={ocupado || recursos.responsaveis.loading}><Ic n="plus" />Definir PIN de um responsável</Btn>
          </div>
        </details>}
      </section>
    </div>

    {pareamento && <Modal title="Parear aparelho da obra" panelClass="pe-modal" onClose={() => { if (!mutacaoRef.current) setPareamento(null); }}>
      <div className="pe-form"><p>Obra: <strong>{pareamento.obraNome}</strong></p>
        {erroAcao && <p className="pe-inline-error" role="alert">{erroAcao}</p>}
        {!pareamento.codigo ? <>
          <p className="pe-muted">O código vale 30 minutos e pode ser usado uma única vez.</p>
          <Inp label="Nome do aparelho" value={pareamento.nome} placeholder="Ex.: Portaria principal" disabled={ocupado} onChange={v => setPareamento(p => ({ ...p, nome: v }))} />
          <Btn onClick={gerarCodigo} disabled={ocupado} loading={acaoEmCurso === "parear" ? "Gerando código…" : false}>Gerar código</Btn>
        </> : <>
          <p className="pe-muted">No celular da obra, abra o app Ponto de Obra e digite:</p>
          <p className={`pe-pairing-code${codigoExpirado ? " pe-pairing-code--expired" : ""}`}>{pareamento.codigo.replace(/(\d{4})(\d{4})/, "$1 $2")}</p>
          <p role="status" className={codigoExpirado ? "pe-warning" : "pe-muted"}>{codigoExpirado ? "Código expirado. Gere outro para parear o aparelho." : `Válido até ${instanteLegivel(pareamento.expiraEm)} (horário de Recife). Após o pareamento, o aparelho aparece na lista na próxima consulta.`}</p>
          <div className="pe-actions"><Btn v={codigoExpirado ? "primary" : "ghost"} onClick={gerarCodigo} disabled={ocupado} loading={acaoEmCurso === "parear" ? "Gerando código…" : false}>Gerar outro código</Btn><Btn v="ghost" disabled={ocupado} onClick={() => { setPareamento(null); refreshRecurso("dispositivos"); }}>Concluir</Btn></div>
        </>}
      </div>
    </Modal>}

    {pinModal && <Modal title="PIN do app de ponto" panelClass="pe-modal" onClose={() => { if (!mutacaoRef.current) setPinModal(null); }}>
      <form className="pe-form" onSubmit={event => { event.preventDefault(); salvarPin(); }}>
        {erroAcao && <p className="pe-inline-error" role="alert">{erroAcao}</p>}
        <Sel label="Responsável" value={pinModal.userId} disabled={ocupado} onChange={v => setPinModal(p => ({ ...p, userId: v }))} options={[{ v: "", l: "Selecione" }, ...(data?.usuarios || []).filter(u => u.active !== false).map(u => ({ v: String(u.id), l: u.nome || u.email }))]} />
        <label className="arcd-field pe-native-field" htmlFor="pe-pin"><span>PIN do app</span><input id="pe-pin" className="arcd-field-control" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} autoComplete="new-password" aria-describedby="pe-pin-hint" disabled={ocupado} value={pinModal.pin} onChange={event => setPinModal(p => ({ ...p, pin: event.target.value.replace(/\D/g, "").slice(0, 8) }))} /><small id="pe-pin-hint">Use de 4 a 8 números. Este PIN é exclusivo do app de ponto.</small></label>
        <fieldset className="pe-scope"><legend>Obras em que pode atuar</legend>
          <label className="pe-check"><input type="radio" name="pe-pin-scope" value="todas" checked={pinModal.escopo === "todas"} disabled={ocupado} onChange={() => setPinModal(p => ({ ...p, escopo: "todas" }))} />Todas as obras</label>
          <label className="pe-check"><input type="radio" name="pe-pin-scope" value="selecionadas" checked={pinModal.escopo === "selecionadas"} disabled={ocupado} onChange={() => setPinModal(p => ({ ...p, escopo: "selecionadas" }))} />Somente as obras selecionadas</label>
          {pinModal.escopo === "selecionadas" && <div className="pe-work-options">{obras.map(o => <label key={o.id} className="pe-check"><input type="checkbox" checked={pinModal.obras.includes(String(o.id))} disabled={ocupado} onChange={event => setPinModal(p => ({ ...p, obras: event.target.checked ? [...p.obras, String(o.id)] : p.obras.filter(id => id !== String(o.id)) }))} />{o.name}</label>)}{!pinModal.obras.length && <p className="pe-warning" role="status">Selecione pelo menos uma obra ou escolha “Todas as obras”.</p>}</div>}
        </fieldset>
        <Btn type="submit" disabled={ocupado || !pinModal.userId || pinModal.pin.length < 4 || (pinModal.escopo === "selecionadas" && !pinModal.obras.length)} loading={acaoEmCurso === "pin" ? "Salvando PIN…" : false}>Salvar PIN</Btn>
      </form>
    </Modal>}

    {estabModal && <Modal title={estabModal.id ? "Editar estabelecimento" : "Novo estabelecimento"} panelClass="pe-modal" onClose={() => { if (!mutacaoRef.current) setEstabModal(null); }}>
      <form className="pe-form" onSubmit={event => { event.preventDefault(); salvarEstabelecimento(); }}>
        {erroAcao && <p className="pe-inline-error" role="alert">{erroAcao}</p>}
        <p className="pe-muted">O NSR é contado por estabelecimento. Inscrição, CNO e CAEPF podem ser informados depois.</p>
        <Inp label="Nome do estabelecimento" value={estabModal.nome} disabled={ocupado} onChange={v => setEstabModal(e => ({ ...e, nome: v }))} />
        <Sel label="Tipo de inscrição" value={estabModal.tipoInscricao || ""} disabled={ocupado} onChange={v => setEstabModal(e => ({ ...e, tipoInscricao: v }))} options={[{ v: "", l: "Ainda não informada" }, { v: "cnpj", l: "CNPJ" }, { v: "cpf", l: "CPF" }]} />
        {estabModal.tipoInscricao && <Inp label={`Número do ${estabModal.tipoInscricao.toUpperCase()}`} value={estabModal.numeroInscricao || ""} disabled={ocupado} onChange={v => setEstabModal(e => ({ ...e, numeroInscricao: v }))} />}
        <Inp label="CNO (12 dígitos)" value={estabModal.cno || ""} disabled={ocupado} onChange={v => setEstabModal(e => ({ ...e, cno: v }))} />
        <Inp label="CAEPF (14 dígitos)" value={estabModal.caepf || ""} disabled={ocupado} onChange={v => setEstabModal(e => ({ ...e, caepf: v }))} />
        <label className="arcd-field pe-native-field" htmlFor="pe-timezone"><span>Fuso horário</span><input id="pe-timezone" className="arcd-field-control" type="text" list="pe-timezones" aria-describedby="pe-timezone-hint" value={estabModal.timezone ?? "America/Recife"} disabled={ocupado} onChange={event => setEstabModal(e => ({ ...e, timezone: event.target.value }))} /><small id="pe-timezone-hint">{FUSOS[estabModal.timezone] || "Use um fuso IANA, como America/Recife."}</small></label>
        <datalist id="pe-timezones">{Object.entries(FUSOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</datalist>
        {!estabModal.id && <label className="pe-check"><input type="checkbox" checked={Boolean(estabModal.vincular)} disabled={ocupado} onChange={event => setEstabModal(e => ({ ...e, vincular: event.target.checked }))} />Vincular a obra {estabModal.obraNome} a este estabelecimento</label>}
        <Btn type="submit" disabled={ocupado || !String(estabModal.nome || "").trim()} loading={acaoEmCurso === "estabelecimento" ? "Salvando…" : false}>Salvar estabelecimento</Btn>
      </form>
    </Modal>}

    {detalhe && <Modal title={`${detalhe.marcacao.tipoRegistro === "acesso_terceiro" ? "Acesso" : "Batida"} de ${nomeDaMarcacao(detalhe.marcacao)}`} panelClass="pe-modal" onClose={fecharDetalhe}>
      <div className="pe-detail">
        {detalhe.carregandoFoto ? <p className="pe-muted" role="status">Carregando foto…</p>
          : detalhe.fotoUrl ? <img src={detalhe.fotoUrl} alt={`Foto registrada na ${detalhe.marcacao.tipoRegistro === "acesso_terceiro" ? "entrada" : "batida"} de ${nomeDaMarcacao(detalhe.marcacao)}`} className="pe-photo" />
            : <div><p className={detalhe.erroFoto ? "pe-warning" : "pe-muted"}>{detalhe.erroFoto || "Sem foto neste registro."}</p>{detalhe.erroFoto && <Btn v="ghost" onClick={() => abrirDetalhe(detalhe.marcacao)}>Tentar carregar a foto novamente</Btn>}</div>}
        <dl><div><dt>Horário</dt><dd>{diaLegivel(dataLocal(detalhe.marcacao.marcadoEm))} {horaLocal(detalhe.marcacao.marcadoEm)} · {FUSOS[FUSO_OBRA] || FUSO_OBRA}</dd></div>
          <div><dt>Identificação</dt><dd>{detalhe.marcacao.metodo === "facial" ? `Reconhecimento facial${detalhe.marcacao.confianca != null ? ` (${Math.round(detalhe.marcacao.confianca * 100)}%)` : ""}` : `Pelo encarregado ${nomeUsuario.get(String(detalhe.marcacao.encarregadoId)) || ""}`}</dd></div>
          <div><dt>Referência da hora</dt><dd>{detalhe.marcacao.horaConfiavel ? "Confirmada pela hora do servidor" : "Relógio do celular; aparelho sem sincronizar desde que ligou"}{detalhe.marcacao.relogioAlterado ? ". O relógio do celular estava alterado; a batida usou a hora do servidor." : ""}</dd></div>
          <div><dt>NSR</dt><dd>{detalhe.marcacao.nsr ?? (detalhe.marcacao.tipoRegistro === "acesso_terceiro" ? "Não se aplica ao controle de acesso" : detalhe.marcacao.formato === 1 ? "Não tem: registro do formato antigo" : "Ainda não atribuído")}</dd></div>
          <div><dt>Aparelho</dt><dd>{dispositivos.find(d => d.id === detalhe.marcacao.dispositivoId)?.nome || "Não informado"} · Registro local nº {detalhe.marcacao.localSequence}</dd></div>
          <div><dt>Recebido pelo servidor</dt><dd>{instanteLegivel(detalhe.marcacao.recebidoEm)}</dd></div>
          {detalhe.marcacao.gps && <div><dt>Localização</dt><dd><a href={`https://maps.google.com/?q=${detalhe.marcacao.gps.lat},${detalhe.marcacao.gps.lng}`} target="_blank" rel="noreferrer">Ver localização do registro no mapa</a> · Precisão {Math.round(detalhe.marcacao.gps.precisao || 0)} m</dd></div>}
        </dl>
      </div>
    </Modal>}
  </div>;
}
