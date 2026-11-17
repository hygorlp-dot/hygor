import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function enter(page,{quota=false,lost=false}={}){
 const data=structuredClone(fixture),commands=[],uploads=[],errors=[];let failPhoto=false,lose=lost,hold=false,release;
 data.usuarios=[profile];data.terceirizados=[{id:'qa-terc',name:'Equipe QA local',obraId:'a',active:true,tipoContrato:'empreitada',contractValue:1000,etapas:[{id:'qa-stage',nome:'Estrutura',valor:1000}]}];data.medicoesTerc=[];data.pagsTerceiros=[];
 await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));await page.addInitScript(({id,quota})=>{sessionStorage.setItem('arcd-section:'+id,'terc');localStorage.setItem('arcd-theme','marcell');if(quota){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('marcell:third-measurement-draft:')&&!window.__allowDraft)throw new DOMException('Quota','QuotaExceededError');return original.call(this,k,v);};}},{id:profile.id,quota});
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',async r=>{const body=r.request().postDataJSON()||{};
  if(r.request().url().includes('/api/microsoft/onedrive')){
   if(body.action==='upload'){uploads.push(body);if(failPhoto&&uploads.length===2)return r.fulfill({status:503,json:{ok:false,error:'Falha no segundo arquivo QA.'}});return r.fulfill({json:{ok:true,url:`/qa-photo-${uploads.length}.svg`,item:{id:`photo-${uploads.length}`}}});}
   return r.fulfill({json:{ok:true,connected:false,items:[]}});
  }
  if(body.action==='operational-command'){commands.push(body.command);if(hold)await new Promise(resolve=>release=resolve);const result=applyOperationalCommand(data,{...body.command,actorRole:'admin'});if(result.ok)Object.assign(data,result.data);if(lose){lose=false;return r.fulfill({status:503,json:{ok:false,error:'A resposta se perdeu no ensaio.'}});}return r.fulfill({json:{...result,data,updatedAt:'2026-11-17T15:01:00Z'}});}
  if(['save','save-sections','financial-command'].includes(body.action))return r.fulfill({status:409,json:{ok:false,error:'Gravação fora do ensaio bloqueada.'}});
  return r.fulfill({json:{ok:true,data,usuario:profile,usuarios:[profile],accessToken:'qa-local',refreshToken:'qa-local',precisaSetup:false,updatedAt:'2026-11-17T15:00:00Z',items:[],bases:[],presencas:[],connected:false,obras:{}}});
 });await page.route('**/qa-photo-*.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><path d="M0 0h50v50H0z" fill="#123456"/></svg>'}));
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('qa-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return {data,commands,uploads,partialPhoto:()=>failPhoto=true,delay:()=>hold=true,release:()=>{hold=false;release?.();},check:()=>expect(errors).toEqual([])};
}
async function open(page){const select=page.getByRole('combobox',{name:'Selecionar visão',exact:true});if(page.viewportSize().width<600)await select.selectOption('medicoes');else await page.getByRole('button',{name:/^Medições/}).click();await page.getByRole('combobox',{name:'Contrato',exact:true}).selectOption('qa-terc');await page.getByRole('button',{name:'Nova medição',exact:true}).click();return page.getByRole('dialog').filter({has:page.getByRole('textbox',{name:'Percentual de Estrutura',exact:true})});}
const percent=d=>d.getByRole('textbox',{name:'Percentual de Estrutura',exact:true});
const send=d=>d.getByRole('button',{name:/Confirmar e enviar para aprovação|Repetir confirmação|Confirmando/,exact:false});
for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 test('rascunho retoma percentual, observação e fotos após fechar e recarregar',async({page})=>{
  const app=await enter(page);let d=await open(page);await percent(d).fill('42,125');await d.getByLabel('Observação',{exact:true}).fill('Execução QA: revisar antes de confirmar');await d.locator('input[type=file][multiple]').setInputFiles({name:'local.png',mimeType:'image/png',buffer:image});await expect(d.getByAltText('Evidência 1',{exact:true})).toBeVisible();await d.getByRole('button',{name:'Cancelar',exact:true}).click();await page.reload();d=await open(page);await percent(d).focus();await expect(percent(d)).toHaveValue('42,125');await expect(d.getByLabel('Observação',{exact:true})).toHaveValue('Execução QA: revisar antes de confirmar');await expect(d.getByAltText('Evidência 1',{exact:true})).toBeVisible();expect(app.commands).toEqual([]);expect(app.uploads).toHaveLength(1);app.check();await expect(d.getByRole('status')).toContainText('Rascunho salvo neste aparelho');await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa6/rascunho-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
 });
 test('armazenamento cheio mantém formulário e bloqueia saída até proteger o rascunho',async({page})=>{
  const app=await enter(page,{quota:true});const d=await open(page);await percent(d).fill('25');await expect(d).toContainText('Não foi possível salvar o rascunho neste aparelho');await d.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(d).toBeVisible();expect(app.commands).toEqual([]);await page.evaluate(()=>window.__allowDraft=true);await d.getByRole('button',{name:'Tentar salvar rascunho',exact:true}).click();await expect(d).toContainText('Rascunho salvo neste aparelho');await d.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(d).toHaveCount(0);app.check();
 });
 test('resposta perdida repete a mesma confirmação sem duplicar medição ou fotos',async({page})=>{
  const app=await enter(page,{lost:true});const d=await open(page);await percent(d).fill('50');await d.locator('input[type=file][multiple]').setInputFiles({name:'local.png',mimeType:'image/png',buffer:image});await expect(d.getByAltText('Evidência 1',{exact:true})).toBeVisible();app.delay();await send(d).click();await expect(send(d)).toBeDisabled();await expect.poll(()=>app.commands.length).toBe(1);app.release();await expect(d.getByRole('button',{name:'Repetir confirmação',exact:true})).toBeEnabled();await expect(percent(d)).toBeDisabled();await d.getByRole('button',{name:'Repetir confirmação',exact:true}).click();await expect(d).toHaveCount(0);expect(app.commands).toHaveLength(2);expect(app.commands[1]).toEqual(app.commands[0]);expect(app.data.medicoesTerc).toHaveLength(1);expect(app.uploads).toHaveLength(1);app.check();
 });
 test('offline preserva o rascunho e reconexão não confirma por conta própria',async({page,context})=>{
  const app=await enter(page);let d=await open(page);await context.setOffline(true);await percent(d).fill('35');await d.getByLabel('Observação',{exact:true}).fill('Anotado sem rede');await expect(d).toContainText('Rascunho salvo neste aparelho');await d.getByRole('button',{name:'Cancelar',exact:true}).click();d=await open(page);await expect(d.getByLabel('Observação',{exact:true})).toHaveValue('Anotado sem rede');await context.setOffline(false);await page.reload();d=await open(page);await percent(d).focus();await expect(percent(d)).toHaveValue('35');expect(app.commands).toEqual([]);app.check();
 });
 test('falha parcial das fotos conserva a foto enviada após recarga',async({page})=>{
  const app=await enter(page);app.partialPhoto();let d=await open(page);await d.locator('input[type=file][multiple]').setInputFiles([{name:'um.png',mimeType:'image/png',buffer:image},{name:'dois.png',mimeType:'image/png',buffer:image}]);await expect(d.getByAltText('Evidência 1',{exact:true})).toBeVisible();await expect(d.getByRole('button',{name:'Escolher da galeria',exact:true})).toBeEnabled();await d.getByRole('button',{name:'Cancelar',exact:true}).click();await page.reload();d=await open(page);await expect(d.getByAltText('Evidência 1',{exact:true})).toBeVisible();await expect(d.getByAltText('Evidência 2',{exact:true})).toHaveCount(0);expect(app.uploads).toHaveLength(2);expect(app.commands).toEqual([]);app.check();
 });
 test('mudança da base sinaliza rascunho antigo sem recalcular ou gravar',async({page})=>{
  const app=await enter(page);let d=await open(page);await percent(d).fill('40');await d.getByRole('button',{name:'Cancelar',exact:true}).click();app.data.terceirizados[0].etapas[0].valor=2000;await page.reload();d=await open(page);await expect(d).toContainText('A base da medição mudou');await expect(send(d)).toBeDisabled();expect(app.commands).toEqual([]);app.check();
 });

 test('reduzir o acumulado não promete estorno nem envia uma medição inválida',async({page})=>{
  const app=await enter(page);app.data.medicoesTerc.push({id:'qa-previous',tercId:'qa-terc',obraId:'a',data:'2026-11-01',status:'aprovada',total:500,itens:[{etapaId:'qa-stage',pctAnterior:0,pctAcum:50,valor:500}]});await page.reload();const d=await open(page);await percent(d).fill('40');await expect(d).toContainText('não cria um estorno');await expect(send(d)).toBeDisabled();expect(app.commands).toEqual([]);app.check();
 });

});
