// Validação do token de sessão (JWT do Supabase Auth).
//
// Padrão: `auth.getUser(token)` - uma chamada de rede ao servidor de
// autenticação em TODA requisição (salvar, carregar, presença, chat).
// Com AUTH_LOCAL_JWT=1, `auth.getClaims(token)` confere assinatura e validade
// localmente com as chaves públicas (JWKS) do projeto, em cache na instância,
// e a chamada de rede some. O projeto assina com ES256 (assimétrico); com
// chave simétrica o getClaims já pergunta ao servidor sozinho.
//
// DECISÃO DE SEGURANÇA - por isso vem DESLIGADO: o `getUser` enxerga na hora
// uma sessão revogada no Supabase (usuário banido, "sair de todos os
// dispositivos"); a validação local só percebe quando o token expira (até 1 h).
// A desativação feita DENTRO do ArcD (`usuarios[].active = false`) continua
// valendo imediatamente nos dois modos, pois é conferida em cada requisição.
//
// Só um sucesso local encerra a validação; qualquer outra coisa (erro, falha ao
// buscar o JWKS, token inválido) cai no getUser, que continua sendo a
// autoridade. Devolve o mesmo formato do getUser: { data:{ user }, error }.
export const criarValidadorDeToken = (authDb, { local = () => process.env.AUTH_LOCAL_JWT === "1" } = {}) =>
  async accessToken => {
    if (!accessToken) return { data: null, error: null };
    if (local() && typeof authDb?.auth?.getClaims === "function") {
      try {
        const { data, error } = await authDb.auth.getClaims(accessToken);
        const claims = data?.claims;
        // Só token de usuário: o da chave anon/service não tem `sub` nem role "authenticated".
        if (!error && claims?.sub && claims.role === "authenticated") {
          return { data: { user: { id: claims.sub, email: claims.email || "" } }, error: null };
        }
      } catch { /* cai na validação pelo servidor de autenticação */ }
    }
    return authDb.auth.getUser(accessToken);
  };
