import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import MagicString from "magic-string";
import {dirname,resolve} from "node:path";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const require=createRequire(import.meta.url);
const browserAdapterFiles=["spreadsheet-zip.js","zip-reader.js","spreadsheet-csv.js","exceljs-encryptor.cjs"].map(name=>fileURLToPath(new URL(`../src/lib/${name}`,import.meta.url)));
const adapterRevision=createHash("sha256").update([fileURLToPath(import.meta.url),...browserAdapterFiles].map(path=>readFileSync(path,"utf8")).join("\n")).digest("hex").slice(0,16);
const bufferInject={Buffer:[require.resolve("buffer/"),"Buffer"]};
// Usar os módulos do ExcelJS permite compartilhar streams e utilitários.
const lodashMethods={escaperegexp:"escapeRegExp",isboolean:"isBoolean",isequal:"isEqual",isfunction:"isFunction",isnil:"isNil",groupby:"groupBy",isundefined:"isUndefined",uniq:"uniq",partition:"partition"};
const encryptorPlugin=()=>({
  // Vite usa o nome dos plugins no hash do otimizador. Esses módulos locais
  // entram no prebundle do ExcelJS; editá-los também precisa invalidá-lo.
  name:`spreadsheet-browser-modules-${adapterRevision}`,
  configureServer(server){
    const watched=new Set(browserAdapterFiles.map(path=>path.replaceAll("\\","/")));
    let restart;
    server.watcher.add(browserAdapterFiles);
    server.watcher.on("change",path=>{
      if(!watched.has(path.replaceAll("\\","/")))return;
      clearTimeout(restart);
      restart=setTimeout(()=>server.restart().catch(error=>server.config.logger.error(error.stack||String(error))),50);
    });
    server.httpServer?.once("close",()=>clearTimeout(restart));
  },
  transform(source,id){
    const path=id.replaceAll("\\","/");
    let before,after;
    if(path.endsWith("/exceljs/lib/xlsx/xlsx.js")||path.endsWith("/exceljs/lib/utils/zip-stream.js")){
      const adapter=fileURLToPath(new URL("../src/lib/spreadsheet-zip.js",import.meta.url));
      before="const JSZip = require('jszip');";after=`const {default: JSZip} = require(${JSON.stringify(adapter)});`;
    }else if(path.endsWith("/exceljs/lib/csv/csv.js")){
      const adapter=fileURLToPath(new URL("../src/lib/spreadsheet-csv.js",import.meta.url));
      before="const fastCsv = require('fast-csv');";after=`const fastCsv = require(${JSON.stringify(adapter)});`;
    }else if(path.endsWith("/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js")){
      const uuid=resolve(dirname(require.resolve("uuid/package.json")),"dist/esm-browser/v4.js");
      before="const {v4: uuidv4} = require('uuid');";after=`const {default: uuidv4} = require(${JSON.stringify(uuid)});`;
    }else if(path.endsWith("/sha.js/hash.js")){
      // O único consumidor deste hash no browser é exceljs-encryptor.cjs:
      // update recebe exclusivamente o Buffer produzido por Buffer.concat.
      // A normalização genérica/legada não participa desse contrato fechado.
      before="var toBuffer = require('to-buffer');";
      after='var toBuffer = function(data) { if (!Buffer.isBuffer(data)) throw new TypeError("A proteção da planilha exige Buffer."); return data; };';
    }
    if(before){
      const start=source.indexOf(before);
      if(start===-1)throw new Error(`Contrato de importação do ExcelJS mudou: ${path}. Revise o adaptador do navegador.`);
      const transformed=new MagicString(source);transformed.overwrite(start,start+before.length,after);
      return {code:transformed.toString(),map:transformed.generateMap({hires:true,source:id,includeContent:true})};
    }
  },
  resolveId(source,importer){
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
    nodePolyfills({include:["buffer","events","process","stream","string_decoder","assert","path"],globals:{Buffer:false,global:true,process:true}}),
  ],
  // Um único construtor Buffer também no otimizador de desenvolvimento:
  // misturar os shims CJS/ESM quebra o instanceof usado pelo ExcelJS.
  build:{rollupOptions:{transform:{inject:bufferInject}}},
  optimizeDeps:{include:["exceljs"],rolldownOptions:{plugins:[encryptorPlugin()],transform:{inject:bufferInject}}},
  resolve:{
    dedupe:["readable-stream","string_decoder","safe-buffer","buffer"],
    alias:[
      // safe-buffer exporta exatamente buffer quando alloc/from existem,
      // como no Buffer 5.7.1 já utilizado pelo aplicativo.
      {find:"safe-buffer",replacement:require.resolve("buffer/")},
      {find:"exceljs",replacement:require.resolve("exceljs/lib/exceljs.bare.js")},
      ...Object.entries(lodashMethods).map(([name,method])=>({find:`lodash.${name}`,replacement:require.resolve(`lodash/${method}.js`)})),
    ],
  },
});
