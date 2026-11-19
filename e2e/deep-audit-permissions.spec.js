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
    if(['operational-command','financial-command','reconciliation-command','save','save-sections'].includes(body.action))mutations.push(body);
    return route.fulfill({json:{ok:true,accessToken:'audit-token',refreshToken:'audit-refresh',usuario:user,data,updatedAt:'2026-10-31T00:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.keyboard.press('Control+k');
  const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill('Equipes');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Equipes'}).click();
  const manager=role==='rh'||role==='admin';
  await expect(page.getByRole('button',{name:'Cadastrar funcionário',exact:true})).toHaveCount(manager?1:0);
  const employee=page.getByRole('button',{name:'Abrir ficha de Equipe de auditoria',exact:true});
  await expect(employee).toBeVisible();
  if(manager){
    await employee.focus();await expect(employee).toBeFocused();await employee.press('Enter');
    await expect(page.getByRole('dialog',{name:'Editar funcionário',exact:true})).toBeVisible();
  }
  await expect(page.getByRole('button',{name:'Registrar desligamento',exact:true})).toHaveCount(manager?1:0);
  if(manager)await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Detalhes',exact:true}).click();
  await expect(page.getByRole('button',{name:'Arquivar cadastro',exact:true})).toHaveCount(manager?1:0);
  if(!manager)await expect(page.locator('.team-row')).toContainText('Dados trabalhistas restritos');
  expect(mutations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('permissions.png'),fullPage:true});
});
