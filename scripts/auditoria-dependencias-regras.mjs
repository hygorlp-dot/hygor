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
//   - NÃO houver versão corrigida publicada (a versão mais recente do pacote
//     no registro ainda cai na faixa vulnerável do advisory).
// Ou seja: a exceção se revoga sozinha quando sai a correção.

export const SEVERIDADES_BLOQUEANTES = ["high", "critical"];

// Advisories de verdade (os objetos em `via`), sem repetir. Um pacote que só
// "depende de" outro vulnerável não é advisory próprio.
export function advisoriesDoRelatorio(relatorio) {
  const porUrl = new Map();
  for (const vuln of Object.values(relatorio?.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (!via || typeof via !== "object" || !via.url) continue;
      if (!porUrl.has(via.url)) {
        porUrl.set(via.url, {
          ghsa: via.url.split("/").pop(),
          pacote: via.name,
          severidade: via.severity,
          faixa: via.range,
          titulo: via.title,
          url: via.url,
        });
      }
    }
  }
  return [...porUrl.values()].sort((a, b) => a.pacote.localeCompare(b.pacote) || a.ghsa.localeCompare(b.ghsa));
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
  return a.pre < b.pre ? -1 : 1;
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

// ultimaVersao: { [pacote]: "x.y.z" } (versão mais recente no registro).
export function avaliarAuditoria({ relatorio, excecoes, escopo, hoje, ultimaVersao = {} }) {
  const falhas = [];
  const excecoesAplicadas = [];
  if (!relatorio || relatorio.error || !relatorio.vulnerabilities) {
    falhas.push(`npm audit não devolveu relatório utilizável${relatorio?.error ? `: ${relatorio.error.summary || relatorio.error.code}` : ""}`);
    return { advisories: [], falhas, excecoesAplicadas, excecoesSemUso: [] };
  }
  const advisories = advisoriesDoRelatorio(relatorio);
  const daqui = (excecoes || []).filter(e => (e.escopos || []).includes(escopo));
  const usadas = new Set();

  for (const a of advisories) {
    if (!SEVERIDADES_BLOQUEANTES.includes(a.severidade)) continue;
    const ex = daqui.find(e => e.ghsa === a.ghsa && e.pacote === a.pacote);
    const rotulo = `${a.pacote} ${a.ghsa} (${a.severidade})`;
    if (!ex) { falhas.push(`${rotulo}: sem correção aplicada e sem exceção registrada`); continue; }
    usadas.add(ex);
    if (ex.severidade !== a.severidade) { falhas.push(`${rotulo}: a severidade mudou (exceção registrada como ${ex.severidade}) - revisar a exceção`); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.revisarAte || "") || ex.revisarAte < hoje) { falhas.push(`${rotulo}: exceção vencida ou sem data de revisão (revisarAte=${ex.revisarAte || "-"})`); continue; }
    const ultima = ultimaVersao[a.pacote];
    const aindaVulneravel = ultima ? versaoNaFaixa(ultima, a.faixa) : null;
    if (aindaVulneravel === false) { falhas.push(`${rotulo}: já existe versão corrigida (${a.pacote}@${ultima}) - atualizar e remover a exceção`); continue; }
    if (aindaVulneravel === null) { falhas.push(`${rotulo}: não foi possível confirmar que segue sem correção (última versão: ${ultima || "desconhecida"}, faixa "${a.faixa}")`); continue; }
    excecoesAplicadas.push({ ...a, revisarAte: ex.revisarAte, ultimaVersao: ultima });
  }
  const excecoesSemUso = daqui.filter(e => !usadas.has(e)).map(e => `${e.pacote} ${e.ghsa}`);
  return { advisories, falhas, excecoesAplicadas, excecoesSemUso };
}
