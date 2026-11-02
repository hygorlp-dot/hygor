import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readRealFinanceData} from './finance-real-data-source.mjs';

// Requisições da base somente GET/HEAD. O navegador recebe uma projeção
// de apresentação, sem PIN, hashes, credenciais ou identificadores de login.
const nativeFetch=globalThis.fetch;let reads=0;
globalThis.fetch=(input,options={})=>{if(!['GET','HEAD'].includes(String(options.method||input?.method||'GET').toUpperCase()))throw Error('Revisão somente de leitura.');reads++;return nativeFetch(input,{...options,signal:AbortSignal.timeout(20000)});};
const {data,updatedAt}=await readRealFinanceData();
const fingerprint=()=>createHash('sha256').update(JSON.stringify(data.usuarios)).digest('hex'),before=fingerprint();
const users=(data.usuarios||[]).map(u=>Object.fromEntries(Object.entries({id:u.id,nome:u.nome,email:u.email,role:u.role,obraId:u.obraId,maxDesconto:u.maxDesconto,active:u.active,accessTabs:u.accessTabs,createdAt:u.createdAt,pin:u.pin?'configured':'',authUserId:u.authUserId?'configured':''}).filter(([,v])=>v!==undefined)));
const actor=users.find(u=>u.role==='admin'&&u.active!==false);if(!actor)throw Error('Não há perfil administrativo para a simulação de apresentação.');
const state={usuarios:users,obras:(data.obras||[]).map(w=>({id:w.id,name:w.name,status:w.status})),config:{},employees:[],attendance:{}};
const output='C:/dev/marcell-local-review/usuarios';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{for(const width of [1704,1024,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});let writes=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'config'),actor.id);
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>{const b=r.request().postDataJSON()||{};
  if(b.action==='heartbeat')return r.fulfill({json:{ok:true}}); // presença simulada; nenhuma chamada ao servidor real

  if(!['profiles','auth-login','auth-refresh','load','list','status','chat-list','ranking-list','equipment-registry-report','attendance-registry-report','core-registry-report','purchase-requests-report','procurement-registry-report'].includes(b.action)){writes++;return r.fulfill({status:403,json:{error:'Ação bloqueada na revisão de apresentação.'}});}
  return r.fulfill({json:b.action==='profiles'?{usuarios:[actor],precisaSetup:false}:{ok:true,usuario:actor,data:structuredClone(state),accessToken:'isolated-layout-review',refreshToken:'isolated-layout-review',presencas:[],items:[],bases:[],updatedAt}});
 });
 await page.goto('http://127.0.0.1:4192/');await page.locator('#login-email').fill(actor.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:/Acessar central/}).click();
 const directory=page.getByRole('region',{name:'Minha equipe MARCELL',exact:true});await expect(directory).toBeVisible({timeout:20000});await expect(directory.locator('tbody tr')).toHaveCount(users.length);
 const initial=await directory.evaluate(root=>({width:Math.round(root.getBoundingClientRect().width),overflow:root.scrollWidth>root.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,nameButtons:[...root.querySelectorAll('.user-directory__member button')].map(b=>({height:Math.round(b.getBoundingClientRect().height),width:Math.round(b.getBoundingClientRect().width)})),overlaps:[...root.querySelectorAll('tbody tr')].filter(row=>{const member=row.querySelector('.user-directory__member'),cell=row.querySelector('td');return member&&cell&&getComputedStyle(cell).display==='block'&&member.getBoundingClientRect().bottom>cell.getBoundingClientRect().top+1;}).length}));
 expect(initial.pageOverflow).toBe(false);expect(initial.overflow).toBe(false);expect(initial.overlaps).toBe(0);
 for(const [filter,expected]of [['active',users.filter(u=>u.active!==false).length],['inactive',users.filter(u=>u.active===false).length]]){await directory.getByLabel('Situação do membro').selectOption(filter);await expect(directory.locator('tbody tr')).toHaveCount(expected);}
 await directory.getByLabel('Situação do membro').selectOption('all');
 const search=directory.getByLabel('Buscar membro');await search.fill(users[0].email||users[0].nome);expect(await directory.locator('tbody tr').count()).toBeGreaterThan(0);await search.fill('');await expect(directory.locator('tbody tr')).toHaveCount(users.length);
 await directory.scrollIntoViewIfNeeded();await directory.screenshot({path:`${output}/usuarios-reais-${width}.png`});
 expect(writes).toBe(0);checks.push({viewport:width,rows:users.length,active:users.filter(u=>u.active!==false).length,inactive:users.filter(u=>u.active===false).length,...initial,writes});await page.close();
}expect(errors).toEqual([]);if(before!==fingerprint())throw Error('A cópia dos usuários foi alterada.');const report={at:new Date().toISOString(),sourceUpdatedAt:updatedAt,reads,usersAndPermissionsUnchanged:true,oneDriveRequests:0,sourceWrites:0,checks,errors};await writeFile(`${output}/REVISAO-LAYOUT.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}finally{await browser.close();}
