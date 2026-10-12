// Configuração dinâmica: tudo continua em app.json; aqui entram
//   - o SHA curto do commit do build, para o Diagnóstico do app mostrar
//     exatamente qual código está instalado (na EAS vem de
//     EAS_BUILD_GIT_COMMIT_HASH; local, do git);
//   - o servidor do ARCD e o ambiente do build. Sem PONTO_API_URL vale o
//     app.json, que é a PRODUÇÃO do ARCD: um aparelho pareado ali grava NSR
//     fiscal real e permanente. O perfil "piloto" (eas.json) declara
//     PONTO_AMBIENTE=piloto; o Diagnóstico e a tela de pareamento mostram o
//     servidor e avisam quando um build de piloto aponta para a produção.
const { execSync } = require("node:child_process");

function commitCurto() {
  const daEas = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (daEas) return daEas.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"], cwd: __dirname }).toString().trim();
  } catch {
    return "";
  }
}

function urlDaApi(padrao) {
  const url = process.env.PONTO_API_URL || padrao;
  let u;
  try { u = new URL(url); } catch { throw new Error("PONTO_API_URL inválida"); }
  if (u.protocol !== "https:") throw new Error("PONTO_API_URL precisa ser https");
  return u.toString();
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: urlDaApi(config.extra?.apiUrl),
    ambiente: process.env.PONTO_AMBIENTE || "producao",
    commit: commitCurto(),
  },
});
