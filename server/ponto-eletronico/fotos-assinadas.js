// Cache somente de URLs, nunca da decisão de acesso. O chamador deve fornecer
// apenas caminhos autorizados na consulta atual. Não aumenta a validade (120s)
// nem publica fotos. Separado por cliente Supabase e empresa, limitado em memória.
const caches = new WeakMap();
const VALIDADE_SEGUNDOS = 120;
const REUSO_MS = 90_000;
const REPETIR_FALHA_MS = 60_000;
const MAX_ENTRADAS = 1000;

export async function assinarFotosEquipe({ db, company, caminhos, agora = Date.now }) {
  let cache = caches.get(db);
  if (!cache) { cache = new Map(); caches.set(db, cache); }
  const inicio = agora();
  for (const [chave, item] of cache) if (item.ate <= inicio) cache.delete(chave);
  const chaveDe = caminho => JSON.stringify([company, caminho]);
  const guardar = (caminho, item) => {
    const chave = chaveDe(caminho);
    cache.delete(chave);
    cache.set(chave, item);
    while (cache.size > MAX_ENTRADAS) cache.delete(cache.keys().next().value);
  };
  const resultado = new Map();
  const prazos = new Map();
  const faltantes = [];
  for (const caminho of new Set(caminhos)) {
    const item = cache.get(chaveDe(caminho));
    if (!item) faltantes.push(caminho);
    else if (item.url) { resultado.set(caminho, item.url); prazos.set(caminho, item.ate); }
  }
  for (let i = 0; i < faltantes.length; i += 100) {
    const lote = faltantes.slice(i, i + 100);
    // Conta a validade antes da chamada: uma resposta lenta não estende o TTL.
    const iniciadoEm = agora();
    let resposta;
    try { resposta = await db.storage.from("ponto-obra").createSignedUrls(lote, VALIDADE_SEGUNDOS); }
    catch { resposta = { error: true }; }
    const urls = new Map();
    if (!resposta?.error) for (const foto of resposta?.data || []) {
      if (foto.signedUrl && !foto.error && lote.includes(foto.path)) urls.set(foto.path, foto.signedUrl);
    }
    for (const caminho of lote) {
      const url = urls.get(caminho);
      if (url && agora() < iniciadoEm + REUSO_MS) {
        guardar(caminho, { url, ate: iniciadoEm + REUSO_MS });
        resultado.set(caminho, url);
        prazos.set(caminho, iniciadoEm + REUSO_MS);
      } else {
        // Mantém o fallback já usado pelo painel e evita martelar Storage em
        // quota excedida/indisponibilidade. Não guarda mensagem nem credenciais.
        guardar(caminho, { ate: agora() + REPETIR_FALHA_MS });
      }
    }
  }
  // Um lote posterior lento também pode consumir a margem de um lote anterior.
  for (const [caminho, prazo] of prazos) if (prazo <= agora()) resultado.delete(caminho);
  return resultado;
}
