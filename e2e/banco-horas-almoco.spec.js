import {test,expect} from '@playwright/test';
test('banco de horas desconta almoço uma vez e usa a escala diária sem regravar ponto',async({page},info)=>{
 await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));
 const user={id:'qa',nome:'RH QA',role:'admin',email:'qa@qa.test',active:true};
 const data={usuarios:[user],obras:[{id:'o',name:'Obra QA',status:'active'}],config:{paymentHolidays:[]},employees:[{id:'e',name:'Equipe QA',obra:'o',role:'Pedreiro',startDate:'2026-01-01',active:true,dailyRate:100,workdayHours:8,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-29'}]}],attendance:{},payments:[]};
 const source=['2026-10-29','2026-10-30'].flatMap((date,d)=>['07:00',d?'16:00':'17:00'].map((time,i)=>({employeeId:'e',eventId:`${date}-${i}`,obraId:'o',obraCapturaId:'o',tipoRegistro:'ponto',metodo:'facial',horaConfiavel:true,marcadoEm:`${date}T${time}:00-03:00`})));
 const writes=[],before=JSON.stringify({data,source});
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],marcacoes:[],presencas:[]}}));
 await page.route('**/api/data',r=>{
  const b=r.request().postDataJSON()||{};
  if(b.action==='profiles')return r.fulfill({json:{precisaSetup:false}});
  if(/(?:^|[-_])(command|save|salvar|registrar|sincronizar)(?:[-_]|$)|^attendance-/.test(b.action||'')){writes.push(b.action);return r.fulfill({status:403,json:{error:'Ensaio somente de leitura'}});}
  if(b.action?.startsWith('ponto-'))return r.fulfill({json:{ok:true,marcacoes:source,apropriacoes:[],cobertura:{completa:true},dispositivos:[],biometrias:[],responsaveis:[],estabelecimentos:[]}});
  return r.fulfill({json:{ok:true,accessToken:'qa',refreshToken:'qa',usuario:user,data,updatedAt:'2026-10-31T12:00:00Z'}});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('#login-email')).toHaveCount(0);
 await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Ponto eletrônico');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Ponto eletrônico'}).click();
 await page.getByRole('tab',{name:'Banco de horas',exact:true}).click();
 const row=page.getByRole('row').filter({has:page.getByRole('button',{name:'Ver extrato de Equipe QA',exact:true})});
 await expect(row).toContainText('9h00 / 8h00');await expect(row).toContainText('17h00');await expect(row).toContainText('almoço padrão aplicado');
 if(info.project.name.includes('mobile')){
  const head=await row.getByRole('rowheader').boundingBox(),cell=await row.getByRole('cell').first().boundingBox();
  expect(cell.y).toBeGreaterThanOrEqual(head.y+head.height-1);
  const caption=await page.locator('.bh-table-equipe caption').boundingBox();expect(caption.width).toBeGreaterThan(300);
 }
 await page.screenshot({path:info.outputPath('almoco-equipe.png'),fullPage:true});
 await page.getByRole('button',{name:'Ver extrato de Equipe QA',exact:true}).click();await page.getByRole('button',{name:'Conferir dia 29/10/2026 de Equipe QA',exact:true}).click();
 await expect(page.locator('.bh-detalhe-dia')).toContainText('Almoço padrão descontado: 1h00');await expect(page.locator('.bh-detalhe-dia')).toContainText('Apurado: 9h00 · Jornada considerada: 9h00');
 await expect(page.locator('.bh-detalhe-dia')).toContainText('Batidas recebidas: 07:00 · 17:00');
 await page.screenshot({path:info.outputPath('almoco-detalhe.png'),fullPage:true});
 expect(writes).toEqual([]);expect(JSON.stringify({data,source})).toBe(before);
});
