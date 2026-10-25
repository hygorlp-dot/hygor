// PIN do responsável no aparelho, conferido OFFLINE contra o hash PBKDF2 que
// veio na sincronização (server/ponto-eletronico/handler.js → hashPin).
// pbkdf2Hex(pin, salt, iteracoes) é injetado: @noble/hashes no app,
// crypto do Node nos testes.
export function verificarPinResponsavel(pin, responsaveis, pbkdf2Hex) {
  const limpo = String(pin || "").replace(/\D/g, "");
  if (limpo.length < 4) return null;
  for (const r of responsaveis || []) {
    if (pbkdf2Hex(limpo, r.pinSalt, Number(r.pinIteracoes)) === r.pinHash) return { userId: r.userId, nome: r.nome };
  }
  return null;
}

// Trava contra tentativa e erro no aparelho: depois de 5 erros seguidos,
// espera crescente (30 s, 60 s, 120 s...).
export function proximaEsperaPin(errosSeguidos) {
  if (errosSeguidos < 5) return 0;
  return Math.min(30_000 * 2 ** (errosSeguidos - 5), 15 * 60_000);
}

// A tentativa é gravada ANTES de conferir o PIN: encerrar o aplicativo no
// meio da derivação não apaga a contagem. A UI recebe apenas o resultado;
// PIN/hash nunca são gravados neste estado.
export function criarProtecaoPin({ler,gravar,agora=()=>Date.now()}){
  let corrente=Promise.resolve();
  const tentar=async conferir=>{
    const raw=await ler();
    const state=raw?JSON.parse(raw):{erros:0,bloqueadoAte:0};
    if(!Number.isInteger(state.erros)||state.erros<0||!Number.isFinite(state.bloqueadoAte)||state.bloqueadoAte<0)throw Error('Proteção do PIN indisponível. Avise o suporte.');
    const now=agora();
    if(now<state.bloqueadoAte)return {ok:false,esperaMs:state.bloqueadoAte-now};
    const erros=state.erros+1,esperaMs=proximaEsperaPin(erros);
    await gravar(JSON.stringify({erros,bloqueadoAte:now+esperaMs}));
    const responsavel=await conferir();
    if(responsavel){await gravar(JSON.stringify({erros:0,bloqueadoAte:0}));return {ok:true,responsavel};}
    return {ok:false,esperaMs};
  };
  return {tentar(conferir){const resultado=corrente.then(()=>tentar(conferir));corrente=resultado.catch(()=>{});return resultado;}};
}
