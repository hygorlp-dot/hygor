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
  const variantePilotoProducao = String(process.env.PONTO_PRODUCAO_PILOTO_VARIANT || "").trim().toLowerCase();
  const validarVariante=(nome,valor)=>{
    if(valor&&!/^[a-z][a-z0-9]{0,15}$/.test(valor))throw new Error(`${nome} inválida: use 1 a 16 caracteres minúsculos, começando por letra.`);
  };
  validarVariante("PONTO_HOMOLOGACAO_VARIANT",varianteHomologacao);
  validarVariante("PONTO_PRODUCAO_PILOTO_VARIANT",variantePilotoProducao);
  if(varianteHomologacao&&variantePilotoProducao)throw new Error("Escolha homologação OU piloto de produção; não use as duas variantes no mesmo build.");
  if(variantePilotoProducao&&ambiente!=="producao")throw new Error("PONTO_PRODUCAO_PILOTO_VARIANT só pode ser usado com PONTO_AMBIENTE=producao.");
  const versionCode = Number(process.env.PONTO_VERSION_CODE || 5);
  if (ambiente === "homologacao" && (!Number.isSafeInteger(versionCode) || versionCode < 5)) throw new Error("PONTO_VERSION_CODE precisa ser inteiro, a partir de 5, para homologação.");
  if (variantePilotoProducao && (!Number.isSafeInteger(versionCode) || versionCode < 17)) throw new Error("PONTO_VERSION_CODE precisa ser inteiro, a partir de 17, para piloto de produção.");
  const pilotoProducao=ambiente==="producao"&&!!variantePilotoProducao;
  return {
    ...config,
    ...(ambiente === "homologacao" ? {
      name: `${config.name} (HOMOLOGAÇÃO${varianteHomologacao ? ` ${varianteHomologacao.toUpperCase()}` : ""})`,
      version: "1.1.1",
      android: { ...config.android, package: `${config.android.package}${SUFIXO_PACOTE_HOMOLOGACAO}${varianteHomologacao ? `.${varianteHomologacao}` : ""}`, versionCode },
      plugins: [...(config.plugins || []), "./plugins/with-homolog-signing"],
    } : pilotoProducao ? {
      name: `${config.name} (PILOTO PRODUÇÃO ${variantePilotoProducao.toUpperCase()})`,
      version: "1.1.2",
      android: { ...config.android, package: `${config.android.package}.piloto.${variantePilotoProducao}`, versionCode },
      // Chave efêmera e pacote separado: fala com produção, mas nunca substitui
      // o app oficial nem é elegível a publicação na loja.
      plugins: [...(config.plugins || []), "./plugins/with-homolog-signing"],
    } : {}),
    extra: {
      ...config.extra, ambiente, apiUrl,
      commit: commitCurto(),
      buildPerfil: process.env.PONTO_BUILD_PROFILE || process.env.EAS_BUILD_PROFILE || "local",
      buildId: process.env.PONTO_BUILD_ID || process.env.EAS_BUILD_ID || "",
      homologacaoVariante: varianteHomologacao || "",
      producaoPilotoVariante: variantePilotoProducao || "",
      buildEm: process.env.PONTO_BUILD_TIMESTAMP || new Date().toISOString(),
      sourceFingerprint: process.env.PONTO_SOURCE_FINGERPRINT || "",
      sourceDirty: process.env.PONTO_SOURCE_DIRTY === "1",
    },
  };
};
