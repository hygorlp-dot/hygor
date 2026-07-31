const UPSERT_ACTION="attendance-upsert";
const BATCH_ACTION="attendance-batch-upsert";

const asPatch=command=>({
  employeeId:command.employeeId,
  date:command.date,
  selectedObraId:command.selectedObraId,
  record:command.record,
});

/**
 * Fila exclusiva do ponto.
 *
 * O primeiro clique é enviado imediatamente. Enquanto ele está em trânsito,
 * novos lançamentos ficam acumulados e seguem juntos no próximo request.
 * Assim, uma sequência de marcações não disputa a fila dos demais módulos nem
 * obriga o servidor a gravar o dataset inteiro uma vez por célula.
 */
export const createAttendanceCommandQueue=({execute,createOperationId})=>{
  let running=false;
  let destroyed=false;
  const waiting=[];

  const takeNext=()=>{
    const first=waiting.shift();
    if(!first)return null;
    if(first.command?.action!==UPSERT_ACTION)return {
      command:first.command,
      entries:[first],
    };

    const entries=[first];
    while(waiting[0]?.command?.action===UPSERT_ACTION)entries.push(waiting.shift());
    if(entries.length===1)return {command:first.command,entries};

    return {
      command:{
        action:BATCH_ACTION,
        operationId:createOperationId(),
        confirmDailyCheck:entries.some(entry=>entry.command.confirmDailyCheck),
        patches:entries.map(entry=>asPatch(entry.command)),
      },
      entries,
    };
  };

  const drain=async()=>{
    if(running||destroyed)return;
    const batch=takeNext();
    if(!batch)return;
    running=true;
    let result;
    try{
      result=await execute(batch.command);
    }catch(error){
      result={ok:false,status:0,reason:error?.message||"O servidor não confirmou o registro de ponto."};
    }
    batch.entries.forEach(entry=>entry.resolve(result));
    running=false;
    if(waiting.length)queueMicrotask(drain);
  };

  return {
    enqueue(command){
      if(destroyed)return Promise.resolve({ok:false,reason:"A fila do ponto foi encerrada."});
      return new Promise(resolve=>{
        waiting.push({command,resolve});
        void drain();
      });
    },
    hasPending:()=>running||waiting.length>0,
    destroy(){
      destroyed=true;
      const result={ok:false,reason:"A fila do ponto foi encerrada."};
      waiting.splice(0).forEach(entry=>entry.resolve(result));
    },
  };
};

