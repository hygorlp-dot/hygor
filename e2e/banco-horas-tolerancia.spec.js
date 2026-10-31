import {test,expect} from '@playwright/test';
test('tolerância por marcação e limite diário sem alterar fontes ou pagamentos',async({page},info)=>{
 await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));
 const user={id:'qa',nome:'RH QA',role:'admin',email:'qa@qa.test',active:true};
 const data={usuarios:[user],obras:[{id:'o',name:'Obra QA',status:'active'}],config:{paymentHolidays:[]},employees:[{id:'e',name:'Equipe QA',obra:'o',role:'Pedreiro',startDate:'2026-01-01',active:true,dailyRate:100,workdayHours:8,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]}],attendance:{},payments:[]};
 const days=[['26',['07:05','16:55']],['27',['06:55','17:05']],['28',['07:06','17:00']],['29',['07:03','11:57','13:03','16:57']],['30',['07:05','15:55']]];
 const source=days.flatMap(([day,hours])=>hours.map((h,i)=>({employeeId:'e',eventId:`${day}-${i}`,obraId:'o',obraCapturaId:'o',tipoRegistro:'ponto',metodo:'facial',horaConfiavel:true,marcadoEm:`2026-10-${day}T${h}:00-03:00`})));
 const writes=[],before=JSON.stringify({data,source});
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],marcacoes:[],presencas:[]}}));
 await page.route('**/api/data',r=>{
  const b=r.request().postDataJSON()||{};
  if(b.action==='profiles')return r.fulfill({json:{precisaSetup:false}});
  if(/(?:^|[-_])(command|save|salvar|registrar|sincronizar)(?:[-_]|$)|^attendance-/.test(b.action||'')){writes.push(b.action);return r.fulfill({status:403,json:{error:'Ensaio somente leitura'}});}
  if(b.action?.startsWith('ponto-'))return r.fulfill({json:{ok:true,marcacoes:source,apropriacoes:[],cobertura:{completa:true},dispositivos:[],biometrias:[],responsaveis:[],estabelecimentos:[]}});
  return r.fulfill({json:{ok:true,accessToken:'qa',refreshToken:'qa',usuario:user,data,updatedAt:'2026-10-31T12:00:00Z'}});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('#login-email')).toHaveCount(0);
 await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Ponto eletrônico');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Ponto eletrônico'}).click();
 await page.getByRole('tab',{name:'Banco de horas',exact:true}).click();
 const row=page.getByRole('row').filter({has:page.getByRole('button',{name:'Ver extrato de Equipe QA',exact:true})});
 await expect(row).toContainText('43h32');await expect(row).toContainText('−0h18');
 await page.getByRole('button',{name:'Ver extrato de Equipe QA',exact:true}).click();
 await page.getByRole('button',{name:'Conferir dia 26/10/2026 de Equipe QA',exact:true}).click();
 await expect(page.locator('.bh-detalhe-dia')).toContainText('Tolerância aplicada');
 await expect(page.locator('.bh-detalhe-dia')).toContainText('Variação antes da tolerância: −0h10 · Ajuste de tolerância: +0h10');
 await expect(page.locator('.bh-detalhe-dia')).toContainText('Batidas recebidas: 07:05 · 16:55');
 await page.screenshot({path:info.outputPath('tolerancia-aplicada.png'),fullPage:true});
 for(const date of ['28','29']){
  await page.getByRole('button',{name:`Conferir dia ${date}/10/2026 de Equipe QA`,exact:true}).click();
  await expect(page.locator('.bh-detalhe-dia')).toContainText('Tolerância excedida');
 }
 await expect(page.locator('.bh-detalhe-dia')).toContainText('Variação: −0h12');
 expect(writes).toEqual([]);expect(JSON.stringify({data,source})).toBe(before);
});
