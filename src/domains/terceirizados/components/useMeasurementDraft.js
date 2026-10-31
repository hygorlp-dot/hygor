import { useEffect, useRef, useState } from "react";
import { readMeasurementDraft, removeMeasurementDraft, saveMeasurementDraft } from "../measurement-draft.js";

/** Device-local drafts never enter medicoesTerc or the financial command bus. */
export function useMeasurementDraft({open, form, baseSignature}) {
  const [session,setSession] = useState(null);
  const [persistence,setPersistence] = useState({state:"idle",error:"",updatedAt:""});
  const latest = useRef(null);
  const timer = useRef(null);
  latest.current = open && session ? {scope:session.scope,blocked:session.blocked,
    record:{measurementId:session.measurementId,baseSignature:session.baseSignature,form}} : null;

  const persist = (snapshot, notify = true) => {
    if (!snapshot) return true;
    if (snapshot.blocked) return false;
    const result = saveMeasurementDraft(snapshot.scope,snapshot.record);
    if (notify) setPersistence(result.ok ? {state:"saved",error:"",updatedAt:result.updatedAt}
      : {state:"error",error:result.error,updatedAt:""});
    return result.ok;
  };

  useEffect(()=>{
    if (!open || !session || session.blocked) return undefined;
    setPersistence(previous=>({...previous,state:"saving"}));
    timer.current = window.setTimeout(()=>persist(latest.current),350);
    return ()=>window.clearTimeout(timer.current);
  },[open,form,session]);

  useEffect(()=>{
    const saveBeforeLeaving = ()=>persist(latest.current,false);
    const visibility = ()=>{if(document.visibilityState==="hidden")saveBeforeLeaving();};
    window.addEventListener("pagehide",saveBeforeLeaving);
    document.addEventListener("visibilitychange",visibility);
    return ()=>{
      window.clearTimeout(timer.current);
      saveBeforeLeaving();
      window.removeEventListener("pagehide",saveBeforeLeaving);
      document.removeEventListener("visibilitychange",visibility);
    };
  },[]);

  const start = (scope, initialForm, {measurementId, signature, submittedIds = []} = {}) => {
    const result = readMeasurementDraft(scope);
    let recovered = result.ok ? result.draft : null;
    // A lost response must not restore a draft that already became a server fact.
    if (recovered && !scope.editId && submittedIds.includes(recovered.measurementId)) {
      removeMeasurementDraft(scope);
      recovered = null;
    }
    setSession({scope,measurementId:recovered?.measurementId || measurementId,
      baseSignature:recovered?.baseSignature ?? signature,restored:!!recovered,blocked:!result.ok});
    setPersistence(result.ok ? {state:recovered ? "saved" : "saving",error:"",updatedAt:recovered?.updatedAt || ""}
      : {state:"error",error:result.error,updatedAt:""});
    return recovered ? {...initialForm,...recovered.form,pcts:{...initialForm.pcts,...recovered.form.pcts}} : initialForm;
  };
  const flush = () => {window.clearTimeout(timer.current);return persist(latest.current);};
  const clear = () => {
    window.clearTimeout(timer.current);
    const result = session ? removeMeasurementDraft(session.scope) : {ok:true};
    latest.current = null;
    setSession(null);
    setPersistence({state:"idle",error:result.ok ? "" : result.error,updatedAt:""});
    return result;
  };
  const discard = () => {
    const result = session ? removeMeasurementDraft(session.scope) : {ok:true};
    if (!result.ok) {setPersistence({state:"error",error:result.error,updatedAt:""});return false;}
    window.clearTimeout(timer.current);
    latest.current = null;
    setSession(null);
    setPersistence({state:"idle",error:"",updatedAt:""});
    return true;
  };
  return {session,persistence,start,flush,clear,discard,
    outdated:!!session && session.baseSignature !== baseSignature,
    acceptCurrentBase:()=>setSession(previous=>previous ? {...previous,baseSignature} : previous)};
}
