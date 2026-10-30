import {useEffect,useState} from "react";
export function useQuoteClock(){
 const [now,setNow]=useState(()=>new Date().toISOString());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date().toISOString()),60000);return()=>clearInterval(timer)},[]);
 return now;
}
