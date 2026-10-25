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

// Sessão do modo encarregado depois do PIN conferido. O servidor também
// confere o PIN no cadastro facial (handler.js, PONTO_EXIGIR_PIN_NO_SERVIDOR),
// então o PIN digitado fica guardado SÓ em memória, numa closure: não é
// propriedade do objeto (não sai em JSON.stringify, spread, log nem estado do
// React), nunca vai para disco/SecureStore/SQLite. descartar() apaga - a tela
// chama ao sair do modo encarregado (botão, inatividade ou desmontagem).
export function abrirSessaoResponsavel(responsavel, pin) {
  let guardado = String(pin || "").replace(/\D/g, "");
  return Object.freeze({
    userId: responsavel.userId,
    nome: responsavel.nome,
    pinParaServidor: () => guardado || null,
    descartar: () => { guardado = ""; },
  });
}

// Corpo de ponto-cadastrar-biometria com a prova do PIN. Sessão descartada =
// sem pinResponsavel (o servidor com o flag ligado recusa; não há como
// cadastrar com sessão encerrada).
export function corpoCadastroBiometria(sessao, campos) {
  const pin = sessao?.pinParaServidor?.() || null;
  return { ...campos, responsavelId: sessao.userId, ...(pin ? { pinResponsavel: pin } : {}) };
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
