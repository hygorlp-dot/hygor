import { build } from 'vite';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(repo,'artifacts/css-recovery');
const fixture=path.join(directory,'fixture');
await mkdir(fixture,{recursive:true});
await writeFile(path.join(fixture,'index.html'),'<html><head></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(path.join(fixture,'screen.css'),'.conference-proof { color: rgb(12, 101, 43); }');
await writeFile(path.join(fixture,'screen.js'),`import './screen.css';import React from 'react';export default ()=>React.createElement('h1',{className:'conference-proof'},'Conferência carregada');`);
await writeFile(path.join(fixture,'main.js'),`
import React,{Suspense,Component,useState,lazy as reactLazy} from 'react';
import {createRoot} from 'react-dom/client';
import {lazyWithCssRetry as lazy} from '../../../src/lib/lazy-with-css-retry.js';
window.boots=Number(sessionStorage.boots||0)+1;sessionStorage.boots=window.boots;
const Screen=(location.search.includes('baseline')?reactLazy:lazy)(()=>import('./screen.js'));
class Boundary extends Component{state={error:null};static getDerivedStateFromError(error){return {error};}render(){return this.state.error?React.createElement('p',null,'Falha persistente capturada'):this.props.children;}}
function App(){const[open,setOpen]=useState(false);return React.createElement(React.Fragment,null,
React.createElement('input',{'aria-label':'Observação'}),React.createElement('button',{onClick:()=>setOpen(true)},'Abrir conferência'),
React.createElement(Boundary,null,React.createElement(Suspense,{fallback:React.createElement('p',null,'Carregando')},open?React.createElement(Screen):null)));}
createRoot(document.getElementById('root')).render(React.createElement(App));`);
await build({configFile:false,root:fixture,logLevel:'error',build:{outDir:path.join(directory,'dist'),emptyOutDir:true}});
const dist=path.join(directory,'dist');
const server=createServer(async(req,res)=>{
  try{const name=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(dist,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();const results=[];
try{
  const baseline=await browser.newPage();let baselineRequests=0;
  await baseline.route('**/assets/*.css*',route=>{baselineRequests++;return route.abort('failed');});
  await baseline.goto(`http://127.0.0.1:${server.address().port}/?baseline`);await baseline.getByRole('button').click();
  await baseline.getByText('Falha persistente capturada').waitFor();
  if(baselineRequests!==1)throw new Error('A reprodução sem correção mudou');
  results.push({baseline:true,screenFailed:true,requests:baselineRequests});await baseline.close();
  for(const width of [320,390,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});let initial=0,retries=0;
    await page.route('**/assets/*.css*',route=>{
      if(new URL(route.request().url()).searchParams.has('_arcd_css_retry')){retries++;return route.continue();}
      initial++;return route.abort('failed');
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole('textbox').fill('Medição em andamento');
    await page.getByRole('button').click();
    await page.getByRole('heading',{name:'Conferência carregada'}).waitFor();
    const proof=await page.evaluate(()=>({boots:window.boots,input:document.querySelector('input').value,color:getComputedStyle(document.querySelector('h1')).color}));
    if(initial!==1||retries!==1||proof.boots!==1||proof.input!=='Medição em andamento'||proof.color!=='rgb(12, 101, 43)')throw new Error(JSON.stringify({width,initial,retries,...proof}));
    await page.screenshot({path:path.join(directory,`recovered-${width}.png`)});
    results.push({width,initial,retries,...proof});await page.close();
  }
  const page=await browser.newPage();let requests=0;
  await page.route('**/assets/*.css*',route=>{requests++;return route.abort('failed');});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.getByRole('button').click();
  await page.getByText('Falha persistente capturada').waitFor();
  if(requests!==2)throw new Error(`Tentativas sem limite: ${requests}`);
  results.push({persistentFailure:true,requests});await page.close();
  await writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();server.close();}
