import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const directory='C:/dev/marcell-local-review';
http.createServer(async(req,res)=>{
 if(req.headers.host!=='127.0.0.1:4194'||req.headers.origin!=='http://127.0.0.1:4192'){res.writeHead(403);return res.end();}
 res.setHeader('access-control-allow-origin','http://127.0.0.1:4192');
 if(req.method==='OPTIONS'){res.setHeader('access-control-allow-methods','POST');res.setHeader('access-control-allow-headers','content-type');res.writeHead(204);return res.end();}
 if(req.method!=='POST'||req.url!=='/review'){res.writeHead(404);return res.end();}
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>512_000)throw Error('size');}
  const result=JSON.parse(raw);
  // Reject accidental credentials or signed URLs before any persistence.
  if(/accessToken|refreshToken|client_secret|[?&]sig=|"pin"\s*:/i.test(raw))throw Error('sensitive');
  if(!['searching','complete','erp-login-required','connection-required','data-unavailable','inspection-failed'].includes(result.phase))throw Error('phase');
  await mkdir(directory,{recursive:true});await writeFile(`${directory}/onedrive-link-review.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({phase:result.phase,targets:result.targets,foldersRead:result.foldersRead,filesRead:result.filesRead,errors:result.errors?.length,ready:result.proposals?.filter(p=>p.status==='ready-for-review').length}));
  res.writeHead(204);res.end();
 }catch{res.writeHead(400);res.end();}
}).listen(4194,'127.0.0.1',()=>console.log('Investigação local: resultados privados; nenhuma alteração nos vínculos.'));
