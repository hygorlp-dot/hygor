import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

const HelpContext = createContext(null);
export function HelpProvider({children}){
 const [topics,setTopics]=useState({});
 const register=useCallback((pageId,topicId)=>{
  const token=Symbol(pageId);
  setTopics(previous=>({...previous,[pageId]:{token,topicId}}));
  return ()=>setTopics(previous=>{
   if(previous[pageId]?.token!==token)return previous;
   const next={...previous};delete next[pageId];return next;
  });
 },[]);
 const value=useMemo(()=>({topics,register}),[topics,register]);
 return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}
export function useHelpTopic(pageId,topicId){
 const register=useContext(HelpContext)?.register;
 useEffect(()=>register?.(pageId,topicId),[register,pageId,topicId]);
}
export function useCurrentHelpTopic(pageId){
 const topics=useContext(HelpContext)?.topics;
 const topicId=topics?.[pageId]?.topicId||pageId;
 return topics?.[topicId]?.topicId||topicId;
}
