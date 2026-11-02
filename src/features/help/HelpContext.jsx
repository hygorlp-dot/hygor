import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

const HelpContext = createContext(null);
export function HelpProvider({children}){
 const [topics,setTopics]=useState({});
 const register=useCallback((pageId,topicId,priority=0)=>{
  const token=Symbol(pageId);
  setTopics(previous=>({...previous,[pageId]:[...(previous[pageId]||[]),{token,topicId,priority}]}));
  return ()=>setTopics(previous=>{
   const remaining=(previous[pageId]||[]).filter(item=>item.token!==token);
   const next={...previous};if(remaining.length)next[pageId]=remaining;else delete next[pageId];return next;
  });
 },[]);
 const value=useMemo(()=>({topics,register}),[topics,register]);
 return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}
export function useHelpTopic(pageId,topicId,priority=0){
 const register=useContext(HelpContext)?.register;
 useEffect(()=>register?.(pageId,topicId,priority),[register,pageId,topicId,priority]);
}
export function useCurrentHelpTopic(pageId){
 const topics=useContext(HelpContext)?.topics;
 const latest=id=>topics?.[id]?.reduce((best,item)=>!best||item.priority>=best.priority?item:best,null)?.topicId;
 const topicId=latest(pageId)||pageId;
 return latest(topicId)||topicId;
}
