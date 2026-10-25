// Checkpoint pequeno e sem dependências privadas: libera API/upload e NTP
// enquanto o frontend completo é publicado pelo Git. Não faz deploy sozinho.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.resolve(root,'.tools/homologacao-checkpoint');
const bundled=await build({entryPoints:[path.join(root,'scripts/homologacao/time-function.mjs')],
  bundle:true,platform:'node',target:'node24',format:'esm',minify:true,write:false});
const config={framework:null,buildCommand:null,installCommand:null,outputDirectory:null,
  regions:['gru1'],functions:{'api/homologacao-time.js':{maxDuration:10}},
  headers:[{source:'/(.*)',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}],
  rewrites:[
    {source:'/api/data',destination:'https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao'},
    {source:'/api/upload',destination:'https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao/upload'},
    {source:'/api/presence',destination:'https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao/presence'},
    {source:'/api/ai-agent',destination:'https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao/ai-agent'},
  ],
};
const files=[
  {file:'api/homologacao-time.js',data:bundled.outputFiles[0].text,encoding:'utf-8'},
  {file:'package.json',data:JSON.stringify({name:'ponto-homologacao',private:true,type:'module',engines:{node:'24.x'}}),encoding:'utf-8'},
  {file:'vercel.json',data:JSON.stringify(config),encoding:'utf-8'},
  {file:'index.html',data:'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Homologação da construtora</title><body><main><h1>Ambiente de simulação</h1><p>A versão completa do aplicativo está em atualização.</p><p>Os dados deste ambiente são de teste.</p></main></body></html>',encoding:'utf-8'},
];
const payload={teamId:'team_poBZ5I1rwStzhvD73ar22b7v',requestBody:{name:'ponto-homologacao',
  project:'prj_W7s5zALWmMuV4Wt5WePSz8ABAefp',target:'production',files,
  projectSettings:{framework:null,buildCommand:null,installCommand:null,outputDirectory:null,nodeVersion:'24.x'},
  meta:{purpose:'homologacao-api-ntp-checkpoint'},
}};
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'deploy-payload.json'),JSON.stringify(payload));
console.log(JSON.stringify({out,files:files.map(f=>({file:f.file,bytes:Buffer.byteLength(f.data)})),bytes:Buffer.byteLength(JSON.stringify(payload)),deploysAutomatically:false}));
