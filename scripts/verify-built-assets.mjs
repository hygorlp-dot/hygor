// Confere referências do build, incluindo o mapa de dependências lazy do Vite.
import {access,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'dist');
const assets=path.join(root,'assets');
const files=await readdir(assets);const missing=[];let references=0;
for(const name of ['../index.html',...files.filter(file=>/\.(js|css)$/.test(file))]){
  const file=path.resolve(assets,name),source=await readFile(file,'utf8');
  for(const match of source.matchAll(/["']((?:\.\/|\/?assets\/)[^"'\s]+\.(?:js|css|mjs))["']/g)){
    references++;const ref=match[1];
    const target=ref.startsWith('./')?path.resolve(path.dirname(file),ref):path.resolve(root,ref.replace(/^\//,''));
    try{await access(target);}catch{missing.push({file:name,ref});}
  }
}
console.log(JSON.stringify({files:files.length,references,missing},null,2));
if(missing.length)process.exitCode=1;
