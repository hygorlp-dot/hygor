import {useEffect,useRef,useSyncExternalStore} from 'react';
import {sessionContext} from '../../lib/session-context.js';

// Carimbo de contexto (Etapa 1 do redesign): a obra escolhida uma vez no topo
// vale para as telas que o seguem. Mesma chave de obraContextoSalvo(), para
// as telas que ainda só leem o valor inicial continuarem funcionando.
const KEY='arcd_obra_contexto';
const listeners=new Set();
let current=null;

export const workContextObraId=()=>current??(current=sessionContext.getItem(KEY)||'');

export function setWorkContextObra(obraId){
  const next=String(obraId||'');
  if(next===workContextObraId())return;
  current=next;
  if(next)sessionContext.setItem(KEY,next);else sessionContext.removeItem(KEY);
  for(const listener of listeners)listener();
}

const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const useWorkContextObra=()=>useSyncExternalStore(subscribe,workContextObraId,workContextObraId);

// Liga a obra local de uma tela ao carimbo, nos dois sentidos.
// - Telas de várias obras passam allValue (por exemplo "all"): carimbo vazio
//   é "Todas as obras" e escolher "Todas" na tela limpa o carimbo.
// - Telas de uma obra só não passam allValue: com o carimbo vazio a tela abre
//   na obra dela.
// Só a troca da obra local vai para o carimbo. A obra com que a tela abre, ou
// em que estava quando `fixed` desliga, não vai: senão abrir o Planejamento
// tiraria o Financeiro de "Todas as obras", e abrir o Financeiro em "Todas"
// apagaria o carimbo antes de a tela segui-lo.
// No detalhe de uma obra (fixed) nada muda: a obra fixa manda.
export function useSyncedWorkObra(obraId,setObraId,{allowedIds=[],fixed='',allValue=null}={}){
  const stamped=useWorkContextObra();
  const allowed=allowedIds.join('|');
  const previous=useRef(obraId);
  useEffect(()=>{
    if(fixed||stamped===obraId)return;
    if(!stamped){if(allValue!==null&&obraId!==allValue)setObraId(allValue);return;}
    if(allowedIds.includes(stamped))setObraId(stamped);
    // Só reage à troca do carimbo; a obra local entra pela segunda via.
  },[stamped,fixed,allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const changed=previous.current!==obraId;
    previous.current=obraId;
    if(fixed||!changed)return;
    if(allValue!==null&&obraId===allValue){setWorkContextObra('');return;}
    if(!obraId||!allowedIds.includes(obraId))return;
    setWorkContextObra(obraId);
  },[obraId,fixed,allowed]); // eslint-disable-line react-hooks/exhaustive-deps
}
