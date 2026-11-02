import {useEffect,useState} from 'react';

// Only harmless presentation choices survive reload. Queries, records and
// drafts stay in the mounted workspace session and never enter this storage.
export function useQueuePreferences(userId,area,initial){
  const key=`mrc-queue-view:${userId||'local'}:${area}`;
  const normalize=saved=>Object.fromEntries(Object.entries(initial).filter(([name])=>['layout','direction'].includes(name)).map(([name,fallback])=>{
    const allowed=name==='layout'?['table','kanban']:['A pagar','A receber'];
    return [name,allowed.includes(saved?.[name])?saved[name]:allowed.includes(fallback)?fallback:allowed[0]];
  }));
  const read=()=>{let saved;try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{saved={};}return normalize(saved);};
  const [entry,setEntry]=useState(()=>({key,value:read()}));
  const value=entry.key===key?entry.value:read();
  if(entry.key!==key)setEntry({key,value});
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing still supports the current session. */}},[key,value]);
  return [value,next=>setEntry({key,value:normalize(next)})];
}
