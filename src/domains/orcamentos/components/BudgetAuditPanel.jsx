import {Input as StandardInput} from '../../../components/ui/input.jsx';
import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import {Button as StandardButton} from '../../../components/ui/button.jsx';
import { useState } from 'react';
export default function BudgetAuditPanel({issues,onNavigate,onRemoveLink,readOnly}){
  const [search,setSearch]=useState(''),[kind,setKind]=useState(''),[limit,setLimit]=useState(50);
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const filtered=issues.filter(i=>(!kind||i.destination===kind)&&norm(`${i.label} ${i.message}`).includes(norm(search)));
  return <details className="memory-disclosure">
    <summary>Conferência do orçamento inteiro · {issues.length} ocorrência(s)</summary>
    <div className="budget-workflow-bar">
      <StandardInput aria-label="Buscar ocorrência" placeholder="Item, pavimento ou problema" value={search} onChange={e=>{setSearch(e.target.value);setLimit(50);}}/>
      <SelectControl aria-label="Tipo de ocorrência" value={kind} onChange={e=>{setKind(e.target.value);setLimit(50);}}><option value="">Todas</option><option value="budget">Itens da planilha</option><option value="memory">Vínculos do memorial</option><option value="item-memory">Memorial item a item</option></SelectControl>
      <span>{filtered.length} ocorrência(s)</span>
    </div>
    {!issues.length&&<p>Nenhuma inconsistência encontrada nas verificações automáticas.</p>}
    {filtered.slice(0,limit).map(issue=><div key={issue.id}>
      <StandardButton variant="secondary" type="button" className="memory-audit-link" onClick={()=>onNavigate(issue)}>{issue.label} — {issue.message}</StandardButton>
      {!readOnly && issue.canRemove && <StandardButton variant="secondary" type="button" onClick={()=>onRemoveLink(issue.source)}>Desvincular este quantitativo</StandardButton>}
    </div>)}
    {filtered.length>limit&&<StandardButton variant="secondary" type="button" onClick={()=>setLimit(limit+50)}>Mostrar mais 50</StandardButton>}
  </details>;
}
