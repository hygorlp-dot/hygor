import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Search } from "lucide-react";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { Select } from "../../../design-system/primitives/Select";
import { matchesPurchaseSearch } from "../workspace";
import { AGRUPAMENTOS_FILA, agruparFilaCompras, linhaAtrasada, resumoDaFila } from "../queue-groups";
import "./purchase-workspace.css";

export const PURCHASE_AREAS = [
  ["fila", "Fila de trabalho"], ["solicitacoes", "Solicitar"], ["cotacoes", "Cotar"],
  ["aprovacoes", "Aprovações"], ["pedidos", "Pedidos"], ["recebimentos", "Receber"],
];
export const PURCHASE_AREA_LABELS = { fila:"Fila de trabalho", aprovacoes:"Aprovações", recebimentos:"Recebimentos" };

export function PurchaseNavigation({ area, onNavigate, counts, financeCount, otherAreas }) {
  return <div className="purchase-navigation">
    <nav className="purchase-primary-nav" aria-label="Fluxo de compras">
      {[...PURCHASE_AREAS,["financeiro","Pagamentos"]].map(([id, label]) => <button key={id} type="button" aria-current={area === id ? "page" : undefined}
        onClick={() => onNavigate(id)}><span>{label}</span><b>{id === "financeiro" ? financeCount : id === "fila" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[id] || 0}</b></button>)}
    </nav>
    <nav className="purchase-secondary-nav" aria-label="Financeiro e consultas de compras">
      <span>Acompanhamento</span>
      <button type="button" aria-current={area === "historico_compras" ? "page" : undefined} onClick={() => onNavigate("historico_compras")}>Histórico de compras</button>
      <details className="purchase-tools" key={area}><summary>{otherAreas.find(([id]) => id === area)?.[1] ? `Consultas e cadastros · ${otherAreas.find(([id]) => id === area)[1]}` : "Consultas e cadastros"}</summary><div>
        {otherAreas.map(([id, label]) => <button key={id} type="button" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onNavigate(id); }} aria-current={area === id ? "page" : undefined}>{label}</button>)}
      </div></details>
    </nav>
  </div>;
}

const stageLabels = {solicitacoes:"Solicitação", cotacoes:"Cotação", aprovacoes:"Aprovação", pedidos:"Pedido", recebimentos:"Recebimento"};
const money = value => new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(value);
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Data não informada";

// `supplierName(id)` dá o nome do fornecedor; `supplierChargeLink(grupo)` devolve
// o link de cobrança das entregas atrasadas do grupo (ou null, sem telefone).
export function PurchaseWorkspace({ model, area, filters, onFiltersChange, onOpen, scope, afterMetrics = null,
  supplierName = id => id, supplierChargeLink = () => null, exportButton = null }) {
  const [page, setPage] = useState(0);
  const patch = next => { setPage(0); onFiltersChange({...filters, ...next}); };
  const source = model.rows.filter(row => area === "fila" || row.stage === area);
  const rows = source.filter(row => (area !== "fila" || !filters.stage || row.stage === filters.stage) &&
    (filters.risk !== "overdue" || row.deadline.tone === "danger") &&
    (filters.risk !== "attention" || ["danger", "warning"].includes(row.deadline.tone)) &&
    (filters.risk !== "soon" || row.deadline.tone === "warning") &&
    matchesPurchaseSearch(filters.query, row.code, row.obra, row.title, row.responsible, row.detail, stageLabels[row.stage]));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  const filtered = Boolean(filters.query || (area === "fila" && filters.stage) || filters.risk);
  // Limpar filtros não desfaz o agrupamento: é um modo de ver, não um filtro.
  const clear = () => {setPage(0); onFiltersChange({query:"", stage:"", risk:"", group:filters.group || ""});};
  const groups = agruparFilaCompras(rows, filters.group, supplierName);
  const totals = resumoDaFila(source);
  const moneyHint = value => value > 0 ? ` · ${money(value)}` : "";
  const renderRow = row => <tr key={`${row.type}-${row.id}`}>
          <td data-label="Registro / obra"><b>{row.code}</b><span>{row.obra}</span><small>{stageLabels[row.stage]}</small></td>
          <td data-label="Material e situação"><strong className="purchase-row-title">{row.title}</strong><span>{row.detail}</span>{row.total != null && <small className="purchase-money">{money(row.total)}</small>}</td>
          <td data-label="Prazo"><span className="purchase-deadline" data-tone={row.deadline.tone}>{row.deadline.label}</span><small>{dateLabel(row.date)}</small></td>
          <td data-label="Contato / solicitante"><span>{row.responsible}</span></td>
          <td data-label="Próxima ação"><Button variant="secondary" size="sm" onClick={() => onOpen(row)} aria-label={`${row.action} · ${row.code}`}>{row.action}<ArrowRight size={14} aria-hidden="true"/></Button></td>
        </tr>;
  return <section className="purchase-workspace" aria-label={PURCHASE_AREA_LABELS[area]}>
    <div className="purchase-queue-intro"><div>
      <h3>{area === "aprovacoes" ? "Decisões antes da compra" : area === "recebimentos" ? "O que precisa chegar à obra" : "O que precisa da sua atenção"}</h3>
      <p className="purchase-scope">{scope}</p><p>{area === "aprovacoes" ? "Consulte o bloqueio e os aprovadores. Somente pessoas elegíveis podem registrar uma decisão."
        : area === "recebimentos" ? "Confira a chegada real dos materiais. Recebimento e pagamento são acompanhados separadamente."
          : "Priorize por prazo e abra a próxima ação. Os filtros permanecem ao voltar dos detalhes."}</p></div><ClipboardList size={26} aria-hidden="true"/></div>
    {area === "fila" && <div className="purchase-queue-metrics" aria-label="Prioridades da fila">
      <button type="button" aria-pressed={!filters.risk && !filters.stage} onClick={() => patch({risk:"",stage:""})}><span>Em andamento</span><strong>{source.length}</strong><small>Solicitações, cotações e entregas{moneyHint(totals.valor)}</small></button>
      <button type="button" data-tone={model.overdue>0?"danger":undefined} aria-pressed={filters.risk === "overdue"} onClick={() => patch({risk:"overdue",stage:""})}><span>Prazo vencido</span><strong>{model.overdue}</strong><small>Tratar o atraso com a obra{moneyHint(totals.valorAtrasado)}</small></button>
      <button type="button" data-tone={model.attention>0?"warning":undefined} aria-pressed={filters.risk === "soon"} onClick={() => patch({risk:"soon",stage:""})}><span>Atenção ao prazo</span><strong>{model.attention}</strong><small>Vence hoje ou nos próximos 3 dias{moneyHint(source.filter(row => row.deadline.tone === "warning").reduce((sum, row) => sum + Number(row.total || 0), 0))}</small></button>
      <button type="button" aria-pressed={filters.stage === "aprovacoes"} onClick={() => patch({stage:"aprovacoes",risk:""})}><span>Em aprovação</span><strong>{model.counts.aprovacoes}</strong><small>Decisão ou configuração pendente</small></button>
    </div>}
    {area === "fila" && afterMetrics}
    <div className="purchase-queue-panel">
      <div className="purchase-queue-filters">
        <Input label="Buscar na fila" name="purchase-search" autoComplete="off" value={filters.query} onChange={event => patch({query:event.target.value})} placeholder="Ex.: cimento Alameda…"/>
        {area === "fila" && <Select label="Etapa do fluxo" value={filters.stage} onChange={event => patch({stage:event.target.value})}
          options={[{value:"",label:"Todas as etapas"},...Object.entries(stageLabels).map(([value,label]) => ({value,label}))]}/>}
        <Select label="Prazo" value={filters.risk} onChange={event => patch({risk:event.target.value})}
          options={[{value:"",label:"Todos os prazos"},{value:"overdue",label:"Prazo vencido"},{value:"soon",label:"Hoje e próximos 3 dias"},{value:"attention",label:"Vencidos e próximos 3 dias"}]}/>
        <Select label="Agrupar por" value={filters.group || ""} onChange={event => patch({group:event.target.value})}
          options={[{value:"",label:"Sem agrupamento"},...Object.entries(AGRUPAMENTOS_FILA).map(([value,label]) => ({value,label}))]}/>
        {filtered && <Button variant="ghost" onClick={clear}>Limpar filtros</Button>}
      </div>
      <div className="purchase-order-count-row">
        <p className="purchase-result-count" role="status">{rows.length} registro(s){filtered ? ` de ${source.length}` : ""}{moneyHint(resumoDaFila(rows).valor)} · {groups.length ? `${groups.length} grupo(s), mais atrasados primeiro` : "prioridades por prazo"}</p>
        {exportButton?.(rows)}
      </div>
      {rows.length ? <div className="purchase-table-scroll" tabIndex={0} role="region" aria-label="Registros da fila de compras"><table className="purchase-queue-table">
        <caption className="purchase-sr-only">Compras em andamento com obra, prazo e próxima ação</caption>
        <thead><tr><th scope="col">Registro / obra</th><th scope="col">Material e situação</th><th scope="col">Prazo</th><th scope="col">Contato / solicitante</th><th scope="col">Próxima ação</th></tr></thead>
        {groups.length ? groups.map(group => {
          const charge = group.atrasados > 0 && filters.group === "fornecedor" ? supplierChargeLink(group) : null;
          return <tbody key={group.chave} className="purchase-group" data-group={group.rotulo}>
            <tr className="purchase-group-row"><th colSpan={5} scope="rowgroup"><div>
              <span><b>{group.rotulo}</b> · {group.quantidade} registro(s){moneyHint(group.valor)}
                {group.atrasados > 0 && <span className="purchase-group-late"> · {group.atrasados} atrasado(s){moneyHint(group.valorAtrasado)}</span>}</span>
              {charge && <a className="purchase-group-charge" href={charge} target="_blank" rel="noreferrer">
                Cobrar {group.linhas.filter(linhaAtrasada).length === 1 ? "a entrega atrasada" : `as ${group.linhas.filter(linhaAtrasada).length} entregas atrasadas`}</a>}
            </div></th></tr>
            {group.linhas.map(renderRow)}
          </tbody>;
        }) : <tbody>{rows.slice(currentPage * 20, currentPage * 20 + 20).map(renderRow)}</tbody>}
      </table></div> : <div className="purchase-empty">{filtered ? <Search size={28} aria-hidden="true"/> : <CheckCircle2 size={28} aria-hidden="true"/>}
        <h4>{filtered ? "Nenhum resultado para estes filtros" : "Nenhuma pendência nesta fila"}</h4>
        <p>{filtered ? "Tente outras palavras, altere o prazo ou limpe os filtros." : "Os registros desta obra aparecerão aqui conforme o fluxo avançar."}</p>
        {filtered && <Button variant="secondary" onClick={clear}>Mostrar todos os registros</Button>}</div>}
      {!groups.length && rows.length > 20 && <div className="purchase-pagination"><Button variant="secondary" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>Página {currentPage + 1} de {Math.ceil(rows.length / 20)}</span><Button variant="secondary" size="sm" disabled={(currentPage + 1) * 20 >= rows.length} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div>}
    </div>
  </section>;
}
