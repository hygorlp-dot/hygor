import { preview } from 'vite';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { data as fixture, profile } from './fixtures/workflow-priorities-data.mjs';
import { applyOperationalCommand } from '../src/domains/sync/operational-commands.js';
import { ENGINEERING_COMMAND_TYPES } from '../src/domains/projetos/commands.js';
import { FILE_COMMAND, FILE_COMMAND_TYPES } from '../src/domains/arquivos/commands.js';
import { fileMime, fileValidation } from '../src/domains/arquivos/model.js';
import { validateOperationalCommandScope } from '../server/operational-command-policy.js';
import { samplePdf } from '../e2e/helpers/sample-pdf.js';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.env.MARCELL_FILES_PREVIEW_PORT||4203);
const root=process.env.MARCELL_FILES_PREVIEW_ROOT||'artifacts/arquivos',statePath=`${root}/demo-state.json`;
let data;
try{if(process.env.MARCELL_FILES_PREVIEW_FRESH==='1')throw Object.assign(new Error('Cenário de teste novo'),{code:'ENOENT'});data=JSON.parse(await readFile(statePath,'utf8'));}
catch(error){
  if(error.code!=='ENOENT')throw error;
  try{data=JSON.parse(await readFile('artifacts/projetos/demo-state.json','utf8'));}catch{data=structuredClone(fixture);}
}
if(!data.usuarios?.some(user=>user.id===profile.id))throw new Error('A prévia aceita somente o cenário fictício.');
if(!data.workFileCabinets?.length&&data.obras?.[0]){
  const obraId=data.obras[0].id;
  for(const [type,payload] of [[FILE_COMMAND.TEMPLATE_APPLIED,{}],[FILE_COMMAND.DOCUMENT_ADDED,{id:'demo-memorial',revisionId:'demo-r01',name:'Memorial descritivo · Exemplo fictício',kind:'link',url:`http://127.0.0.1:${port}/exemplos-projetos/casa-alameda/R01.txt`,label:'R01',note:'Primeira emissão de demonstração.'}],[FILE_COMMAND.REVISION_ADDED,{id:'demo-memorial',revisionId:'demo-r02',kind:'link',url:`http://127.0.0.1:${port}/exemplos-projetos/casa-alameda/R02.txt`,label:'R02',note:'Segunda emissão: ajustes no ambiente da cozinha.'}]]){
    const version=data.workFileCabinets?.find(item=>item.obraId===obraId)?.version||0;
    const result=applyOperationalCommand(data,{type,payload:{...payload,obraId,folderId:''},expectedVersion:version,idempotencyKey:randomUUID(),actorId:profile.id,actorRole:profile.role,actorName:profile.nome,now:new Date().toISOString()});
    if(!result.ok)throw new Error(result.reason);data=result.data;
  }
}
await mkdir(`${root}/uploads`,{recursive:true});
// Fictitious licensing attachments exercise the same protected access contract
// as the real reader. No production files or Microsoft sessions are accessed.
const licensingExamples=[['prefeitura_aprovada','11111111-1111-4111-8111-111111111111','prefeitura-exemplo','Alvará de construção — demonstração.pdf'],['titulo','22222222-2222-4222-8222-222222222222','cartorio-exemplo','Matrícula do imóvel — demonstração.pdf']];
let demoLicense=data.licencas?.find(item=>item.obraId===data.obras[0]?.id);
if(!demoLicense){demoLicense={id:'licenca-demo-nativa',obraId:data.obras[0]?.id,tipo:'simplificada',itens:{}};data.licencas=[...(data.licencas||[]),demoLicense];}
for(const [key,id,itemId,name] of licensingExamples){
  const bytes=samplePdf();await writeFile(`${root}/uploads/${id}.bin`,bytes);await writeFile(`${root}/uploads/${id}.json`,JSON.stringify({name,mime:'application/pdf'}));
  demoLicense.itens||={};const previous=demoLicense.itens[key]||{};
  if(!previous.documentos?.some(doc=>doc.id===itemId))demoLicense.itens[key]={...previous,status:previous.status||'entregue',documentos:[...(previous.documentos||[]),{id:itemId,nome:name,tipo:'application/pdf',tamanho:bytes.length,enviadoEm:new Date().toISOString(),url:`/api/microsoft/onedrive?action=file&driveId=demo-licenciamento&itemId=${itemId}`} ]};
}
await writeFile(statePath,JSON.stringify(data,null,2));
let tail=Promise.resolve();
async function persist(next){await writeFile(`${statePath}.tmp`,JSON.stringify(next,null,2));await rename(`${statePath}.tmp`,statePath);data=next;}
await preview({build:{outDir:'artifacts/arquivos/build'},preview:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'local-work-files',configurePreviewServer(server){
  server.middlewares.use('/api',async(request,response)=>{
    response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','application/json; charset=utf-8');
    const json=(status,body)=>{response.statusCode=status;response.end(JSON.stringify(body));};
    if(request.headers.origin&&![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(request.headers.origin))return json(403,{error:'Origem não permitida.'});
    try{
      const fileMatch=request.url.match(/^\/local-files\/([a-f0-9-]{36})$/);
      if(fileMatch&&request.method==='GET'){
        const id=fileMatch[1];
        const metadata=JSON.parse(await readFile(`${root}/uploads/${id}.json`,'utf8'));
        const bytes=await readFile(`${root}/uploads/${id}.bin`);
        response.setHeader('X-Content-Type-Options','nosniff');
        response.setHeader('Content-Type',metadata.mime||'application/octet-stream');
        response.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`);
        response.end(bytes);return;
      }
      let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>4500000)return json(413,{error:'Requisição muito grande.'});}
      const body=raw?JSON.parse(raw):{};
      if(request.url.startsWith('/microsoft/onedrive')){
        if(body.action==='file-link'&&body.driveId==='demo-licenciamento'){
          const example=licensingExamples.find(item=>item[2]===body.itemId);
          if(!example)return json(404,{error:'Anexo fictício não encontrado.'});
          return json(200,{ok:true,url:`/api/local-files/${example[1]}`});
        }
        if(body.action==='upload'&&body.category==='arquivos'){
          if(!data.obras.some(item=>item.id===body.obraId))return json(403,{error:'Obra não encontrada.'});
          const match=String(body.dataUrl||'').match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);if(!match)return json(400,{error:'Arquivo inválido.'});
          const bytes=Buffer.from(match[2],'base64'),validation=fileValidation({name:body.fileName,size:bytes.length});if(validation)return json(400,{error:validation});
          const id=randomUUID();await writeFile(`${root}/uploads/${id}.bin`,bytes);await writeFile(`${root}/uploads/${id}.json`,JSON.stringify({name:body.fileName,mime:fileMime(body.fileName)}));
          return json(200,{ok:true,url:`/api/local-files/${id}`,path:id,item:{id}});
        }
        return json(400,{error:'Esta prévia usa somente armazenamento local.'});
      }
      if(body.action==='operational-command'){
        const run=async()=>{
          if(!FILE_COMMAND_TYPES.has(body.command?.type)&&!ENGINEERING_COMMAND_TYPES.has(body.command?.type))return json(403,{error:'Comando não disponível nesta prévia.'});
          const command={...body.command,actorId:profile.id,actorRole:profile.role,actorName:profile.nome,now:new Date().toISOString()};
          const scope=validateOperationalCommandScope({user:profile,data,command});if(!scope.ok)return json(403,{error:scope.error});
          const result=applyOperationalCommand(data,command);if(!result.ok)return json(409,result);await persist(result.data);json(200,{...result,updatedAt:new Date().toISOString()});
        };const next=tail.then(run,run);tail=next.catch(()=>{});await next;return;
      }
      if(body.action==='profiles')return json(200,{usuarios:[profile],precisaSetup:false});
      json(200,{ok:true,data,items:[],presencas:[],bases:[],accessToken:'local-files-preview',refreshToken:'local-files-preview',usuario:profile,updatedAt:new Date().toISOString()});
    }catch(error){if(!response.writableEnded)json(error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'Arquivo local não encontrado.':'Falha na prévia local.'});console.error(error.message);}
  });
}}]});
console.log(`Arquivos locais: http://127.0.0.1:${port} · ${profile.email} / piloto-local`);
console.log(`Dados e uploads fictícios persistidos em ${root}. Nenhuma conexão com produção.`);
