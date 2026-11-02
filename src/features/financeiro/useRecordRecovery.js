import {useCallback,useRef,useState} from 'react';
import {readRecoveryData,renewEditingSession} from '../../api.js';
import {sameRecordValue,mergeRecordEdits} from './record-recovery.js';

export function useRecordRecovery({collection,fields,format=value=>value}){
 const base=useRef(null),attempt=useRef(null),entity=useRef('');
 const [failure,setFailure]=useState(null),[latest,setLatest]=useState(null),[choices,setChoices]=useState({}),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(null);
 const reset=useCallback(record=>{base.current=structuredClone(record);attempt.current=null;entity.current=record?.id||'';setFailure(null);setLatest(null);setChoices({});setConfirmed(null);},[]);
 const entityId=proposed=>entity.current||(entity.current=proposed);
 const prepare=command=>{
  if(failure?.conflict){setFailure(previous=>({...previous,message:'Confira a versão atual e aplique a revisão antes de confirmar novamente.'}));return null;}
  if(attempt.current&&sameRecordValue(attempt.current.command.payload,command.payload))return attempt.current.command;
  if(attempt.current?.uncertain){setFailure({message:'O resultado anterior está indefinido. Consulte a versão atual antes de enviar outra edição.',uncertain:true});return null;}
  attempt.current={command,uncertain:false};return command;
 };
 const fail=result=>{
  const status=Number(result?.status??0),message=result?.reason||result?.error||result?.message||'Não foi possível confirmar a operação.';
  const conflict=result?.code==='VERSION_CONFLICT'||/alterad[ao].*outra pessoa|conflito|versão.*desatualizada/i.test(message);
  const uncertain=status===0||status>=500;
  if(attempt.current)attempt.current.uncertain=uncertain;
  setFailure({message,status,conflict,uncertain});setLatest(null);setConfirmed(null);
 };
 const check=async()=>{
  setBusy(true);
  try{
   const result=await readRecoveryData();if(!result.ok){fail(result);return;}
   if(attempt.current&&result.data.operationalCommandReceipts?.some(r=>r.idempotencyKey===attempt.current.command.idempotencyKey)){setConfirmed(result);setFailure({message:'O servidor já confirmou esta operação. Aplique a confirmação recebida para concluir a consulta.',info:true});return;}
   const record=(result.data[collection]||[]).find(r=>String(r.id)===String(entity.current||base.current?.id));
   if(!record&&!base.current?.id&&entity.current){setLatest(format({...base.current,id:entity.current,version:0}));setChoices({});setFailure({info:true,message:'O novo registro ainda não consta na consulta. Revise o preenchimento; a mesma identidade será mantida ao confirmar.'});return;}
   if(!record){setFailure({message:'A origem não foi encontrada na consulta atual. O preenchimento foi mantido; confira seu acesso e o registro.'});return;}
   setLatest(format(record));setChoices({});setFailure(previous=>({...previous,status:200,info:true,message:'Versão atual consultada. Revise as diferenças antes de aplicar ao formulário.'}));
  }catch(error){fail(error);}finally{setBusy(false);}
 };
 const rebase=draft=>{
  if(!latest)return null;
  const result=mergeRecordEdits(base.current||{},draft,latest,fields,choices);
  if(result.conflicts.length)return null;
  base.current=structuredClone(latest);attempt.current=null;setLatest(null);setFailure(null);return result.merged;
 };
 const renew=async(user,password)=>{
  setBusy(true);try{const result=await renewEditingSession({email:user.email,userId:user.id,password});if(!result.ok){setFailure(previous=>({...previous,message:result.error,status:401,info:false}));return false;}setFailure({message:'Acesso renovado. Consulte a versão atual antes de confirmar.',info:true});return true;}catch(error){fail(error);return false;}finally{setBusy(false);}
 };
 return {failure,latest,choices,busy,confirmed,base,reset,entityId,prepare,fail,check,rebase,renew,setChoices,conflicts:draft=>latest?mergeRecordEdits(base.current||{},draft,latest,fields,choices).conflicts:[]};
}
