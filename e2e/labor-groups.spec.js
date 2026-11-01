import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

for(const tab of ['ponto_geral','ponto','folha'])test(`${tab}: grupos, período e ajuda`,async({page},info)=>{
 const data=structuredClone(fixture),obra=data.obras[0].id;
 data.employees=[{id:'field',name:'Operador exclusivo de obra',role:'Pedreiro',obra,active:true,dailyRate:100,startDate:'2026-01-01'},
  {id:'office',name:'Assistente exclusivo administrativo',workArea:'administrativo',role:'Assistente',active:true,dailyRate:150,startDate:'2026-01-01'},
  {id:'engineer',name:'Engenheiro da obra no administrativo',role:'Engenheiro civil',obra,active:true,dailyRate:200,startDate:'2026-01-01'}];
 data.attendance=Object.fromEntries(data.employees.map(e=>[e.id,Object.fromEntries(['2026-10-21','2026-10-22','2026-10-23'].map(date=>[date,{status:'P',obraId:e.obra||''}]))]));
 data.dailyCheckDate='2026-10-23';data.quinzenasArquivadas={};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-23T12:00:00-03:00'));
 await page.addInitScript(({id,user})=>sessionStorage.setItem(`arcd-section:${user}`,id),{id:tab,user:profile.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
 await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'local-only',refreshToken:'local-only'}}));
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-only');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 const main=page.locator('.arcd-main'),tabs=main.locator('.labor-area-tabs');
 await expect(tabs).toBeVisible();
 const before=await main.locator('input[type=date],input[type=number],select').evaluateAll(nodes=>nodes.filter(n=>!n.closest('.labor-area-tabs')).map(n=>({label:n.getAttribute('aria-label'),value:n.value})));
 await tabs.getByRole('button',{name:'Administrativo',exact:true}).click();
 await expect(main.getByText('Assistente exclusivo administrativo',{exact:true}).first()).toBeVisible();
 await expect(main.getByText('Engenheiro da obra no administrativo',{exact:true}).first()).toBeVisible();
 await expect(main.getByText('Operador exclusivo de obra',{exact:true})).toHaveCount(0);
 if(tab==='folha')await expect(main.getByRole('button',{name:'Fechar quinzena',exact:true})).toBeDisabled();
 if(tab==='ponto_geral')await expect(main.getByRole('button',{name:'Finalizar e arquivar quinzena',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();
 await expect(page.locator('.app-help-article')).toContainText('Administrativo');await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 await page.screenshot({path:info.outputPath('administrativo.png'),animations:'disabled'});
 await tabs.getByRole('button',{name:'Pessoal de obra',exact:true}).click();
 await expect(main.getByText('Operador exclusivo de obra',{exact:true}).first()).toBeVisible();
 await expect(main.getByText('Assistente exclusivo administrativo',{exact:true})).toHaveCount(0);
 await expect(main.getByText('Engenheiro da obra no administrativo',{exact:true})).toHaveCount(0);
 expect(await main.locator('input[type=date],input[type=number],select').evaluateAll(nodes=>nodes.filter(n=>!n.closest('.labor-area-tabs')).map(n=>({label:n.getAttribute('aria-label'),value:n.value})))).toEqual(before);
 await tabs.getByRole('button',{name:'Todos',exact:true}).click();
 await expect(main.getByText('Assistente exclusivo administrativo',{exact:true}).first()).toBeVisible();
 await expect(main.getByText('Operador exclusivo de obra',{exact:true}).first()).toBeVisible();
 expect(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1)).toBe(true);
 if(tab==='folha'){
  await tabs.getByRole('button',{name:'Administrativo',exact:true}).click();
  const area=main.getByRole('button',{name:'Holerites CLT',exact:true});
  if(await area.isVisible())await area.click();else await main.getByRole('combobox',{name:'Áreas da folha',exact:true}).selectOption('clt');
  await expect(main.getByLabel('Funcionário do holerite',{exact:true}).locator('option')).toHaveCount(3);
  await tabs.getByRole('button',{name:'Pessoal de obra',exact:true}).click();
  await expect(main.getByLabel('Funcionário do holerite',{exact:true}).locator('option')).toHaveCount(2);
  await main.getByLabel('Funcionário do holerite',{exact:true}).selectOption('field');
  await main.getByLabel('Matrícula',{exact:true}).fill('TESTE-LOCAL');
  page.once('dialog',dialog=>dialog.dismiss());
  await tabs.getByRole('button',{name:'Administrativo',exact:true}).click();
  await expect(main.getByLabel('Matrícula',{exact:true})).toHaveValue('TESTE-LOCAL');
  await expect(tabs.getByRole('button',{name:'Pessoal de obra',exact:true})).toHaveAttribute('aria-current','page');
  page.once('dialog',dialog=>dialog.accept());
  await tabs.getByRole('button',{name:'Administrativo',exact:true}).click();
  await expect(main.getByLabel('Funcionário do holerite',{exact:true})).toHaveValue('');
 }
 expect(errors).toEqual([]);
});
