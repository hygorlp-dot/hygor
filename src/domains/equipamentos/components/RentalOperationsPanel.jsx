import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Banknote, ChevronLeft, ChevronRight, ChevronsUpDown, Gauge, Info, Plus, RefreshCw, Search, SlidersHorizontal, Truck, X } from "lucide-react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { Input } from "../../../design-system/primitives/Input.jsx";
import { Select } from "../../../design-system/primitives/Select.jsx";
import { EmptyState, ErrorState } from "../../../design-system/patterns/FeedbackState.jsx";
import { SummaryCard } from "../../../design-system/patterns/SummaryCard.jsx";
import {
  activeFilterCount, applyRentalFilters, buildFilterOptions, buildRentalRows, computeRentalKpis, countBySituation, DEFAULT_FILTERS,
  filterBySituation, formatDate, formatMoney, GROUP_OPTIONS, groupRentalRows, monthOf, paginate, periodSelectOptions,
  periodSelectValue, periodStateFromSelect, PERIOD_PRESET, primaryRowAction, rentalRowActions, resolveRentalPeriod,
  shiftMonth, sortRentalRows, summarizeRentalRows,
} from "../rental-operations.js";
import { RentalDetailDrawer } from "./RentalDetailDrawer.jsx";
import { AlertFlag, BillingPill, SituationPill } from "./RentalPills.jsx";
import { RentalRowMenu } from "./RentalRowMenu.jsx";
import "./rental-operations.css";

const PAGE_SIZE = 25;
const DEFAULT_SITUATION = "em_andamento";
const SEGMENTS = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "programada", label: "Programadas" },
  { value: "encerrada", label: "Encerradas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "todas", label: "Todas" },
];
const SITUATION_CHIP = Object.fromEntries(SEGMENTS.map(item => [item.value, item.label]));
const COLUMNS = [
  { key: "equipamento", label: "Equipamento", sort: "equipamento" },
  { key: "obra", label: "Obra", sort: "obra", className: "ro-col--obra" },
  { key: "periodo", label: "Período", className: "ro-col--periodo" },
  { key: "situacao", label: "Situação", sort: "situacao" },
  { key: "valor", label: "Valor no período", aria: "valor", sort: "valor", className: "ro-num" },
  { key: "cobranca", label: "Cobrança", sort: "cobranca" },
  { key: "proprietario", label: "Proprietário", className: "ro-col--owner" },
  { key: "acoes", label: "Ações", className: "ro-col--actions" },
];

const periodText = row => `${formatDate(row.inicio)} → ${row.cancelada ? "excluída" : row.fim ? formatDate(row.fim) : "em andamento"}`;

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function SortHeader({ column, effectiveSort, onSort }) {
  const keys = column.key === "periodo" ? [{ key: "inicio", label: "Início" }, { key: "fim", label: "Fim" }] : column.sort ? [{ key: column.sort, label: column.label }] : [];
  const active = keys.find(item => item.key === effectiveSort.key);
  const ariaSort = active ? (effectiveSort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" className={column.className} aria-sort={keys.length ? ariaSort : undefined}>
      {keys.length === 0 && column.label}
      {keys.length > 0 && column.key === "periodo" && <span className="ro-th-label">Período</span>}
      <span className="ro-th-actions">
        {keys.map(item => {
          const isActive = effectiveSort.key === item.key;
          const Icon = !isActive ? ChevronsUpDown : effectiveSort.dir === "asc" ? ArrowUp : ArrowDown;
          return (
            <button key={item.key} type="button" className="ro-sort" data-active={isActive} aria-label={`Ordenar por ${(column.aria || item.label).toLowerCase()}`} onClick={() => onSort(item.key)}>
              {item.label}<Icon size={12} aria-hidden="true" />
            </button>
          );
        })}
      </span>
    </th>
  );
}

// Aba "Locações": CONTEXTO (período, obra, filtros, busca) -> INDICADORES ->
// NAVEGAÇÃO (situação) -> RESULTADOS (tabela). Toda a lógica de recorte,
// ordenação e totais está em ../rental-operations.js; aqui só há estado de
// tela e apresentação. As ações em si (modais, comandos) continuam no dono
// da tela e chegam por `onAction` - este componente nunca grava nada.
export default function RentalOperationsPanel({
  data, user, hoje = localToday(), obraIdFixo = "", busy = false, loading = false, error = "", onRetry,
  onNovaLocacao, onAction,
}) {
  const [periodState, setPeriodState] = useState({ preset: PERIOD_PRESET.MONTH, ym: monthOf(hoje) });
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, obraId: obraIdFixo || "all" });
  const [situation, setSituation] = useState(DEFAULT_SITUATION);
  const [groupBy, setGroupBy] = useState("none");
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuRowId, setMenuRowId] = useState("");
  const [detailId, setDetailId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const searchRef = useRef(null);

  const computed = useMemo(() => {
    try {
      const periodo = resolveRentalPeriod(periodState, { hoje, rentals: data?.locacoesEquip || [] });
      const all = buildRentalRows(data || {}, { periodo, hoje }).filter(row => !obraIdFixo || row.obraId === obraIdFixo);
      const context = applyRentalFilters(all, filters, periodo);
      return { periodo, all, context, options: buildFilterOptions(data || {}, all), failure: "" };
    } catch (failure) {
      console.error("Falha ao montar a central de locações:", failure);
      return { failure: "Não foi possível carregar as locações." };
    }
    // `attempt` força o recálculo quando o usuário pede "Tentar novamente".
  }, [data, periodState, filters, hoje, obraIdFixo, attempt]);

  const resetPage = () => setPage(0);
  const patchFilters = patch => { setFilters(current => ({ ...current, ...patch })); resetPage(); };
  const retry = () => { setAttempt(value => value + 1); onRetry?.(); };

  if (loading) {
    return <div className="ro" aria-busy="true"><div className="ro-skeleton" role="status" aria-label="Carregando locações"><span /><span /><span /><span /><span /></div></div>;
  }
  if (error || computed.failure) {
    return <div className="ro"><ErrorState title="Não foi possível carregar as locações." description={error || "Os dados das locações vieram incompletos. Nada foi alterado."} action={<Button variant="secondary" onClick={retry}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>} /></div>;
  }

  const { periodo, all, context, options } = computed;
  if (!(data?.locacoesEquip || []).length) {
    return <div className="ro"><EmptyState title="Nenhuma locação cadastrada." description="Escolha um equipamento e uma obra para iniciar o controle de ocupação e cobrança." action={<Button onClick={onNovaLocacao}><Plus size={14} aria-hidden="true" /> Nova locação</Button>} /></div>;
  }

  const counts = countBySituation(context);
  const kpis = computeRentalKpis(data, context, periodo, filters);
  const visible = filterBySituation(context, situation);
  const effectiveSort = sort || (situation === "em_andamento" ? { key: "vencimento", dir: "asc" } : situation === "programada" ? { key: "inicio", dir: "asc" } : { key: "inicio", dir: "desc" });
  const sorted = sortRentalRows(visible, sort, situation);
  const summary = summarizeRentalRows(sorted);
  const groups = groupBy === "none" ? null : groupRentalRows(sorted, groupBy);
  // Agrupado, as linhas de um grupo precisam ficar contíguas (a ordem escolhida vale dentro de cada grupo).
  const paged = paginate(groups ? groups.flatMap(group => group.rows) : sorted, page, PAGE_SIZE);
  const groupTotals = new Map((groups || []).map(group => [group.key, group]));
  const groupOf = new Map();
  (groups || []).forEach(group => group.rows.forEach(row => groupOf.set(row.id, group.key)));
  const detailRow = all.find(row => row.id === detailId) || null;

  const obraOption = options.obras.find(item => item.value === filters.obraId);
  const scope = `${periodo.label} · ${filters.obraId === "all" ? "todas as obras" : obraOption?.label || "obra selecionada"}${activeFilterCount({ ...filters, obraId: "all" }) ? " · filtros ativos" : ""}`;
  const defaultPeriod = periodState.preset === PERIOD_PRESET.MONTH && periodState.ym === monthOf(hoje);
  const secondaryActive = ["proprietario", "categoria"].filter(key => filters[key] !== "all").length;

  const chips = [];
  if (!defaultPeriod) chips.push({ id: "periodo", label: periodo.label, clear: () => { setPeriodState({ preset: PERIOD_PRESET.MONTH, ym: monthOf(hoje) }); resetPage(); } });
  if (!obraIdFixo && filters.obraId !== "all") chips.push({ id: "obra", label: obraOption?.label || "Obra", clear: () => patchFilters({ obraId: "all" }) });
  if (filters.cobranca !== "all") chips.push({ id: "cobranca", label: `Cobrança: ${options.cobranca.find(item => item.value === filters.cobranca)?.label}`, clear: () => patchFilters({ cobranca: "all" }) });
  if (filters.proprietario !== "all") chips.push({ id: "proprietario", label: `Proprietário: ${options.proprietarios.find(item => item.value === filters.proprietario)?.label || "—"}`, clear: () => patchFilters({ proprietario: "all" }) });
  if (filters.categoria !== "all") chips.push({ id: "categoria", label: `Categoria: ${filters.categoria}`, clear: () => patchFilters({ categoria: "all" }) });
  if (filters.busca.trim()) chips.push({ id: "busca", label: `Busca: “${filters.busca.trim()}”`, clear: () => patchFilters({ busca: "" }) });
  if (situation !== DEFAULT_SITUATION) chips.push({ id: "situacao", label: SITUATION_CHIP[situation], clear: () => { setSituation(DEFAULT_SITUATION); resetPage(); } });
  const clearAll = () => {
    setPeriodState({ preset: PERIOD_PRESET.MONTH, ym: monthOf(hoje) });
    setFilters({ ...DEFAULT_FILTERS, obraId: obraIdFixo || "all" });
    setSituation(DEFAULT_SITUATION); setSort(null); setMoreOpen(false); resetPage();
  };

  const toggleSort = key => {
    setSort(current => {
      const base = current || effectiveSort;
      return base.key === key ? { key, dir: base.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "valor" || key === "inicio" || key === "fim" ? "desc" : "asc" };
    });
    resetPage();
  };

  const selectPeriod = value => { setPeriodState(current => periodStateFromSelect(value, hoje, current)); resetPage(); };
  const stepMonth = delta => { setPeriodState({ preset: PERIOD_PRESET.MONTH, ym: shiftMonth(periodo.ym, delta) }); resetPage(); };
  const act = (action, row) => onAction?.(action, row, { competence: periodo.mensal ? periodo.ym : monthOf(periodo.fim) });

  const renderRow = row => {
    const actions = rentalRowActions(row, user);
    const primary = row.situacao === "em_andamento" ? primaryRowAction(actions) : null;
    return (
      <tr key={row.id} data-row-id={row.id} data-situation={row.situacao} onClick={() => setDetailId(row.id)}>
        <td className="ro-cell-equip">
          <button type="button" className="ro-link" onClick={event => { event.stopPropagation(); setDetailId(row.id); }} aria-label={`Abrir detalhes de ${row.equipamentoNome}`}>{row.equipamentoNome}</button>
          <span className="ro-sub ro-mono">{[row.equipamentoCodigo, row.quantidade > 1 ? `${row.quantidade} un.` : ""].filter(Boolean).join(" · ") || "sem patrimônio"}</span>
          <span className="ro-sub ro-inline-owner">{row.proprietarioNome}</span>
        </td>
        <td className="ro-col--obra">
          <strong className="ro-strong">{row.obraNome || row.obraRotulo}</strong>
          {row.obraCodigo && <span className="ro-sub ro-mono">{row.obraCodigo}</span>}
          <span className="ro-sub ro-mono ro-inline-period">{periodText(row)}</span>
        </td>
        <td className="ro-col--periodo">
          <span className="ro-mono ro-nowrap">{periodText(row)}</span>
          <span className="ro-sub">{row.cancelada ? "" : `${row.diasContrato} dia(s)`}{row.plannedEnd && row.emAberto ? ` · previsto ${formatDate(row.plannedEnd)}` : ""}</span>
          {row.vencimento && <AlertFlag>{row.vencimento.tipo === "vencida" ? `Vencida há ${row.vencimento.dias} dia(s)` : row.vencimento.dias === 0 ? "Vence hoje" : `Vence em ${row.vencimento.dias} dia(s)`}</AlertFlag>}
        </td>
        <td>
          <SituationPill row={row} />
          {row.lifecycleLabel && <span className="ro-sub">Ciclo · {row.lifecycleLabel}</span>}
        </td>
        <td className="ro-num">
          {row.cancelada ? <span className="ro-sub">—</span> : row.semTarifa ? <AlertFlag>Sem tarifa</AlertFlag> : <strong className="ro-mono ro-strong">{formatMoney(row.valorPeriodo)}</strong>}
          {!row.cancelada && !row.semTarifa && <span className="ro-sub">{row.diasNoPeriodo} dia(s){row.composicao && !/^\d+ dias?$/.test(row.composicao) ? ` · ${row.composicao}` : ""}</span>}
        </td>
        <td>
          <BillingPill cobranca={row.cobranca} />
          {row.cobranca.abertoCents > 0 && <span className="ro-sub ro-mono ro-nowrap">saldo {formatMoney(row.cobranca.abertoCents / 100)}</span>}
          {row.cobranca.abertoCents === 0 && row.cobranca.aFaturarCents > 0 && <span className="ro-sub ro-mono ro-nowrap">medido {formatMoney(row.cobranca.aFaturarCents / 100)}</span>}
        </td>
        <td className="ro-col--owner">{row.proprietarioNome}</td>
        <td className="ro-col--actions" onClick={event => event.stopPropagation()}>
          <div className="ro-actions">
            {primary && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(primary, row)}>{primary.label}</Button>}
            <RentalRowMenu row={row} actions={actions} busy={busy} open={menuRowId === row.id}
              onOpenChange={open => setMenuRowId(open ? row.id : "")} onDetails={() => setDetailId(row.id)} onAction={act} />
          </div>
        </td>
      </tr>
    );
  };

  // Linhas da página; cada cabeçalho de grupo aparece quando o grupo muda.
  const body = [];
  let lastGroup = null;
  paged.items.forEach(row => {
    if (groups) {
      const key = groupOf.get(row.id);
      if (key !== lastGroup) {
        const group = groupTotals.get(key);
        body.push(
          <tr key={`group-${key}`} className="ro-group-row">
            <th scope="rowgroup" colSpan={COLUMNS.length}>
              <span className="ro-group-name">{group.label}</span>{" "}
              <span className="ro-mono">{group.count} locaç{group.count === 1 ? "ão" : "ões"} · {formatMoney(group.valor)} no período</span>
            </th>
          </tr>,
        );
        lastGroup = key;
      }
    }
    body.push(renderRow(row));
  });

  const nothingInContext = context.length === 0;
  return (
    <div className="ro">
      {/* 1. CONTEXTO */}
      <section className="ro-context" aria-label="Contexto da consulta">
        <div className="ro-context__row">
          <div className="ro-period">
            {periodo.mensal && <Button variant="secondary" size="icon" aria-label="Mês anterior" onClick={() => stepMonth(-1)}><ChevronLeft size={16} aria-hidden="true" /></Button>}
            <Select label="Período" value={periodSelectValue(periodState, hoje)} onChange={event => selectPeriod(event.target.value)} options={periodSelectOptions(periodState, hoje)} />
            {periodo.mensal && <Button variant="secondary" size="icon" aria-label="Próximo mês" onClick={() => stepMonth(1)}><ChevronRight size={16} aria-hidden="true" /></Button>}
          </div>
          {periodState.preset === PERIOD_PRESET.CUSTOM && <>
            <Input label="De" type="date" value={periodo.inicio} max={periodo.fim} onChange={event => { setPeriodState({ preset: PERIOD_PRESET.CUSTOM, inicio: event.target.value, fim: periodo.fim }); resetPage(); }} />
            <Input label="Até" type="date" value={periodo.fim} min={periodo.inicio} onChange={event => { setPeriodState({ preset: PERIOD_PRESET.CUSTOM, inicio: periodo.inicio, fim: event.target.value }); resetPage(); }} />
          </>}
          <Select label="Obra" value={filters.obraId} disabled={Boolean(obraIdFixo)} onChange={event => patchFilters({ obraId: event.target.value })} options={obraIdFixo ? options.obras.filter(item => item.value === obraIdFixo) : options.obras} />
          <Select label="Cobrança" value={filters.cobranca} onChange={event => patchFilters({ cobranca: event.target.value })} options={options.cobranca} />
          <div className="ro-search">
            <Input ref={searchRef} label="Buscar" type="search" value={filters.busca} placeholder="Buscar equipamento, código, obra ou proprietário" onChange={event => patchFilters({ busca: event.target.value })} />
            {filters.busca && <button type="button" className="ro-search__clear" aria-label="Limpar busca" onClick={() => { patchFilters({ busca: "" }); searchRef.current?.focus(); }}><X size={14} aria-hidden="true" /></button>}
            {!filters.busca && <Search size={15} className="ro-search__icon" aria-hidden="true" />}
          </div>
          <Button variant="ghost" aria-expanded={moreOpen} aria-controls="ro-more-filters" onClick={() => setMoreOpen(value => !value)}>
            <SlidersHorizontal size={14} aria-hidden="true" /> Mais filtros{secondaryActive > 0 ? ` (${secondaryActive})` : ""}
          </Button>
        </div>
        {moreOpen && <div id="ro-more-filters" className="ro-context__row ro-context__row--more">
          <Select label="Proprietário" value={filters.proprietario} onChange={event => patchFilters({ proprietario: event.target.value })} options={options.proprietarios} />
          <Select label="Categoria" value={filters.categoria} onChange={event => patchFilters({ categoria: event.target.value })} options={options.categorias} />
        </div>}
        {chips.length > 0 && <div className="ro-chips" aria-label="Filtros ativos">
          {chips.map(chip => <button key={chip.id} type="button" className="ro-chip" onClick={chip.clear} aria-label={`Remover filtro ${chip.label}`}>{chip.label}<X size={12} aria-hidden="true" /></button>)}
          <Button variant="link" onClick={clearAll}>Limpar filtros</Button>
        </div>}
      </section>

      {/* 2. INDICADORES */}
      <section className="ro-kpis" aria-label="Indicadores do período">
        <SummaryCard label="Equipamentos locados" icon={<Truck />} value={`${kpis.equipamentosLocados.unidadesNoPico} un.`}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">{kpis.equipamentosLocados.equipamentos} equipamento(s) · {kpis.equipamentosLocados.locacoes} locação(ões)</div>
        </SummaryCard>
        <SummaryCard label="Taxa de ocupação" icon={<Gauge />} value={kpis.ocupacao.pct == null ? "—" : `${kpis.ocupacao.pct.toFixed(0)}%`}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">{kpis.ocupacao.unidadeDias} de {kpis.ocupacao.capacidade} unidades-dia</div>
        </SummaryCard>
        <SummaryCard label="Receita no período" icon={<Banknote />} value={formatMoney(kpis.receita.valor)}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">{kpis.receita.locacoes} locação(ões) com cobrança no período</div>
        </SummaryCard>
        <SummaryCard label="A receber" icon={<Info />} tone={kpis.aReceber.abertoCents > 0 ? "warning" : "neutral"} value={formatMoney(kpis.aReceber.abertoCents / 100)}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">
            {kpis.aReceber.locacoesComSaldo} locação(ões) com saldo
            {kpis.aReceber.aFaturarCents > 0 ? ` · ${formatMoney(kpis.aReceber.aFaturarCents / 100)} medidos a faturar` : ""}
          </div>
        </SummaryCard>
        <p className="ro-kpis__free">
          {kpis.livres
            ? <>Livres no pico do período: <b className="ro-mono">{kpis.livres.unidades}</b> de <span className="ro-mono">{kpis.livres.total}</span> unidades da frota.</>
            : <>Equipamentos livres são calculados para períodos de até 3 meses.</>}
        </p>
      </section>

      {/* aviso discreto: não compete com as locações */}
      <details className="ro-notice">
        <summary><Info size={14} aria-hidden="true" /> Cobrança por ciclo ainda não está integrada ao DRE. <span className="ro-notice__more">Saiba mais</span></summary>
        <p>Linhas de cobrança, medições e faturas registradas nesta aba ainda não entram no DRE: a receita de locação reconhecida hoje vem do período e da tarifa do contrato. Use esses recursos como controle interno até a integração ser concluída.</p>
      </details>

      {/* 3. NAVEGAÇÃO OPERACIONAL */}
      <div className="ro-nav">
        <div className="ro-segments" role="group" aria-label="Situação da locação">
          {SEGMENTS.map(segment => (
            <button key={segment.value} type="button" className="ro-segment" aria-pressed={situation === segment.value}
              onClick={() => { setSituation(segment.value); setSort(null); resetPage(); }}>
              {segment.label} <b className="ro-mono">{counts[segment.value]}</b>
            </button>
          ))}
        </div>
        <Select label="Agrupar por" value={groupBy} onChange={event => { setGroupBy(event.target.value); resetPage(); }} options={GROUP_OPTIONS} />
      </div>

      {/* 4. RESULTADOS */}
      <p className="ro-summary" role="status" aria-live="polite">
        <strong>{summary.locacoes} locaç{summary.locacoes === 1 ? "ão" : "ões"}</strong>{" "}
        <span>{summary.obras} obra{summary.obras === 1 ? "" : "s"}</span>{" "}
        <span className="ro-mono">{formatMoney(summary.valor)} no período</span>
      </p>

      {sorted.length === 0
        ? <EmptyState
            title="Nenhuma locação encontrada para estes filtros."
            description={nothingInContext ? "Ajuste o período ou limpe os filtros para ver outras locações." : `Há ${context.length} locação(ões) neste contexto em outras situações. Troque a aba acima ou limpe os filtros.`}
            action={<Button variant="secondary" onClick={clearAll}>Limpar filtros</Button>} />
        : <>
          <div className="ro-table-wrap">
            <table className="ro-table">
              <caption className="ro-sr-only">Locações de equipamentos</caption>
              <thead><tr>{COLUMNS.map(column => <SortHeader key={column.key} column={column} effectiveSort={effectiveSort} onSort={toggleSort} />)}</tr></thead>
              <tbody>{body}</tbody>
            </table>
          </div>
          <nav className="ro-pagination" aria-label="Paginação das locações">
            <span className="ro-mono">{paged.from}–{paged.to} de {paged.total}</span>
            <Button size="sm" variant="secondary" disabled={paged.page === 0} onClick={() => setPage(paged.page - 1)}>Anterior</Button>
            <span className="ro-mono" aria-current="page">{paged.page + 1}/{paged.pageCount}</span>
            <Button size="sm" variant="secondary" disabled={paged.page >= paged.pageCount - 1} onClick={() => setPage(paged.page + 1)}>Próxima</Button>
          </nav>
        </>}

      <RentalDetailDrawer row={detailRow} data={data} user={user} periodoLabel={periodo.label} busy={busy}
        onClose={() => setDetailId("")} onAction={act} />
    </div>
  );
}
