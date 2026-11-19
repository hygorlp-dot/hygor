import {createServer} from 'vite';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {verifyFinanceEmail,simulateFinanceEmail,LARK_SMTP} from '../server/client-billing-email.js';
import {prepareStatementDelivery,dispatchStatementDelivery} from '../server/client-statement-delivery.js';
import {financeConnectionStatus,saveFinancePassword,financePrivateDirectory} from './lib/client-billing-local.mjs';
const origin='http://127.0.0.1:4210',session=randomBytes(32).toString('hex');let connecting=false;
const server=await createServer({server:{host:'127.0.0.1',port:4210,strictPort:true,fs:{strict:true,allow:[process.cwd()]}},plugins:[{name:'finance-local-connection',transformIndexHtml:html=>html.replace('/src/index.js','/scripts/client-billing-connection-review.jsx'),configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url,origin);
 if(req.headers.host!=='127.0.0.1:4210'){res.statusCode=403;return res.end('Acesso local somente.');}
 if(url.pathname==='/'){
  if(req.headers['sec-fetch-site']==='cross-site'){res.statusCode=403;return res.end('Abra esta tela diretamente no navegador.');}
  res.setHeader('Set-Cookie',`marcell_finance_setup=${session}; HttpOnly; SameSite=Strict; Path=/`);
  res.setHeader('X-Frame-Options','DENY');return next();
 }
 if(!url.pathname.startsWith('/api/local-finance/'))return next();
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
 if(!String(req.headers.cookie||'').split(';').some(item=>item.trim()===`marcell_finance_setup=${session}`))return send(403,{error:'Abra a tela local para iniciar a configuração.'});
 if(req.method==='GET'&&url.pathname.endsWith('/status'))return send(200,await financeConnectionStatus());
 if(req.method!=='POST'||req.headers.origin!==origin||!String(req.headers['content-type']).startsWith('application/json'))return send(403,{error:'Pedido não permitido nesta conexão local.'});
 try{
  let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>4096)return send(413,{error:'Pedido excede o tamanho permitido.'});}const body=JSON.parse(raw||'{}');
  if(url.pathname.endsWith('/connect')){
   if(connecting)return send(409,{error:'Uma verificação já está em andamento. Aguarde.'});connecting=true;
   try{await verifyFinanceEmail(body.password);await saveFinancePassword(body.password);body.password='';return send(200,{ok:true,...await financeConnectionStatus()});}
   catch{return send(422,{error:'Não foi possível autenticar. Confira a senha dedicada e se o Lark permite clientes de e-mail. Nenhuma mensagem foi enviada.'});}
   finally{body.password='';raw='';connecting=false;}
  }
  if(url.pathname.endsWith('/simulate')){
   const report=JSON.parse(await readFile('C:/dev/marcell-local-review/accountability/statement.json','utf8'));
   if(report.simulation!==true||report.projectId!=='obra-local')throw new Error('Cenário fictício indisponível.');
   const pdf=await readFile('output/pdf/MARCELL-prestacao-contas-simulacao.pdf');
   const delivery=prepareStatementDelivery({report,recipient:{id:'cliente-ficticio',email:'cliente@example.test',whatsapp:'81999990000'},pdf});
   await mkdir(financePrivateDirectory,{recursive:true});
   const email=await simulateFinanceEmail(delivery.jobs.find(job=>job.channel==='email'));await writeFile(path.join(financePrivateDirectory,'simulacao-email.eml'),email,{mode:0o600});
   const journal={reserve:async(key,value)=>{try{await writeFile(path.join(financePrivateDirectory,`simulation-${key}.json`),JSON.stringify(value),{flag:'wx',mode:0o600});return true;}catch(error){if(error.code==='EEXIST')return false;throw error;}},finish:(key,value)=>writeFile(path.join(financePrivateDirectory,`simulation-${key}.json`),JSON.stringify(value))};
   const first=await dispatchStatementDelivery({delivery,journal}),repeat=await dispatchStatementDelivery({delivery,journal});
   const pdfSha256=createHash('sha256').update(pdf).digest('hex');
   const result={ok:true,channels:first,repeat,recipient:'Cliente fictício',pdfBytes:pdf.length,pdfSha256,emailWithPdf:email.toString('ascii').replace(/\r?\n/g,'').includes(pdf.toString('base64')),whatsappWithSamePdf:createHash('sha256').update(delivery.jobs.find(job=>job.channel==='whatsapp').pdf).digest('hex')===pdfSha256,messagesSent:0,automaticDelivery:false};
   await writeFile(path.join(financePrivateDirectory,'simulation.json'),JSON.stringify(result,null,2),{mode:0o600});return send(200,result);
  }
  return send(404,{error:'Operação não disponível.'});
 }catch{return send(503,{error:'Não foi possível concluir a operação local. Nenhuma mensagem foi enviada.'});}
 });}}]});
await server.listen();console.log(JSON.stringify({url:origin,sender:'financeiro@marcelleng.com.br',smtp:LARK_SMTP,liveSending:false}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
