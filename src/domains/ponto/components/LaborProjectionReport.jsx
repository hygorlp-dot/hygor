import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ClipboardList, Download, FileText, RefreshCw, X } from "lucide-react";
import { Button } from "../../../components/ui/button.jsx";
import { Card } from "../../../components/ui/card.jsx";
import { Label } from "../../../components/ui/label.jsx";
import { Alert, AlertDescription } from "../../../components/ui/alert.jsx";
import {
  exportLaborProjectionExcel, exportLaborProjectionPdf, laborProjectionCanViewPeople, laborProjectionComponent, laborProjectionDate as date,
  laborProjectionFilterSummary, laborProjectionIssueMessage, laborProjectionMethodology, laborProjectionMode,
  laborProjectionMoney as money, laborProjectionPartition, laborProjectionPeople, laborProjectionPercent as percent,
  laborProjectionRateSource, laborProjectionSource, laborProjectionStatus, laborProjectionTimestamp,
} from "../../../reports/labor-projection.js";
import "./labor-projection-report.css";

const EMPTY_FILTERS = Object.freeze({ area: "all", obraId: "", employeeId: "", mode: "", role: "", onlyIssues: false });
const normalizeFilters = value => Object.fromEntries(Object.keys(EMPTY_FILTERS).map(key => [key, value?.[key] ?? EMPTY_FILTERS[key]]));
const array = value => Array.isArray(value) ? value : [];
const count = value => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("pt-BR") : "Não informado";
const optionValue = option => typeof option === "string" ? option : String(option.id ?? option.value ?? "");
const optionLabel = option => typeof option === "string" ? option : option.name || option.label || optionValue(option);
const sourceVersion = report => typeof report.sourceVersion === "string" ? report.sourceVersion : JSON.stringify(report.sourceVersion ?? "Não informada");
const messageText = message => typeof message === "string" ? message : message?.message || "";

function SelectField({ label, value, onChange, children, disabled = false }) {
  const id = useId();
  return <div className="lp-field"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>{children}</select></div>;
}

function ScrollTable({ label, children }) {
  return <div className="lp-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

function HistoryTable({ history, caption }) {
  return <ScrollTable label={caption}><table className="lp-table"><caption>{caption}</caption><thead><tr>
    <th scope="col">Intervalo</th><th scope="col">Previstos</th><th scope="col">Observados P/M/F</th><th scope="col">Pendentes</th><th scope="col">Afastamentos</th><th scope="col">Faltas registradas</th><th scope="col">Meios períodos</th><th scope="col">Cobertura</th>
  </tr></thead><tbody>{array(history?.intervals).map((interval, index) => <tr key={interval.key || index}>
    <th scope="row">{date(interval.startDate)} a {date(interval.endDate)}</th><td>{count(interval.expectedDays)}</td><td>{count(interval.observedDays)}</td><td>{count(interval.missingDays)}</td><td>{count(interval.excludedDays)}</td><td>{count(interval.absenceDays)}</td><td>{count(interval.halfDays)}</td><td>{percent(interval.coverage)}</td>
  </tr>)}</tbody></table></ScrollTable>;
}

function HistorySummary({ history }) {
  return <dl className="lp-history-summary">
    <div><dt>Cobertura observada</dt><dd>{percent(history?.coverage)}</dd></div>
    <div><dt>Dias elegíveis</dt><dd>{count(history?.eligibleDays)}</dd></div>
    <div><dt>Dias classificados</dt><dd>{count(history?.observedDays)}</dd></div>
    <div><dt>Dados pendentes</dt><dd>{count(history?.missingDays)}</dd></div>
    <div><dt>Afastamentos excluídos</dt><dd>{count(history?.excludedDays)}</dd></div>
    <div><dt>Intervalos com dados</dt><dd>{count(history?.representedIntervals)} de {array(history?.intervals).length || 3}</dd></div>
  </dl>;
}

function CostComposition({ totals, groups }) {
  const parts = [
    { id: "actual", label: "Já apurado", value: totals.actualCost },
    { id: "confirmed", label: "Futuro confirmado", value: totals.confirmedFutureCost },
    { id: "estimated", label: "Estimado", value: totals.estimatedCost },
    { id: "pending", label: "Pendências · provisório", value: totals.pendingCost },
  ];
  // Apenas escala visual: os valores monetários continuam os do snapshot.
  const scale = Math.max(1, ...groups.map(group => Number(group.projectedCost) || 0));
  return <div className="lp-charts"><figure className="lp-composition"><figcaption><h3>Composição do custo</h3><p>Cada parcela entra uma vez no custo esperado.</p></figcaption>
    <div className="lp-composition-bar" aria-hidden="true">{parts.filter(part => part.value > 0).map(part => <span key={part.id} data-part={part.id} style={{ flexGrow: part.value }} />)}</div>
    <dl className="lp-composition-legend">{parts.map(part => <div key={part.id} data-part={part.id}><dt><span aria-hidden="true" />{part.label}</dt><dd>{money(part.value)}</dd></div>)}</dl>
  </figure><figure className="lp-comparison"><figcaption><h3>Comparação por centro</h3><p>Custo esperado no recorte confirmado.</p></figcaption>
    <ul>{groups.map(group => <li key={group.id}><div><span>{group.name}</span><strong>{money(group.projectedCost)}</strong></div><div className="lp-comparison-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Number(group.projectedCost) || 0) / scale * 100}%` }} /></div></li>)}</ul>
  </figure></div>;
}

function GroupTable({ groups }) {
  return <ScrollTable label="Custos por obra e centro de trabalho"><table className="lp-table lp-groups"><caption>Valores por centro. Pessoas transferidas podem aparecer em mais de uma linha; o total da consulta conta IDs distintos.</caption><thead><tr>
    <th scope="col">Obra / centro</th><th scope="col">Equipe</th><th scope="col">Dias futuros</th><th scope="col">Taxa histórica</th><th scope="col">Apurado</th><th scope="col">Futuro confirmado</th><th scope="col">Estimado</th><th scope="col">Pendências</th><th scope="col">Custo esperado</th><th scope="col">Reserva integral</th><th scope="col">Cobertura</th>
  </tr></thead><tbody>{groups.map(group => <tr key={group.id}>
    <th scope="row">{group.name}<small>{({ work: "Obra", administrative: "Administrativo", unassigned: "Sem lotação definida" })[group.kind]}</small></th>
    <td>{count(group.employeeCount)}</td><td>{count(group.futureDays)}</td><td>{percent(group.rate?.value)}<small>{laborProjectionRateSource(group.rate?.source)}</small>{group.rate?.limitedClassification && <small>Classificação histórica limitada</small>}</td>
    <td className="lp-money">{money(group.actualCost)}</td><td className="lp-money">{money(group.confirmedFutureCost)}</td><td className="lp-money">{money(group.estimatedCost)}</td><td className="lp-money">{money(group.pendingCost)}</td><td className="lp-money lp-total">{money(group.projectedCost)}</td><td className="lp-money">{money(group.fullAttendanceReserve)}</td><td>{percent(group.history?.coverage)}<small>{group.partial ? "Dados parciais" : group.provisional ? "Estimativa provisória" : `${count(group.history?.observedDays)} dias observados`}</small></td>
  </tr>)}</tbody></table></ScrollTable>;
}

function CashSection({ cash = {} }) {
  return <section className="lp-section" aria-labelledby="lp-cash-title"><div className="lp-section-heading"><div><h3 id="lp-cash-title">Caixa e obrigações</h3><p>O líquido e o saldo aos funcionários seguem as obrigações do ciclo; tributos e repasses têm leitura própria.</p></div>{(cash.partial || !cash.available) && <span className="lp-status" data-tone="warning">Base de caixa incompleta</span>}</div>
    <dl className="lp-cash-values"><div><dt>Líquido previsto aos funcionários</dt><dd>{money(cash.projectedNet)}</dd>{cash.projectedNet == null && cash.knownNetAmount != null && <small>Subtotal conhecido: {money(cash.knownNetAmount)}</small>}</div><div><dt>Saldo a desembolsar aos funcionários</dt><dd>{money(cash.remainingToPay)}</dd>{cash.remainingToPay == null && cash.knownRemainingToPay != null && <small>Subtotal conhecido: {money(cash.knownRemainingToPay)}</small>}</div></dl>
    <dl className="lp-cash-details"><div><dt>Pagamentos vinculados</dt><dd>{money(cash.paidAmount)}</dd></div><div><dt>Obrigações existentes</dt><dd>{money(cash.existingObligations)}</dd></div><div><dt>Adiantamentos aplicados ao ciclo</dt><dd>{money(cash.advancesApplied)}</dd></div><div><dt>Retenção sindical prevista</dt><dd>{money(cash.unionWithheldAmount)}</dd></div><div><dt>Retenções a repassar</dt><dd>{money(cash.withheldTransfer)}</dd></div></dl>
    {(cash.partial || !cash.available) && <p className="lp-note">Parcelas sem base suficiente permanecem indisponíveis. Os subtotais conhecidos não completam a previsão de caixa.</p>}
    <p className="lp-note">Adiantamentos e pagamentos não reduzem o custo de competência. Retenções com obrigação de repasse permanecem separadas do líquido ao funcionário.</p>
    {array(cash.responsibilities).length > 0 && <ScrollTable label="Responsáveis pelo pagamento"><table className="lp-table"><caption>Responsabilidade pelo pagamento</caption><thead><tr><th scope="col">Responsável</th><th scope="col">Líquido previsto</th><th scope="col">Pago</th><th scope="col">Saldo</th><th scope="col">Base</th></tr></thead><tbody>{cash.responsibilities.map(item => <tr key={item.id}><th scope="row">{item.label}</th><td className="lp-money">{money(item.projectedNet)}</td><td className="lp-money">{money(item.paidAmount)}</td><td className="lp-money">{money(item.remainingToPay)}</td><td>{item.partial ? "Parcial" : "Obrigações informadas"}</td></tr>)}</tbody></table></ScrollTable>}
  </section>;
}

function MemoryDialog({ report, person, onClose }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  const groupNames = new Map(array(report.groups).map(group => [String(group.id), group.name]));
  return <dialog ref={ref} className="lp-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><div><h3 id={titleId}>{person ? `Memória de ${person.name}` : "Memória de cálculo"}</h3><p>{date(report.period.startDate)} a {date(report.period.endDate)} · consulta de {laborProjectionTimestamp(report)}</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar memória"><X aria-hidden="true" size={20} /></Button></header>
    <div className="lp-dialog-body">{person ? <>
      <p>{person.role || "Função não informada"} · {laborProjectionMode(person.mode)} · Custo esperado: <strong>{money(person.projectedCost)}</strong> · Reserva integral: <strong>{money(person.fullAttendanceReserve)}</strong>.</p>
      <div className="lp-rate-detail"><h4>Taxa usada na estimativa</h4><p><strong>{percent(person.rate?.value)}</strong> · {laborProjectionRateSource(person.rate?.source)} · {count(person.rate?.numerator)} faltas / {count(person.rate?.denominator)} dias classificados.</p><p>Cobertura da referência: {percent(person.rate?.coverage)}. {person.rate?.reason}</p>{person.rate?.limitedClassification && <p className="lp-warning-text">Histórico com classificação limitada. A estimativa é provisória e não gera desconto em folha.</p>}{person.rate?.halfDayProbability != null && <p>Probabilidade de meio período: {percent(person.rate.halfDayProbability)}. Meio período permanece separado da taxa de faltas.</p>}</div>
      <h4>Histórico da pessoa</h4><HistorySummary history={person.history} /><HistoryTable history={person.history} caption="Três intervalos históricos da pessoa" />
      <h4>Memória diária da quinzena</h4><p className="lp-note">Encargos já compõem a coluna “Remuneração e encargos”. O total do dia inclui os benefícios e é o mesmo informado pelo servidor.</p>
      <ScrollTable label="Memória diária da pessoa"><table className="lp-table"><caption>Datas e componentes sem duplicação de custos</caption><thead><tr><th scope="col">Dia / centro</th><th scope="col">Parcela / componente</th><th scope="col">Remuneração e encargos</th><th scope="col">Encargos incluídos</th><th scope="col">Benefícios</th><th scope="col">Custo</th><th scope="col">Reserva</th><th scope="col">Fonte e premissas</th></tr></thead><tbody>{array(person.days).map((day, index) => <tr key={`${day.date}:${day.groupId}:${index}`}><th scope="row">{date(day.date)}<small>{groupNames.get(String(day.groupId)) || "Sem lotação"}</small></th><td>{laborProjectionPartition(day.partition)}<small>{laborProjectionComponent(day.component)}</small><small>{laborProjectionStatus(day.status)} · {laborProjectionMode(day.mode)}</small></td><td className="lp-money">{money(day.laborCost)}</td><td className="lp-money">{money(day.chargesCost)}</td><td className="lp-money">{money(day.benefitCost)}</td><td className="lp-money lp-total">{money(day.totalCost)}</td><td className="lp-money">{money(day.reserveCost)}</td><td>{laborProjectionSource(day.source)}{[...array(day.assumptions), ...array(day.issues)].map((message, messageIndex) => <small key={messageIndex}>{messageText(message)}</small>)}</td></tr>)}</tbody></table></ScrollTable>
    </> : <><h4>Como interpretar a projeção</h4><ul className="lp-methodology">{laborProjectionMethodology(report).map(message => <li key={message}>{message}</li>)}</ul><HistorySummary history={report.history} /><HistoryTable history={report.history} caption="Janela histórica fixa da consulta" />{array(report.assumptions).length > 0 && <><h4>Premissas desta consulta</h4><ul>{report.assumptions.map((message, index) => <li key={index}>{messageText(message)}</li>)}</ul></>}<p className="lp-note">{laborProjectionCanViewPeople(report) ? "Abra uma pessoa na tabela para conferir seus componentes e a memória diária." : "Este perfil consulta dados agregados. Detalhes individuais permanecem restritos aos perfis autorizados."}</p></>}
      <dl className="lp-snapshot"><div><dt>Metodologia</dt><dd>{report.methodologyVersion}</dd></div><div><dt>Versão das fontes</dt><dd>{sourceVersion(report)}</dd></div><div><dt>Filtros confirmados</dt><dd>{laborProjectionFilterSummary(report)}</dd></div></dl>
    </div><footer><Button type="button" variant="outline" onClick={onClose}>Fechar</Button></footer>
  </dialog>;
}

export default function LaborProjectionReport({ requestReport, onOpenPending }) {
  const [report, setReport] = useState(null), [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [exporting, setExporting] = useState(""), [exportError, setExportError] = useState(""), [memory, setMemory] = useState(null);
  const request = useRef(0), pendingHeading = useRef(null), pendingSection = useRef(null);
  const load = useCallback(async filters => {
    const token = ++request.current;
    setLoading(true); setError(""); setExportError(""); setMemory(null);
    try {
      if (typeof requestReport !== "function") throw new Error("A consulta de projeção ainda não está disponível. Reabra o relatório.");
      const result = await requestReport({ ...normalizeFilters(filters) });
      if (token !== request.current) return;
      if (!result?.ok) {
        if ([401, 403].includes(Number(result?.status))) setReport(null);
        throw new Error(result?.error || "Não foi possível consultar a projeção. Tente novamente.");
      }
      const next = result.report;
      if (!next?.period?.key || !next.period.startDate || !next.period.endDate || !next.asOf || !next.generatedAt || !next.totals || !Array.isArray(next.groups) || !next.filters) throw new Error("O servidor não confirmou o período, os filtros e os totais da consulta. Tente atualizar novamente.");
      setReport(next); setDraft(normalizeFilters(next.filters));
    } catch (cause) { if (token === request.current) setError(cause?.message || "Não foi possível consultar a projeção."); }
    finally { if (token === request.current) setLoading(false); }
  }, [requestReport]);
  useEffect(() => { setReport(null); load(EMPTY_FILTERS); return () => { request.current += 1; }; }, [load]);

  const changed = report && JSON.stringify(normalizeFilters(draft)) !== JSON.stringify(normalizeFilters(report.filters));
  const options = report?.options || {}, totals = report?.totals || {}, groups = array(report?.groups), people = laborProjectionPeople(report);
  const canViewPeople = laborProjectionCanViewPeople(report), issues = [...array(report?.issues), ...array(report?.cash?.issues)];
  const limitedHistory = groups.some(group => group.rate?.limitedClassification) || people.some(person => person.rate?.limitedClassification);
  const patch = (key, value) => setDraft(current => ({ ...current, [key]: value, ...(key === "area" && value !== "works" && value !== "all" ? { obraId: "" } : {}) }));
  const pending = () => { pendingSection.current?.scrollIntoView?.({ block: "start", behavior: "auto" }); pendingHeading.current?.focus({ preventScroll: true }); };
  const exportSnapshot = async format => {
    if (!report || loading || exporting) return;
    setExportError(""); setExporting(format);
    try { if (format === "pdf") exportLaborProjectionPdf(report); else await exportLaborProjectionExcel(report); }
    catch (cause) { setExportError(cause?.message || "Não foi possível exportar a consulta. Tente novamente."); }
    finally { setExporting(""); }
  };

  return <section className="labor-projection" aria-labelledby="lp-title">
    <header className="lp-header"><div><h2 id="lp-title">Projeção de mão de obra</h2><p>Custos da quinzena ativa, histórico de frequência e recursos a reservar.</p>{report && <p className="lp-period"><strong>{date(report.period.startDate)} a {date(report.period.endDate)}</strong><span>{report.period.key}</span></p>}</div><div className="lp-actions"><Button type="button" onClick={() => load(draft)} disabled={loading}><RefreshCw size={17} aria-hidden="true" />{loading ? "Consultando…" : "Atualizar"}</Button><Button type="button" variant="outline" disabled={!report || loading || !!exporting} onClick={() => exportSnapshot("pdf")}><FileText size={17} aria-hidden="true" />PDF</Button><Button type="button" variant="outline" disabled={!report || loading || !!exporting} onClick={() => exportSnapshot("excel")}><Download size={17} aria-hidden="true" />{exporting === "excel" ? "Gerando Excel…" : "Excel"}</Button></div></header>

    {report && <dl className="lp-metadata"><div><dt>Corte dos dados</dt><dd>{date(report.asOf)}</dd></div><div><dt>Pagamento previsto</dt><dd>{date(report.period.paymentDate)}</dd></div><div><dt>Janela histórica</dt><dd>{date(report.history?.startDate)} a {date(report.history?.endDate)}</dd></div><div><dt>Consulta concluída</dt><dd>{laborProjectionTimestamp(report)}<small>{report.timeZone || "America/Bahia"}</small></dd></div></dl>}
    {error && <Alert variant="destructive"><AlertDescription><strong>{report ? "A atualização não foi concluída." : "Não foi possível consultar a projeção."}</strong><p>{error}</p>{report && <p>A última consulta confirmada permanece visível, com seu período e filtros originais.</p>}<Button type="button" variant="outline" disabled={loading} onClick={() => load(draft)}>Tentar novamente</Button></AlertDescription></Alert>}
    {exportError && <Alert variant="destructive"><AlertDescription>{exportError}</AlertDescription></Alert>}
    {report && <p className="lp-confirmed-filters">Filtros confirmados: <strong>{laborProjectionFilterSummary(report)}</strong></p>}
    {report && <div className="lp-summary" aria-busy={loading}>
        {totals.partial && <Alert variant="warning" role="status"><AlertDescription><strong>Subtotal parcial.</strong> Há parcelas sem base suficiente. {count(totals.unpricedDays)} dia(s) sem valor calculável; confira as pendências antes de definir a reserva.</AlertDescription></Alert>}
        {totals.provisional && !limitedHistory && <Alert variant="warning" role="status"><AlertDescription><strong>Estimativa provisória.</strong> Há parcelas com condição ou conferência pendente. Elas permanecem separadas do custo já apurado na composição e na memória de cálculo.</AlertDescription></Alert>}
        {limitedHistory && <Alert variant="warning" role="status"><AlertDescription><strong>Histórico com classificação limitada.</strong> A estimativa derivada dessa base é provisória. Use a reserva com presença integral como referência adicional; a projeção não gera descontos em folha.</AlertDescription></Alert>}
        <dl className="lp-kpis" aria-label="Resumo da projeção"><Card className="lp-kpi"><dt>{totals.partial ? "Subtotal parcial de custo" : "Custo esperado da quinzena"}{totals.partial && <small>Parcelas indisponíveis fora do subtotal</small>}</dt><dd data-metric="projectedCost">{money(totals.projectedCost)}</dd><dd className="lp-kpi-note">{count(totals.employeeCount)} pessoa(s) distinta(s) consideradas.</dd></Card><Card className="lp-kpi"><dt>Custo já apurado</dt><dd data-metric="actualCost">{money(totals.actualCost)}</dd><dd className="lp-kpi-note">Parcelas conhecidas, preservadas na projeção.</dd></Card><Card className="lp-kpi"><dt>Estimativa e pendências</dt><dd data-metric="estimatedCost">{money(totals.estimatedCost)}</dd><dd className="lp-kpi-note">Reserva provisória de pendências: <strong>{money(totals.pendingCost)}</strong><br />Futuro confirmado: <strong>{money(totals.confirmedFutureCost)}</strong></dd></Card><Card className="lp-kpi"><dt>Reserva com presença integral</dt><dd data-metric="fullAttendanceReserve">{money(totals.fullAttendanceReserve)}</dd><dd className="lp-kpi-note">Referência para dias ainda não apurados; não é teto absoluto.</dd></Card></dl>
    </div>}
    <form className="lp-filters" aria-label="Filtros da projeção" onSubmit={event => { event.preventDefault(); load(draft); }}><fieldset disabled={loading}><legend>Filtrar dentro da quinzena ativa</legend><div className="lp-filter-grid">
      <SelectField label="Área" value={draft.area} onChange={value => patch("area", value)}><option value="all">Todas as áreas</option><option value="works">Obras</option><option value="administrative">Administrativo</option><option value="unassigned">Sem lotação</option></SelectField>
      <SelectField label="Obra" value={draft.obraId} onChange={value => patch("obraId", value)} disabled={draft.area === "administrative" || draft.area === "unassigned"}><option value="">Todas as obras permitidas</option>{array(options.works).map(work => <option key={work.id} value={work.id}>{work.name}</option>)}</SelectField>
      <SelectField label="Remuneração" value={draft.mode} onChange={value => patch("mode", value)}><option value="">Todas as modalidades</option>{array(options.modes).map(mode => <option key={optionValue(mode)} value={optionValue(mode)}>{typeof mode === "string" ? laborProjectionMode(mode) : optionLabel(mode)}</option>)}</SelectField>
      <SelectField label="Função" value={draft.role} onChange={value => patch("role", value)}><option value="">Todas as funções</option>{array(options.roles).map(role => <option key={optionValue(role)} value={optionValue(role)}>{optionLabel(role)}</option>)}</SelectField>
      {canViewPeople && <SelectField label="Pessoa" value={draft.employeeId} onChange={value => patch("employeeId", value)}><option value="">Todas as pessoas permitidas</option>{array(options.employees).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</SelectField>}
    </div><div className="lp-filter-footer"><label className="lp-checkbox"><input type="checkbox" checked={draft.onlyIssues} onChange={event => patch("onlyIssues", event.target.checked)} /><span>Somente pendências</span></label><div><Button type="submit" variant="outline">Aplicar filtros</Button><Button type="button" variant="ghost" onClick={() => { setDraft({ ...EMPTY_FILTERS }); load(EMPTY_FILTERS); }}>Limpar filtros</Button></div></div></fieldset></form>
    {changed && <p className="lp-note lp-draft-notice" role="status">Filtros em edição. A tela e as exportações continuam usando a última consulta confirmada até aplicar os filtros.</p>}

    <div className="lp-results" aria-busy={loading}>
      {loading && <p className="lp-loading-message" role="status">{report ? "Atualizando o histórico e os valores da quinzena…" : "Consultando a quinzena ativa e reconstruindo o histórico…"}</p>}
      {!report && loading && <div className="lp-loading" aria-hidden="true"><div /><div /><div /><div /></div>}
      {report && <>

        <div className="lp-reading-actions"><p>{count(totals.futureDays)} dia(s) futuro(s) · {count(totals.pendingDays)} dia(s) a conferir.</p><div><Button type="button" variant="outline" onClick={() => setMemory({ type: "methodology" })}><ClipboardList size={17} aria-hidden="true" />Memória de cálculo</Button><Button type="button" variant="ghost" onClick={pending}>Conferir pendências</Button></div></div>
        {totals.employeeCount === 0 ? <div className="lp-empty" role="status"><h3>Nenhuma pessoa neste recorte</h3><p>Confira os filtros e as obras permitidas. A consulta continua limitada à quinzena ativa.</p><Button type="button" variant="outline" disabled={loading} onClick={() => { setDraft({ ...EMPTY_FILTERS }); load(EMPTY_FILTERS); }}>Consultar todas as áreas permitidas</Button></div> : <><CostComposition totals={totals} groups={groups} /><section className="lp-section" aria-labelledby="lp-groups-title"><h3 id="lp-groups-title">Obras e Administrativo</h3><p className="lp-note">A taxa por centro descreve o histórico ponderado. Cada pessoa usa sua referência individual, de grupo comparável ou a reserva sem taxa confiável.</p><GroupTable groups={groups} /></section></>}
        <section className="lp-section" aria-labelledby="lp-history-title"><h3 id="lp-history-title">Histórico e cobertura</h3><p>Três meses de calendário anteriores à abertura da quinzena. A janela permanece a mesma quando o ciclo atravessa o mês.</p><HistorySummary history={report.history} /><HistoryTable history={report.history} caption="Intervalos usados na referência histórica" /><p className="lp-note">P = presença; M = meio período; F = falta registrada. Férias, atestado e folga ficam fora da exposição ordinária. Dado ausente não é falta.</p></section>
        {canViewPeople ? <section className="lp-section" aria-labelledby="lp-people-title"><h3 id="lp-people-title">Pessoas consideradas</h3><p>Abra uma pessoa para conferir o histórico, os componentes e a memória diária.</p><ScrollTable label="Custos por pessoa autorizada"><table className="lp-table"><caption>Detalhe individual permitido neste perfil</caption><thead><tr><th scope="col">Pessoa / função</th><th scope="col">Modalidade</th><th scope="col">Referência histórica</th><th scope="col">Apurado</th><th scope="col">Estimado</th><th scope="col">Pendências</th><th scope="col">Custo esperado</th><th scope="col">Reserva integral</th></tr></thead><tbody>{people.map(person => <tr key={person.id}><th scope="row"><Button type="button" variant="link" className="lp-person-link" aria-label={`Ver memória de ${person.name}`} onClick={() => setMemory({ type: "person", id: person.id })}>{person.name}</Button><small>{person.role || "Função não informada"}</small></th><td>{laborProjectionMode(person.mode)}</td><td>{percent(person.rate?.value)}<small>{laborProjectionRateSource(person.rate?.source)}</small></td><td className="lp-money">{money(person.actualCost)}</td><td className="lp-money">{money(person.estimatedCost)}</td><td className="lp-money">{money(person.pendingCost)}</td><td className="lp-money lp-total">{money(person.projectedCost)}</td><td className="lp-money">{money(person.fullAttendanceReserve)}</td></tr>)}</tbody></table></ScrollTable></section> : <p className="lp-access-note">Este perfil consulta valores agregados. Pessoas e memória diária permanecem restritas na tela e nas exportações.</p>}
        <CashSection cash={report.cash} />
        <section className="lp-section" ref={pendingSection} aria-labelledby="lp-pending-title"><div className="lp-section-heading"><div><h3 id="lp-pending-title" ref={pendingHeading} tabIndex={-1}>Pendências e premissas</h3><p>Confira os limites da base antes de definir o valor a reservar.</p></div>{onOpenPending && <Button type="button" variant="outline" onClick={() => onOpenPending(report)}>Abrir conferência de ponto</Button>}</div>
          {issues.length ? <ul className="lp-issues">{issues.map((issue, index) => <li key={`${issue.code || "issue"}:${index}`}><strong>{laborProjectionIssueMessage(issue, report)}</strong>{issue.date && <small>{date(issue.date)}</small>}</li>)}</ul> : <p className="lp-note">Nenhuma pendência identificada nesta consulta.</p>}
          {array(report.assumptions).length > 0 && <details className="lp-assumptions"><summary>Premissas consideradas nesta consulta</summary><ul>{report.assumptions.map((message, index) => <li key={index}>{messageText(message)}</li>)}</ul></details>}
          <p className="lp-note">A consulta é uma simulação de leitura. Ela não lança ponto, não fecha folha e não cria pagamentos.</p>
        </section>
      </>}
    </div>
    {report && memory && <MemoryDialog report={report} person={memory.type === "person" && canViewPeople ? people.find(person => person.id === memory.id) : null} onClose={() => setMemory(null)} />}
  </section>;
}
