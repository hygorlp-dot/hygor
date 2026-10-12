// Confere o projeto Android gerado pelo prebuild (CNG) - usado na CI
// (.github/workflows/quality.yml, job mobile-ponto-obra) e localmente:
//   npx expo prebuild --platform android --no-install --clean
//   node scripts/verificar-prebuild.mjs
// Falha (exit 1) se algo que o app precisa no aparelho não estiver lá.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const falhas = [];
const conferir = (ok, mensagem) => { console.log(`${ok ? "ok  " : "FALHA"} ${mensagem}`); if (!ok) falhas.push(mensagem); };
const ler = rel => (existsSync(path.join(raiz, rel)) ? readFileSync(path.join(raiz, rel), "utf8") : "");
// Argumentos fixos (nenhum vem de fora).
const autolinking = subcomando => JSON.parse(execSync(`npx expo-modules-autolinking ${subcomando} --platform android --json`, { cwd: raiz, encoding: "utf8" }));

conferir(existsSync(path.join(raiz, "android")), "pasta android/ gerada pelo prebuild");
conferir(/^expo\.sqlite\.useSQLCipher=true$/m.test(ler("android/gradle.properties")), "SQLCipher ligado (expo.sqlite.useSQLCipher=true)");
conferir(/^expo\.camera\.barcode-scanner-enabled=false$/m.test(ler("android/gradle.properties")), "leitor de código de barras (ML Kit) desligado - o app não usa");

const manifesto = ler("android/app/src/main/AndroidManifest.xml");
conferir(/android:allowBackup="false"/.test(manifesto), "backup do Android desligado (banco cifrado não vai para a nuvem sem a chave)");
const linhasPermissao = manifesto.split("\n").filter(l => l.includes("uses-permission"));
const ativa = nome => linhasPermissao.some(l => l.includes(`"android.permission.${nome}"`) && !l.includes('tools:node="remove"'));
conferir(ativa("CAMERA"), "permissão de câmera declarada");
conferir(ativa("ACCESS_FINE_LOCATION"), "permissão de localização declarada");
// WRITE_SETTINGS: o expo-brightness só mexe no brilho da janela do app, que
// não precisa dela - nunca alterar configuração do sistema do aparelho.
// READ_PHONE_STATE entra IMPLÍCITA pelo merge de manifestos (biblioteca sem
// targetSdkVersion); USE_BIOMETRIC/USE_FINGERPRINT vêm do SecureStore, que o
// app não usa com biometria. Como o merge acontece DEPOIS deste manifesto,
// cada proibida precisa da linha explícita de remoção (tools:node="remove"):
// ausência aqui não garante ausência no APK. O APK final: scripts/verificar-apk.mjs.
const removida = nome => linhasPermissao.some(l => l.includes(`"android.permission.${nome}"`) && l.includes('tools:node="remove"'));
for (const proibida of ["RECORD_AUDIO", "SYSTEM_ALERT_WINDOW", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "WRITE_SETTINGS", "READ_PHONE_STATE", "USE_BIOMETRIC", "USE_FINGERPRINT"]) {
  conferir(!ativa(proibida) && removida(proibida), `permissão ${proibida} removida explicitamente (vale também para o merge)`);
}
// Lista PERMITIDA (não só proibidas): qualquer permissão nova que uma
// dependência injete (localização em segundo plano, notificações, serviço em
// primeiro plano...) falha aqui até alguém decidir e acrescentar.
const PERMITIDAS = new Set(["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "INTERNET", "VIBRATE"]);
const ativas = linhasPermissao.filter(l => !l.includes('tools:node="remove"')).map(l => (l.match(/android:name="(?:android\.permission\.)?([^"]+)"/) || [])[1]).filter(Boolean);
for (const nome of ativas) conferir(PERMITIDAS.has(nome), `permissão ${nome} está na lista permitida`);

const modulosExpo = autolinking("resolve").modules.map(m => m.packageName);
for (const m of ["relogio-confiavel", "expo-sqlite", "expo-camera", "expo-secure-store", "expo-font", "expo-haptics", "expo-speech", "expo-brightness",
  "expo-location", "expo-asset", "expo-crypto", "expo-file-system", "expo-image-manipulator", "expo-keep-awake", "expo-application", "expo-device", "expo-constants"]) conferir(modulosExpo.includes(m), `módulo Expo autolinkado: ${m}`);
const rn = autolinking("react-native-config").dependencies || {};
for (const m of ["react-native-fast-tflite", "react-native-nitro-modules", "react-native-safe-area-context"]) conferir(!!rn[m]?.platforms?.android, `módulo React Native autolinkado: ${m}`);

if (falhas.length) { console.error(`\n${falhas.length} verificação(ões) falharam.`); process.exit(1); }
console.log("\nPrebuild Android conferido.");
