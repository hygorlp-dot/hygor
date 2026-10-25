// Chave exclusiva de homologação. Os valores são lidos pelo Gradle na hora
// de compilar; nenhum segredo entra no app.json, bundle, fonte ou APK.
const { withAppBuildGradle } = require("@expo/config-plugins");
const INICIO = "// @generated begin ponto-homolog-signing";
const FIM = "// @generated end ponto-homolog-signing";

module.exports = config => withAppBuildGradle(config, mod => {
  if (mod.modResults.language !== "groovy") throw new Error("Assinatura de homologação exige build.gradle Groovy.");
  const blocoAnterior = new RegExp(`\\n?${INICIO}[\\s\\S]*?${FIM}\\n?`, "g");
  const fonte = mod.modResults.contents.replace(blocoAnterior, "");
  mod.modResults.contents = `${fonte}\n${INICIO}
def homologSigning = [
    path: System.getenv('PONTO_KEYSTORE_PATH'),
    password: System.getenv('PONTO_KEYSTORE_PASSWORD'),
    alias: System.getenv('PONTO_KEY_ALIAS'),
    keyPassword: System.getenv('PONTO_KEY_PASSWORD')
]
if (gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') } && homologSigning.values().any { !it }) {
    throw new GradleException('Assinatura de homologação ausente. Não é permitido gerar release com chave de debug.')
}
android {
    signingConfigs {
        homologacao {
            if (homologSigning.path) storeFile file(homologSigning.path)
            storePassword homologSigning.password
            keyAlias homologSigning.alias
            keyPassword homologSigning.keyPassword
        }
    }
    buildTypes.release.signingConfig = signingConfigs.homologacao
}
${FIM}\n`;
  return mod;
});
