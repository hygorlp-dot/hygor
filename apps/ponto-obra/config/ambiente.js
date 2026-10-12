// Regras de AMBIENTE do app (produção x homologação), usadas no BUILD
// (app.config.js) e em EXECUÇÃO (src/servicos/conexao.js, pareamento).
// CommonJS e sem dependências: o app.config.js roda no Node do EAS.
//
// Por quê: um APK de homologação que fale com a produção gera NSR fiscal real
// e permanente. Então:
//   - homologação EXIGE PONTO_API_URL explícita (sem padrão, sem fallback);
//   - homologação RECUSA o host de produção e as URLs de preview da Vercel do
//     mesmo projeto (elas usam as credenciais e o banco de produção);
//   - em execução, o app só pareia/sincroniza com servidor que CONFIRMA o
//     mesmo ambiente (o servidor confirma pelo marcador no banco -
//     server/ponto-eletronico/ambiente.js). O endereço sozinho não prova nada.
const AMBIENTES = ["producao", "homologacao"];
const HOSTS_PRODUCAO = ["pontosarcd.vercel.app"];
// Deploys de preview do projeto de produção na Vercel: pontosarcd-<algo>.vercel.app.
const PREVIEW_PRODUCAO = /^pontosarcd(-[a-z0-9-]+)?\.vercel\.app$/;
const NOME_AMBIENTE = { producao: "PRODUÇÃO", homologacao: "HOMOLOGAÇÃO — NÃO OFICIAL" };

const ehHostDeProducao = host => {
  const h = String(host || "").trim().toLowerCase();
  return HOSTS_PRODUCAO.includes(h) || PREVIEW_PRODUCAO.test(h);
};

const normalizarAmbiente = valor => {
  const a = String(valor ?? "").trim().toLowerCase() || "producao";
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
    if (ehHostDeProducao(u.host)) {
      throw new Error(`PONTO_API_URL aponta para a PRODUÇÃO (${u.host}) num build de homologação - recusado.`);
    }
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

module.exports = { AMBIENTES, HOSTS_PRODUCAO, NOME_AMBIENTE, ehHostDeProducao, normalizarAmbiente, resolverServidor, conferirAmbiente };
