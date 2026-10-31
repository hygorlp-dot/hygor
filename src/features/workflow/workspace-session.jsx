import {useCallback,useEffect,useLayoutEffect,useState} from "react";
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
 const setValue=useCallback(next=>setEntry(previous=>({address,value:typeof next==="function"?next(previous.value):next})),[address]);
 useEffect(()=>{views?.set(address,value);},[views,address,value]);
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
