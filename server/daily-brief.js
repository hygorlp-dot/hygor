// Import direto da lib, pulando o index.js do pdf-parse v1: seu modo debug
// (`!module.parent`) dispara sob ESM e tenta ler um PDF de teste inexistente.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { CUB_PE_PROJECTS, parseCubPeComposition } from "./cub-pe.js";

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

// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): o CUB-PE
// some do Dashboard de forma intermitente - reproduzido em produção (duas
// recargas seguidas da mesma sessão, uma com o gráfico e outra sem). Cada
// `comTimeout` já limita a chamada individual, mas nada limitava o tempo
// TOTAL da coleta (listar meses + baixar/ler até 12 PDFs em paralelo) - se
// mesmo uma dessas chamadas demorar perto do próprio limite, a função
// inteira do daily-brief pode ultrapassar o tempo de execução da Vercel e
// morrer sem devolver nada (nem clima, nem notícias). Este orçamento
// desiste da coleta do CUB isoladamente (devolvendo `fallback`) sem afetar
// o resto do brief, que já é rápido por natureza.
export const comOrcamento = async (promise, ms, fallback) => {
  let venceu = false;
  const limite = new Promise(resolve => setTimeout(() => { venceu = true; resolve(fallback); }, ms));
  // `.catch` aqui é defensivo: nenhuma função de coleta deste arquivo rejeita
  // hoje (todas tratam seu próprio erro e devolvem null/[]), mas comOrcamento
  // não deve depender disso para nunca derrubar o daily-brief inteiro.
  const resultado = await Promise.race([promise.catch(() => fallback), limite]);
  if (venceu) console.error(`Coleta do CUB-PE abandonada após ${ms}ms (orçamento de tempo do daily-brief).`);
  return resultado;
};

// Escala padrão da OMS para índice UV.
const uvLabel = uv => {
  if (uv >= 11) return "extremo";
  if (uv >= 8) return "muito alto";
  if (uv >= 6) return "alto";
  if (uv >= 3) return "moderado";
  return "baixo";
};

const buscarClima = async () => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index&timezone=America%2FRecife`;
    const r = await comTimeout(url);
    if (!r.ok) return null;
    const j = await r.json();
    const code = j.current?.weather_code;
    if (typeof j.current?.temperature_2m !== "number") return null;
    const uv = j.current?.uv_index;
    return {
      temperatura: Math.round(j.current.temperature_2m),
      umidade: Math.round(j.current.relative_humidity_2m ?? 0),
      vento: Math.round(j.current.wind_speed_10m ?? 0),
      uv: Number.isFinite(uv) ? Math.round(uv * 10) / 10 : null,
      uvLabel: Number.isFinite(uv) ? uvLabel(uv) : null,
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

// R1-A (residência unifamiliar padrão alto): dado OFICIAL do Sinduscon-PE.
// A tabela consolidada exige login, mas o relatório mensal "Composição
// CUB/m²" (um PDF por mês, com todas as categorias — R1-A entre elas) é
// público. O site lista os PDFs de cada ano via um endpoint AJAX que também
// não exige login: POST /cub/conteudo {ano} devolve o HTML com o id de cada
// mês, e /cub/download/{id}/composicaoCubSemDeson devolve o PDF daquele mês.
const CUB_SINDUSCON_BASE = "https://sindusconpe.com.br/cub";
const CUB_MESES = 12;
const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const buscarIdsPorAno = async ano => {
  try {
    const r = await comTimeout(`${CUB_SINDUSCON_BASE}/conteudo`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0" },
      body: `ano=${ano}`,
    }, 6000);
    if (!r.ok) return [];
    const json = await r.json();
    const html = json?.html || "";
    const linhas = html.split("<tr>").slice(2); // a 1ª ocorrência de <tr> é o cabeçalho
    const meses = [];
    for (const linha of linhas) {
      const nomeMes = (linha.match(/<th>([^<]+)<\/th>/) || [])[1];
      const id = (linha.match(/\/cub\/download\/(\d+)\/composicaoCubSemDeson/) || [])[1];
      const idxMes = MESES_PT.indexOf(nomeMes);
      if (idxMes < 0 || !id) continue;
      meses.push({ mes: `${MESES_ABREV[idxMes]}/${String(ano).slice(2)}`, id: Number(id) });
    }
    return meses;
  } catch (error) {
    console.error("Falha ao listar meses do CUB-PE:", error?.name || error);
    return [];
  }
};

// O texto extraído do PDF junta as colunas sem separador (ex.:
// "3.195,792.572,732.652,05"); como todo valor em reais termina em vírgula +
// 2 dígitos, dá para recuperar os limites de cada número sem ambiguidade.
const buscarValoresProjetos = async id => {
  try {
    const r = await comTimeout(`${CUB_SINDUSCON_BASE}/download/${id}/composicaoCubSemDeson`, { headers: { "user-agent": "Mozilla/5.0" } }, 5000);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    const { text } = await pdfParse(bytes);
    const valores = parseCubPeComposition(text);
    return Object.keys(valores).length ? valores : null;
  } catch (error) {
    console.error("Falha ao ler composição CUB-PE:", error?.name || error);
    return null;
  }
};

const buscarCubOficial = async () => {
  const anoAtual = new Date().getFullYear();
  const [mesesAnoAtual, mesesAnoAnterior] = await Promise.all([
    buscarIdsPorAno(anoAtual), buscarIdsPorAno(anoAtual - 1),
  ]);
  const meses = [...mesesAnoAnterior, ...mesesAnoAtual].slice(-CUB_MESES);
  if (!meses.length) return [];
  const valores = await Promise.all(meses.map(m => buscarValoresProjetos(m.id)));
  return meses.map((m, i) => ({ mes: m.mes, valores: valores[i] })).filter(x => x.valores);
};

const buscarCubPE = async () => {
  const serie = await buscarCubOficial();
  if (!serie.length) return null;
  const ultimo = serie[serie.length - 1];
  return {
    label: "CUB-PE · projetos-padrão do Sinduscon-PE",
    fonteOficial: CUB_SINDUSCON_BASE,
    regime: "sem_desoneracao",
    regimeLabel: "Mão de obra com encargos sociais (sem desoneração)",
    projetos: CUB_PE_PROJECTS,
    atual: { mes: ultimo.mes, valores: ultimo.valores },
    serie,
  };
};

export const buildDailyBrief = async () => {
  const [clima, noticias, noticiasCbicPe, cub] = await Promise.all([
    buscarClima(), buscarNoticias(), buscarNoticiasCbicPe(), comOrcamento(buscarCubPE(), 7000, null),
  ]);
  return { ok: true, clima, noticias, noticiasCbicPe, cub, cidade: "Caruaru, PE" };
};
