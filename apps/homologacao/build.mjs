// Compila a aplicação existente em uma saída exclusiva desta homologação.
// Não instala pacotes, não chama prebuild e não lê credenciais do backend.
import {readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'vite';

const project=fileURLToPath(new URL('./',import.meta.url));
const root=path.resolve(project,'../..');
const output=path.join(project,'public');
const sourcePublic=path.join(root,'public');
process.chdir(root);

await build({
  root,
  configFile:path.join(root,'vite.config.mjs'),
  build:{outDir:output,emptyOutDir:true,manifest:true,sourcemap:false},
});

async function filesIn(directory,prefix=''){
  const files=[];
  for(const item of await readdir(directory,{withFileTypes:true})){
    const name=path.posix.join(prefix,item.name);
    if(item.isSymbolicLink())throw new Error(`Link simbólico recusado: ${name}`);
    if(item.isDirectory())files.push(...await filesIn(path.join(directory,item.name),name));
    else if(item.isFile())files.push(name);
  }
  return files;
}
const manifest=JSON.parse(await readFile(path.join(output,'.vite/manifest.json'),'utf8'));
const allowed=new Set((await filesIn(sourcePublic)).filter(name=>!name.split('/').some(part=>part.startsWith('.'))&&!name.endsWith('.map')));
allowed.add('index.html');
for(const entry of Object.values(manifest))for(const name of [entry.file,...(entry.css||[]),...(entry.assets||[])]){
  if(typeof name!=='string'||path.posix.isAbsolute(name)||name.split('/').some(part=>part==='..'||part.startsWith('.'))||name.endsWith('.map')){
    throw new Error('O manifesto contém caminho de saída inválido.');
  }
  allowed.add(name);
}
// Manifesto e relatório ficam fora da pasta servida. O conjunto publicado
// contém somente a saída atual do Vite e os arquivos públicos existentes.
await writeFile(path.join(project,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const name of await filesIn(output))if(!allowed.has(name))await rm(path.join(output,name));
await rm(path.join(output,'.vite'),{recursive:true,force:true});

const files=[];
for(const name of [...allowed].sort()){
  const bytes=await readFile(path.join(output,name));
  files.push({file:name,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
const bytes=files.reduce((total,file)=>total+file.size,0);
if(bytes>90_000_000)throw new Error('Artefato excede a margem definida para homologação.');
const report={environment:'homologacao',project:'ponto-homologacao',output:'apps/homologacao/public',
  sourceMapFiles:0,files,bytes};
await writeFile(path.join(project,'build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({environment:report.environment,files:files.length,bytes,output:report.output}));
