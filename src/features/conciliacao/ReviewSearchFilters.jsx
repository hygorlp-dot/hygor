import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { emptyReviewFilters } from "./review-search.js";

const labels = { work: "Obra", party: "Pessoa / fornecedor", start: "Data inicial", end: "Data final", min: "Saldo mínimo", max: "Saldo máximo", status: "Situação do vínculo" };
export default function ReviewSearchFilters({ data, available, filters, onChange, disabled }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const works = [...new Set(available.map(item => String(item.obraId || "")).filter(Boolean))];
  const parties = [...new Set(available.map(item => item.counterparty).filter(Boolean))].sort();
  const workName = id => (data.obras || []).find(work => String(work.id) === id)?.name || id;
  const display = (key, value) => key === "work" ? workName(value) : key === "status" ? value === "partial" ? "Parcialmente vinculado" : "Sem vínculo" : value;
  return <div className="reconciliation-search-filters"><details><summary>Filtrar lançamentos existentes</summary>
    <fieldset disabled={disabled}><legend>Recorte da busca</legend><div className="reconciliation-search-filters__fields">
      <label>{labels.work}<select aria-label={labels.work} value={filters.work} onChange={event => set("work", event.target.value)}><option value="">Todas as obras</option>{works.map(id => <option key={id} value={id}>{workName(id)}</option>)}</select></label>
      <label>{labels.party}<select aria-label={labels.party} value={filters.party} onChange={event => set("party", event.target.value)}><option value="">Todas as pessoas</option>{parties.map(name => <option key={name}>{name}</option>)}</select></label>
      {["start", "end", "min", "max"].map(key => <label key={key}>{labels[key]}<Input type={key === "start" || key === "end" ? "date" : "number"} min={key === "min" || key === "max" ? "0" : undefined} step={key === "min" || key === "max" ? "0.01" : undefined} value={filters[key]} onChange={event => set(key, event.target.value)}/></label>)}
      <label>{labels.status}<select aria-label={labels.status} value={filters.status} onChange={event => set("status", event.target.value)}><option value="">Todos os disponíveis</option><option value="unlinked">Sem vínculo</option><option value="partial">Parcialmente vinculado</option></select></label>
    </div></fieldset></details>
    <div className="reconciliation-filter-chips" aria-label="Filtros ativos da busca">{Object.entries(filters).filter(([,value]) => value !== "").map(([key,value]) => <Button key={key} variant="outline" size="sm" disabled={disabled} onClick={() => set(key, "")} aria-label={`Remover filtro ${labels[key]}`}>{labels[key]}: {display(key, value)}</Button>)}{Object.values(filters).some(Boolean) && <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange({ ...emptyReviewFilters })}>Limpar filtros da busca</Button>}</div>
  </div>;
}
