import { useState } from "react";
import { buildBudgetTree, flattenBudgetTree } from "../tree";
import "./structural-memory.css";

const unitKey = unit => String(unit || "").trim().toLowerCase().replace("²", "2").replace("³", "3");
export const compatibleMemoryUnit = (a, b) => !!unitKey(a) && unitKey(a) === unitKey(b);
export const memoryBudgetItems = budget => flattenBudgetTree(buildBudgetTree(budget?.etapas, budget?.itens))
  .filter(item => item.tipo !== "etapa" && item.tipo !== "titulo");

export default function StructuralBudgetLinks({ scope, rows, budget, onChange, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const canEdit = editing && !readOnly;
  const items = memoryBudgetItems(budget);
  const links = budget?.memoriaCalculo?.vinculosEstruturais || {};
  const linked = rows.filter(row => items.some(item => item.id === links[`${scope}.${row.key}`])).length;
  return <section className="structural-links" aria-label="Destinos no orçamento">
    <header>
      <div><h4>Destinos no orçamento</h4><p>{linked} de {rows.length} quantitativos com destino · coluna Quantidade</p></div>
      {!readOnly && <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>{editing ? "Concluir vínculos" : "Definir destinos"}</button>}
    </header>
    {canEdit && <label className="structural-link-search">Buscar item por número, código ou descrição
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: concretagem de pilares" />
    </label>}
    <div className="structural-link-head" aria-hidden="true"><span>Quantitativo do memorial</span><span>Célula de destino</span></div>
    {rows.map(row => {
      const key = `${scope}.${row.key}`;
      const targetId = links[key] || "";
      const item = items.find(candidate => candidate.id === targetId);
      const incompatible = item && !compatibleMemoryUnit(row.unit, item.unidade);
      const candidates = items.filter(candidate => compatibleMemoryUnit(row.unit, candidate.unidade)
        && `${candidate.codigoItem} ${candidate.codigo} ${candidate.descricao}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
      if (item && !candidates.some(candidate => candidate.id === item.id)) candidates.unshift(item);
      return <div className="structural-link-row" key={row.key}>
        <div><strong>{row.label}</strong><span className="structural-quantity">{Number(row.value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {row.unit}</span>{row.pending && <small className="structural-pending">⚠ Conferência pendente</small>}</div>
        <div>
          {canEdit ? <select aria-label={`Destino de ${row.label}`} value={targetId} onChange={e => onChange(key, e.target.value)}>
            <option value="">Sem vínculo</option>
            {targetId && !item && <option value={targetId}>Item removido — redefina o destino</option>}
            {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.codigoItem} · {candidate.descricao} · {candidate.unidade}</option>)}
          </select> : item ? <><strong>Item {item.codigoItem} · Quantidade</strong><p>{item.descricao}</p><small>No orçamento: {Number(item.quantidade || 0).toLocaleString("pt-BR")} {item.unidade}</small></> : <span className={targetId ? "structural-pending" : "structural-muted"}>{targetId ? "⚠ Item removido — redefina o destino" : "Sem vínculo definido"}</span>}
          {incompatible && <small className="structural-pending">⚠ Unidade do destino ({item.unidade}) diferente de {row.unit}.</small>}
          {canEdit && !candidates.length && <small>Nenhum item compatível com {row.unit} nesta busca.</small>}
        </div>
      </div>;
    })}
    <p className="structural-link-note">Os destinos ficam salvos nesta versão. O vínculo indica onde lançar o quantitativo; a quantidade do orçamento continua sendo preenchida manualmente.</p>
  </section>;
}
