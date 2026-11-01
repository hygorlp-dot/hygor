import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';

async function enter(page,{terminated=false}={}){
 let data=structuredClone(fixture);data.employees=[{...data.employees[0],id:'person',name:'Pessoa do ponto QA',role:'Pedreiro',obra:data.obras[0].id,active:!terminated,status:terminated?'desligado':'ativo',startDate:'2026-01-01',endDate:terminated?'2026-10-28':'',terminationReason:terminated?'Pedido de demissão':'',terminationNotes:terminated?'Saída registrada pelo RH.':'',dailyRate:150,version:1}];
 data.attendance={person:{'2026-10-23':{status:'P',obraId:data.obras[0].id}}};data.advances=[];
 const originalAttendance=JSON.stringify(data.attendance),originalPayments=JSON.stringify(data.payments),commands=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
 await page.addInitScript(({id,terminated})=>{sessionStorage.setItem(`arcd-section:${id}`,terminated?'equipe':'ponto_geral');if(terminated)sessionStorage.setItem('arcd_editar_funcionario','person');localStorage.setItem('arcd-theme','operacional');},{id:profile.id,terminated});
 await page.route('https://**/*',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));
 await page.route('**/api/data',route=>{const body=route.request().postDataJSON()||{};if(body.action==='profiles')return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});
 if(body.action==='operational-command'){commands.push(body.command);const result=applyOperationalCommand(data,{...body.command,actorId:profile.id,actorName:profile.nome},"2026-11-01T15:00:00Z");if(result.ok)data=result.data;return route.fulfill({status:result.ok?200:409,json:{...result,data,updatedAt:'2026-11-01T15:01:00Z'}});}
 return route.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,accessToken:'local',refreshToken:'local',updatedAt:'2026-11-01T15:00:00Z'}});});
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 return {commands,errors,employee:()=>data.employees[0],checkHistory:()=>{expect(JSON.stringify(data.attendance)).toBe(originalAttendance);expect(JSON.stringify(data.payments)).toBe(originalPayments);expect(errors).toEqual([]);}};
}

test('nome abre cadastro compacto, cancelamento conserva rascunho e retorno conserva filtros',async({page},info)=>{
 const app=await enter(page);const name=page.getByRole('button',{name:'Pessoa do ponto QA',exact:true});await expect(name).toBeVisible();await expect(name).toHaveCSS('border-top-width','0px');
 await expect(page.locator('.ponto-row-actions')).toHaveCount(0);await expect(page.getByRole('button',{name:'Limpar',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Ficha',exact:true})).toHaveCount(0);
 const width=await name.locator('xpath=..').evaluate(el=>el.getBoundingClientRect().width);expect(width).toBeLessThanOrEqual(260);
 await page.getByLabel('Buscar funcionário',{exact:true}).fill('Pessoa');await name.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:info.outputPath('ponto-compacto.png')});
 await name.click();const edit=page.getByRole('dialog').first(),summary=edit.getByRole('region',{name:'Vínculo e desligamento'});await expect(summary).toBeInViewport();await expect(summary).toContainText('Sem desligamento registrado');
 await edit.getByLabel('Telefone',{exact:true}).fill('81988887777');await edit.getByRole('button',{name:'Registrar desligamento',exact:true}).click();
 const dismissal=page.getByRole('dialog').last();await expect(dismissal.getByText('O desligamento usa os dados salvos.',{exact:false})).toBeVisible();await dismissal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(edit.getByLabel('Telefone',{exact:true})).toHaveValue('(81) 98888-7777');await edit.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Voltar a Gestão do ponto',exact:true}).click();await expect(page.getByLabel('Buscar funcionário',{exact:true})).toHaveValue('Pessoa');expect(app.commands).toHaveLength(0);app.checkHistory();
});

test('cadastro apresenta data e motivo de desligamento no início',async({page},info)=>{
 const app=await enter(page,{terminated:true});const summary=page.getByRole('region',{name:'Vínculo e desligamento'});await expect(summary).toBeInViewport();await expect(summary).toContainText('Desligado');await expect(summary).toContainText('28/10/2026');await expect(summary).toContainText('Pedido de demissão');await expect(summary).toContainText('Saída registrada pelo RH.');await expect(summary.getByRole('button',{name:'Registrar desligamento',exact:true})).toHaveCount(0);await page.screenshot({animations:'disabled',path:info.outputPath('desligamento-visivel.png')});expect(app.commands).toHaveLength(0);app.checkHistory();
});

test('registrar desligamento mantém ponto e pagamentos e só grava na confirmação',async({page})=>{
 const app=await enter(page);await page.getByRole('button',{name:'Pessoa do ponto QA',exact:true}).click();await page.getByRole('button',{name:'Registrar desligamento',exact:true}).click();const dialog=page.getByRole('dialog').last();await dialog.getByLabel('Último dia trabalhado *',{exact:true}).fill('2026-11-03');await dialog.getByLabel('Tipo de desligamento *',{exact:true}).selectOption('pedido_demissao');expect(app.commands).toHaveLength(0);await dialog.getByRole('button',{name:'Confirmar desligamento',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(app.commands).toHaveLength(1);expect(app.employee()).toMatchObject({active:true,status:'desligamento_agendado',endDate:'2026-11-03',terminationReason:'Pedido de demissão'});app.checkHistory();
});

test('entrada lenta usa a marca atual sem sobreposição e termina no login',async({page},info)=>{
 let release;const gate=new Promise(resolve=>release=resolve);await page.route(/\/assets\/LegacyApp-[^/]+\.js$/,async route=>{await gate;await route.continue();});await page.goto('/',{waitUntil:'commit'});
 const loading=page.getByRole('main',{name:'Carregamento do MARCELL'});await expect(loading).toBeVisible();const logo=loading.getByRole('img',{name:'MARCELL',exact:true});await expect(logo).toBeVisible();await expect(loading.getByRole('status',{name:'Carregando MARCELL',exact:true})).toBeVisible();
 const bounds=await loading.evaluate(el=>{const a=el.querySelector('img').getBoundingClientRect(),b=el.querySelector('p').getBoundingClientRect();return {bottom:a.bottom,textTop:b.top,width:document.documentElement.scrollWidth,viewport:innerWidth};});expect(bounds.bottom).toBeLessThan(bounds.textTop);expect(bounds.width).toBeLessThanOrEqual(bounds.viewport);await page.screenshot({animations:'disabled',path:info.outputPath('entrada.png')});release();await expect(page.locator('#login-email')).toBeVisible();await expect(loading).toHaveCount(0);
});
