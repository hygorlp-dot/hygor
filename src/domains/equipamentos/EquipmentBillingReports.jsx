import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronsUpDown, Info, RefreshCw, X } from "lucide-react";
import { Button } from "../../design-system/primitives/Button.jsx";
import { Checkbox } from "../../design-system/primitives/Checkbox.jsx";
import { Input } from "../../design-system/primitives/Input.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";
import { EmptyState, ErrorState } from "../../design-system/patterns/FeedbackState.jsx";
import {
  billingScopeLabel, buildBillingChips, buildBillingDashboard, buildBillingFilterOptions, buildWorkMemory,
  DEFAULT_BILLING_FILTERS, PENDING_TYPE, sortWorks, workResultBars,
} from "./billing-dashboard.js";
import BillingTrendChart, { TREND_SERIES } from "./BillingTrendChart.jsx";
import { formatMoney } from "./rental-operations.js";
import { physicalIdentityForRecord } from "./registry.js";
import "./billing-center.css";

const pct = value => (value == null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const signedMoney = value => `${value < 0 ? "−" : ""}${formatMoney(Math.abs(value))}`;
const VIEWS = [{ value: "geral", label: "Visão geral" }, { value: "obras", label: "Por obra" }, { value: "mapa", label: "Mapa da frota" }];
const WORK_COLUMNS = [
  { key: "nome", label: "Obra" }, { key: "equipamentos", label: "Equip.", num: true, sortable: false }, { key: "locacoes", label: "Locações", num: true },
  { key: "receita", label: "Receita líquida", num: true }, { key: "custo", label: "Repasses", num: true }, { key: "resultado", label: "Resultado", num: true },
  { key: "margem", label: "Margem", num: true }, { key: "pendencias", label: "Pendências", num: true },
];

// Variação contra a competência anterior: sinal + texto, nunca só cor.
function Delta({ pctValue, ppValue, label }) {
  if (pctValue == null && ppValue == null) return null;
  const value = ppValue ?? pctValue;
  const up = value >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  const text = ppValue != null
    ? `${up ? "+" : "−"}${Math.abs(ppValue).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
    : `${up ? "+" : "−"}${Math.abs(pctValue).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return <span className="bc-delta" data-direction={up ? "up" : "down"}><Icon size={12} aria-hidden="true" />{text} vs {label}</span>;
}

function Term({ label, value, note, help, tone, children }) {
  return (
    <div className="bc-term" data-tone={tone}>
      <dt title={help}>{label}{help && <Info size={12} aria-hidden="true" />}</dt>
      <dd>
        <strong className="bc-mono">{value}</strong>
        {note && <span className="bc-note">{note}</span>}
        {help && <span className="bc-sr-only">{help}</span>}
        {children}
      </dd>
    </div>
  );
}

// Central de cobranças (aba "Cobrança por obra"): CONTEXTO (competência e
// filtros) -> FECHAMENTO e ATENÇÃO -> RESULTADO (equação financeira) ->
// FATURAMENTO (ciclo de cobrança, fora do DRE) -> OPERAÇÃO -> comparações.
// Todo número vem de ./billing-dashboard.js; o componente só desenha. O PDF e
// a exportação continuam sendo gerados pelo dono da tela (EquipamentosView),
// sem mudança - o painel e o documento têm arquiteturas diferentes.
export default function EquipmentBillingReports({
  data, period, periodOptions, onPeriodChange, ownerName, hoje, formatDate, formatComposition,
  onPrintManagement, onPrintWork, onExportManagement, onExportWork, onEditRental, onDeleteRental, onAddRentalToWork,
}) {
  const [view, setView] = useState("geral");
  const [filters, setFilters] = useState(DEFAULT_BILLING_FILTERS);
  const [workSort, setWorkSort] = useState({ key: "receita", dir: "desc" });
  const [workId, setWorkId] = useState("");
  const [mapWorkId, setMapWorkId] = useState("");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const today = hoje || new Date().toISOString().slice(0, 10);

  const computed = useMemo(() => {
    try {
      const model = buildBillingDashboard(data || {}, { ym: period, hoje: today, filters, ownerName });
      return { model, options: buildBillingFilterOptions(model, data), failure: "" };
    } catch (failure) {
      console.error("Falha ao montar a central de cobranças:", failure);
      return { failure: "Não foi possível calcular os indicadores desta competência." };
    }
    // `attempt` força o recálculo em "Tentar novamente".
  }, [data, period, today, filters, ownerName, attempt]);

  useEffect(() => { setWorkId(""); }, [period]);

  const patch = next => setFilters(current => ({ ...current, ...next }));
  const clearFilters = () => setFilters(DEFAULT_BILLING_FILTERS);

  if (computed.failure) {
    return <section className="bc"><ErrorState title="Não foi possível calcular os indicadores desta competência." description="Nenhum valor foi exibido para não parecer resultado real. Nada foi alterado." action={<Button variant="secondary" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>} /></section>;
  }

  const { model, options } = computed;
  const scope = billingScopeLabel(model, options);
  const chips = buildBillingChips(filters, options);
  const { finance, operation, billing, split, previous } = model;
  const works = sortWorks(model.works, workSort);
  const memory = workId ? buildWorkMemory(model, workId) : null;
  const trendPoints = model.trend.filter(point => !point.semDados).map(point => ({ ...point, short: `${point.label.slice(0, 3)}/${point.ym.slice(2, 4)}` }));
  const bars = workResultBars(model);
  const goToPending = type => { patch({ pendencia: type }); setWorkId(""); setView("obras"); if (type === PENDING_TYPE.NEGATIVE) setWorkSort({ key: "resultado", dir: "asc" }); };
  const mapWorks = model.works;
  const mapWork = mapWorks.find(work => work.id === mapWorkId) || mapWorks[0] || null;

  const header = (
    <header className="bc-header">
      <div>
        <p className="bc-eyebrow">Financeiro · Ativos e locações</p>
        <h2>Central de cobranças</h2>
        <p className="bc-lead">Fechamento, cobrança, custos e resultado das locações por obra.</p>
      </div>
      <div className="bc-header__actions">
        <Button variant="secondary" size="sm" onClick={onExportManagement}>Exportar dados</Button>
        <Button variant="secondary" size="sm" onClick={onPrintManagement}>Relatório gerencial PDF</Button>
      </div>
    </header>
  );

  const filterBar = (
    <section className="bc-filters" aria-label="Filtros da central de cobranças">
      <div className="bc-filters__row">
        <Select label="Competência" value={period} onChange={event => onPeriodChange(event.target.value)} options={periodOptions.map(option => ({ value: option.v, label: option.l }))} />
        <Select label="Obra" value={filters.obraId} onChange={event => patch({ obraId: event.target.value })} options={options.obras} />
        <Select label="Propriedade" value={filters.propriedade} onChange={event => patch({ propriedade: event.target.value })} options={options.propriedade} />
        <Select label="Situação da cobrança" value={filters.situacao} onChange={event => patch({ situacao: event.target.value })} options={options.situacao} />
        <Input label="Buscar" type="search" value={filters.busca} placeholder="Obra, equipamento, proprietário ou fatura" onChange={event => patch({ busca: event.target.value })} />
      </div>
      <div className="bc-filters__row bc-filters__row--secondary">
        <Checkbox label="Somente com pendência" checked={filters.pendencia !== "none"} onChange={event => patch({ pendencia: event.target.checked ? "qualquer" : "none" })} />
        {chips.length > 0 && <div className="bc-chips" role="group" aria-label="Filtros ativos">
          {chips.map(chip => <button key={chip.id} type="button" className="bc-chip" aria-label={`Remover filtro ${chip.label}`}
            onClick={() => patch({ [chip.id]: DEFAULT_BILLING_FILTERS[chip.id] })}>{chip.label}<X size={12} aria-hidden="true" /></button>)}
          <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
        </div>}
      </div>
    </section>
  );

  const tabs = (
    <div className="bc-views" role="tablist" aria-label="Visões da central de cobranças">
      {VIEWS.map(item => <button key={item.value} type="button" role="tab" aria-selected={view === item.value} className="bc-view" onClick={() => { setView(item.value); setWorkId(""); }}>{item.label}</button>)}
    </div>
  );

  if (!model.hasMonthData) {
    return <section className="bc" aria-label="Central de cobranças">{header}{filterBar}
      <EmptyState title={`Nenhuma cobrança encontrada para ${model.label}.`} description="Não há locações com permanência registrada nesta competência. Escolha outra competência acima." />
    </section>;
  }

  const filteredEmpty = model.rows.length === 0;

  return (
    <section className="bc" aria-label="Central de cobranças">
      {header}
      {filterBar}
      {tabs}

      {filteredEmpty && <EmptyState title="Nenhum resultado para estes filtros." description={`Há ${model.allRows.length} locação(ões) em ${model.label} fora deste recorte.`} action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>} />}

      {!filteredEmpty && view === "geral" && <>
        {/* FECHAMENTO + ATENÇÃO */}
        <div className="bc-band">
          <section className="bc-closing" data-status={model.closing.status} aria-labelledby="bc-closing-title">
            <p className="bc-eyebrow">Fechamento · {model.label}</p>
            <h3 id="bc-closing-title">{model.closing.status === "pronto" ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}{model.closing.label}</h3>
            <p className="bc-note">{operation.locacoes} locações · {operation.obras} obras · {operation.equipamentos} equipamentos</p>
            <ul className="bc-checks">
              {model.closing.checks.map(check => <li key={check.label} data-ok={check.ok} data-kind={check.warning ? "warning" : "blocking"}>
                {check.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
                <span className="bc-sr-only">{check.ok ? "Concluído:" : "Atenção:"}</span>{check.label}
              </li>)}
            </ul>
            <p className="bc-fineprint">Conferência e fechamento formais da competência ainda não são registrados pelo sistema; este estado é calculado pelos lançamentos.</p>
          </section>

          <section className="bc-attention" aria-labelledby="bc-attention-title">
            <h3 id="bc-attention-title" className="bc-eyebrow">Atenção necessária</h3>
            {model.attention.length === 0
              ? <p className="bc-ok"><CheckCircle2 size={16} aria-hidden="true" /> Nenhuma pendência crítica nesta competência.</p>
              : <ul>{model.attention.map(item => <li key={item.type} data-tone={item.tone}>
                <span><AlertTriangle size={14} aria-hidden="true" />{item.label}{item.amount ? ` · ${formatMoney(item.amount)}` : ""}</span>
                <button type="button" className="bc-link" onClick={() => goToPending(item.type)} aria-label={`Ver: ${item.label}`}>Ver →</button>
              </li>)}</ul>}
          </section>
        </div>

        {/* RESULTADO FINANCEIRO (equação) */}
        <section className="bc-section" aria-labelledby="bc-result-title">
          <div className="bc-section__head"><h3 id="bc-result-title">Resultado financeiro</h3><span className="bc-note">{scope}</span></div>
          <dl className="bc-equation">
            <Term label="Receita contratual" value={formatMoney(finance.receitaContratual)} note="tarifas das locações no período" help="Soma das tarifas das locações nos dias da competência, antes dos descontos (mesma conta do DRE de equipamentos)." />
            <span className="bc-op" aria-hidden="true">−</span>
            <Term label="Descontos" value={formatMoney(finance.descontos)} note={`${finance.descontosQtd} locação(ões) · ${pct(finance.descontosPct)} da contratual`} help="Descontos percentuais e fixos dos contratos, aplicados na competência." />
            <span className="bc-op" aria-hidden="true">=</span>
            <Term label="Receita líquida" value={formatMoney(finance.receitaLiquida)} note="o que a locação gera de receita" help="Receita contratual menos descontos. É a receita de locação reconhecida hoje no DRE.">
              {previous && <Delta pctValue={previous.receitaLiquida.variacaoPct} label={previous.label.split(" ")[0]} />}
            </Term>
            <span className="bc-op" aria-hidden="true">−</span>
            <Term label="Custo total" value={formatMoney(finance.custo)} note={finance.manutencaoApropriada ? "repasses + manutenção" : "só repasses (manutenção não é apropriada por obra)"} help="Repasses aos proprietários de equipamentos de terceiros, mais manutenção paga pela empresa quando o recorte permite apropriá-la." />
            <span className="bc-op" aria-hidden="true">=</span>
            <Term label="Resultado" value={signedMoney(finance.resultado)} tone={finance.resultado < 0 ? "negative" : "neutral"} note={finance.resultado < 0 ? "Resultado negativo no período" : "receita líquida − custo"} help="Receita líquida menos custo total. Não é caixa: não depende de fatura nem de recebimento.">
              {previous && previous.resultado.variacaoPct != null && <Delta pctValue={previous.resultado.variacaoPct} label={previous.label.split(" ")[0]} />}
            </Term>
            <Term label="Margem" value={pct(finance.margem)} tone={finance.margem != null && finance.margem < 0 ? "negative" : "neutral"} note="resultado ÷ receita líquida" />
          </dl>
          <div className="bc-breakdown">
            <div>
              <p className="bc-eyebrow">Composição do custo</p>
              <ul className="bc-list">
                <li><span>Repasses a terceiros</span><b className="bc-mono">{formatMoney(finance.repasses)}</b><small>{pct(finance.custo > 0 ? finance.repasses / finance.custo * 100 : null)}</small></li>
                <li><span>Manutenção (empresa)</span><b className="bc-mono">{finance.manutencaoApropriada ? formatMoney(finance.manutencao) : "não apropriada"}</b><small>{finance.manutencaoApropriada ? pct(finance.custo > 0 ? finance.manutencao / finance.custo * 100 : null) : "por obra"}</small></li>
              </ul>
            </div>
            <div>
              <p className="bc-eyebrow">Próprios × terceiros</p>
              <table className="bc-table bc-table--compact">
                <caption className="bc-sr-only">Comparação entre equipamentos próprios e de terceiros</caption>
                <thead><tr><th scope="col">Indicador</th><th scope="col" className="num">Próprios</th><th scope="col" className="num">Terceiros</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Receita líquida</th><td className="num bc-mono">{formatMoney(split.proprios.receitaLiquida)}</td><td className="num bc-mono">{formatMoney(split.terceiros.receitaLiquida)}</td></tr>
                  <tr><th scope="row">Custo</th><td className="num bc-mono">{formatMoney(split.proprios.custo)}</td><td className="num bc-mono">{formatMoney(split.terceiros.custo)}</td></tr>
                  <tr><th scope="row">Resultado</th>{["proprios", "terceiros"].map(key => <td key={key} className="num bc-mono" data-negative={split[key].resultado < 0}>{signedMoney(split[key].resultado)}</td>)}</tr>
                  <tr><th scope="row">Margem</th>{["proprios", "terceiros"].map(key => <td key={key} className="num bc-mono" data-negative={split[key].margem != null && split[key].margem < 0}>{pct(split[key].margem)}{split[key].margem != null && split[key].margem < 0 ? <span className="bc-flag"><AlertTriangle size={12} aria-hidden="true" /> margem negativa no período</span> : null}</td>)}</tr>
                  <tr><th scope="row">Participação na receita</th><td className="num bc-mono">{pct(split.proprios.participacao)}</td><td className="num bc-mono">{pct(split.terceiros.participacao)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FATURAMENTO: ciclo de cobrança, separado do resultado */}
        <section className="bc-section" aria-labelledby="bc-billing-title">
          <div className="bc-section__head"><h3 id="bc-billing-title">Faturamento da competência</h3><span className="bc-note">{scope}</span></div>
          <p className="bc-info"><Info size={14} aria-hidden="true" /> As faturas ainda não alimentam o DRE. Os valores abaixo representam o ciclo de cobrança, não a receita.</p>
          {billing.temDados
            ? <dl className="bc-terms">
              <Term label="Faturado" value={formatMoney(billing.faturado)} note={`${billing.faturas} fatura(s) da competência`} />
              <Term label="Recebido" value={formatMoney(billing.recebido)} note="recebimentos vinculados às faturas" />
              <Term label="Faturas em aberto" value={formatMoney(billing.emAberto)} note={`${billing.faturasEmAberto} fatura(s)`} />
              <Term label="Faturas vencidas" value={formatMoney(billing.vencido)} tone={billing.vencido > 0 ? "negative" : "neutral"} note={billing.faturasVencidas ? `${billing.faturasVencidas} fatura(s) após o vencimento` : "nenhuma"} />
              <Term label="Medido, sem fatura" value={formatMoney(billing.medidoSemFatura)} note={`${billing.linhasSemFatura} linha(s) de cobrança`} />
            </dl>
            : <p className="bc-note">Nenhuma fatura ou medição registrada para {model.label}.</p>}
        </section>

        {/* OPERAÇÃO */}
        <section className="bc-section" aria-labelledby="bc-ops-title">
          <div className="bc-section__head"><h3 id="bc-ops-title">Operação</h3><span className="bc-note">{scope}</span></div>
          <dl className="bc-terms bc-terms--ops">
            <Term label="Utilização da frota" value={pct(operation.utilizacao)} note={`${operation.unidadeDias.toLocaleString("pt-BR")} / ${operation.capacidade.toLocaleString("pt-BR")} diárias-unidade disponíveis`} help="Diárias-unidade usadas na competência divididas pelas diárias-unidade da frota ativa (unidades × dias da competência).">
              {previous?.utilizacao.diferencaPp != null && <Delta ppValue={previous.utilizacao.diferencaPp} label={previous.label.split(" ")[0]} />}
            </Term>
            <Term label="Equipamentos utilizados" value={String(operation.equipamentos)} note={`de ${operation.unidadesFrota} unidade(s) na frota`} />
            <Term label="Locações" value={String(operation.locacoes)} />
            <Term label="Obras" value={String(operation.obras)} />
          </dl>
        </section>

        {/* GRÁFICOS: tendência + resultado por obra */}
        <div className="bc-charts">
          <figure className="bc-section bc-chart" aria-labelledby="bc-trend-title">
            <figcaption><h3 id="bc-trend-title">Tendência · últimos 6 meses</h3><span className="bc-note">{scope.replace(model.label, "mesmo recorte")}</span></figcaption>
            {trendPoints.length < 2
              ? <p className="bc-note">Histórico insuficiente para tendência (é preciso ao menos duas competências com locações).</p>
              : <>
                <ul className="bc-legend" aria-hidden="true">{TREND_SERIES.map(series => <li key={series.key}><i style={{ background: series.color }} />{series.label}</li>)}</ul>
                <div className="bc-chart__plot" role="img" aria-label={`Receita líquida, custo e resultado de ${trendPoints[0].label} a ${trendPoints.at(-1).label}. Valores na tabela abaixo.`}>
                  <BillingTrendChart points={trendPoints} formatMoney={formatMoney} />
                </div>
                <details className="bc-chart__table">
                  <summary>Ver valores em tabela</summary>
                  <table className="bc-table bc-table--compact">
                    <caption className="bc-sr-only">Tendência mensal</caption>
                    <thead><tr><th scope="col">Competência</th>{TREND_SERIES.map(series => <th key={series.key} scope="col" className="num">{series.label}</th>)}</tr></thead>
                    <tbody>{model.trend.map(point => <tr key={point.ym}><th scope="row">{point.label}</th>{point.semDados ? <td colSpan={3} className="bc-note">sem locações</td> : TREND_SERIES.map(series => <td key={series.key} className="num bc-mono">{signedMoney(point[series.key])}</td>)}</tr>)}</tbody>
                  </table>
                </details>
              </>}
          </figure>

          <figure className="bc-section bc-chart" aria-labelledby="bc-bars-title">
            <figcaption><h3 id="bc-bars-title">Resultado por obra</h3><span className="bc-note">receita líquida − repasses</span></figcaption>
            <ol className="bc-bars">
              {bars.map(bar => <li key={bar.id} data-negative={bar.negative}>
                <button type="button" className="bc-bars__label bc-link" onClick={() => { setWorkId(bar.id); setView("obras"); }}>{bar.label}</button>
                <span className="bc-bars__track" aria-hidden="true"><span style={{ width: `${Math.max(2, bar.ratio * 100)}%` }} /></span>
                <b className="bc-mono">{signedMoney(bar.value)}{bar.negative ? " (negativo)" : ""}</b>
              </li>)}
            </ol>
          </figure>
        </div>

        {/* RESULTADO POR EQUIPAMENTO e REPASSES (preservados da tela anterior) */}
        <details className="bc-section bc-more">
          <summary>Resultado por equipamento e repasses aos proprietários</summary>
          <EquipmentTables model={model} data={data} ownerName={ownerName} />
        </details>
      </>}

      {!filteredEmpty && view === "obras" && !memory && <section className="bc-section" aria-labelledby="bc-works-title">
        <div className="bc-section__head"><h3 id="bc-works-title">Resultado por obra</h3><span className="bc-note">{scope} · custo = repasses (manutenção não é apropriada por obra)</span></div>
        <div className="bc-table-wrap">
          <table className="bc-table">
            <caption className="bc-sr-only">Ranking de obras da competência</caption>
            <thead><tr>{WORK_COLUMNS.map(column => {
              const active = workSort.key === column.key;
              const Icon = !active ? ChevronsUpDown : workSort.dir === "asc" ? ArrowUp : ArrowDown;
              return <th key={column.key} scope="col" className={column.num ? "num" : undefined} aria-sort={column.sortable === false ? undefined : active ? (workSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                {column.sortable === false ? column.label : <button type="button" className="bc-sort" aria-label={`Ordenar por ${column.label.toLowerCase()}`}
                  onClick={() => setWorkSort(current => (current.key === column.key ? { key: column.key, dir: current.dir === "asc" ? "desc" : "asc" } : { key: column.key, dir: column.key === "nome" ? "asc" : "desc" }))}>{column.label}<Icon size={12} aria-hidden="true" /></button>}
              </th>;
            })}</tr></thead>
            <tbody>{works.map(work => <tr key={work.id} data-negative={work.negativa}>
              <td><button type="button" className="bc-link bc-strong" onClick={() => setWorkId(work.id)} aria-label={`Abrir memória da obra ${work.nome}`}>{work.nome}</button>{work.codigo && <span className="bc-note bc-mono">{work.codigo}</span>}</td>
              <td className="num bc-mono">{work.equipamentos}</td>
              <td className="num bc-mono">{work.locacoes}</td>
              <td className="num bc-mono">{formatMoney(work.receita)}</td>
              <td className="num bc-mono">{formatMoney(work.custo)}</td>
              <td className="num bc-mono" data-negative={work.resultado < 0}>{signedMoney(work.resultado)}{work.resultado < 0 && <span className="bc-flag"><AlertTriangle size={12} aria-hidden="true" /> negativo</span>}</td>
              <td className="num bc-mono">{pct(work.margem)}</td>
              <td className="num">{work.pendencias ? <span className="bc-pill" data-tone="warning">{work.pendencias}</span> : <span className="bc-note">—</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}

      {!filteredEmpty && view === "obras" && memory && <WorkMemory memory={memory} model={model} formatDate={formatDate} formatComposition={formatComposition}
        onBack={() => setWorkId("")} onEditRental={onEditRental} onDeleteRental={onDeleteRental} onAddRentalToWork={onAddRentalToWork} onExportWork={onExportWork} onPrintWork={onPrintWork} />}

      {!filteredEmpty && view === "mapa" && <FleetMap works={mapWorks} work={mapWork} onSelect={setMapWorkId} query={equipmentQuery} onQuery={setEquipmentQuery} ownerName={ownerName} formatDate={formatDate} label={model.label} />}
    </section>
  );
}

function WorkMemory({ memory, model, formatDate, formatComposition, onBack, onEditRental, onDeleteRental, onAddRentalToWork, onExportWork, onPrintWork }) {
  const { work, finance, billing, rows, pendencias } = memory;
  return (
    <section className="bc-section bc-memory" aria-labelledby="bc-memory-title">
      <div className="bc-memory__head">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={14} aria-hidden="true" /> Voltar ao ranking</Button>
        <div className="bc-header__actions">
          <Button variant="secondary" size="sm" onClick={() => onAddRentalToWork?.(work.obra)}>Adicionar equipamento à obra</Button>
          <Button variant="secondary" size="sm" onClick={() => onExportWork(work.obra)}>Exportar memória da obra</Button>
          <Button variant="secondary" size="sm" onClick={() => onPrintWork(work.obra)}>PDF da obra</Button>
        </div>
      </div>
      <p className="bc-eyebrow">Memória da obra · {model.label}</p>
      <h3 id="bc-memory-title">{work.nome} {work.codigo && <span className="bc-mono bc-note">{work.codigo}</span>}</h3>
      <dl className="bc-terms">
        <Term label="Equipamentos" value={String(work.equipamentos)} note={`${work.locacoes} locação(ões) · ${work.unidadeDias} diárias-unidade`} />
        <Term label="Receita contratual" value={formatMoney(finance.receitaContratual)} />
        <Term label="Descontos" value={formatMoney(finance.descontos)} />
        <Term label="Receita líquida" value={formatMoney(finance.receitaLiquida)} />
        <Term label="Repasses" value={formatMoney(finance.repasses)} note="manutenção não é apropriada por obra" />
        <Term label="Resultado" value={signedMoney(finance.resultado)} tone={finance.resultado < 0 ? "negative" : "neutral"} note={`margem ${pct(finance.margem)}`} />
        <Term label="Faturas" value={formatMoney(billing.faturado)} note={billing.faturas ? `${billing.faturas} fatura(s) · em aberto ${formatMoney(billing.emAberto)}` : "nenhuma fatura (ciclo de cobrança fora do DRE)"} />
      </dl>
      <div className="bc-memory__pending">
        <p className="bc-eyebrow">Pendências</p>
        {pendencias.length === 0 ? <p className="bc-ok"><CheckCircle2 size={14} aria-hidden="true" /> Nenhuma pendência nesta obra.</p>
          : <ul>{pendencias.map((item, index) => <li key={`${item.type}-${item.locacaoId}-${index}`}><AlertTriangle size={14} aria-hidden="true" />{item.label}{item.equipamento ? ` · ${item.equipamento}` : ""}</li>)}</ul>}
      </div>
      <div className="bc-table-wrap">
        <table className="bc-table">
          <caption>Memória de cálculo · 1 mês tarifário = 30 dias; 31 dias = 1 mês + 1 diária</caption>
          <thead><tr><th scope="col">Equipamento</th><th scope="col">Período</th><th scope="col" className="num">Qtd.</th><th scope="col" className="num">Diárias-un.</th><th scope="col">Composição</th><th scope="col" className="num">Bruto</th><th scope="col" className="num">Desconto</th><th scope="col" className="num">Líquido</th><th scope="col" className="num">Repasse</th><th scope="col"><span className="bc-sr-only">Ações</span></th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <td><strong className="bc-strong">{row.equipamento.nome}</strong><span className="bc-note">{row.identity?.label}{row.observacao ? ` · ${row.observacao}` : ""}</span></td>
            <td className="bc-mono">{formatDate(row.inicio)} a {formatDate(row.fim)}<span className="bc-note">{row.status === "em_andamento" ? "Em andamento" : "Encerrada"}{row.tarifaNegociada ? " · tarifa negociada" : ""}</span></td>
            <td className="num bc-mono">{row.quantidade}</td>
            <td className="num bc-mono">{row.unidadeDias}</td>
            <td>{row.semTarifa ? <span className="bc-flag"><AlertTriangle size={12} aria-hidden="true" /> Sem tarifa</span> : formatComposition(row.composicao)}</td>
            <td className="num bc-mono">{formatMoney(row.bruto)}</td>
            <td className="num bc-mono">{formatMoney(row.descontos)}{row.descontoElevado && <span className="bc-flag"><AlertTriangle size={12} aria-hidden="true" /> elevado ({pct(row.descontoEfetivoPct)})</span>}</td>
            <td className="num bc-mono">{formatMoney(row.receita)}</td>
            <td className="num bc-mono">{row.terceiro ? (row.custoDono > 0 ? formatMoney(row.custoDono) : <span className="bc-flag"><AlertTriangle size={12} aria-hidden="true" /> sem tarifa de custo</span>) : "—"}</td>
            <td className="bc-row-actions">
              <Button variant="ghost" size="sm" onClick={() => onEditRental?.(row.locacaoId)}>Editar</Button>
              <button type="button" className="bc-danger-link" onClick={() => onDeleteRental?.(row.locacaoId)} aria-label={`Excluir locação de ${row.equipamento.nome}`}>Excluir…</button>
            </td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={3}>Total da obra</th><td className="num bc-mono">{work.unidadeDias}</td><td /><td className="num bc-mono">{formatMoney(finance.receitaContratual)}</td><td className="num bc-mono">{formatMoney(finance.descontos)}</td><td className="num bc-mono">{formatMoney(finance.receitaLiquida)}</td><td className="num bc-mono">{formatMoney(finance.repasses)}</td><td /></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

function EquipmentTables({ model, data, ownerName }) {
  const equipmentRows = model.monthly.linhas.filter(line => line.receita > 0 || line.custo > 0 || line.diasTotais > 0).slice().sort((a, b) => b.receita - a.receita);
  const owners = new Map();
  model.rows.filter(row => row.terceiro).forEach(row => {
    const key = `${row.equipamento.proprietarioId}:${row.obra.id}`;
    const current = owners.get(key) || { key, owner: row.owner, obra: row.obraRotulo, equipments: new Set(), rentals: 0, unitDays: 0, amount: 0 };
    current.equipments.add(row.equipamento.id); current.rentals += 1; current.unitDays += Number(row.unidadeDias || 0); current.amount += Number(row.custoDono || 0);
    owners.set(key, current);
  });
  const ownerRows = [...owners.values()].sort((a, b) => a.owner.localeCompare(b.owner, "pt-BR") || a.obra.localeCompare(b.obra, "pt-BR"));
  return <>
    <div className="bc-table-wrap">
      <table className="bc-table">
        <caption>Resultado por equipamento (competência inteira, inclui manutenção)</caption>
        <thead><tr><th scope="col">Equipamento</th><th scope="col">Propriedade</th><th scope="col" className="num">Diárias-un.</th><th scope="col" className="num">Receita líquida</th><th scope="col" className="num">Descontos</th><th scope="col" className="num">Repasse</th><th scope="col" className="num">Manutenção</th><th scope="col" className="num">Resultado</th><th scope="col" className="num">Margem</th></tr></thead>
        <tbody>{equipmentRows.map(line => <tr key={line.equip.id}>
          <td><strong className="bc-strong">{line.equip.nome}</strong><span className="bc-note">{physicalIdentityForRecord(data, {}, line.equip).label}</span></td>
          <td>{line.proprio ? "ARCD (próprio)" : ownerName(line.equip.proprietarioId)}</td>
          <td className="num bc-mono">{line.unidadeDias}</td><td className="num bc-mono">{formatMoney(line.receita)}</td><td className="num bc-mono">{formatMoney(line.descontos)}</td>
          <td className="num bc-mono">{formatMoney(line.custoDono)}</td><td className="num bc-mono">{formatMoney(line.manut)}</td>
          <td className="num bc-mono" data-negative={line.lucro < 0}>{signedMoney(line.lucro)}</td><td className="num bc-mono">{pct(line.receita > 0 ? line.lucro / line.receita * 100 : null)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="bc-table-wrap">
      <table className="bc-table">
        <caption>Repasses aos proprietários por obra (tarifas de custo dos contratos)</caption>
        <thead><tr><th scope="col">Proprietário</th><th scope="col">Obra</th><th scope="col" className="num">Equip.</th><th scope="col" className="num">Locações</th><th scope="col" className="num">Diárias-un.</th><th scope="col" className="num">Valor a repassar</th></tr></thead>
        <tbody>{ownerRows.length ? ownerRows.map(row => <tr key={row.key}>
          <td>{row.owner}</td><td>{row.obra}</td><td className="num bc-mono">{row.equipments.size}</td><td className="num bc-mono">{row.rentals}</td><td className="num bc-mono">{row.unitDays}</td>
          <td className="num bc-mono">{row.amount > 0 ? formatMoney(row.amount) : <span className="bc-flag"><AlertTriangle size={12} aria-hidden="true" /> tarifa de custo ausente</span>}</td>
        </tr>) : <tr><td colSpan={6} className="bc-note">Nenhum equipamento de terceiros no recorte.</td></tr>}</tbody>
        {ownerRows.length > 0 && <tfoot><tr><th scope="row" colSpan={5}>Total a repassar</th><td className="num bc-mono">{formatMoney(ownerRows.reduce((total, row) => total + row.amount, 0))}</td></tr></tfoot>}
      </table>
    </div>
  </>;
}

// Mapa da frota (preservado): é geográfico de verdade (endereço da obra no mapa).
function FleetMap({ works, work, onSelect, query, onQuery, ownerName, formatDate, label }) {
  if (!work) return null;
  const address = work.obra.address || work.obra.endereco || "";
  const term = query.trim().toLocaleLowerCase("pt-BR");
  const grouped = new Map();
  work.rows.forEach(row => {
    const key = `${row.equipamento.id}:${row.identity?.label}`;
    const current = grouped.get(key) || { key, row, rentals: 0, quantity: 0, unitDays: 0, revenue: 0, starts: [], ends: [], inProgress: false };
    current.rentals += 1; current.quantity += Number(row.quantidade || 0); current.unitDays += Number(row.unidadeDias || 0); current.revenue += Number(row.receita || 0);
    if (row.inicio) current.starts.push(row.inicio); if (row.fim) current.ends.push(row.fim);
    current.inProgress = current.inProgress || row.status === "em_andamento";
    grouped.set(key, current);
  });
  const equipment = [...grouped.values()].filter(item => !term || [item.row.equipamento.nome, item.row.identity?.label, item.row.equipamento.patrimonio, item.row.equipamento.categoria]
    .some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(term)));
  return (
    <section className="bc-section bc-map" aria-labelledby="bc-map-title">
      <div className="bc-section__head"><h3 id="bc-map-title">Mapa da frota · {work.nome}</h3><span className="bc-note">posição pela obra vinculada à locação em {label}</span></div>
      <div className="bc-map__layout">
        <ul className="bc-map__works" aria-label="Obras com equipamentos">
          {works.map(item => <li key={item.id}><button type="button" aria-pressed={item.id === work.id} onClick={() => onSelect(item.id)}>
            <strong>{item.nome}</strong><span className="bc-note">{item.obra.address || item.obra.endereco || "Endereço não informado"}</span><b className="bc-mono">{item.equipamentos} equip.</b>
          </button></li>)}
        </ul>
        <div className="bc-map__frame">
          {address
            ? <><iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} title={`Mapa da obra ${work.nome}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <a className="bc-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Abrir rota até {work.nome}</a></>
            : <p className="bc-note">Endereço não cadastrado. Informe o endereço da obra para exibi-la no mapa.</p>}
        </div>
      </div>
      <Input label="Buscar equipamento neste local" type="search" value={query} placeholder="Nome, patrimônio ou categoria" onChange={event => onQuery(event.target.value)} />
      <div className="bc-table-wrap">
        <table className="bc-table">
          <caption className="bc-sr-only">Equipamentos em {work.nome}</caption>
          <thead><tr><th scope="col">Equipamento</th><th scope="col">Permanência</th><th scope="col" className="num">Quantidade</th><th scope="col" className="num">Diárias-un.</th><th scope="col">Propriedade</th></tr></thead>
          <tbody>{equipment.length ? equipment.map(item => {
            const first = item.starts.slice().sort()[0]; const last = item.ends.slice().sort().at(-1);
            return <tr key={item.key}>
              <td><strong className="bc-strong">{item.row.equipamento.nome}</strong><span className="bc-note">{item.row.identity?.label} · {item.row.equipamento.categoria || "Sem categoria"}</span></td>
              <td className="bc-mono">{first && last ? `${formatDate(first)} — ${formatDate(last)}` : "Período não informado"}<span className="bc-note">{item.inProgress ? "Em andamento" : "Movimentação encerrada"}</span></td>
              <td className="num bc-mono">{item.quantity}<span className="bc-note">{item.rentals} locação(ões)</span></td>
              <td className="num bc-mono">{item.unitDays}</td>
              <td>{item.row.terceiro ? ownerName(item.row.equipamento.proprietarioId) : "ARCD (próprio)"}</td>
            </tr>;
          }) : <tr><td colSpan={5} className="bc-note">Nenhum equipamento corresponde à busca.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  );
}

