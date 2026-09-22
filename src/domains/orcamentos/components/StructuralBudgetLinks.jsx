import { useState } from "react";
import { compatibleMemoryUnit, memoryBudgetItems, compatibleStructuralItem, structuralOrigin, normalizeStructuralText } from "../structural-budget-matching";
export { compatibleMemoryUnit, memoryBudgetItems } from "../structural-budget-matching";
import "./structural-memory.css";

export default function StructuralBudgetLinks({ scope, rows, budget, onChange, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const origin = structuralOrigin(scope);
  const context = `${origin.floor} · ${origin.element}`;
  const canEdit = editing && !readOnly;
  const items = memoryBudgetItems(budget);
  const links = budget?.memoriaCalculo?.vinculosEstruturais || {};
  const linked = rows.filter(row => items.some(item => item.id === links[`${scope}.${row.key}`])).length;
  return <section className="structural-links" aria-label="Destinos no orçamento">
    <header>
      <div><h4>Destinos no orçamento · {context}</h4><p>{linked} de {rows.length} quantitativos com destino · coluna Quantidade</p></div>
      {!readOnly && <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>{editing ? "Concluir vínculos" : "Definir destinos"}</button>}
    </header>
    {canEdit && <label className="structural-link-search">Buscar item por etapa, número, código ou descrição
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: concretagem de pilares" />
    </label>}
    <div className="structural-link-head" aria-hidden="true"><span>Quantitativo do memorial</span><span>Célula de destino</span></div>
    {rows.map(row => {
      const key = `${scope}.${row.key}`;
      const targetId = links[key] || "";
      const item = items.find(candidate => candidate.id === targetId);
      const incompatible = item && !compatibleMemoryUnit(row.unit, item.unidade);
      const wrongService = item && !compatibleStructuralItem(row, item) && !incompatible;
      const candidates = items.filter(candidate => compatibleStructuralItem(row, candidate)
        && normalizeStructuralText(`${candidate.stagePath} ${candidate.codigoItem} ${candidate.codigo} ${candidate.descricao}`).includes(normalizeStructuralText(search)));
      const originScore = candidate => Number(normalizeStructuralText(candidate.stagePath).includes(normalizeStructuralText(origin.floor))) * 2
        + Number(normalizeStructuralText(`${candidate.stagePath} ${candidate.descricao}`).includes(normalizeStructuralText(origin.element)));
      candidates.sort((a, b) => originScore(b) - originScore(a));
      if (item && !candidates.some(candidate => candidate.id === item.id)) candidates.unshift(item);
      return <div className="structural-link-row" key={row.key}>
        <div><small className="structural-origin">{context}</small><strong>{row.label}</strong><span className="structural-quantity">{Number(row.value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {row.unit}</span>{row.pending && <small className="structural-pending">⚠ Conferência pendente</small>}</div>
        <div>
          {canEdit ? <select aria-label={`Destino de ${row.label} · ${context}`} value={targetId} onChange={e => onChange(key, e.target.value)}>
            <option value="">Sem vínculo</option>
            {targetId && !item && <option value={targetId}>Item removido — redefina o destino</option>}
            {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.codigoItem} · {candidate.stagePath} · {candidate.descricao.length > 125 ? `${candidate.descricao.slice(0, 125)}…` : candidate.descricao} · {candidate.unidade}</option>)}
          </select> : item ? <><strong>Item {item.codigoItem} · Quantidade</strong><small>{item.stagePath}</small><p>{item.descricao}</p><small>No orçamento: {Number(item.quantidade || 0).toLocaleString("pt-BR")} {item.unidade}</small></> : <span className={targetId ? "structural-pending" : "structural-muted"}>{targetId ? "⚠ Item removido — redefina o destino" : "Sem vínculo definido"}</span>}
          {canEdit && item && <><small>Destino: {item.stagePath} · item {item.codigoItem}</small><p>{item.descricao}</p></>}
          {wrongService && <small className="structural-pending">⚠ O serviço vinculado não corresponde a {row.label.toLowerCase()}. Redefina o destino.</small>}
          {incompatible && <small className="structural-pending">⚠ Unidade do destino ({item.unidade}) diferente de {row.unit}.</small>}
          {canEdit && !candidates.length && <small>Nenhum item de {row.label.toLowerCase()} em {row.unit} nesta busca. Confira a descrição e a unidade no orçamento.</small>}
        </div>
      </div>;
    })}
    <p className="structural-link-note">As opções são filtradas por serviço e unidade. Confira a etapa do orçamento antes de vincular. Os destinos ficam salvos nesta versão. O vínculo indica onde lançar o quantitativo; a quantidade do orçamento continua sendo preenchida manualmente.</p>
  </section>;
}
