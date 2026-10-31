import {test,expect} from '@playwright/test';
import {planBiometricSync} from '../server/attendance-biometric-sync.js';
import {applyAttendanceCommand} from '../server/attendance-command.js';
const now='2026-10-31T12:00:00Z',date='2026-10-29';
async function enter(page,{fail=false,role='rh'}={}){
 await page.clock.setFixedTime(new Date(now));
 const user={id:'qa',nome:'RH QA',email:'qa@qa.test',role,active:true};
 let data={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'o',name:'Obra A',status:'active'},{id:'b',name:'Obra B',status:'active'}],
  employees:['e','f'].map(id=>({id,name:`Funcionário ${id}`,obra:'o',dailyRate:100,startDate:'2020-01-01',active:true,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]})),
  attendance:{e:{[date]:{status:'F',obraId:'o'}}},payments:[{id:'real',amount:7160}],titulosFolha:[]};
 const originalPayments=JSON.stringify(data.payments),commands=[];
 const events=['e','f'].flatMap(employeeId=>['10:00','15:00','16:00','20:00'].map((clock,i)=>({employeeId,eventId:`${employeeId}-${i}`,obraId:employeeId==='e'?'o':'b',tipoRegistro:'ponto',marcadoEm:`${date}T${clock}:00Z`,metodo:'facial',horaConfiavel:true,tipoEvento:['entrada','intervalo','retorno','saida'][i]})));
 events.push({...events[0],eventId:'partial',marcadoEm:'2026-10-30T10:00:00Z'});
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[]}}));
 await page.route('**/api/data',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='profiles')return route.fulfill({json:{precisaSetup:false}});
  if(body.action==='attendance-preview-punches')return route.fulfill({json:{ok:true,items:planBiometricSync(data,body,events,now)}});
  if(body.action==='attendance-sync-punches'){
   commands.push(body);if(fail)return route.fulfill({status:409,json:{error:'O ponto mudou. Atualize antes de sincronizar.'}});
   const result=applyAttendanceCommand(data,user,body,now,events);if(result.ok)data=result.data;
   return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:now}});
  }
  if(/command|save|attendance-/.test(body.action||''))throw new Error(`Gravação inesperada: ${body.action}`);
  return route.fulfill({json:{ok:true,accessToken:'qa',refreshToken:'qa',usuario:user,data,updatedAt:now}});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');
 await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('#login-email')).toHaveCount(0);
 await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Gestão do ponto');
 await search.locator('xpath=../..').getByRole('button').filter({hasText:'Gestão do ponto'}).click();
 return {commands,getData:()=>data,checkPayments:()=>expect(JSON.stringify(data.payments)).toBe(originalPayments)};
}
test('RH sincroniza todas as obras do período, prioriza biometria e protege a grade',async({page},info)=>{
 const fixture=await enter(page);await page.getByRole('button',{name:'Sincronizar batidas do app',exact:true}).click();
 const modal=page.getByRole('dialog');await expect(modal).toContainText('2 dia(s) para sincronizar');await expect(modal).toContainText('1 pendência(s)');
 await expect(modal.getByRole('heading',{name:'Obra B',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('sync-preview.png'),fullPage:true});
 expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await modal.getByRole('button',{name:'Sincronizar 2 dia(s) e proteger',exact:true}).click();
 await expect(modal.getByRole('status').filter({hasText:'2 dia(s) gravado(s)'})).toBeVisible();await expect(modal).toContainText('2 já sincronizado(s)');
 expect(fixture.commands).toHaveLength(1);expect(fixture.commands[0].items).toHaveLength(2);
 expect(fixture.getData().attendance.e[date].status).toBe('P');expect(fixture.getData().attendance.f[date].obraId).toBe('b');fixture.checkPayments();
 await modal.locator('.biometric-sync__actions').getByRole('button',{name:'Fechar',exact:true}).click();await expect(page.getByTitle('Ponto biométrico: protegido contra alteração pela engenharia. Revisão somente pelo RH.').first()).toBeDisabled();
});
test('falha mantém lançamentos anteriores e impede repetir lote desatualizado',async({page})=>{
 const fixture=await enter(page,{fail:true});await page.getByRole('button',{name:'Sincronizar batidas do app',exact:true}).click();
 const modal=page.getByRole('dialog');await modal.getByRole('button',{name:'Sincronizar 2 dia(s) e proteger',exact:true}).click();
 await expect(modal.getByRole('alert')).toContainText('O ponto mudou');expect(fixture.getData().attendance.e[date].status).toBe('F');fixture.checkPayments();
 await expect(modal.getByRole('button',{name:'Sincronizar 2 dia(s) e proteger',exact:true})).toBeDisabled();
});
