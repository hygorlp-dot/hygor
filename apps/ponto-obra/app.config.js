// Configuração dinâmica: separação dos ambientes e identificação do build.
// SDK, módulos e permissões continuam em app.json.
const { execSync } = require("node:child_process");
const { resolverServidor, SUFIXO_PACOTE_HOMOLOGACAO } = require("./config/ambiente");

function commitCurto() {
  const daEas = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (daEas) return daEas.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"], cwd: __dirname }).toString().trim();
  } catch {
    return "";
  }
}

// Metadados do build (sem segredo): perfil e ID vêm das variáveis públicas
// da EAS (EAS_BUILD_PROFILE, EAS_BUILD_ID); a data é a da geração da
// configuração. Local: perfil "local". Homologação usa versionCode explícito.
module.exports = ({ config }) => {
  const { ambiente, apiUrl } = resolverServidor({ ambiente: process.env.PONTO_AMBIENTE, urlEnv: process.env.PONTO_API_URL, urlPadrao: config.extra?.apiUrl });
  const varianteHomologacao = String(process.env.PONTO_HOMOLOGACAO_VARIANT || "").trim().toLowerCase();
  if (varianteHomologacao && !/^[a-z][a-z0-9]{0,15}$/.test(varianteHomologacao)) {
    throw new Error("PONTO_HOMOLOGACAO_VARIANT inválida: use 1 a 16 caracteres minúsculos, começando por letra.");
  }
  const faceEngine = String(process.env.PONTO_FACE_ENGINE || "legacy").trim().toLowerCase();
  if (!["legacy", "facenet512"].includes(faceEngine)) throw new Error("PONTO_FACE_ENGINE inválido.");
  const modeloBiometria = faceEngine === "facenet512" ? "facenet-512-apache2" : "mobilefacenet-192-apache2";
  const versionCode = Number(process.env.PONTO_VERSION_CODE || 5);
  if (ambiente === "homologacao" && (!Number.isSafeInteger(versionCode) || versionCode < 5)) throw new Error("PONTO_VERSION_CODE precisa ser inteiro, a partir de 5, para homologação.");
  return {
    ...config,
    ...(ambiente === "homologacao" ? {
      name: `${config.name} (HOMOLOGAÇÃO${varianteHomologacao ? ` ${varianteHomologacao.toUpperCase()}` : ""})`,
      version: "1.1.1",
      android: { ...config.android, package: `${config.android.package}${SUFIXO_PACOTE_HOMOLOGACAO}${varianteHomologacao ? `.${varianteHomologacao}` : ""}`, versionCode },
      plugins: [...(config.plugins || []), "./plugins/with-homolog-signing"],
    } : {}),
    extra: {
      ...config.extra, ambiente, apiUrl,
      commit: commitCurto(),
      buildPerfil: process.env.PONTO_BUILD_PROFILE || process.env.EAS_BUILD_PROFILE || "local",
      buildId: process.env.PONTO_BUILD_ID || process.env.EAS_BUILD_ID || "",
      homologacaoVariante: varianteHomologacao || "",
      faceEngine, modeloBiometria,
      buildEm: process.env.PONTO_BUILD_TIMESTAMP || new Date().toISOString(),
      sourceFingerprint: process.env.PONTO_SOURCE_FINGERPRINT || "",
      sourceDirty: process.env.PONTO_SOURCE_DIRTY === "1",
    },
  };
};
