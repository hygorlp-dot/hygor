import {Input as StandardInput} from '../../../components/ui/input.jsx';
import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import {Button as StandardButton} from '../../../components/ui/button.jsx';
import { useState } from 'react';
import { buildBudgetTree, flattenBudgetTree } from '../tree';
import './structural-memory.css';

export default function AddFloorForm({ budget, onCreate, onCancel }) {
  const [form, setForm] = useState({nome:'',nivel:'',origem:'pavimento1',etapaId:''});
  const [error, setError] = useState('');
  const stages = flattenBudgetTree(buildBudgetTree(budget.etapas, []));
  const set = key => event => setForm({...form,[key]:event.target.value});
  return <form className="floor-create-form" onSubmit={event=>{
    event.preventDefault();
    try { onCreate(form); } catch (e) { setError(e.message); }
  }}>
    <p>Copie o modelo da memória e a etapa do orçamento. Todos os quantitativos começam zerados; composições e preços unitários são preservados.</p>
    <label>Nome do pavimento<StandardInput required value={form.nome} onChange={set('nome')} placeholder="Ex.: 2º pavimento"/></label>
    <label>Nível do pavimento (m)<StandardInput required inputMode="decimal" value={form.nivel} onChange={set('nivel')} placeholder="Ex.: 6,00 ou -3,00"/></label>
    <small>Cota de elevação em relação ao nível de referência da obra.</small>
    <label>Modelo da memória<SelectControl value={form.origem} onChange={set('origem')}><option value="terreo">Térreo</option><option value="pavimento1">1º pavimento</option></SelectControl></label>
    <label>Etapa do orçamento a copiar<SelectControl required value={form.etapaId} onChange={set('etapaId')}><option value="">Selecione o pavimento de origem</option>{stages.map(s=><option key={s.id} value={s.id}>{s.codigo} · {s.nome}</option>)}</SelectControl></label>
    <p>Todas as subetapas e itens da etapa escolhida serão copiados, incluindo estrutura, alvenaria e demais serviços cadastrados.</p>
    {error && <p role="alert">{error}</p>}
    <div><StandardButton variant="secondary" type="button" onClick={onCancel}>Cancelar</StandardButton><StandardButton variant="primary" type="submit">Criar pavimento</StandardButton></div>
  </form>;
}
