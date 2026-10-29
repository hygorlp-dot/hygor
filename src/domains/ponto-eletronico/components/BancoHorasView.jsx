import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Btn, C, Ic } from "../../../LegacyApp";
import { formatMinutes } from "../../ponto/timekeeping.js";
import { construirBancoHoras, formatarSaldoMinutos, resumirLinhasBancoHoras, validarPeriodoBancoHoras } from "../banco-horas.js";
import { dataLocal, FUSO_OBRA, horaLocal } from "../painel.js";
import { usePontoRecurso } from "../usePontoEletronico.js";
import "./banco-horas.css";

const VAZIO = Object.freeze([]);
const diaLegivel = dia => String(dia).split("-").reverse().join("/");
const dataCurta = dia => diaLegivel(dia).slice(0, 5);
const textoBusca = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const minutosLegiveis = valor => valor == null ? "—" : formatMinutes(valor);
const tomSaldo = valor => valor > 0 ? "credito" : valor < 0 ? "debito" : "neutro";
const selecionarResposta = r => {
  if (!Array.isArray(r?.marcacoes) || !Array.isArray(r?.apropriacoes) || typeof r?.cobertura?.completa !== "boolean") {
    throw new Error("A consulta não confirmou a cobertura do período. Tente atualizar novamente.");
  }
  return r;
};

export function periodoDoMes(dia, deslocamento = 0) {
  const hoje = dataLocal(new Date().toISOString());
  const base = validarPeriodoBancoHoras(dia, dia).ok ? dia : hoje;
  const [ano, mes] = base.split("-").map(Number);
  const de = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1)).toISOString().slice(0, 10);
  const ultimo = new Date(Date.UTC(ano, mes + deslocamento, 0)).toISOString().slice(0, 10);
  return { de, ate: de.slice(0, 7) === hoje.slice(0, 7) ? hoje : ultimo };
}

function AjudaCalculo() {
  return <details className="bh-calculo">
    <summary>Como este saldo é calculado</summary>
    <div>
      <p>Horas apuradas menos a jornada diária cadastrada, somadas apenas nos dias que podem ser considerados. A jornada do funcionário prevalece sobre o padrão da empresa.</p>
      <p>Intervalos já tratados prevalecem sobre a leitura das batidas. Sem tratamento, os horários são interpretados pelas capturas, incluindo mudanças de obra. A jornada é descontada uma vez por funcionário e dia.</p>
      <p>Dias sem registro ou com horários incompletos não geram débito automático. A consulta usa a jornada cadastrada atualmente; não inclui saldo anterior, compensações, calendário contratual ou lançamentos na folha.</p>
    </div>
  </details>;
}

function TotaisBanco({ resumo, individual }) {
  const temSaldo = resumo.diasConsiderados > 0;
  return <dl className="bh-totais" aria-label={individual ? "Resumo do funcionário no período" : "Resumo da equipe filtrada no período"}>
    <div><dt>Saldo estimado {individual ? "do período" : "da equipe"}</dt><dd data-tone={tomSaldo(resumo.saldoMinutos)}>{formatarSaldoMinutos(resumo.saldoMinutos)}</dd></div>
    <div><dt>Horas a mais</dt><dd>{temSaldo ? minutosLegiveis(resumo.creditosMinutos) : "—"}</dd></div>
    <div><dt>Horas a menos</dt><dd>{temSaldo ? minutosLegiveis(resumo.debitosMinutos) : "—"}</dd></div>
    <div><dt>Dias a conferir</dt><dd>{resumo.diasPendentes}</dd></div>
  </dl>;
}

function TooltipSaldo({ active, payload }) {
  const ponto = payload?.[0]?.payload;
  if (!active || !ponto) return null;
  return <div className="bh-tooltip">
    <strong>{diaLegivel(ponto.data)}</strong>
    <span>Saldo acumulado: {formatarSaldoMinutos(ponto.saldo)}</span>
    <span>Variação do dia: {formatarSaldoMinutos(ponto.variacao)}</span>
  </div>;
}

function EvolucaoSaldo({ linha, selecionarDia }) {
  const serie = linha.dias.map(d => ({
    data: d.data,
    saldo: d.situacao === "considerado" ? d.acumuladoMinutos : null,
    variacao: d.saldoMinutos,
  }));
  return <figure className="bh-evolucao">
    <figcaption><h3>Evolução do saldo estimado</h3><p>Selecione um dia no gráfico ou na tabela para conferir os horários.</p></figcaption>
    {linha.diasConsiderados > 0 ? <div className="bh-grafico" role="img" aria-label={`Evolução do saldo estimado de ${linha.nome}. Os mesmos valores estão na tabela de dias.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={serie} margin={{ top: 16, right: 20, left: 4, bottom: 4 }}
          onClick={evento => { const data = evento?.activePayload?.[0]?.payload?.data; if (data) selecionarDia(data); }}>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="data" tickFormatter={dataCurta} minTickGap={30} tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatarSaldoMinutos} width={76} tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4" />
          <Tooltip content={<TooltipSaldo />} />
          <Line type="linear" dataKey="saldo" name="Saldo acumulado" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div> : <p className="bh-vazio">A evolução aparece quando houver pelo menos um dia com horários suficientes para calcular o saldo.</p>}
    <p className="bh-nota">As lacunas representam dias que não entraram no saldo. Não indicam saldo zero.</p>
  </figure>;
}

function DetalheDia({ dia, nomeObra, tituloRef }) {
  return <div className="bh-detalhe-dia" id={`bh-detalhe-${dia.data}`}>
    <h4 ref={tituloRef} tabIndex={-1}>Conferência de {diaLegivel(dia.data)}</h4>
    <p>{dia.origem === "apropriacao" ? "Base: intervalos tratados." : dia.temRegistro ? "Base: batidas recebidas." : "Nenhum registro recebido nesta data."}</p>
    {dia.pendencias.length > 0 && <ul className="bh-pendencias">{dia.pendencias.map(p => <li key={p.codigo}>{p.mensagem}</li>)}</ul>}
    {dia.alertas.length > 0 && <ul className="bh-avisos">{dia.alertas.map(a => <li key={a.codigo}>{a.mensagem} O aviso não exclui a marcação.</li>)}</ul>}
    {dia.intervalos.length > 0 && <ul className="bh-intervalos">{dia.intervalos.map((i, indice) => <li key={`${i.inicio}-${indice}`}>
      <span>{horaLocal(i.inicio).slice(0, 5)} → {horaLocal(i.fim).slice(0, 5)}{dataLocal(i.inicio) !== dataLocal(i.fim) ? ` (${diaLegivel(dataLocal(i.fim))})` : ""}</span>
      <span>{nomeObra.get(String(i.obraId)) || "Obra não identificada"}</span><strong>{minutosLegiveis(Math.round(i.minutos))}</strong>
    </li>)}</ul>}
    {dia.batidas.length > 0 && <p>Batidas recebidas: {dia.batidas.map(b => horaLocal(b.marcadoEm).slice(0, 5)).join(" · ")}.</p>}
    {dia.situacao === "considerado" && <p>Apurado: <strong>{minutosLegiveis(dia.trabalhadosMinutos)}</strong> · Jornada considerada: <strong>{minutosLegiveis(dia.previstosMinutos)}</strong> · Variação: <strong>{formatarSaldoMinutos(dia.saldoMinutos)}</strong>.</p>}
    {dia.situacao === "pendente" && <p>Este dia está fora do saldo até a conferência dos horários.</p>}
  </div>;
}

function ExtratoFuncionario({ linha, nomeObra, voltar }) {
  const [filtroDia, setFiltroDia] = useState("registros");
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const tituloRef = useRef(null);
  const detalheRef = useRef(null);
  const diasVisiveis = linha.dias.filter(d => filtroDia === "todos" || (filtroDia === "pendentes" ? d.situacao === "pendente" : d.temRegistro));
  const detalhe = linha.dias.find(d => d.data === diaSelecionado);
  useEffect(() => {
    tituloRef.current?.focus({ preventScroll: true });
    tituloRef.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  useEffect(() => {
    if (!diaSelecionado) return;
    detalheRef.current?.focus({ preventScroll: true });
    detalheRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [diaSelecionado]);
  return <section className="bh-extrato" aria-labelledby="bh-extrato-titulo">
    <div className="bh-section-heading"><div><h3 id="bh-extrato-titulo" ref={tituloRef} tabIndex={-1}>Extrato de {linha.nome}</h3>
      <p>Jornada diária: {minutosLegiveis(linha.jornadaMinutos)}{linha.fonteJornada === "empresa" ? " · padrão da empresa" : linha.fonteJornada ? " · cadastro do funcionário" : " · precisa ser cadastrada"}.</p></div>
      <Btn v="ghost" onClick={voltar}>Voltar para a equipe</Btn>
    </div>
    {linha.pendencias?.length > 0 && <ul className="bh-pendencias">{linha.pendencias.map(p => <li key={p.codigo}>{p.mensagem}</li>)}</ul>}
    <EvolucaoSaldo linha={linha} selecionarDia={setDiaSelecionado} />
    {detalhe && <DetalheDia dia={detalhe} nomeObra={nomeObra} tituloRef={detalheRef} />}
    <div className="bh-dias-heading"><h3>Dias do período</h3><label className="bh-campo"><span>Exibir dias</span><select value={filtroDia} onChange={e => setFiltroDia(e.target.value)}>
      <option value="registros">Com registros</option><option value="pendentes">A conferir</option><option value="todos">Todos os dias</option>
    </select></label></div>
    <div className="bh-table-scroll" tabIndex={0} role="region" aria-label="Tabela de dias do banco de horas">
      <table className="bh-table"><caption>Extrato diário de {linha.nome}. Horários de Recife.</caption><thead><tr>
        <th scope="col">Dia</th><th scope="col">Horas apuradas</th><th scope="col">Jornada</th><th scope="col">Variação</th><th scope="col">Acumulado</th><th scope="col">Situação</th>
      </tr></thead><tbody>{diasVisiveis.map(d => <tr key={d.data} data-selected={d.data === diaSelecionado ? "true" : undefined}>
        <th scope="row"><button className="bh-text-button" type="button" aria-label={`Conferir dia ${diaLegivel(d.data)} de ${linha.nome}`} aria-pressed={d.data === diaSelecionado}
          onClick={() => setDiaSelecionado(atual => atual === d.data ? "" : d.data)}>{diaLegivel(d.data)}</button></th>
        <td>{minutosLegiveis(d.trabalhadosMinutos)}</td><td>{minutosLegiveis(d.previstosMinutos)}</td>
        <td data-tone={tomSaldo(d.saldoMinutos)}>{formatarSaldoMinutos(d.saldoMinutos)}</td><td>{formatarSaldoMinutos(d.acumuladoMinutos)}</td>
        <td>{d.situacao === "pendente" ? "A conferir · fora do saldo" : d.situacao === "sem_registro" ? "Sem registro · sem débito" : d.origem === "apropriacao" ? "Intervalos tratados" : "Pelas batidas"}{d.situacao === "considerado" && d.alertas.length > 0 ? " · com aviso" : ""}</td>
      </tr>)}</tbody></table>
    </div>
    {!diasVisiveis.length && <p className="bh-vazio">{filtroDia === "pendentes" ? "Nenhum dia pendente neste período." : "Nenhum dia com registros neste período. Selecione “Todos os dias” para conferir as datas."}</p>}
  </section>;
}

export default function BancoHorasView({ data, obraId, currentUser, dia }) {
  const [periodo, setPeriodo] = useState(() => periodoDoMes(dia));
  const [rascunho, setRascunho] = useState(periodo);
  const [erroPeriodo, setErroPeriodo] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const [abrangencia, setAbrangencia] = useState("obra");
  const recurso = usePontoRecurso({
    action: "ponto-banco-horas", payload: periodo, select: selecionarResposta,
    queryKey: `${periodo.de}:${periodo.ate}`, scopeKey: `${currentUser?.id || ""}:${currentUser?.role || ""}`,
  });
  const modelo = useMemo(() => recurso.success ? construirBancoHoras({
    employees: data?.employees || VAZIO, config: data?.config || {},
    marcacoes: recurso.data.marcacoes, apropriacoes: recurso.data.apropriacoes,
    ...periodo, cobertura: recurso.data.cobertura,
  }) : null, [data?.employees, data?.config, recurso.success, recurso.data, periodo]);
  const nomeObra = useMemo(() => new Map((data?.obras || []).map(o => [String(o.id), o.name])), [data?.obras]);
  const equipe = useMemo(() => (modelo?.linhas || VAZIO).filter(l => abrangencia === "todos" || l.lotacaoObraId === String(obraId) || l.obrasIds.includes(String(obraId))), [modelo, abrangencia, obraId]);
  const selecionado = equipe.find(l => l.employeeId === funcionarioId);
  const linhasVisiveis = useMemo(() => {
    if (selecionado) return [selecionado];
    const termo = textoBusca(busca.trim());
    return equipe.filter(l => (!termo || textoBusca(`${l.nome} ${l.funcao}`).includes(termo))
      && (situacao === "todos" || (situacao === "credito" && l.saldoMinutos > 0) || (situacao === "debito" && l.saldoMinutos < 0)
        || (situacao === "pendentes" && (l.diasPendentes > 0 || l.pendencias.length > 0))));
  }, [equipe, selecionado, busca, situacao]);
  const resumo = useMemo(() => resumirLinhasBancoHoras(linhasVisiveis), [linhasVisiveis]);
  const emConsulta = recurso.loading || recurso.refreshing;
  const mudouRascunho = periodo.de !== rascunho.de || periodo.ate !== rascunho.ate;

  useEffect(() => { setFuncionarioId(""); setBusca(""); setSituacao("todos"); }, [obraId, abrangencia]);
  useEffect(() => {
    if (recurso.success && funcionarioId && !equipe.some(l => l.employeeId === funcionarioId)) setFuncionarioId("");
  }, [equipe, funcionarioId, recurso.success]);

  const trocarPeriodo = proximo => { setPeriodo(proximo); setRascunho(proximo); setErroPeriodo(""); };
  const consultar = evento => {
    evento.preventDefault();
    const validacao = validarPeriodoBancoHoras(rascunho.de, rascunho.ate);
    if (!validacao.ok) { setErroPeriodo(validacao.erro); return; }
    setErroPeriodo("");
    if (!mudouRascunho) recurso.refresh();
    else setPeriodo({ de: validacao.de, ate: validacao.ate });
  };
  const selecionarFuncionario = id => { setFuncionarioId(id); setBusca(""); setSituacao("todos"); };

  return <section className="bh-page" aria-labelledby="bh-titulo">
    <div className="bh-section-heading"><div><h2 id="bh-titulo">Banco de horas</h2><p>Explore o saldo estimado por funcionário e confira a composição de cada dia.</p></div>
      <span className="bh-periodo-atual">{diaLegivel(periodo.de)} a {diaLegivel(periodo.ate)}</span>
    </div>
    <form className="bh-periodo" onSubmit={consultar}>
      <label className="bh-campo"><span>Início do período</span><input type="date" value={rascunho.de} onChange={e => setRascunho(p => ({ ...p, de: e.target.value }))} required aria-invalid={Boolean(erroPeriodo)} aria-describedby={erroPeriodo ? "bh-erro-periodo" : undefined} /></label>
      <label className="bh-campo"><span>Fim do período</span><input type="date" value={rascunho.ate} onChange={e => setRascunho(p => ({ ...p, ate: e.target.value }))} required aria-invalid={Boolean(erroPeriodo)} aria-describedby={erroPeriodo ? "bh-erro-periodo" : undefined} /></label>
      <button className="bh-primary" type="submit" disabled={emConsulta && !mudouRascunho}>{emConsulta && !mudouRascunho ? "Consultando…" : "Consultar período"}</button>
      <div className="bh-atalhos" aria-label="Navegação entre meses">
        <Btn v="ghost" onClick={() => trocarPeriodo(periodoDoMes(periodo.de, -1))}><Ic n="chevL" /> Mês anterior</Btn>
        <Btn v="ghost" onClick={() => trocarPeriodo(periodoDoMes(dataLocal(new Date().toISOString())))}>Mês atual</Btn>
        <Btn v="ghost" onClick={() => trocarPeriodo(periodoDoMes(periodo.de, 1))}>Próximo mês <Ic n="chevR" /></Btn>
      </div>
    </form>
    {erroPeriodo && <p id="bh-erro-periodo" className="bh-error" role="alert">{erroPeriodo}</p>}
    {mudouRascunho && <p className="bh-nota" role="status">Período em edição. Os resultados abaixo continuam de {diaLegivel(periodo.de)} a {diaLegivel(periodo.ate)} até consultar.</p>}
    <AjudaCalculo />
    {recurso.error && <div className="bh-error" role="alert"><strong>{recurso.success ? "A atualização não foi concluída." : "Não foi possível consultar o banco de horas."}</strong><p>{recurso.error}</p>
      {recurso.success && <p>Exibindo a última consulta concluída deste mesmo período.</p>}<Btn v="ghost" onClick={() => recurso.refresh()} loading={emConsulta ? "Tentando…" : false}>Tentar novamente</Btn>
    </div>}
    <div aria-busy={emConsulta} className="bh-resultados">
      {!recurso.success ? !recurso.error && <div className="bh-carregando" role="status"><p>Consultando registros e intervalos do período…</p><div /><div /><div /></div> : <>
        {!modelo.cobertura.completa && <p className="bh-error" role="alert">A cobertura da consulta está incompleta. O saldo ficará indisponível até receber todos os registros.</p>}
        {modelo.avisos.length > 0 && <ul className="bh-avisos">{modelo.avisos.map(a => <li key={a.codigo}>{a.mensagem}</li>)}</ul>}
        <div className="bh-filtros">
          <label className="bh-campo"><span>Equipe</span><select value={abrangencia} onChange={e => setAbrangencia(e.target.value)}>
            <option value="obra">Da obra {nomeObra.get(String(obraId)) || "selecionada"}</option><option value="todos">Todas as obras</option>
          </select></label>
          <label className="bh-campo bh-funcionario"><span>Funcionário</span><select value={selecionado ? funcionarioId : ""} onChange={e => selecionarFuncionario(e.target.value)}>
            <option value="">Todos da equipe ({equipe.length})</option>{equipe.map(l => <option key={l.employeeId} value={l.employeeId}>{l.nome}</option>)}
          </select></label>
          {!selecionado && <label className="bh-campo"><span>Situação do saldo</span><select value={situacao} onChange={e => setSituacao(e.target.value)}>
            <option value="todos">Todas</option><option value="credito">Saldo positivo</option><option value="debito">Saldo negativo</option><option value="pendentes">Com pendências</option>
          </select></label>}
        </div>
        <p className="bh-nota">{abrangencia === "obra" ? "Equipe atual e funcionários com registros nesta obra no período. " : "Funcionários de todas as obras. "}O saldo de cada pessoa inclui seus registros nas demais obras.</p>
        <TotaisBanco resumo={resumo} individual={Boolean(selecionado)} />
        <p className="bh-cobertura" role="status">{resumo.diasConsiderados} dia(s) considerado(s) · {resumo.diasPendentes} a conferir · {resumo.diasSemRegistro} sem registro, sem débito.
          {recurso.lastUpdated && <span> Consulta concluída em {new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_OBRA, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(recurso.lastUpdated))}.</span>}
        </p>
        {selecionado ? <ExtratoFuncionario key={`${selecionado.employeeId}:${periodo.de}:${periodo.ate}`} linha={selecionado} nomeObra={nomeObra} voltar={() => selecionarFuncionario("")} /> : <section className="bh-equipe" aria-labelledby="bh-equipe-titulo">
          <div className="bh-section-heading"><h3 id="bh-equipe-titulo">Saldo por funcionário</h3><label className="bh-campo bh-busca"><span>Buscar funcionário</span><input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou função" /></label></div>
          <div className="bh-table-scroll" tabIndex={0} role="region" aria-label="Tabela de saldo por funcionário">
            <table className="bh-table bh-table-equipe"><caption>Saldo estimado por funcionário de {diaLegivel(periodo.de)} a {diaLegivel(periodo.ate)}.</caption><thead><tr>
              <th scope="col">Funcionário</th><th scope="col">Jornada diária</th><th scope="col">Horas apuradas</th><th scope="col">Saldo estimado</th><th scope="col">Cobertura</th>
            </tr></thead><tbody>{linhasVisiveis.map(l => <tr key={l.employeeId}>
              <th scope="row"><button className="bh-text-button" type="button" onClick={() => selecionarFuncionario(l.employeeId)} aria-label={`Ver extrato de ${l.nome}`}>{l.nome}</button><span className="bh-funcao">{l.funcao}</span></th>
              <td data-label="Jornada diária">{minutosLegiveis(l.jornadaMinutos)}</td><td data-label="Horas apuradas">{l.diasConsiderados ? minutosLegiveis(l.trabalhadosMinutos) : "—"}</td>
              <td data-label="Saldo estimado" data-tone={tomSaldo(l.saldoMinutos)}>{formatarSaldoMinutos(l.saldoMinutos)}</td>
              <td data-label="Cobertura">{l.diasConsiderados} dia(s){l.diasPendentes > 0 ? ` · ${l.diasPendentes} a conferir` : ""}{!l.diasComRegistro ? " · sem registros" : ""}{!l.jornadaMinutos ? " · jornada não cadastrada" : ""}</td>
            </tr>)}</tbody></table>
          </div>
          {!linhasVisiveis.length && <p className="bh-vazio">{equipe.length ? "Nenhum funcionário corresponde aos filtros. Ajuste a busca ou a situação do saldo." : "Nenhum funcionário ou registro encontrado para esta obra no período. Confira a obra ou consulte todas as obras."}</p>}
          {linhasVisiveis.length > 0 && <p className="bh-nota">Selecione o nome para abrir a evolução e o extrato diário.</p>}
        </section>}
      </>}
    </div>
  </section>;
}
