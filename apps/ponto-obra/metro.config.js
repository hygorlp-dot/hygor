// Metro do app Ponto de Obra.
// - .tflite como asset (modelos de rosto, ver NOTICE);
// - as regras do ponto são as MESMAS do servidor: o app importa
//   src/domains/ponto-eletronico da raiz do repositório (base única de regras).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const raizApp = __dirname;
const regrasCompartilhadas = path.resolve(raizApp, "../../src/domains/ponto-eletronico");

const config = getDefaultConfig(raizApp);
config.resolver.assetExts.push("tflite");
config.watchFolders = [...(config.watchFolders || []), regrasCompartilhadas];
// O código compartilhado não tem dependências próprias; tudo resolve no app.
config.resolver.nodeModulesPaths = [path.resolve(raizApp, "node_modules")];

module.exports = config;
