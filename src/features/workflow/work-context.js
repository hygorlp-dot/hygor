import {useEffect,useSyncExternalStore} from 'react';
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

// Liga a obra local de uma tela ao carimbo, nos dois sentidos. A tela segue o
// carimbo quando a obra dele está entre as que ela aceita; trocar a obra na
// tela atualiza o carimbo. Dentro do detalhe de uma obra (fixed) nada muda:
// a obra fixa manda e o carimbo não é tocado.
export function useSyncedWorkObra(obraId,setObraId,{allowedIds=[],fixed=''}={}){
  const stamped=useWorkContextObra();
  const allowed=allowedIds.join('|');
  useEffect(()=>{
    if(fixed||!stamped||stamped===obraId||!allowedIds.includes(stamped))return;
    setObraId(stamped);
    // Só reage à troca do carimbo; a obra local entra pela segunda via.
  },[stamped,fixed,allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(fixed||!obraId||!allowedIds.includes(obraId))return;
    setWorkContextObra(obraId);
  },[obraId,fixed,allowed]); // eslint-disable-line react-hooks/exhaustive-deps
}
