// Regras do portão de auditoria de dependências (CI, job financial-and-security
// e mobile-ponto-obra). Sem rede e sem npm: recebe o JSON do `npm audit` e a
// lista de exceções, e diz o que bloqueia. O script que chama o npm é
// scripts/auditoria-dependencias.mjs.
//
// Bloqueia todo advisory high/critical, exceto os que têm uma exceção formal
// em scripts/auditoria-excecoes.json. A exceção só vale enquanto:
//   - o escopo (raiz "." ou "apps/ponto-obra") estiver listado nela;
//   - a severidade for a mesma registrada (se subir, revisar de novo);
//   - a data de revisão não tiver passado;
//   - o pacote só atingir os pacotes registrados na exceção (atingidosPermitidos):
//     se uma dependência nova passar a puxá-lo, a exposição precisa ser revista;
//   - NÃO houver versão corrigida publicada (nenhuma versão estável fora da
//     faixa vulnerável e mais nova que a maior vulnerável, em qualquer tag).
// E bloqueia pacote high/critical que nenhum advisory do relatório explique.
// Ou seja: a exceção se revoga sozinha quando sai a correção.

export const SEVERIDADES_BLOQUEANTES = ["high", "critical"];
const SEVERIDADES_CONHECIDAS = ["info", "low", "moderate", "high", "critical"];
// Severidade fora do vocabulário do npm (ou ausente) também bloqueia.
export function bloqueia(severidade) {
  const s = String(severidade || "").toLowerCase();
  return SEVERIDADES_BLOQUEANTES.includes(s) || !SEVERIDADES_CONHECIDAS.includes(s);
}

// Advisories de verdade (os objetos em `via`), sem repetir por advisory E
// pacote: o mesmo GHSA pode atingir mais de um pacote e cada um conta. Um
// pacote que só "depende de" outro vulnerável não é advisory próprio.
// Objeto sem url vira "SEM-IDENTIFICACAO", que nenhuma exceção cobre.
export function advisoriesDoRelatorio(relatorio) {
  const porChave = new Map();
  for (const [nome, vuln] of Object.entries(relatorio?.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (!via || typeof via !== "object") continue;
      const url = via.url || "";
      const pacote = via.name || nome;
      const chave = `${url}|${pacote}`;
      if (!porChave.has(chave)) {
        porChave.set(chave, {
          ghsa: url ? url.split("/").pop() : "SEM-IDENTIFICACAO",
          pacote,
          severidade: String(via.severity || "").toLowerCase(),
          faixa: via.range,
          titulo: via.title,
          url,
        });
      }
    }
  }
  return [...porChave.values()].sort((a, b) => a.pacote.localeCompare(b.pacote) || a.ghsa.localeCompare(b.ghsa));
}

const parteNumerica = v => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(v).trim());
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || null };
};

function comparar(a, b) {
  for (let i = 0; i < 3; i += 1) if (a.nums[i] !== b.nums[i]) return a.nums[i] < b.nums[i] ? -1 : 1;
  if (a.pre === b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  // Identificador a identificador; numéricos como número (beta.9 < beta.10).
  const pa = a.pre.split("."), pb = b.pre.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = /^\d+$/.test(pa[i]), nb = /^\d+$/.test(pb[i]);
    if (na && nb && Number(pa[i]) !== Number(pb[i])) return Number(pa[i]) < Number(pb[i]) ? -1 : 1;
    if (na !== nb) return na ? -1 : 1;
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

// Faixa no formato que o npm audit devolve: comparadores separados por espaço
// (E), alternativas por "||" (OU). Ex.: "<=3.0.3", ">=1.0.0 <1.2.2", "*".
// Formato desconhecido -> null (quem chama trata como "não sei" e bloqueia).
export function versaoNaFaixa(versao, faixa) {
  const v = parteNumerica(versao);
  if (!v) return null;
  const alternativas = String(faixa || "").split("||").map(s => s.trim()).filter(Boolean);
  if (!alternativas.length) return null;
  let algumaValida = false;
  for (const alternativa of alternativas) {
    if (alternativa === "*") return true;
    const comparadores = alternativa.replace(/(<=|>=|<|>|=)\s+/g, "$1").split(/\s+/);
    let ok = true;
    for (const c of comparadores) {
      const m = /^(<=|>=|<|>|=)?(.+)$/.exec(c);
      const alvo = m && parteNumerica(m[2]);
      if (!alvo) return null;
      const r = comparar(v, alvo);
      const op = m[1] || "=";
      const passa = op === "<=" ? r <= 0 : op === ">=" ? r >= 0 : op === "<" ? r < 0 : op === ">" ? r > 0 : r === 0;
      if (!passa) { ok = false; break; }
    }
    algumaValida = true;
    if (ok) return true;
  }
  return algumaValida ? false : null;
}

// Existe versão publicada (estável) fora da faixa vulnerável e mais nova que
// a maior versão vulnerável? Olha a lista inteira, não só a tag "latest"
// (correção publicada em outra tag também revoga a exceção).
// Devolve a versão corrigida, false (não há) ou null (não dá para saber).
export function versaoCorrigidaPublicada(versoes, faixa) {
  const estaveis = (versoes || []).filter(v => { const p = parteNumerica(v); return p && !p.pre; });
  const vulneraveis = [], fora = [];
  for (const v of estaveis) {
    const r = versaoNaFaixa(v, faixa);
    if (r === null) return null;
    (r ? vulneraveis : fora).push(v);
  }
  if (!vulneraveis.length) return null;
  const maior = vulneraveis.map(parteNumerica).reduce((a, b) => (comparar(a, b) >= 0 ? a : b));
  const corrigida = fora.find(v => comparar(parteNumerica(v), maior) > 0);
  return corrigida || false;
}

// Pacotes atingidos por um pacote vulnerável: fechamento de `effects` do
// npm audit (quem depende dele, direta ou indiretamente).
export function atingidosPor(relatorio, pacote) {
  const vistos = new Set();
  const fila = [...(relatorio?.vulnerabilities?.[pacote]?.effects || [])];
  while (fila.length) {
    const n = fila.shift();
    if (vistos.has(n)) continue;
    vistos.add(n);
    fila.push(...(relatorio.vulnerabilities[n]?.effects || []));
  }
  return [...vistos].sort();
}

// versoesPublicadas: { [pacote]: ["x.y.z", ...] } (npm view <pacote> versions).
export function avaliarAuditoria({ relatorio, excecoes, escopo, hoje, versoesPublicadas = {} }) {
  const falhas = [];
  const excecoesAplicadas = [];
  if (!relatorio || relatorio.error || !relatorio.vulnerabilities) {
    falhas.push(`npm audit não devolveu relatório utilizável${relatorio?.error ? `: ${relatorio.error.summary || relatorio.error.code}` : ""}`);
    return { advisories: [], falhas, excecoesAplicadas, excecoesSemUso: [] };
  }
  const advisories = advisoriesDoRelatorio(relatorio);
  const daqui = (excecoes || []).filter(e => (e.escopos || []).includes(escopo));
  const usadas = new Set();

  // Nenhum pacote high/critical pode ficar sem advisory que o explique
  // (sem isso, um `via` fora do formato esperado passaria calado).
  const explicados = new Set(advisories.flatMap(a => [a.pacote, ...atingidosPor(relatorio, a.pacote)]));
  for (const [nome, v] of Object.entries(relatorio.vulnerabilities)) {
    if (bloqueia(v.severity) && !explicados.has(nome)) falhas.push(`${nome} (${v.severity}): sem advisory identificável no relatório do npm`);
  }

  for (const a of advisories) {
    if (!bloqueia(a.severidade)) continue;
    const ex = daqui.find(e => e.ghsa === a.ghsa && e.pacote === a.pacote);
    const rotulo = `${a.pacote} ${a.ghsa} (${a.severidade})`;
    if (!ex) { falhas.push(`${rotulo}: sem correção aplicada e sem exceção registrada`); continue; }
    usadas.add(ex);
    if (ex.severidade !== a.severidade) { falhas.push(`${rotulo}: a severidade mudou (exceção registrada como ${ex.severidade}) - revisar a exceção`); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.revisarAte || "") || ex.revisarAte < hoje) { falhas.push(`${rotulo}: exceção vencida ou sem data de revisão (revisarAte=${ex.revisarAte || "-"})`); continue; }
    // A exceção vale só para os caminhos analisados: se o pacote passar a
    // atingir outro (ex.: dependência de produção nova), revisar a exposição.
    const permitidos = new Set(ex.atingidosPermitidos?.[escopo] || []);
    const novos = atingidosPor(relatorio, a.pacote).filter(n => !permitidos.has(n));
    if (novos.length) { falhas.push(`${rotulo}: passou a atingir ${novos.join(", ")}, fora dos caminhos registrados na exceção - revisar a exposição`); continue; }
    const corrigida = versaoCorrigidaPublicada(versoesPublicadas[a.pacote], a.faixa);
    if (corrigida) { falhas.push(`${rotulo}: já existe versão corrigida (${a.pacote}@${corrigida}) - atualizar e remover a exceção`); continue; }
    if (corrigida === null) { falhas.push(`${rotulo}: não foi possível confirmar que segue sem correção (versões publicadas indisponíveis ou faixa "${a.faixa}" fora do formato)`); continue; }
    excecoesAplicadas.push({ ...a, revisarAte: ex.revisarAte, ultimaVulneravel: (versoesPublicadas[a.pacote] || []).filter(v => versaoNaFaixa(v, a.faixa) && !parteNumerica(v)?.pre).pop() });
  }
  const excecoesSemUso = daqui.filter(e => !usadas.has(e)).map(e => `${e.pacote} ${e.ghsa}`);
  return { advisories, falhas, excecoesAplicadas, excecoesSemUso };
}
