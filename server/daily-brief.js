// Caruaru, PE
const LAT = -8.2839, LON = -35.9761;

const WEATHER_LABELS = {
  0: "Céu limpo", 1: "Poucas nuvens", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Neblina", 48: "Neblina com geada",
  51: "Garoa fraca", 53: "Garoa", 55: "Garoa forte",
  61: "Chuva fraca", 63: "Chuva", 65: "Chuva forte",
  80: "Pancadas de chuva", 81: "Pancadas de chuva", 82: "Pancadas fortes",
  95: "Trovoada", 96: "Trovoada com granizo", 99: "Trovoada forte",
};
const weatherIcon = code => {
  if (code === 0 || code === 1) return "sun";
  if (code >= 95) return "zap";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "cloud";
  return "cloudRain";
};

const comTimeout = async (url, options = {}, ms = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const buscarClima = async () => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=America%2FRecife`;
    const r = await comTimeout(url);
    if (!r.ok) return null;
    const j = await r.json();
    const code = j.current?.weather_code;
    if (typeof j.current?.temperature_2m !== "number") return null;
    return {
      temperatura: Math.round(j.current.temperature_2m),
      umidade: Math.round(j.current.relative_humidity_2m ?? 0),
      condicao: WEATHER_LABELS[code] || "—",
      icone: weatherIcon(code),
    };
  } catch (error) {
    console.error("Falha ao buscar clima:", error?.name || error);
    return null;
  }
};

// RSS do Google News tem formato fixo e estável o suficiente para extração
// por regex — evita puxar uma dependência de XML só para 5 manchetes.
const extrairManchetes = (xml, limite = 5) => {
  const itens = [];
  const blocos = xml.split("<item>").slice(1);
  for (const bloco of blocos) {
    if (itens.length >= limite) break;
    const tituloBruto = (bloco.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const link = (bloco.match(/<link>([\s\S]*?)<\/link>/) || [])[1];
    const fonte = (bloco.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1];
    if (!tituloBruto) continue;
    const titulo = tituloBruto.replace("<![CDATA[", "").replace("]]>", "").trim();
    itens.push({ titulo, link: (link || "").trim(), fonte: (fonte || "").trim() });
  }
  return itens;
};

const buscarNoticiasRSS = async (query, limite = 5) => {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
    const r = await comTimeout(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return [];
    const xml = await r.text();
    return extrairManchetes(xml, limite);
  } catch (error) {
    console.error("Falha ao buscar notícias:", error?.name || error);
    return [];
  }
};

const buscarNoticias = () => buscarNoticiasRSS("construção civil OR obras OR engenharia civil", 5);
const buscarNoticiasCbicPe = () => buscarNoticiasRSS('"CBIC" OR "Sinduscon-PE" Pernambuco construção', 5);

// Não existe API pública para o CUB. A tabela oficial do Sinduscon-PE fica
// atrás de login de associado; a única fonte aberta com histórico mensal é
// este agregador terceiro, que só publica a categoria R8N (padrão médio) —
// não há fonte gratuita confiável para "casa alto padrão". Isso é deixado
// explícito no rótulo devolvido ao front, para não passar dado errado como
// se fosse a categoria pedida.
const CUB_URL = "https://myside.com.br/guia-imoveis/cub-pe";
const CUB_MESES = 24;

const numeroBR = texto => Number(String(texto || "").trim().replace(/\./g, "").replace(",", "."));

const buscarCubPE = async () => {
  try {
    const r = await comTimeout(CUB_URL, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 10000);
    if (!r.ok) return null;
    const html = await r.text();
    const corpo = (html.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1];
    if (!corpo) return null;

    const linhas = corpo.split("<tr").slice(1);
    const serie = [];
    for (const linha of linhas) {
      const celulas = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/&nbsp;/g, " ").trim());
      if (celulas.length < 5 || !celulas[0]) continue;
      const valor = numeroBR(celulas[1]);
      if (!Number.isFinite(valor) || valor <= 0) continue;
      serie.push({
        mes: celulas[0],
        valor,
        variacaoMes: celulas[2] || null,
        variacaoAno: celulas[3] || null,
        variacao12m: celulas[4] || null,
      });
    }
    if (!serie.length) return null;

    // A tabela do site vem do mês mais recente para o mais antigo.
    const recentes = serie.slice(0, CUB_MESES).reverse();
    return {
      categoria: "R8N",
      label: "CUB-PE R8N · padrão médio (fonte não-oficial, não há série aberta para casa alto padrão)",
      fonte: CUB_URL,
      atual: serie[0],
      serie: recentes,
    };
  } catch (error) {
    console.error("Falha ao buscar CUB-PE:", error?.name || error);
    return null;
  }
};

export const buildDailyBrief = async () => {
  const [clima, noticias, noticiasCbicPe, cub] = await Promise.all([
    buscarClima(), buscarNoticias(), buscarNoticiasCbicPe(), buscarCubPE(),
  ]);
  return { ok: true, clima, noticias, noticiasCbicPe, cub, cidade: "Caruaru, PE" };
};
