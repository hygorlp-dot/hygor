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
//   na obra dela, mas essa escolha automática não vai para o carimbo; só a
//   troca feita pela pessoa vai (senão abrir o Planejamento tiraria o
//   Financeiro de "Todas as obras").
// No detalhe de uma obra (fixed) nada muda: a obra fixa manda.
export function useSyncedWorkObra(obraId,setObraId,{allowedIds=[],fixed='',allValue=null}={}){
  const stamped=useWorkContextObra();
  const allowed=allowedIds.join('|');
  const initial=useRef(obraId);
  useEffect(()=>{
    if(fixed||stamped===obraId)return;
    if(!stamped){if(allValue!==null&&obraId!==allValue)setObraId(allValue);return;}
    if(allowedIds.includes(stamped))setObraId(stamped);
    // Só reage à troca do carimbo; a obra local entra pela segunda via.
  },[stamped,fixed,allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(fixed)return;
    if(allValue!==null&&obraId===allValue){setWorkContextObra('');return;}
    if(!obraId||!allowedIds.includes(obraId))return;
    if(allValue===null&&!workContextObraId()&&obraId===initial.current)return;
    setWorkContextObra(obraId);
  },[obraId,fixed,allowed]); // eslint-disable-line react-hooks/exhaustive-deps
}
