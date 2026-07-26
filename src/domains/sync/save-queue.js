export const SAVE_QUEUE_STATE = Object.freeze({
  IDLE:"idle", SAVING:"saving", RETRY_SCHEDULED:"retry_scheduled", OFFLINE:"offline", CONFLICT:"conflict", FAILED:"failed",
});

// Serializa snapshots já reconciliados pelo App. A fila não descarta uma nova
// alteração enquanto uma gravação está em voo e nunca reinicia sozinha depois
// de atingir o limite de falhas.
export const createSaveQueue = ({ save, onState = () => {}, onSuccess = () => {}, onConflict = () => {}, onRetry = () => {}, onFailed = () => {}, schedule = setTimeout, maxRetries = 3, retryDelay = attempt => 1500 * attempt, isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false }) => {
  let state=SAVE_QUEUE_STATE.IDLE;
  let pending=null;
  let inFlight=false;
  let retryScheduled=false;
  let attempts=0;

  const transition=next=>{state=next;onState(next);};
  const hasPending=()=>!!pending||inFlight||retryScheduled;

  const flush=async()=>{
    if(inFlight||retryScheduled||state===SAVE_QUEUE_STATE.CONFLICT||!pending)return;
    const target=pending;
    pending=null;
    inFlight=true;
    transition(SAVE_QUEUE_STATE.SAVING);
    let drain=false;
    const fail=result=>{
      if(!pending)pending=target;
      if(isOffline()){
        transition(SAVE_QUEUE_STATE.OFFLINE);
        onFailed({result,attempts,pending:target,offline:true});
        return;
      }
      attempts+=1;
      if(attempts<=maxRetries){
        const delay=retryDelay(attempts);
        retryScheduled=true;
        transition(SAVE_QUEUE_STATE.RETRY_SCHEDULED);
        onRetry({result,attempt:attempts,delay});
        schedule(()=>{retryScheduled=false;void flush();},delay);
      }else{
        transition(SAVE_QUEUE_STATE.FAILED);
        onFailed({result,attempts,pending:target});
      }
    };
    try{
      const result=await save(target);
      if(result?.conflict){
        pending=target;
        attempts=0;
        transition(SAVE_QUEUE_STATE.CONFLICT);
        onConflict({result,pending:target});
        return;
      }
      if(!result?.ok){fail(result);return;}
      attempts=0;
      transition(SAVE_QUEUE_STATE.IDLE);
      onSuccess({result,target});
      drain=true;
    }catch(error){
      fail({ok:false,error});
    }finally{
      inFlight=false;
      if(drain&&pending)void flush();
    }
  };

  return {
    enqueue(snapshot){
      pending=snapshot;
      if([SAVE_QUEUE_STATE.FAILED,SAVE_QUEUE_STATE.OFFLINE].includes(state)){attempts=0;transition(SAVE_QUEUE_STATE.IDLE);}
      void flush();
    },
    flush,
    resume(){
      if(state!==SAVE_QUEUE_STATE.OFFLINE)return;
      attempts=0;
      transition(SAVE_QUEUE_STATE.IDLE);
      void flush();
    },
    discard(){pending=null;attempts=0;retryScheduled=false;transition(SAVE_QUEUE_STATE.IDLE);},
    getState:()=>state,
    hasPending,
  };
};
