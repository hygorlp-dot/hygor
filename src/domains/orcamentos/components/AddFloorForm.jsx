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
    <label>Nome do pavimento<input required value={form.nome} onChange={set('nome')} placeholder="Ex.: 2º pavimento"/></label>
    <label>Nível do pavimento (m)<input required inputMode="decimal" value={form.nivel} onChange={set('nivel')} placeholder="Ex.: 6,00 ou -3,00"/></label>
    <small>Cota de elevação em relação ao nível de referência da obra.</small>
    <label>Modelo da memória<select value={form.origem} onChange={set('origem')}><option value="terreo">Térreo</option><option value="pavimento1">1º pavimento</option></select></label>
    <label>Etapa do orçamento a copiar<select required value={form.etapaId} onChange={set('etapaId')}><option value="">Selecione o pavimento de origem</option>{stages.map(s=><option key={s.id} value={s.id}>{s.codigo} · {s.nome}</option>)}</select></label>
    <p>Todas as subetapas e itens da etapa escolhida serão copiados, incluindo estrutura, alvenaria e demais serviços cadastrados.</p>
    {error && <p role="alert">{error}</p>}
    <div><button type="button" onClick={onCancel}>Cancelar</button><button type="submit">Criar pavimento</button></div>
  </form>;
}
