// Import direto da lib, pulando o index.js do pdf-parse v1: seu modo debug
// (`!module.parent`) dispara sob ESM e tenta ler um PDF de teste inexistente.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

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

// R8N (padrão médio): não existe API pública, e a tabela oficial do
// Sinduscon-PE fica atrás de login de associado. Este agregador terceiro é a
// única fonte aberta com histórico mensal longo — serve de referência.
const CUB_URL = "https://myside.com.br/guia-imoveis/cub-pe";
const CUB_MESES = 24;

const numeroBR = texto => Number(String(texto || "").trim().replace(/\./g, "").replace(",", "."));

const buscarCubR8N = async () => {
  try {
    const r = await comTimeout(CUB_URL, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 10000);
    if (!r.ok) return [];
    const html = await r.text();
    const corpo = (html.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1];
    if (!corpo) return [];

    const linhas = corpo.split("<tr").slice(1);
    const serie = [];
    for (const linha of linhas) {
      const celulas = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/&nbsp;/g, " ").trim());
      if (celulas.length < 5 || !celulas[0]) continue;
      const valor = numeroBR(celulas[1]);
      if (!Number.isFinite(valor) || valor <= 0) continue;
      serie.push({ mes: celulas[0], valor });
    }
    // A tabela do site vem do mês mais recente para o mais antigo.
    return serie.slice(0, CUB_MESES).reverse();
  } catch (error) {
    console.error("Falha ao buscar CUB-PE R8N:", error?.name || error);
    return [];
  }
};

// R1-A (residência unifamiliar padrão alto): dado OFICIAL do Sinduscon-PE.
// A tabela consolidada exige login, mas o relatório mensal "Composição
// CUB/m²" (um PDF por mês, com todas as categorias — R1-A entre elas) é
// público. O site lista os PDFs de cada ano via um endpoint AJAX que também
// não exige login: POST /cub/conteudo {ano} devolve o HTML com o id de cada
// mês, e /cub/download/{id}/composicaoCubSemDeson devolve o PDF daquele mês.
const CUB_SINDUSCON_BASE = "https://sindusconpe.com.br/cub";
const R1A_MESES = 12;
const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const buscarIdsPorAno = async ano => {
  try {
    const r = await comTimeout(`${CUB_SINDUSCON_BASE}/conteudo`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0" },
      body: `ano=${ano}`,
    }, 10000);
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
const buscarValorAltoPadrao = async id => {
  try {
    const r = await comTimeout(`${CUB_SINDUSCON_BASE}/download/${id}/composicaoCubSemDeson`, { headers: { "user-agent": "Mozilla/5.0" } }, 12000);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    const { text } = await pdfParse(bytes);
    const secao = text.match(/Projetos-Padrão Residenciais - Alto\s*Item([^\n]*)[\s\S]*?Total([^\n]*)/);
    if (!secao) return null;
    const labels = [...secao[1].matchAll(/[A-Z]+\d*-[A-Z]/g)].map(m => m[0]);
    const valores = [...secao[2].matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(m => numeroBR(m[0]));
    const idx = labels.indexOf("R1-A");
    return idx >= 0 && Number.isFinite(valores[idx]) ? valores[idx] : null;
  } catch (error) {
    console.error("Falha ao ler composição CUB-PE:", error?.name || error);
    return null;
  }
};

const buscarCubR1A = async () => {
  const anoAtual = new Date().getFullYear();
  const [mesesAnoAtual, mesesAnoAnterior] = await Promise.all([
    buscarIdsPorAno(anoAtual), buscarIdsPorAno(anoAtual - 1),
  ]);
  const meses = [...mesesAnoAnterior, ...mesesAnoAtual].slice(-R1A_MESES);
  if (!meses.length) return [];
  const valores = await Promise.all(meses.map(m => buscarValorAltoPadrao(m.id)));
  return meses.map((m, i) => ({ mes: m.mes, valor: valores[i] })).filter(x => Number.isFinite(x.valor));
};

const buscarCubPE = async () => {
  const [r8n, r1a] = await Promise.all([buscarCubR8N(), buscarCubR1A()]);
  if (!r8n.length && !r1a.length) return null;

  const mapaR8N = new Map(r8n.map(x => [x.mes, x.valor]));
  const serie = r1a.length
    ? r1a.map(x => ({ mes: x.mes, r1a: x.valor, r8n: mapaR8N.get(x.mes) ?? null }))
    : r8n.map(x => ({ mes: x.mes, r1a: null, r8n: x.valor }));

  const ultimoR1a = [...r1a].reverse().find(x => Number.isFinite(x.valor));
  const ultimoR8n = r8n[r8n.length - 1];
  return {
    label: r1a.length
      ? "CUB-PE R1-A · residência unifamiliar padrão alto (Sinduscon-PE, oficial)"
      : "CUB-PE R8N · padrão médio (não foi possível ler o padrão alto agora)",
    fonteOficial: `${CUB_SINDUSCON_BASE}`,
    fonteR8N: CUB_URL,
    atual: { r1a: ultimoR1a?.valor ?? null, r8n: ultimoR8n?.valor ?? null, mes: ultimoR1a?.mes || ultimoR8n?.mes },
    serie,
  };
};

export const buildDailyBrief = async () => {
  const [clima, noticias, noticiasCbicPe, cub] = await Promise.all([
    buscarClima(), buscarNoticias(), buscarNoticiasCbicPe(), buscarCubPE(),
  ]);
  return { ok: true, clima, noticias, noticiasCbicPe, cub, cidade: "Caruaru, PE" };
};
