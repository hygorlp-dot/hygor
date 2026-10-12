// Regras de AMBIENTE do app (produção x homologação), usadas no BUILD
// (app.config.js) e em EXECUÇÃO (src/servicos/conexao.js, pareamento,
// sincronização). CommonJS e sem dependências: o app.config.js roda no Node do EAS.
//
// Por quê: um APK de homologação que fale com a produção gera NSR fiscal real
// e permanente. Então:
//   - PONTO_AMBIENTE é OBRIGATÓRIO (producao | homologacao): build sem ele
//     falha - nunca vira produção por omissão;
//   - homologação EXIGE PONTO_API_URL explícita, num host com "homolog" no
//     nome (lista permitida), e RECUSA a produção, os previews da Vercel do
//     projeto de produção ("pontos"), IP literal e host com ponto final;
//   - homologação ganha PACOTE Android próprio (instalação, SecureStore e
//     banco separados do app de produção);
//   - em execução, o app só pareia/sincroniza com servidor que CONFIRMA o
//     mesmo ambiente (o servidor confirma pelo marcador no banco e recusa o
//     projeto Supabase de produção - server/ponto-eletronico/ambiente.js).
const AMBIENTES = ["producao", "homologacao"];
// Produção do ARCD na Vercel: projeto "pontos" (aliases pontos/pontosarcd e
// previews pontos-<hash>-<time>.vercel.app / pontos-git-<branch>-<time>.vercel.app).
const HOSTS_PRODUCAO = ["pontosarcd.vercel.app", "pontos.vercel.app"];
const PREVIEW_PRODUCAO = /^pontos(arcd)?(-[a-z0-9-]+)?\.vercel\.app$/;
const IP_LITERAL = /^(\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])$/i;
const NOME_AMBIENTE = { producao: "PRODUÇÃO", homologacao: "HOMOLOGAÇÃO — NÃO OFICIAL" };
const SUFIXO_PACOTE_HOMOLOGACAO = ".homologacao";

const hostNormalizado = host => String(host || "").trim().toLowerCase().replace(/\.+$/, "").replace(/:\d+$/, "");
const ehHostDeProducao = host => {
  const h = hostNormalizado(host);
  return HOSTS_PRODUCAO.includes(h) || PREVIEW_PRODUCAO.test(h);
};

const normalizarAmbiente = valor => {
  const a = String(valor ?? "").trim().toLowerCase();
  if (!a) throw new Error("PONTO_AMBIENTE é obrigatório (producao ou homologacao): o build não escolhe a produção por omissão.");
  if (!AMBIENTES.includes(a)) throw new Error(`PONTO_AMBIENTE desconhecido: "${a}" (use producao ou homologacao)`);
  return a;
};

const urlHttps = (url, nome) => {
  let u;
  try { u = new URL(String(url)); } catch { throw new Error(`${nome} inválida`); }
  if (u.protocol !== "https:") throw new Error(`${nome} precisa ser https`);
  return u;
};

// No BUILD: decide o servidor embutido no APK, ou falha (o build para).
function resolverServidor({ ambiente, urlEnv, urlPadrao }) {
  const a = normalizarAmbiente(ambiente);
  if (a === "homologacao") {
    if (!String(urlEnv || "").trim()) {
      throw new Error("Perfil de homologação exige PONTO_API_URL (backend de homologação ISOLADO, com banco e Storage próprios). Sem ela o build não sai - nunca cai na produção.");
    }
    const u = urlHttps(urlEnv, "PONTO_API_URL");
    const h = hostNormalizado(u.host);
    if (ehHostDeProducao(h)) throw new Error(`PONTO_API_URL aponta para a PRODUÇÃO (${h}) num build de homologação - recusado.`);
    if (IP_LITERAL.test(h) || u.hostname.endsWith(".")) throw new Error("PONTO_API_URL de homologação precisa ser um nome de host (sem IP e sem ponto final).");
    if (!/homolog/.test(h)) throw new Error(`PONTO_API_URL de homologação precisa ter "homolog" no nome do host (${h}): convenção que separa os projetos.`);
    return { ambiente: a, apiUrl: u.toString() };
  }
  const u = urlHttps(urlEnv || urlPadrao, urlEnv ? "PONTO_API_URL" : "apiUrl do app.json");
  return { ambiente: a, apiUrl: u.toString() };
}

// Em EXECUÇÃO: o servidor sem o campo "ambiente" (versão antiga) é produção.
function conferirAmbiente(doApp, doServidor) {
  const app = AMBIENTES.includes(doApp) ? doApp : "producao";
  const servidor = AMBIENTES.includes(doServidor) ? doServidor : "producao";
  if (app === servidor) return { ok: true, mensagem: "" };
  return {
    ok: false,
    mensagem: `Este aplicativo é de ${NOME_AMBIENTE[app]} e o servidor é de ${NOME_AMBIENTE[servidor]}. O aparelho NÃO foi vinculado e nada foi enviado.`,
  };
}

// Pareamento: o que fazer com a resposta de "ponto-ambiente".
//   status 0/-1 (sem rede, sem servidor) ou 503 de ambiente não confirmado: parar com a mensagem;
//   400 sem "ambiente" = servidor ANTIGO (sem a ação) = produção;
//   qualquer outra falha sem "ambiente" (5xx...): não confirmado - parar;
//   com "ambiente": comparar.
function decidirAmbienteDoPareamento(resposta, ambienteApp) {
  const r = resposta || {};
  if (r.ok) return conferirAmbiente(ambienteApp, r.ambiente);
  if (r.status === 0 || r.status === -1 || r.code === "AMBIENTE_NAO_CONFIRMADO") return { ok: false, parar: "falha" };
  if (r.status === 400 && r.ambiente === undefined) return conferirAmbiente(ambienteApp, "producao");
  return { ok: false, mensagem: "O servidor não confirmou o próprio ambiente. O aparelho NÃO foi vinculado; tente de novo ou chame o suporte." };
}

// Sessão guardada no aparelho: só vale no MESMO ambiente e servidor em que foi
// pareada. Sessões antigas (sem os campos) são de produção e sem servidor fixo.
function sessaoConfereCom(sessao, ambiente, host) {
  if (!sessao) return false;
  return (sessao.ambiente || "producao") === ambiente && (!sessao.servidor || sessao.servidor === host);
}

module.exports = {
  AMBIENTES, HOSTS_PRODUCAO, NOME_AMBIENTE, SUFIXO_PACOTE_HOMOLOGACAO,
  ehHostDeProducao, hostNormalizado, normalizarAmbiente, resolverServidor, conferirAmbiente, decidirAmbienteDoPareamento, sessaoConfereCom,
};
