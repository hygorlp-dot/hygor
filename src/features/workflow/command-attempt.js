export const UNCONFIRMED_COMMAND='Sem confirmação do servidor. Confirme novamente nesta ficha para reenviar a mesma operação. Confira o histórico antes de fechar ou recarregar.';
// Uma resposta perdida não autoriza criar outra operação. Reenvia o comando
// original, inclusive versão, IDs do estoque/pagamento e chave idempotente.
export async function dispatchConfirmedAttempt(attempt,dispatch,build){
 if(attempt.busy)return {ok:false,reason:'Aguarde a confirmação da operação em andamento.'};
 attempt.busy=true;
 try{
  const result=await dispatch(data=>attempt.command||(attempt.command=build(data)));
  const status=Number(result?.status||0);
  if(result?.ok||(status>=400&&status<500&&![408,429].includes(status)))delete attempt.command;
  return result;
 }catch{return {ok:false,status:0,reason:UNCONFIRMED_COMMAND};}
 finally{attempt.busy=false;}
}
