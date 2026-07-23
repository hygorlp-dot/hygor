import { authenticateAppUser } from "./auth.js";

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

const buscarNoticias = async () => {
  try {
    const query = encodeURIComponent("construção civil OR obras OR engenharia civil");
    const url = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
    const r = await comTimeout(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return [];
    const xml = await r.text();
    return extrairManchetes(xml, 5);
  } catch (error) {
    console.error("Falha ao buscar notícias:", error?.name || error);
    return [];
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const user = await authenticateAppUser(req.body || {});
  if (!user) return res.status(401).json({ error: "Sessão inválida." });

  const [clima, noticias] = await Promise.all([buscarClima(), buscarNoticias()]);
  res.setHeader("Cache-Control", "private, max-age=900");
  return res.status(200).json({ ok: true, clima, noticias, cidade: "Caruaru, PE" });
}
