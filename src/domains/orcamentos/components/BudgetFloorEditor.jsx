import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import {Input as StandardInput} from '../../../components/ui/input.jsx';
import {Button as StandardButton} from '../../../components/ui/button.jsx';
import { useState } from 'react';
import { memoryFloors } from '../budget-floors';
import { buildBudgetTree, flattenBudgetTree } from '../tree';
export default function BudgetFloorEditor({budget,onSave,onClose}){
  const floors=memoryFloors(budget.memoriaCalculo);
  const [id,setId]=useState(floors[0].id), [form,setForm]=useState({...floors[0],nivelM:floors[0].nivelM ?? ''});
  const [error,setError]=useState('');
  const stages=flattenBudgetTree(buildBudgetTree(budget.etapas,[]));
  return <form className="floor-create-form" onSubmit={e=>{e.preventDefault();try{onSave(id,form);}catch(err){setError(err.message);}}}>
    <label>Pavimento<SelectControl value={id} onChange={e=>{const floor=floors.find(f=>f.id===e.target.value);setId(floor.id);setForm({...floor,nivelM:floor.nivelM ?? ''});setError('');}}>{floors.map(f=><option value={f.id} key={f.id}>{f.nome}</option>)}</SelectControl></label>
    <label>Nome<StandardInput required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
    <label>Nível em metros (cota de elevação)<StandardInput required inputMode="decimal" value={form.nivelM} onChange={e=>setForm({...form,nivelM:e.target.value})}/></label>
    <label>Etapa correspondente na planilha<SelectControl value={form.etapaId || ''} onChange={e=>setForm({...form,etapaId:e.target.value})}><option value="">Sem etapa associada</option>{stages.map(s=><option key={s.id} value={s.id}>{s.codigo} · {s.nome}</option>)}</SelectControl></label>
    <p>O nome e o nível serão compartilhados pela planilha e pelo memorial. Os vínculos são preservados mesmo após renumerar ou renomear.</p>
    {error && <p role="alert">{error}</p>}
    <div><StandardButton variant="secondary" type="button" onClick={onClose}>Cancelar</StandardButton><StandardButton variant="primary" type="submit">Salvar pavimento</StandardButton></div>
  </form>;
}
