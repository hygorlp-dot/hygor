// Gravação recusada pelo servidor (permissão, regra, validação): a edição
// otimista não pode continuar na tela como se estivesse salva. Achado #4 da
// matriz de 16/08 e brecha 9 do roteiro do piloto.
//
// Sem conexão (offline), erro transitório (0/408/429/5xx) ou sessão vencida
// (401) NÃO é recusa: a edição continua guardada para depois do novo login
// ou da nova tentativa.
const RETRYABLE_STATUS = new Set([0, 401, 408, 429, 500, 502, 503, 504]);

export const isServerRejection = ({ result, offline } = {}) => {
  if (offline) return false;
  const status = Number(result?.status || 0);
  return status > 0 && !RETRYABLE_STATUS.has(status);
};

// Seções de primeiro nível que diferem entre o último estado confirmado pelo
// servidor e o snapshot recusado - é o que a tela vai desfazer.
export const rejectedSections = (confirmed = {}, rejected = {}) => {
  const keys = new Set([...Object.keys(confirmed || {}), ...Object.keys(rejected || {})]);
  return [...keys]
    .filter(key => JSON.stringify(confirmed?.[key] ?? null) !== JSON.stringify(rejected?.[key] ?? null))
    .sort();
};
