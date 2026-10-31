import {test,expect} from '@playwright/test';
import {projectDataForUser} from '../server/data-projection.js';

for(const role of ['engenheiro','rh','admin'])test(`equipe: ações de gestão correspondem à permissão de ${role}`,async({page},testInfo)=>{
  const user={id:'audit-role',nome:'Operador local',email:'role@audit.test',role,active:true,obraId:'w'};
  const source={usuarios:[user],obras:[{id:'w',name:'Obra local',status:'active'}],employees:[{id:'e',name:'Equipe de auditoria',role:'Pedreiro',obra:'w',active:true,startDate:'2026-01-01',dailyRate:120,monthlySalary:3000,remunerationMode:'clt'}],attendance:{},config:{paymentHolidays:[]}};
  const data=projectDataForUser(source,user);
  const mutations=[];
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[]}}));
  await page.route('**/api/data',route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==='profiles')return route.fulfill({json:{precisaSetup:false}});
    if(body.action==='operational-command')mutations.push(body.command);
    return route.fulfill({json:{ok:true,accessToken:'audit-token',refreshToken:'audit-refresh',usuario:user,data,updatedAt:'2026-10-31T00:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.keyboard.press('Control+k');
  const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill('Equipes');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Equipes'}).click();
  const manager=role==='rh'||role==='admin';
  await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(manager?1:0);
  await expect(page.getByRole('button',{name:'Cadastrar funcionário',exact:true})).toHaveCount(manager?1:0);
  await page.locator('.team-row__employee').click();
  await expect(page.getByRole('button',{name:'Registrar desligamento',exact:true})).toHaveCount(manager?1:0);
  await expect(page.getByRole('button',{name:'Arquivar cadastro',exact:true})).toHaveCount(manager?1:0);
  if(!manager)await expect(page.locator('.team-row')).toContainText('Dados trabalhistas restritos');
  expect(mutations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('permissions.png'),fullPage:true});
});
