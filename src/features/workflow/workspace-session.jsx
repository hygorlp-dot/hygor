import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {ArrowLeft} from "lucide-react";
import {Button} from "../../design-system/primitives/Button.jsx";
import {useWorkflow} from "./WorkflowNavigation.jsx";

// View preferences live only in this user's mounted app session, never in the API.
export function useWorkspaceState(screen,key,initial,instance=""){
 const {views}=useWorkflow();
 const address=JSON.stringify([screen,instance,key]);
 const initialValue=()=>views?.has(address)?views.get(address):typeof initial==="function"?initial():initial;
 const [entry,setEntry]=useState(()=>({address,value:initialValue()}));
 const value=entry.address===address?entry.value:initialValue();
 if(entry.address!==address)setEntry({address,value});
 const setValue=useCallback(next=>{
  if(!views){setEntry(previous=>({address,value:typeof next==="function"?next(previous.address===address?previous.value:initialValue()):next}));return;}
  // Record the user's choice before navigation can unmount this screen.
  // Functional updates also read the last choice from the same session key.
  const previous=views.has(address)?views.get(address):initialValue();
  const resolved=typeof next==="function"?next(previous):next;
  views.set(address,resolved);
  setEntry({address,value:resolved});
 },[views,address]);
 useEffect(()=>{if(views&&!views.has(address))views.set(address,value);},[views,address,value]);
 return [value,setValue];
}

export function useWorkspaceScroll(screen,instance="",ready=true){
 const {views}=useWorkflow();
 const address=JSON.stringify([screen,instance,"scroll"]);
 useLayoutEffect(()=>{
  if(!views||!ready)return;
  const main=document.querySelector("main"),position=views.get(address)||{window:0,main:0};
  const frame=requestAnimationFrame(()=>{window.scrollTo(0,position.window);if(main)main.scrollTop=position.main;});
  const save=()=>views.set(address,{window:window.scrollY,main:main?.scrollTop||0});
  window.addEventListener("scroll",save,{passive:true});main?.addEventListener("scroll",save,{passive:true});
  return()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",save);main?.removeEventListener("scroll",save);};
 },[views,address,ready]);
}

export function WorkflowReturn(){
 const {returnTo,goBack}=useWorkflow();
 if(!returnTo||!goBack)return null;
 return <nav className="workflow-return" aria-label="Retornar ao contexto anterior"><Button variant="secondary" size="sm" onClick={goBack}><ArrowLeft size={16} aria-hidden="true"/>{returnTo.label}</Button></nav>;
}

// Guarda posições de leitura da fila, inclusive a rolagem horizontal do quadro.
export function useQueuePosition(screen,instance){
 const {views}=useWorkflow(),ref=useRef(null),address=JSON.stringify([screen,instance,'queuePosition']);
 useLayoutEffect(()=>{
  const main=document.querySelector('main');
  // Montagem desfeita antes do primeiro quadro não restaurou nada: gravar agora
  // apagaria a posição guardada com a rolagem zerada da tela recém-montada.
  let restored=false;
  const frame=requestAnimationFrame(()=>{restored=true;const saved=views?.get(address);if(!saved)return;window.scrollTo(0,saved.window);if(main)main.scrollTop=saved.main;for(const region of ref.current?.querySelectorAll('[role="region"]')||[]){const pos=saved.regions.find(p=>p.name===region.getAttribute('aria-label'));if(pos){region.scrollTop=pos.top;region.scrollLeft=pos.left;}}});
  return()=>{cancelAnimationFrame(frame);if(!restored)return;views?.set(address,{window:window.scrollY,main:main?.scrollTop||0,regions:[...ref.current?.querySelectorAll('[role="region"]')||[]].map(node=>({name:node.getAttribute('aria-label'),top:node.scrollTop,left:node.scrollLeft}))});};
 },[views,address]);
 return ref;
}
