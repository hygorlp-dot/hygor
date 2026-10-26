// Pure transport boundary. No credentials or raw exception text in diagnostics.
export function criarTransporte({url,ambiente,obterToken,fetchImpl=globalThis.fetch,limiteMs=30_000}) {
  return async (action,corpo={})=>{
    if(!url)return {ok:false,status:-1,code:'SERVIDOR_NAO_CONFIGURADO',error:'Este aplicativo não tem servidor configurado. Nada foi enviado.'};
    let token;
    try { token=await obterToken?.(); }
    catch { return {ok:false,status:0,code:'SESSAO_LOCAL_INDISPONIVEL',error:'Não foi possível ler a sessão deste aparelho. Tente novamente ou procure o responsável.'}; }
    const controle=new AbortController();
    const timer=setTimeout(()=>controle.abort(),limiteMs);
    try {
      const response=await fetchImpl(url,{method:'POST',signal:controle.signal,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...corpo,ambienteApp:ambiente})});
      let json;
      try { json=await response.json(); } catch { return {ok:false,status:response.ok?502:response.status,code:'RESPOSTA_INVALIDA',error:'O servidor respondeu sem dados válidos. Tente novamente; os registros locais permanecem guardados.'}; }
      if(!json||typeof json!=='object'||Array.isArray(json))return {ok:false,status:response.ok?502:response.status,code:'RESPOSTA_INVALIDA',error:'Resposta inesperada do servidor. Tente novamente.'};
      return {...json,ok:response.ok&&json.ok!==false,status:response.status};
    } catch {
      return {ok:false,status:0,code:controle.signal.aborted?'TEMPO_ESGOTADO':'CONEXAO_INDISPONIVEL',error:controle.signal.aborted?'O servidor não respondeu a tempo. Tente novamente.':'Não foi possível conectar ao servidor. Confira a conexão e tente novamente.'};
    } finally { clearTimeout(timer); }
  };
}
