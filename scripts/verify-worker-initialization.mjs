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
  results.push({mode,workerStarted:true,rows:result.data.itens.length,price:result.data.itens[0].precoNao,errors});
 }finally{await browser.close();if(mode==='dev')await server.close();else await new Promise(resolve=>server.httpServer.close(resolve));}
}
await writeFile(resolve(directory,'worker.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
