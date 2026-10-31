import {useEffect,useRef,useState} from 'react';

// Drafts stay in the mounted editor. Only warn on exit; never persist them as preferences.
export function useUnsavedChanges(draft,onClose,{identity=draft?.id||'new',busy=false}={}){
 const base=useRef(null),latest=useRef({draft,busy,onClose}),[asked,setAsked]=useState(false);
 latest.current={draft,busy,onClose};
 const active=draft!=null;
 useEffect(()=>{base.current=active?JSON.stringify(latest.current.draft):null;setAsked(false);},[active,identity]);
 const dirty=()=>base.current!==null&&latest.current.draft!=null&&JSON.stringify(latest.current.draft)!==base.current;
 useEffect(()=>{
  if(!active)return;
  const protect=event=>{if(dirty()||latest.current.busy){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);
 },[active,identity]);
 const requestClose=()=>{if(latest.current.busy)return;if(dirty()){setAsked(true);return;}latest.current.onClose();};
 return {asked,requestClose,continueEditing:()=>setAsked(false),discard:()=>{if(latest.current.busy)return;setAsked(false);latest.current.onClose();}};
}
