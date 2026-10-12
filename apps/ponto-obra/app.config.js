// Configuração dinâmica: tudo continua em app.json; aqui entram
//   - o SHA curto do commit do build, para o Diagnóstico do app mostrar
//     exatamente qual código está instalado (na EAS vem de
//     EAS_BUILD_GIT_COMMIT_HASH; local, do git);
//   - o AMBIENTE e o servidor do ARCD (config/ambiente.js). Produção: o
//     apiUrl do app.json. Homologação: EXIGE PONTO_API_URL de um backend
//     isolado e recusa o host de produção - sem ela, o build FALHA (nunca cai
//     na produção em silêncio).
const { execSync } = require("node:child_process");
const { SUFIXO_PACOTE_HOMOLOGACAO, resolverServidor } = require("./config/ambiente");

function commitCurto() {
  const daEas = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (daEas) return daEas.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"], cwd: __dirname }).toString().trim();
  } catch {
    return "";
  }
}

module.exports = ({ config }) => {
  const { ambiente, apiUrl } = resolverServidor({ ambiente: process.env.PONTO_AMBIENTE, urlEnv: process.env.PONTO_API_URL, urlPadrao: config.extra?.apiUrl });
  return {
    ...config,
    // Homologação: nome e PACOTE próprios - instala ao lado do oficial, com
    // SecureStore e banco separados (sessão e batidas nunca se misturam).
    ...(ambiente === "homologacao" ? {
      name: `${config.name} (HOMOLOGAÇÃO)`,
      android: { ...config.android, package: `${config.android.package}${SUFIXO_PACOTE_HOMOLOGACAO}` },
    } : {}),
    extra: { ...config.extra, apiUrl, ambiente, commit: commitCurto() },
  };
};
