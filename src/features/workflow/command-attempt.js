import {attemptStore} from './attempt-store.js';
export const UNCONFIRMED_COMMAND='Sem confirmação do servidor. Reenvie nesta ficha ou use Retomar trabalho salvo após recarregar. Confira o histórico antes de criar outra operação.';
// Uma resposta perdida não autoriza criar outra operação. Reenvia o comando
// original, inclusive versão, IDs do estoque/pagamento e chave idempotente.
export async function dispatchConfirmedAttempt(attempt,dispatch,build){
 if(attempt.busy)return {ok:false,reason:'Aguarde a confirmação da operação em andamento.'};
 const retry=!!attempt.command;
 attempt.busy=true;
 try{
  const result=await dispatch(async data=>{
   const command=attempt.command||(attempt.command=build(data));
   if(attempt.owner){try{attempt.key=await (attempt.store||attemptStore).protect(attempt.owner,command,attempt.context);}catch(error){throw Object.assign(error,{local:true});}}
   return command;
  });
  const status=Number(result?.status||0);
  if(result?.ok||(status>=400&&status<500&&![408,429,...(retry?[401,403]:[])].includes(status))){if(attempt.key)await (attempt.store||attemptStore).resolve(attempt.key,!!result?.ok).catch(()=>{});delete attempt.command;}
  return result;
 }catch(error){if(error.local){if(!retry)delete attempt.command;return {ok:false,status:400,reason:`Não enviado: ${error.message||'armazenamento local indisponível'}`};}return {ok:false,status:0,reason:UNCONFIRMED_COMMAND};}
 finally{attempt.busy=false;}
}
