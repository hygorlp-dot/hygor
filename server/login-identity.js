const ativos=usuarios => (Array.isArray(usuarios)?usuarios:[]).filter(usuario => usuario&&usuario.active!==false);

// A tela pública só precisa saber se deve oferecer o cadastro inicial. Os
// identificadores e permissões dos operadores ficam no servidor até o login.
export const respostaPerfisPublica=indice => ({
  precisaSetup:!Array.isArray(indice?.usuarios)||indice.usuarios.length===0,
});

export const normalizarIdentificador=valor => (typeof valor==="string"?valor:"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .trim().replace(/\s+/g," ").toLowerCase();

export const resolverUsuarioPorIdentificador=(usuarios,identificador) => {
  const alvo=normalizarIdentificador(identificador);
  if(!alvo)return null;
  const lista=ativos(usuarios);
  const porEmail=lista.filter(usuario => normalizarIdentificador(usuario.email)===alvo);
  if(porEmail.length)return porEmail.length===1?porEmail[0]:null;
  const porNome=lista.filter(usuario => normalizarIdentificador(usuario.nome)===alvo);
  return porNome.length===1?porNome[0]:null;
};

// Nome, e-mail e sessões já abertas compartilham o contador do ID canônico.
// applyPersistentAuthRateLimit transforma este sujeito em hash antes da RPC.
export const assuntoLimitePinUsuario=userId => `pin-usuario|${String(userId||"")}`;
