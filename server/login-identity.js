// Tela de login pública: o que ela pode saber antes de alguém se identificar.
//
// A lista de operadores (nome + papel) era devolvida a qualquer visitante para
// montar os botões do PIN. Isso entregava a quem não tem conta quem é
// administrador e o id de cada um, faltando só adivinhar o PIN. Agora a tela
// pública recebe apenas se o sistema precisa do primeiro administrador; a
// pessoa digita o próprio e-mail ou nome completo, e o servidor resolve.

const ativos = usuarios => (Array.isArray(usuarios) ? usuarios : []).filter(u => u && u.active !== false);

export const respostaPerfisPublica = indice => ({
  precisaSetup: ativos(indice?.usuarios).length === 0,
});

export const normalizarIdentificador = valor => String(valor || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .trim().replace(/\s+/g, " ").toLowerCase();

// E-mail ou nome completo, sem diferenciar maiúsculas e acentos. Nome repetido
// entre dois usuários ativos não resolve: a pessoa precisa usar o e-mail.
export const resolverUsuarioPorIdentificador = (usuarios, identificador) => {
  const alvo = normalizarIdentificador(identificador);
  if (!alvo) return null;
  const lista = ativos(usuarios);
  const porEmail = lista.filter(u => normalizarIdentificador(u.email) === alvo);
  if (porEmail.length === 1) return porEmail[0];
  const porNome = lista.filter(u => normalizarIdentificador(u.nome) === alvo);
  return porNome.length === 1 ? porNome[0] : null;
};

// Limite de tentativas por usuário, além do limite por IP: tentativas vindas
// de várias origens contra a mesma pessoa somam no mesmo contador.
export const assuntoLimitePinUsuario = userId => `pin-usuario|${String(userId || "")}`;
