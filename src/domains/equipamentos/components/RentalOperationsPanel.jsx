import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Banknote, ChevronLeft, ChevronRight, ChevronsUpDown, Gauge, Info, Plus, ReceiptText, RefreshCw, Search, SlidersHorizontal, Truck, X } from "lucide-react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { Input } from "../../../design-system/primitives/Input.jsx";
import { Select } from "../../../design-system/primitives/Select.jsx";
import { EmptyState, ErrorState } from "../../../design-system/patterns/FeedbackState.jsx";
import { SummaryCard } from "../../../design-system/patterns/SummaryCard.jsx";
import { rentalCycleNote, rentalRowActions, primaryRowAction } from "../rental-actions.js";
import {
  applyRentalFilters, billingNote, buildActiveFilterChips, buildFilterOptions, buildRentalResults, buildRentalRows, clearFilterChip,
  clearRentalView, computeRentalKpis, defaultRentalView, formatMoney, GROUP_OPTIONS, nextRentalSort, rentalPeriodText,
  rentalScopeLabel, rentalValueCell, SITUATION_SEGMENTS, vencimentoText,
} from "../rental-operations.js";
import {
  formatDate, monthOf, PERIOD_PRESET, periodSelectOptions, periodSelectValue, periodStateFromSelect, resolveRentalPeriod, shiftMonth,
} from "../rental-period.js";
import { RentalDetailDrawer } from "./RentalDetailDrawer.jsx";
import { AlertFlag, BillingPill, SituationPill } from "./RentalPills.jsx";
import { RentalRowMenu } from "./RentalRowMenu.jsx";
import "./rental-operations.css";

const PAGE_SIZE = 25;
const COLUMNS = [
  { key: "equipamento", label: "Equipamento", sort: "equipamento" },
  { key: "obra", label: "Obra", sort: "obra", className: "ro-col--obra" },
  { key: "periodo", label: "Período", className: "ro-col--periodo" },
  { key: "situacao", label: "Situação da locação", aria: "situação da locação", sort: "situacao" },
  { key: "valor", label: "Valor no período", aria: "valor", sort: "valor", className: "ro-num" },
  { key: "cobranca", label: "Situação da cobrança", aria: "situação da cobrança", sort: "cobranca" },
  { key: "proprietario", label: "Proprietário", className: "ro-col--owner" },
  { key: "acoes", label: "Ações", className: "ro-col--actions" },
];

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function SortHeader({ column, effectiveSort, onSort }) {
  const keys = column.key === "periodo" ? [{ key: "inicio", label: "Início" }, { key: "fim", label: "Fim" }] : column.sort ? [{ key: column.sort, label: column.label }] : [];
  const active = keys.find(item => item.key === effectiveSort.key);
  const ariaSort = active ? (effectiveSort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" className={column.className} aria-sort={keys.length ? ariaSort : undefined}>
      {keys.length === 0 && column.label}
      {column.key === "periodo" && <span className="ro-th-label">Período</span>}
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

// Período + duração + previsto + vencimento: aparece na coluna "Período" e,
// quando ela some por falta de largura, sob a obra - a informação nunca se perde.
function PeriodInfo({ row }) {
  return <>
    <span className="ro-mono">{rentalPeriodText(row)}</span>
    <span className="ro-sub">{row.cancelada ? "" : `${row.diasContrato} dia(s)`}{row.plannedEnd && row.emAberto ? ` · previsto ${formatDate(row.plannedEnd)}` : ""}</span>
    {row.vencimento && <AlertFlag>{vencimentoText(row.vencimento)}</AlertFlag>}
  </>;
}

// Aba "Locações": CONTEXTO -> INDICADORES -> SITUAÇÃO -> RESULTADOS.
// O componente guarda UM objeto de estado (`view`) e desenha o que o domínio
// devolve (rental-operations.js / rental-period.js / rental-actions.js): filtros,
// ordenação, agrupamento, valores, permissões e textos não são recalculados
// aqui. As ações em si (modais, comandos) continuam no dono da tela e chegam
// por `onAction` - este componente nunca grava nada.
export default function RentalOperationsPanel({
  data, user, hoje = localToday(), obraIdFixo = "", busy = false, loading = false, error = "", onRetry,
  onNovaLocacao, onAction,
}) {
  const [view, setView] = useState(() => defaultRentalView({ hoje, obraIdFixo }));
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuRowId, setMenuRowId] = useState("");
  const [detailId, setDetailId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const searchRef = useRef(null);
  const detailReturnRef = useRef(null);
  const ctx = { hoje, obraIdFixo };

  const computed = useMemo(() => {
    try {
      const periodo = resolveRentalPeriod(view.periodState, { hoje, rentals: data?.locacoesEquip || [] });
      const all = buildRentalRows(data || {}, { periodo, hoje }).filter(row => !obraIdFixo || row.obraId === obraIdFixo);
      return { periodo, all, context: applyRentalFilters(all, view.filters, periodo), options: buildFilterOptions(data || {}, all), failure: "" };
    } catch (failure) {
      console.error("Falha ao montar a central de locações:", failure);
      return { failure: "Não foi possível carregar as locações." };
    }
    // `attempt` força o recálculo quando o usuário pede "Tentar novamente".
  }, [data, view.periodState, view.filters, hoje, obraIdFixo, attempt]);

  // Toda mudança de recorte volta à primeira página; só a paginação a preserva.
  const change = patch => setView(current => ({ ...current, page: 0, ...patch }));
  const patchFilters = patch => setView(current => ({ ...current, page: 0, filters: { ...current.filters, ...patch } }));
  const retry = () => { setAttempt(value => value + 1); onRetry?.(); };
  const openDetail = id => {
    detailReturnRef.current = document.querySelector(`tr[data-row-id="${String(id).replace(/"/g, '\\"')}"] .ro-link`);
    setDetailId(id);
  };

  if (loading) {
    return <div className="ro" aria-busy="true"><div className="ro-skeleton" role="status" aria-label="Carregando locações"><span /><span /><span /><span /><span /></div></div>;
  }
  if (error || computed.failure) {
    return <div className="ro"><ErrorState title="Não foi possível carregar as locações." description={error || "Os dados das locações vieram incompletos. Nada foi alterado."} action={<Button variant="secondary" onClick={retry}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>} /></div>;
  }
  if (!(data?.locacoesEquip || []).length) {
    return <div className="ro"><EmptyState title="Nenhuma locação cadastrada." description="Escolha um equipamento e uma obra para iniciar o controle de ocupação e cobrança." action={<Button onClick={onNovaLocacao}><Plus size={14} aria-hidden="true" /> Nova locação</Button>} /></div>;
  }

  const { periodo, all, context, options } = computed;
  const results = buildRentalResults(context, view, PAGE_SIZE);
  const kpis = computeRentalKpis(data, context, periodo, view.filters);
  const scope = rentalScopeLabel(view, { periodo, options });
  const chips = buildActiveFilterChips(view, { periodo, options, ...ctx });
  const secondaryActive = ["proprietario", "categoria"].filter(key => view.filters[key] !== "all").length;
  const segment = SITUATION_SEGMENTS.find(item => item.value === view.situation);
  const detailRow = all.find(row => row.id === detailId) || null;
  const clearAll = () => { setView(current => clearRentalView(current, ctx)); setMoreOpen(false); };
  const act = (action, row) => onAction?.(action, row, { competence: periodo.mensal ? periodo.ym : monthOf(periodo.fim) });

  const renderRow = row => {
    const actions = rentalRowActions(row, user);
    const primary = row.situacao === "em_andamento" ? primaryRowAction(actions) : null;
    const value = rentalValueCell(row);
    const cycleNote = rentalCycleNote(row, user);
    const billing = billingNote(row);
    return (
      <tr key={row.id} data-row-id={row.id} data-situation={row.situacao} onClick={() => openDetail(row.id)}>
        <td className="ro-cell-equip">
          <button type="button" className="ro-link" onClick={event => { event.stopPropagation(); openDetail(row.id); }} aria-label={`Abrir detalhes de ${row.equipamentoNome}`}>{row.equipamentoNome}</button>
          <span className="ro-sub ro-mono">{[row.equipamentoCodigo, row.quantidade > 1 ? `${row.quantidade} un.` : ""].filter(Boolean).join(" · ") || "sem patrimônio"}</span>
          <span className="ro-sub ro-inline-owner">{row.proprietarioNome}</span>
        </td>
        <td className="ro-col--obra">
          <strong className="ro-strong">{row.obraNome || row.obraRotulo}</strong>
          {row.obraCodigo && <span className="ro-sub ro-mono">{row.obraCodigo}</span>}
          <span className="ro-inline-period"><PeriodInfo row={row} /></span>
        </td>
        <td className="ro-col--periodo"><PeriodInfo row={row} /></td>
        <td>
          <SituationPill row={row} />
          {row.lifecycleLabel && <span className="ro-sub">Ciclo · {row.lifecycleLabel}</span>}
          {cycleNote && <span className="ro-sub">{cycleNote}</span>}
        </td>
        <td className="ro-num">
          {value.kind === "valor" && <strong className="ro-mono ro-strong">{formatMoney(value.amount)}</strong>}
          {value.kind === "sem_tarifa" && <AlertFlag>Sem tarifa</AlertFlag>}
          {(value.kind === "cancelada" || value.kind === "fora") && <span className="ro-sub">—</span>}
          {value.note && <span className="ro-sub">{value.note}</span>}
        </td>
        <td>
          <BillingPill cobranca={row.cobranca} />
          {billing && <span className="ro-sub ro-mono">{billing}</span>}
        </td>
        <td className="ro-col--owner">{row.proprietarioNome}</td>
        <td className="ro-col--actions" onClick={event => event.stopPropagation()}>
          <div className="ro-actions">
            {primary && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(primary, row)}>{primary.label}</Button>}
            <RentalRowMenu row={row} actions={actions} cycleNote={cycleNote} busy={busy} open={menuRowId === row.id}
              onOpenChange={open => setMenuRowId(open ? row.id : "")} onDetails={() => openDetail(row.id)} onAction={act} />
          </div>
        </td>
      </tr>
    );
  };

  const nothingInContext = context.length === 0;
  return (
    <div className="ro">
      {/* 1. CONTEXTO */}
      <section className="ro-context" aria-label="Contexto da consulta">
        <div className="ro-context__row">
          <div className="ro-period">
            {periodo.mensal && <Button variant="secondary" size="icon" aria-label="Mês anterior" onClick={() => change({ periodState: { preset: PERIOD_PRESET.MONTH, ym: shiftMonth(periodo.ym, -1) } })}><ChevronLeft size={16} aria-hidden="true" /></Button>}
            <Select label="Período" value={periodSelectValue(view.periodState, hoje)} onChange={event => change({ periodState: periodStateFromSelect(event.target.value, hoje, view.periodState) })} options={periodSelectOptions(view.periodState, hoje)} />
            {periodo.mensal && <Button variant="secondary" size="icon" aria-label="Próximo mês" onClick={() => change({ periodState: { preset: PERIOD_PRESET.MONTH, ym: shiftMonth(periodo.ym, 1) } })}><ChevronRight size={16} aria-hidden="true" /></Button>}
          </div>
          {view.periodState.preset === PERIOD_PRESET.CUSTOM && <>
            <Input label="De" type="date" value={periodo.inicio} max={periodo.fim} onChange={event => change({ periodState: { preset: PERIOD_PRESET.CUSTOM, inicio: event.target.value, fim: periodo.fim } })} />
            <Input label="Até" type="date" value={periodo.fim} min={periodo.inicio} onChange={event => change({ periodState: { preset: PERIOD_PRESET.CUSTOM, inicio: periodo.inicio, fim: event.target.value } })} />
          </>}
          <Select label="Obra" value={view.filters.obraId} disabled={Boolean(obraIdFixo)} onChange={event => patchFilters({ obraId: event.target.value })} options={obraIdFixo ? options.obras.filter(item => item.value === obraIdFixo) : options.obras} />
          <Select label="Cobrança" value={view.filters.cobranca} onChange={event => patchFilters({ cobranca: event.target.value })} options={options.cobranca} />
          <div className="ro-search">
            <Input ref={searchRef} label="Buscar" type="search" value={view.filters.busca} placeholder="Buscar equipamento, código, obra ou proprietário" onChange={event => patchFilters({ busca: event.target.value })} />
            {view.filters.busca && <button type="button" className="ro-search__clear" aria-label="Limpar busca" onClick={() => { patchFilters({ busca: "" }); searchRef.current?.focus(); }}><X size={14} aria-hidden="true" /></button>}
            {!view.filters.busca && <Search size={15} className="ro-search__icon" aria-hidden="true" />}
          </div>
          <Button variant="ghost" aria-expanded={moreOpen} aria-controls="ro-more-filters" onClick={() => setMoreOpen(value => !value)}>
            <SlidersHorizontal size={14} aria-hidden="true" /> Mais filtros{secondaryActive > 0 ? ` (${secondaryActive})` : ""}
          </Button>
        </div>
        {moreOpen && <div id="ro-more-filters" className="ro-context__row ro-context__row--more">
          <Select label="Proprietário" value={view.filters.proprietario} onChange={event => patchFilters({ proprietario: event.target.value })} options={options.proprietarios} />
          <Select label="Categoria" value={view.filters.categoria} onChange={event => patchFilters({ categoria: event.target.value })} options={options.categorias} />
        </div>}
        {chips.length > 0 && <div className="ro-chips" role="group" aria-label="Filtros ativos">
          {chips.map(chip => <button key={chip.id} type="button" className="ro-chip" onClick={() => setView(current => clearFilterChip(current, chip.id, ctx))} aria-label={`Remover filtro ${chip.label}`}>{chip.label}<X size={12} aria-hidden="true" /></button>)}
          <Button variant="link" onClick={clearAll}>Limpar filtros</Button>
        </div>}
      </section>

      {/* 2. INDICADORES - do recorte (período + filtros), em todas as situações */}
      <section className="ro-kpis" aria-label="Indicadores do recorte">
        <SummaryCard label="Equipamentos locados" icon={<Truck />} value={`${kpis.equipamentosLocados.unidadesNoPico} un.`}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">Pico de unidades simultâneas · {kpis.equipamentosLocados.equipamentos} equipamento(s) · {kpis.equipamentosLocados.locacoes} locação(ões)</div>
        </SummaryCard>
        <SummaryCard label="Taxa de ocupação" icon={<Gauge />} value={kpis.ocupacao.pct == null ? "—" : `${kpis.ocupacao.pct.toFixed(0)}%`}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">{kpis.ocupacao.unidadeDias} de {kpis.ocupacao.capacidade} unidades-dia da frota</div>
        </SummaryCard>
        <SummaryCard label={<span title="Calculada pela tarifa e pelos dias de cada locação dentro do período (a mesma conta dos relatórios de locação). Não depende de medição nem de fatura.">Receita contratual no período</span>}
          icon={<Banknote />} value={formatMoney(kpis.receita.valor)} detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">Conforme tarifas das locações · {plural(kpis.receita.locacoes, "locação", "locações")}</div>
        </SummaryCard>
        <SummaryCard label={<span title="Soma do saldo em aberto das faturas emitidas para as locações deste recorte. Vem das faturas, não do contrato, e ainda não alimenta o DRE.">Faturas a receber</span>}
          icon={<ReceiptText />} tone={kpis.aReceber.abertoCents > 0 ? "warning" : "neutral"} value={formatMoney(kpis.aReceber.abertoCents / 100)}
          detail={<span title={scope}>{scope}</span>}>
          <div className="ro-kpi-note">
            {kpis.aReceber.faturasComSaldo > 0 ? `${plural(kpis.aReceber.faturasComSaldo, "fatura pendente", "faturas pendentes")} · ${plural(kpis.aReceber.locacoesComSaldo, "locação", "locações")}` : "Nenhuma fatura com saldo"}
            {kpis.aReceber.aFaturarCents > 0 ? ` · ${formatMoney(kpis.aReceber.aFaturarCents / 100)} medidos, ainda sem fatura` : ""}
          </div>
          <div className="ro-kpi-note">Controle interno, ainda fora do DRE</div>
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

      {/* 3. NAVEGAÇÃO POR SITUAÇÃO DA LOCAÇÃO */}
      <div className="ro-nav">
        <div className="ro-segments" role="group" aria-label="Situação da locação">
          {SITUATION_SEGMENTS.map(item => (
            <button key={item.value} type="button" className="ro-segment" aria-pressed={view.situation === item.value}
              onClick={() => change({ situation: item.value, sort: null })}>
              {item.label} <b className="ro-mono">{results.counts[item.value]}</b>
            </button>
          ))}
        </div>
        <Select label="Agrupar por" value={view.groupBy} onChange={event => change({ groupBy: event.target.value })} options={GROUP_OPTIONS} />
      </div>

      {/* 4. RESULTADOS - só a situação selecionada; os indicadores acima cobrem todas */}
      <p className="ro-summary" role="status" aria-live="polite">
        <strong>{plural(results.summary.locacoes, "locação", "locações")}{segment?.noun ? ` ${segment.noun}` : ""}</strong>{" "}
        <span>{plural(results.summary.obras, "obra", "obras")}</span>{" "}
        <span className="ro-mono">{formatMoney(results.summary.valor)} no período</span>
      </p>

      {results.sorted.length === 0
        ? <EmptyState
            title="Nenhuma locação encontrada para estes filtros."
            description={nothingInContext ? "Ajuste o período ou limpe os filtros para ver outras locações." : `Há ${context.length} locação(ões) neste contexto em outras situações. Troque a aba acima ou limpe os filtros.`}
            action={<Button variant="secondary" onClick={clearAll}>Limpar filtros</Button>} />
        : <>
          <div className="ro-table-wrap">
            <table className="ro-table">
              <caption className="ro-sr-only">Locações de equipamentos</caption>
              <thead><tr>{COLUMNS.map(column => <SortHeader key={column.key} column={column} effectiveSort={results.effectiveSort} onSort={key => change({ sort: nextRentalSort(view.sort || results.effectiveSort, key) })} />)}</tr></thead>
              <tbody>{results.entries.map(entry => entry.type === "group"
                ? <tr key={`group-${entry.group.key}`} className="ro-group-row">
                  <th scope="rowgroup" colSpan={COLUMNS.length}>
                    <span className="ro-group-name">{entry.group.label}</span>{" "}
                    <span className="ro-mono">{plural(entry.group.count, "locação", "locações")} · {formatMoney(entry.group.valor)} no período</span>
                  </th>
                </tr>
                : renderRow(entry.row))}</tbody>
            </table>
          </div>
          <nav className="ro-pagination" aria-label="Paginação das locações">
            <span className="ro-mono">{results.page.from}–{results.page.to} de {results.page.total}</span>
            <Button size="sm" variant="secondary" disabled={results.page.page === 0} onClick={() => setView(current => ({ ...current, page: results.page.page - 1 }))}>Anterior</Button>
            <span className="ro-mono" aria-current="page">{results.page.page + 1}/{results.page.pageCount}</span>
            <Button size="sm" variant="secondary" disabled={results.page.page >= results.page.pageCount - 1} onClick={() => setView(current => ({ ...current, page: results.page.page + 1 }))}>Próxima</Button>
          </nav>
        </>}

      <RentalDetailDrawer row={detailRow} data={data} user={user} periodoLabel={periodo.label} busy={busy} returnFocusRef={detailReturnRef}
        onClose={() => setDetailId("")} onAction={act} />
    </div>
  );
}
