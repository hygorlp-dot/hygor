import {expect,test} from '@playwright/test';
const profile={id:'rh-qa',nome:'RH QA',email:'rh@qa.test',role:'rh',active:true};
async function enter(page,{saved=false,role='rh'}={}){
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00-03:00'));
  const user={...profile,role};
  const employee={id:'emp',name:'Funcionário QA',role:'Pedreiro',cpf:'52998224725',phone:'81999999999',obra:'obra',workArea:'campo',startDate:'2026-01-01',dailyRate:100,monthlySalary:2800,remunerationMode:'clt',remunerationEffectiveFrom:'2026-10-28',active:true,version:4,workdayHours:8,workStart:'07:00',cltPayroll:{profile:{salary:2800}},vtDaily:0,vrDaily:0};
  if(saved)employee.laborProvisions={'2026-10':{competence:'2026-10',included:true,base:3500,average:0,fgtsPercent:8,finePercent:40,extraReserve:0,fgtsOnVacation:true,openingMonth:'2026-10',openingBalance:0,usedReserve:0,fgtsSeveranceBase:'',notes:'Base conhecida'}};
  const data={usuarios:[user],employees:[employee],obras:[{id:'obra',name:'Obra QA',status:'active'}],config:{companyName:'Empresa QA',cnpj:'00.000.000/0001-00',paymentHolidays:[]},attendance:{emp:{'2026-10-28':{status:'P',obraId:'obra'}}},attendanceLocks:{},advances:[],changeLog:[],payments:[{id:'preservar',amount:7160}]};
  const before=JSON.stringify(data),writes=[];
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,presencas:[],items:[]}}));
  await page.route('**/api/data',async route=>{const body=route.request().postDataJSON()||{};
    if(/command|save/.test(body.action||'')){writes.push(body.action);return route.fulfill({status:409,json:{ok:false,error:'Ensaio somente de navegação'}});}
    if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
    return route.fulfill({json:{ok:true,accessToken:'qa',refreshToken:'qa',usuario:user,data,updatedAt:'2026-10-30T15:00:00Z'}});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('teste');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('#login-email')).toHaveCount(0);
  const check=()=>{expect(writes).toEqual([]);expect(JSON.stringify(data)).toBe(before);};
  await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Folha');
  if(role==='financeiro'){await expect(search.locator('xpath=../..').getByRole('button').filter({hasText:'Folha'})).toHaveCount(0);await page.keyboard.press('Escape');return {check};}
  await search.locator('xpath=../..').getByRole('button').filter({hasText:'Folha'}).click();
  return {check};
}
test('pendências e atalhos reaproveitam cadastro, holerite e provisões sem gravar',async({page},info)=>{
  const {check}=await enter(page);
  await page.getByRole('button',{name:'Organizar pendências do RH',exact:true}).click();
  const panel=page.getByRole('region',{name:'Próximos passos do RH'});
  await expect(panel).toContainText('Matrícula');await expect(panel).toContainText('CBO');await expect(panel).toContainText('não é considerado falta');
  await expect(panel).toContainText('Estimativa não salva');await page.screenshot({path:info.outputPath('pendencias.png'),fullPage:true});
  expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await panel.getByRole('button',{name:'Abrir cadastro',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Nome completo *',{exact:true})).toHaveValue('Funcionário QA');await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Folha');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Folha'}).click();
  await page.getByRole('button',{name:'Pendências do RH',exact:true}).click();await panel.getByRole('button',{name:'Abrir holerite',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Funcionário do holerite',exact:true})).toHaveValue('emp');await expect(page.getByLabel('Salário contratual mensal (R$)',{exact:true})).toHaveValue('2800');await expect(page.getByRole('button',{name:'Salvar demonstrativo',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Pendências do RH',exact:true}).click();await panel.getByRole('button',{name:'Abrir provisões',exact:true}).click();await expect(page.getByLabel('Base mensal para provisões (R$)',{exact:true})).toHaveValue('2800');await expect(page.getByRole('button',{name:'Salvar provisões',exact:true})).toBeEnabled();await expect(page.getByText('Estimativa — ainda não salva',{exact:true})).toBeVisible();check();
});
test('atalhos abrem data, obra e funcionário corretos e mantêm estimativa salva',async({page})=>{
  const {check}=await enter(page,{saved:true});
  await page.getByRole('button',{name:'Pendências do RH',exact:true}).click();await page.getByRole('button',{name:'Abrir gestão do ponto',exact:true}).click();
  await expect(page.getByLabel('Buscar funcionário',{exact:true})).toHaveValue('Funcionário QA');
  await page.keyboard.press('Control+k');let search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Folha');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Folha'}).click();
  await page.getByRole('button',{name:'Pendências do RH',exact:true}).click();await page.getByRole('button',{name:'Abrir fechamento por obra',exact:true}).click();
  await expect(page.locator('main input[type=date]').first()).toHaveValue('2026-10-28');
  await page.keyboard.press('Control+k');search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Folha');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Folha'}).click();
  await page.getByRole('button',{name:'Pendências do RH',exact:true}).click();await page.getByRole('button',{name:'Abrir provisões',exact:true}).click();await expect(page.getByLabel('Base mensal para provisões (R$)',{exact:true})).toHaveValue('3500');await expect(page.getByLabel('Reserva existente antes desse mês (R$)',{exact:true})).toHaveValue('0');check();
});
test('perfil financeiro não recebe atalhos de alteração do RH',async({page})=>{const {check}=await enter(page,{role:'financeiro'});await expect(page.getByRole('button',{name:'Pendências do RH',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Organizar pendências do RH',exact:true})).toHaveCount(0);check();});
