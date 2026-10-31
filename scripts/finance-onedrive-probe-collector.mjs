import http from 'node:http';
import {writeFile,mkdir} from 'node:fs/promises';
const allowed=new Set(['phase','httpStatus','connected','worksWithFolders','foldersRead','folderErrors','filesFound','originalsRead','originalErrors','invoices','lastFolderHttpStatus','lastOriginalHttpStatus','records','linkedDocuments','protectedReferences','linkedOriginalsRead','linkedOriginalErrors','targets','imagesDecoded','memorialReferencesVerified','centralReferencesVerified']);
http.createServer(async(req,res)=>{
 if(req.headers.host!=='127.0.0.1:4194'||req.headers.origin!=='http://127.0.0.1:4192'){res.writeHead(403);return res.end();}
 res.setHeader('access-control-allow-origin','http://127.0.0.1:4192');
 if(req.method==='OPTIONS'){res.setHeader('access-control-allow-methods','POST');res.setHeader('access-control-allow-headers','content-type');res.writeHead(204);return res.end();}
 if(req.method!=='POST'||req.url!=='/result'){res.writeHead(404);return res.end();}
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('size');}
  const input=JSON.parse(raw),result={};
  for(const [key,value]of Object.entries(input)){
   if(key==='downloadHost'&&typeof value==='string'&&/^[a-z0-9.-]{1,255}$/.test(value)){result[key]=value;continue;}
   if(!allowed.has(key)||(!['number','boolean'].includes(typeof value)&&!(key==='phase'&&/^[a-z-]{1,40}$/.test(value))))throw Error('shape');
   result[key]=value;
  }
  await mkdir('artifacts/financeiro',{recursive:true});
  await writeFile('artifacts/financeiro/onedrive-live-review.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));res.writeHead(204);res.end();
 }catch{res.writeHead(400);res.end();}
}).listen(4194,'127.0.0.1',()=>console.log('Collector local: somente contagens; aguardando sessão habitual do MARCELL.'));
