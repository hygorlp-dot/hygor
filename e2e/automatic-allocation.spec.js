import {test,expect} from '@playwright/test';
import {planBiometricSync} from '../server/attendance-biometric-sync.js';
import {applyAttendanceCommand} from '../server/attendance-command.js';
import {enrichAttendanceWithAutomaticAllocation} from '../server/attendance-auto-allocation.js';

test('terceiro dia sincronizado transfere lotação e preserva histórico e pagamento',async({page},info)=>{
 const now='2026-10-31T12:00:00Z',date='2026-10-29';await page.clock.setFixedTime(new Date(now));
 const user={id:'qa',nome:'RH QA',email:'qa@qa.test',role:'rh',active:true};
 let data={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'o',name:'Obra A',status:'active'},{id:'b',name:'Obra B',status:'active'}],
 employees:[{id:'e',name:'Funcionário QA',role:'Servente',obra:'o',version:1,dailyRate:100,startDate:'2020-01-01',active:true,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]}],
 attendance:{e:{'2026-10-27':{status:'P',obraId:'b'},'2026-10-28':{status:'P',obraId:'b'}}},payments:[{id:'fixture',amount:7160}],titulosFolha:[]};
 const events=['10:00','15:00','16:00','20:00'].map((clock,i)=>({employeeId:'e',eventId:`e-${i}`,obraId:'b',tipoRegistro:'ponto',marcadoEm:`${date}T${clock}:00Z`,metodo:'facial',horaConfiavel:true,tipoEvento:['entrada','intervalo','retorno','saida'][i]}));
 const originals=JSON.stringify({events,payments:data.payments,oldDays:Object.values(data.attendance.e)});const writes=[];
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[]}}));
 await page.route('**/api/data',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='profiles')return route.fulfill({json:{precisaSetup:false}});
  if(body.action==='attendance-preview-punches')return route.fulfill({json:{ok:true,items:planBiometricSync(data,body,events,now)}});
  if(body.action==='attendance-sync-punches'){
   writes.push(body.action);const result=enrichAttendanceWithAutomaticAllocation(applyAttendanceCommand(data,user,body,now,events),{now,operationId:body.operationId,actorId:user.id,actorName:user.nome});
   if(result.ok)data=result.data;
   return route.fulfill({status:result.ok?200:409,json:{ok:result.ok,result:result.result,error:result.error,updatedAt:now}});
  }
  if(/(?:^|[-_])(command|save|salvar)(?:[-_]|$)|^attendance-/.test(body.action||''))throw Error(`Gravação inesperada: ${body.action}`);
  return route.fulfill({json:{ok:true,accessToken:'qa',refreshToken:'qa',usuario:user,data,updatedAt:now}});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('#login-email')).toHaveCount(0);
 const navigate=async term=>{await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(term);await search.locator('xpath=../..').getByRole('button').filter({hasText:term}).first().click();};
 await navigate('Gestão do ponto');await page.getByRole('button',{name:'Sincronizar batidas do app',exact:true}).click();
 const modal=page.getByRole('dialog');await expect(modal).toContainText('1 dia(s) para sincronizar');
 await modal.getByRole('button',{name:'Sincronizar 1 dia(s) e proteger',exact:true}).click();await expect(modal.getByRole('status').filter({hasText:'1 dia(s) gravado(s)'})).toBeVisible();
 expect(data.employees[0]).toMatchObject({obra:'b',version:2});expect(data.changeLog).toContainEqual(expect.objectContaining({type:'transfer',automatic:true}));
 expect(JSON.stringify({events,payments:data.payments,oldDays:[data.attendance.e['2026-10-27'],data.attendance.e['2026-10-28']]})).toBe(originals);
 await modal.locator('.biometric-sync__actions').getByRole('button',{name:'Fechar',exact:true}).click();
 await navigate('Equipes');const row=page.locator('.team-row').filter({hasText:'Funcionário QA'});await expect(row).toContainText('Obra B');
 await page.screenshot({path:info.outputPath('lotacao-atualizada.png'),fullPage:true});expect(writes).toEqual(['attendance-sync-punches']);
});
