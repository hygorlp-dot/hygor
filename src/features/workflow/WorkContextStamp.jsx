import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {setWorkContextObra,useWorkContextObra} from './work-context.js';
import './work-context-stamp.css';

// Carimbo no topo: a obra em foco é escolhida uma vez e as telas que seguem o
// carimbo obedecem. Quem só enxerga uma obra vê o nome dela, sem escolha.
export function WorkContextStamp({obras=[]}){
  const stamped=useWorkContextObra();
  if(!obras.length)return null;
  if(obras.length===1)return <p className="work-context-stamp" data-testid="work-context-stamp"><span>Obra</span><strong>{obras[0].name}</strong></p>;
  const value=obras.some(obra=>obra.id===stamped)?stamped:'';
  return <label className="work-context-stamp" data-testid="work-context-stamp">
    <span>Obra em foco</span>
    <SelectControl value={value} onChange={event=>setWorkContextObra(event.target.value)}>
      <option value="">Escolha a obra</option>
      {obras.map(obra=><option key={obra.id} value={obra.id}>{obra.name}</option>)}
    </SelectControl>
  </label>;
}
