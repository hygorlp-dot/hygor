import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {setWorkContextObra,useActiveWorkContextScreen,useWorkContextObra} from './work-context.js';
import './work-context-stamp.css';

// Carimbo no topo: a obra em foco é escolhida uma vez e as telas que seguem o
// carimbo obedecem. O topo mostra a obra que a tela usa de fato e some nas telas
// que não o seguem. Quem só enxerga uma obra, ou está dentro de uma obra, vê o
// nome dela, sem escolha.
export function WorkContextStamp({obras=[],todasObras=obras}){
  const stamped=useWorkContextObra();
  const tela=useActiveWorkContextScreen();
  if(!obras.length||!tela)return null;
  const nome=id=>todasObras.find(obra=>obra.id===id)?.name||'';
  const fixa=tela.mode==='locked'?tela.obraId:obras.length===1?obras[0].id:'';
  if(fixa)return nome(fixa)?<p className="work-context-stamp" data-testid="work-context-stamp"><span>Obra</span><strong>{nome(fixa)}</strong></p>:null;
  const daTela=tela.mode==='follow'||tela.mode==='paused';
  const value=daTela?tela.obraId:obras.some(obra=>obra.id===stamped)?stamped:'';
  const todas=!daTela||tela.allowAll;
  // Obra da tela fora da lista do topo (por exemplo, pausada): aparece como opção para o topo não mentir.
  const extra=value&&!obras.some(obra=>obra.id===value)&&nome(value);
  return <label className="work-context-stamp" data-testid="work-context-stamp">
    <span>Obra em foco</span>
    <SelectControl value={value} disabled={tela.mode==='paused'} onChange={event=>setWorkContextObra(event.target.value)}>
      {todas&&<option value="">Todas as obras</option>}
      {!todas&&!value&&<option value="" disabled>Escolha a obra</option>}
      {extra&&<option value={value}>{extra}</option>}
      {obras.map(obra=><option key={obra.id} value={obra.id}>{obra.name}</option>)}
    </SelectControl>
  </label>;
}
