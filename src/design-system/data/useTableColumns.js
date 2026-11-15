import {useEffect,useMemo,useState} from 'react';

export const tableColumnsKey=(user,config,list)=>{
 const company=String(config?.companyId||config?.cnpj||'').trim();
 return user?.id&&company?'mrc-columns:v1:'+JSON.stringify([company,String(user.id),list]):null;
};
export function useTableColumns(columns,storageKey){
 const read=()=>{try{const value=storageKey?JSON.parse(localStorage.getItem(storageKey)||'[]'):[];return {hidden:Array.isArray(value)?value.filter(v=>typeof v==='string').slice(0,200):[],failed:false};}catch{return {hidden:[],failed:true};}};
 const saved=useMemo(read,[storageKey]);
 const [entry,setEntry]=useState(null);
 const current=entry&&entry.key===storageKey?entry:saved;
 const visible=columns.filter(c=>c.hideable===false||!current.hidden.includes(c.key)).map(c=>c.key);
 if(!visible.length&&columns.length)visible.push(columns[0].key);
 useEffect(()=>{
  if(!storageKey)return;
  const sync=event=>{if(event.detail?.key===storageKey)setEntry(event.detail);};
  window.addEventListener('mrc-columns',sync);
  return ()=>window.removeEventListener('mrc-columns',sync);
 },[storageKey]);
 const save=hidden=>{
  hidden=columns.filter(c=>c.hideable!==false&&hidden.includes(c.key)).map(c=>c.key);
  let failed=false;
  if(storageKey)try{hidden.length?localStorage.setItem(storageKey,JSON.stringify(hidden)):localStorage.removeItem(storageKey);}catch{failed=true;}
  const next={key:storageKey,hidden,failed};
  setEntry(next);
  if(storageKey)window.dispatchEvent(new CustomEvent('mrc-columns',{detail:next}));
 };
 return {visible,sessionOnly:!storageKey||current.failed,
  toggle:key=>{const column=columns.find(c=>c.key===key);if(!column||column.hideable===false||visible.length===1&&visible.includes(key))return;save(visible.includes(key)?[...current.hidden,key]:current.hidden.filter(k=>k!==key));},
  reset:()=>save([])};
}
