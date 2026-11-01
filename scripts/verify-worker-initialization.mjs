import {createServer,preview} from 'vite';
import {chromium,expect} from '@playwright/test';
import ExcelJS from 'exceljs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const directory=resolve('artifacts/import-audit');await mkdir(directory,{recursive:true});
const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('CSD');
sheet.addRow(['06/2026','','','PE']);sheet.addRow(['Código','Descrição','Unidade','Preço']);sheet.addRow([101,'SERVIÇO SINTÉTICO','UN',12.34]);
const bytes=Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
const results=[];
for(const mode of ['dev','build']){
 const port=mode==='dev'?4276:4277,origin=`http://127.0.0.1:${port}`;
 const install=server=>{server.middlewares.use('/__worker_check__',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><head></head><body></body></html>');});};
 const plugin={name:'worker-initialization-check',configureServer:install,configurePreviewServer:install};
 const server=mode==='dev'?await createServer({cacheDir:'node_modules/.vite-import-audit',plugins:[plugin],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}})
  :await preview({plugins:[plugin],build:{outDir:resolve(directory,'build')},preview:{host:'127.0.0.1',port,strictPort:true}});
 if(mode==='dev')await server.listen();
 const browser=await chromium.launch();const page=await browser.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());
 try{
  const manifest=mode==='build'?JSON.parse(await readFile(resolve(directory,'build/.vite/manifest.json'),'utf8')):null;
  const entry=mode==='dev'?'/src/domains/orcamentos/sinapi-import.js':'/'+manifest['src/domains/orcamentos/sinapi-import.js'].file;
  await page.goto(origin+'/__worker_check__',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async({url,bytes})=>{
   const {readSinapiInWorker}=await import(/* @vite-ignore */ url);
   const progress=[];const file=new File([Uint8Array.from(atob(bytes),char=>char.charCodeAt(0))],'sinapi-sintetico.xlsx');
   const data=await readSinapiInWorker(file,'PE',message=>progress.push(message),{inactivityTimeoutMs:15000});
   return {data,progress};
  },{url:origin+entry,bytes});
  expect(result.data.itens).toHaveLength(1);expect(result.data.itens[0]).toMatchObject({codigo:'101',precoNao:12.34,unidade:'UN'});
  expect(result.data.dataBase).toBe('2026-06');expect(result.progress.length).toBeGreaterThan(1);expect(errors).toEqual([]);
  results.push({mode,worker:'SINAPI',workerStarted:true,rows:result.data.itens.length,price:result.data.itens[0].precoNao,errors:[...errors]});
  await page.close();
  const orsePage=await browser.newPage();const orseErrors=[];
  orsePage.on('pageerror',error=>orseErrors.push(error.message));
  await orsePage.route('https://**/*',route=>route.abort());
  await orsePage.goto(origin+'/__worker_check__',{waitUntil:'domcontentloaded'});
  const orseEntry=mode==='dev'?'/src/domains/orcamentos/orse-import.js':'/'+manifest['src/domains/orcamentos/orse-import.js'].file;
  const orse=await orsePage.evaluate(async url=>{
   const {readOrseInWorker}=await import(/* @vite-ignore */ url);
   const contents={
    insumo:'ORSE;54;Areia lavada;Areia;m3;m3;1;9;N;dbo;30/07/2002;30/07/2002;S;CEHOP;100',
    insumoPreco:'ORSE;54;2026;6;1;0;0;0;0;8,6;8,6;27/07/2026;orse;B;;;N',
    servico:'ORSE;4;Limpeza do terreno;m2;44;31/01/2003;2;;25/04/2008;N;CEHOP;5',
    servicoPreco:'ORSE;4;2026;6;1;6,74;6,33;0,07;0,16;0,17;0,01;D;167;1;CEHOP;25/04/2008;',
    composicao:'ORSE;4;2026;6;1;I;ORSE;54;0,5;0;0;P;8,6;18,19;0;0;4,3;9,09',
   };
   const files=Object.fromEntries(Object.entries(contents).map(([name,text])=>[name,new File([text],name+'.txt')]));
   const progress=[];const data=await readOrseInWorker(files,message=>progress.push(message),{inactivityTimeoutMs:15000});
   return {data,progress};
  },origin+orseEntry);
  expect(orse.data.itens).toHaveLength(1);expect(orse.data.itens[0]).toMatchObject({codigo:'4',precoNao:6.74});
  expect(orse.data.insumos).toHaveLength(1);expect(orse.progress.length).toBeGreaterThan(1);expect(orseErrors).toEqual([]);
  results.push({mode,worker:'ORSE',workerStarted:true,rows:orse.data.itens.length,errors:orseErrors});
 }finally{await browser.close();if(mode==='dev')await server.close();else await new Promise(resolve=>server.httpServer.close(resolve));}
}
await writeFile(resolve(directory,'worker.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
