// Configuração dinâmica: tudo continua em app.json; aqui só entra o SHA curto
// do commit do build, para o Diagnóstico do app mostrar exatamente qual
// código está instalado. Na EAS vem de EAS_BUILD_GIT_COMMIT_HASH; local, do git.
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

module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, commit: commitCurto() },
});
