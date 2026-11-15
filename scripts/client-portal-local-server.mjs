// Servidor de revisão isolado: banco PostgreSQL em memória, sem .env/produção.
import {createServer} from "vite";
import {newPortalDatabase} from "../server/client-portal.test-helper.js";
import {portalFixture,seedPortalSource} from "../server/client-portal.fixture.js";
import {portalSimulationFixture} from "../server/client-portal-simulation.fixture.js";
import {portalAccountabilityFixture} from '../server/client-portal-accountability.fixture.js';
import {executeClientPortalAdmin} from "../server/client-portal-admin.js";
import {handleClientPortal} from "../api/client.js";
import {readPortalSession} from '../server/client-portal-runtime.js';
import PDFDocument from 'pdfkit';
const accountability=process.argv.includes('--accountability'),simulation=process.argv.includes("--simulation")||accountability,port=accountability?4200:simulation?4198:4197;
const db=await newPortalDatabase(),data=accountability?portalAccountabilityFixture():simulation?portalSimulationFixture():portalFixture();
await seedPortalSource(db,data);
for(const operation of ["provision","publish"])await executeClientPortalAdmin({db,companyId:"arcd",data,actor:{id:"admin-local",role:"admin"},body:{operation,obraId:"obra-local",email:"cliente@example.test",password:"ClienteLocal1234",profile:"owner"}});
const server=await createServer({server:{host:"127.0.0.1",port,strictPort:true},plugins:[{name:"portal-local-fixture",transformIndexHtml:html=>accountability?html.replace('/src/index.js','/scripts/client-portal-accountability-review.jsx'):html,configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,"http://127.0.0.1:4197");
  if(accountability&&url.pathname.startsWith('/api/client/projects/obra-local/files/')&&req.method==='GET'){
    const session=await readPortalSession(req,db),membership=session?.projects.find(item=>item.projectId==='obra-local');
    if(!membership?.permissions.viewProcurement||!membership.permissions.downloadDocuments){res.statusCode=403;return res.end('Acesso não permitido.');}
    const parts=url.pathname.split('/'),note=data.notasFiscais.find(item=>item.id===decodeURIComponent(parts[6]||'')),document=note?.documentos?.find(item=>item.id===decodeURIComponent(parts[7]||''));
    if(!document){res.statusCode=404;return res.end('Documento fictício não encontrado.');}
    res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','private, no-store');
    const pdf=new PDFDocument({size:'A4',margin:48});pdf.pipe(res);pdf.fontSize(22).text('DOCUMENTO FICTÍCIO');pdf.moveDown();pdf.fontSize(12).text(`Simulação local MARCELL\nReferência: ${note.numero}\nCategoria: ${note.categoria}\nValor ilustrativo: R$ ${note.valorBruto.toFixed(2)}\n\nNão é uma nota fiscal válida. Não corresponde a uma compra real e não deve ser utilizado para pagamento ou escrituração.`);pdf.end();return;
  }
  if(url.pathname==="/__portal_review_admin"){
    res.setHeader("Content-Type","text/html; charset=utf-8");
    return res.end(await vite.transformIndexHtml(url.pathname,`<!doctype html><html lang="pt-BR"><head><title>Revisão local · acessos de clientes</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/scripts/client-portal-admin-review.jsx"></script></body></html>`));
  }
  if(url.pathname==="/api/data"){
    res.status=function(code){this.statusCode=code;return this;};res.json=function(body){this.setHeader("Content-Type","application/json");this.end(JSON.stringify(body));return this;};
    try{let raw="";for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};if(body.action!=="client-portal-admin")return res.status(404).json({error:"Revisão local: rota indisponível."});const result=await executeClientPortalAdmin({db,companyId:"arcd",data,actor:{id:"admin-local",role:"admin"},body});return res.status(result.status).json(result);}catch(error){return res.status(500).json({error:error.message});}
  }
  if(!url.pathname.startsWith("/api/client/"))return next();
  res.status=function(code){this.statusCode=code;return this;};res.json=function(body){this.setHeader("Content-Type","application/json");this.end(JSON.stringify(body));return this;};
  try{let raw="";for await(const chunk of req)raw+=chunk;req.body=raw?JSON.parse(raw):{};req.query={...Object.fromEntries(url.searchParams),route:url.pathname.slice("/api/client/".length)};await handleClientPortal(req,res,db);}catch(error){res.status(500).json({error:error.message});}
});}}]});
await server.listen();
console.log(`Revisão local em http://127.0.0.1:${port}/cliente — cliente@example.test / ClienteLocal1234. Dados fictícios; nada é gravado em produção.`);
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,async()=>{await server.close();await db.pg.close();process.exit(0);});
