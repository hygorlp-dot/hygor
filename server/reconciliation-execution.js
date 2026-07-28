// Reexecuta o mesmo comando idempotente sobre a fotografia mais recente
// quando outra seção é salva simultaneamente. Nenhum snapshot calculado no
// navegador é reaplicado e nenhum lançamento parcial é produzido.
export const executeReconciliationWithRetry=async({
  initial,execute,persist,reload,maxAttempts=6,
})=>{
  let base=initial;
  for(let attempt=0;attempt<maxAttempts;attempt+=1){
    const executed=execute(base.payload);
    if(executed.error)return {kind:"error",...executed,base,attempts:attempt+1};
    if(executed.idempotent)return {kind:"idempotent",...executed,base,attempts:attempt+1};
    const saved=await persist(base,executed);
    if(saved?.applied)return {kind:"saved",executed,saved,base,attempts:attempt+1};
    if(attempt<maxAttempts-1)base=await reload();
  }
  return {kind:"busy",base,attempts:maxAttempts};
};
