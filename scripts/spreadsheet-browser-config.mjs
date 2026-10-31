import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {nodePolyfills} from "vite-plugin-node-polyfills";

const require=createRequire(import.meta.url);
const bufferInject={Buffer:[require.resolve("buffer/"),"Buffer"]};
// ExcelJS e JSZip publicam bundles Browserify fechados. Usar seus módulos
// originais permite compartilhar streams e utilitários com o restante do ERP.
const lodashMethods={escaperegexp:"escapeRegExp",isboolean:"isBoolean",isequal:"isEqual",isfunction:"isFunction",isnil:"isNil",groupby:"groupBy",isundefined:"isUndefined",uniq:"uniq",partition:"partition"};
const encryptorPlugin=()=>({
  name:"spreadsheet-browser-encryptor",
  resolveId(source,importer){
    if(source==="jszip")return require.resolve("jszip/lib/index.js");
    // Worksheet usa somente SHA-512. Não enviar os outros algoritmos,
    // cifras e protocolos de crypto-browserify para proteger uma planilha.
    if(source==="../utils/encryptor"&&importer?.replaceAll("\\","/").endsWith("/exceljs/lib/doc/worksheet.js")){
      return fileURLToPath(new URL("../src/lib/exceljs-encryptor.cjs",import.meta.url));
    }
  },
});
export const spreadsheetBrowserConfig=()=>({
  plugins:[
    {...encryptorPlugin(),enforce:"pre"},
    nodePolyfills({include:["buffer","events","process","stream","string_decoder","util","assert","path"],globals:{Buffer:false,global:true,process:true}}),
  ],
  // Um único construtor Buffer também no otimizador de desenvolvimento:
  // misturar os shims CJS/ESM quebra o instanceof usado pelo ExcelJS.
  build:{rollupOptions:{transform:{inject:bufferInject}}},
  optimizeDeps:{include:["exceljs"],rolldownOptions:{plugins:[encryptorPlugin()],transform:{inject:bufferInject}}},
  resolve:{
    dedupe:["readable-stream","string_decoder","safe-buffer","buffer"],
    alias:[
      {find:"exceljs",replacement:require.resolve("exceljs/lib/exceljs.bare.js")},
      ...Object.entries(lodashMethods).map(([name,method])=>({find:`lodash.${name}`,replacement:require.resolve(`lodash/${method}.js`)})),
    ],
  },
});
