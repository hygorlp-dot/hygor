import {useEffect,useId,useRef,useSyncExternalStore} from 'react';
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

// Tela em uso: o topo mostra a obra que a tela usa de fato e some onde nenhuma
// tela o segue. Cada tela que segue o carimbo se registra:
// - follow: segue o carimbo; obraId é a obra da tela ('' = "Todas as obras") e
//   allowAll diz se a tela aceita "Todas".
// - locked: obra fixa (detalhe da obra, usuário vinculado); o topo só mostra o nome.
// - paused: segue, mas está travada agora (ação em curso); o topo mostra a obra
//   da tela sem deixar trocar.
// - passthrough: a tela lê o carimbo à sua maneira; o topo mostra o carimbo.
// Vale a última tela aberta. O detalhe da obra se registra depois das abas
// filhas (os efeitos dos filhos rodam antes) e manda nelas.
const screens=new Map();
const screenListeners=new Set();
let activeScreen=null;
function publishScreens(){
  activeScreen=[...screens.values()].at(-1)||null;
  for(const listener of screenListeners)listener();
}
const subscribeScreens=listener=>{screenListeners.add(listener);return()=>screenListeners.delete(listener);};
const readActiveScreen=()=>activeScreen;
export const useActiveWorkContextScreen=()=>useSyncExternalStore(subscribeScreens,readActiveScreen,readActiveScreen);

export function useWorkContextScreen({mode='passthrough',obraId='',allowAll=true}={}){
  const id=useId();
  useEffect(()=>()=>{screens.delete(id);publishScreens();},[id]);
  useEffect(()=>{
    const previous=screens.get(id);
    if(previous&&previous.mode===mode&&previous.obraId===obraId&&previous.allowAll===allowAll)return;
    // Atualizar sem reordenar: só abrir ou fechar telas muda qual manda.
    screens.set(id,{mode,obraId:String(obraId||''),allowAll});
    publishScreens();
  },[id,mode,obraId,allowAll]);
}

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
// fixedShows: com `fixed` que não é uma obra (pausa), o topo mostra o carimbo
// ('carimbo', padrão) ou a obra da tela sem deixar trocar ('local').
export function useSyncedWorkObra(obraId,setObraId,{allowedIds=[],fixed='',allValue=null,fixedShows='carimbo'}={}){
  const stamped=useWorkContextObra();
  const allowed=allowedIds.join('|');
  const fixedObra=Boolean(fixed)&&allowedIds.includes(fixed);
  const local=allValue!==null&&obraId===allValue?'':obraId;
  useWorkContextScreen(fixedObra?{mode:'locked',obraId:fixed,allowAll:false}
    :fixed?(fixedShows==='local'?{mode:'paused',obraId:local,allowAll:allValue!==null}:{mode:'passthrough'})
    :{mode:'follow',obraId:local,allowAll:allValue!==null});
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
