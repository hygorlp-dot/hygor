export const SAVE_QUEUE_STATE = Object.freeze({
  IDLE:"idle", SAVING:"saving", RETRY_SCHEDULED:"retry_scheduled", OFFLINE:"offline", CONFLICT:"conflict", FAILED:"failed",
});

const transientStatus=status=>[0,408,429,500,502,503,504].includes(status);

// Serializa snapshots já reconciliados pelo App. A fila não descarta uma nova
// alteração enquanto uma gravação está em voo e nunca reinicia sozinha depois
// de atingir o limite de falhas.
export const createSaveQueue = ({ save, capture, protect, release, onStorageError=()=>{}, onState = () => {}, onSuccess = () => {}, onConflict = () => {}, onRetry = () => {}, onFailed = () => {}, schedule = setTimeout, cancelSchedule = clearTimeout, maxRetries = 3, retryDelay = attempt => 1500 * attempt, isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false }) => {
  let state=SAVE_QUEUE_STATE.IDLE;
  let pending=null;
  let inFlight=false;
  let retryScheduled=false;
  let retryTimer=null;
  let destroyed=false;
  let attempts=0;
  let lastFailure=null;
  const waiters=new Set();
  let protectionTail=Promise.resolve();
  const remember=snapshot=>{
    if(!protect)return null;
    let context;
    try{context=capture?.();}catch(error){const rejected=Promise.reject(error);rejected.catch(()=>{});return rejected;}
    const promise=protectionTail.catch(()=>{}).then(()=>protect(snapshot,context));
    protectionTail=promise;promise.catch(()=>{});return promise;
  };

  const transition=next=>{state=next;onState(next);};
  const hasPending=()=>!destroyed&&(!!pending||inFlight||retryScheduled);
  const terminal=()=>[SAVE_QUEUE_STATE.CONFLICT,SAVE_QUEUE_STATE.FAILED,SAVE_QUEUE_STATE.OFFLINE].includes(state);
  const isSettled=()=>!inFlight&&!retryScheduled&&(terminal()||(!pending&&state===SAVE_QUEUE_STATE.IDLE));
  const settleWaiters=()=>{
    if(!isSettled())return;
    const result={ok:state===SAVE_QUEUE_STATE.IDLE,state,...(lastFailure?.reason?{reason:lastFailure.reason}:{})};
    for(const waiter of waiters){
      waiters.delete(waiter);
      if(waiter.timer)clearTimeout(waiter.timer);
      waiter.resolve(result);
    }
  };
  const waitForIdle=(timeoutMs=50000)=>{
    if(isSettled())return Promise.resolve({ok:state===SAVE_QUEUE_STATE.IDLE,state,...(lastFailure?.reason?{reason:lastFailure.reason}:{})});
    return new Promise(resolve=>{
      const waiter={resolve};
      waiters.add(waiter);
      if(timeoutMs>0)waiter.timer=setTimeout(()=>{
        if(!waiters.delete(waiter))return;
        resolve({ok:false,state,timeout:true});
      },timeoutMs);
    });
  };

  const flush=async()=>{
    if(destroyed||inFlight||retryScheduled||state===SAVE_QUEUE_STATE.CONFLICT||!pending)return;
    const entry=pending,target=entry.snapshot;
    pending=null;
    inFlight=true;
    transition(SAVE_QUEUE_STATE.SAVING);
    let drain=false,persisted=!protect,confirmed=false;
    const fail=result=>{
      lastFailure=result||{reason:"Falha desconhecida ao salvar."};
      if(!pending)pending=entry;
      if(isOffline()){
        transition(SAVE_QUEUE_STATE.OFFLINE);
        onFailed({result,attempts,pending:target,offline:true});
        return;
      }
      // Recusas de regra/permissão chegaram ao servidor e não serão resolvidas
      // repetindo a mesma requisição. Exibir o motivo real evita a mensagem
      // enganosa "sem resposta" e impede um loop de 409/403.
      const status=Number(result?.status||0);
      const retryable=!result?.local&&status!==408&&transientStatus(status);
      if(!retryable){
        transition(SAVE_QUEUE_STATE.FAILED);
        onFailed({result,attempts,pending:target,offline:false});
        return;
      }
      attempts+=1;
      if(attempts<=maxRetries){
        const serverDelay=status===429
          ?Math.max(0,Number(result?.retryAfter||result?.retry_after_seconds||0)*1000)
          :0;
        const delay=Math.max(retryDelay(attempts),serverDelay);
        retryScheduled=true;
        transition(SAVE_QUEUE_STATE.RETRY_SCHEDULED);
        onRetry({result,attempt:attempts,delay});
        retryTimer=schedule(()=>{
          retryTimer=null;
          retryScheduled=false;
          void flush();
        },delay);
      }else{
        transition(SAVE_QUEUE_STATE.FAILED);
        onFailed({result,attempts,pending:target});
      }
    };
    try{
      const receipt=entry.protection?await entry.protection:null;
      persisted=true;
      if(destroyed)return;
      const result=await save(target);
      if(destroyed)return;
      if(result?.conflict){
        if(!pending)pending=entry;
        attempts=0;
        transition(SAVE_QUEUE_STATE.CONFLICT);
        onConflict({result,pending:target});
        return;
      }
      if(!result?.ok){fail(result);return;}
      confirmed=true;
      attempts=0;
      lastFailure=null;
      transition(SAVE_QUEUE_STATE.IDLE);
      onSuccess({result,target});
      if(release){try{await release(receipt);}catch(error){onStorageError(error);}}
      drain=true;
    }catch(error){
      if(!destroyed&&!confirmed)fail({ok:false,error,...(!persisted?{local:true,reason:"Não enviado: não foi possível proteger a edição neste navegador."}:{})});
    }finally{
      inFlight=false;
      if(drain&&pending)void flush();
      else settleWaiters();
    }
  };

  const canRetry=()=>!destroyed&&!inFlight&&!!pending&&state===SAVE_QUEUE_STATE.FAILED&&transientStatus(Number(lastFailure?.status||0));
  return {
    canRetry,
    async protectPending(){if(!pending||inFlight||!protect)return false;pending.protection=remember(pending.snapshot);await pending.protection;return true;},
    enqueue(snapshot){
      if(destroyed)return Promise.resolve({ok:false,state:SAVE_QUEUE_STATE.FAILED,destroyed:true});
      pending={snapshot,protection:remember(snapshot)};
      if([SAVE_QUEUE_STATE.FAILED,SAVE_QUEUE_STATE.OFFLINE].includes(state)){attempts=0;lastFailure=null;transition(SAVE_QUEUE_STATE.IDLE);}
      void flush();
      return waitForIdle();
    },
    flush,
    waitForIdle,
    resume(){
      if(destroyed||(state!==SAVE_QUEUE_STATE.OFFLINE&&!canRetry()))return;
      if(pending&&protect)pending.protection=remember(pending.snapshot);
      attempts=0;lastFailure=null;
      transition(SAVE_QUEUE_STATE.IDLE);
      void flush();
    },
    discard({keepJournal=false}={}){
      const abandoned=pending;
      if(!keepJournal&&release&&abandoned?.protection)abandoned.protection.then(release).catch(onStorageError);
      pending=null;attempts=0;lastFailure=null;retryScheduled=false;
      if(retryTimer!=null){cancelSchedule(retryTimer);retryTimer=null;}
      transition(SAVE_QUEUE_STATE.IDLE);settleWaiters();
    },
    destroy(){
      destroyed=true;pending=null;attempts=0;retryScheduled=false;
      if(retryTimer!=null){cancelSchedule(retryTimer);retryTimer=null;}
      // Desmontagem não é falha de gravação visível para a próxima fila.
      state=SAVE_QUEUE_STATE.FAILED;
      settleWaiters();
    },
    getState:()=>state,
    getFailure:()=>lastFailure,
    hasPending,
  };
};
