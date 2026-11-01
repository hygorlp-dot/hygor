import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';

async function enter(page,{terminated=false,screen,role=profile.role,scheduled=false,failDismissal=false}={}){
 const actor={...profile,role};
 let data=structuredClone(fixture);data.usuarios=[actor];data.employees=[{...data.employees[0],id:'person',name:'Pessoa do ponto QA',role:'Pedreiro',obra:data.obras[0].id,active:!terminated,status:terminated?'desligado':'ativo',startDate:'2026-01-01',endDate:terminated?'2026-10-28':'',terminationReason:terminated?'Pedido de demissão':'',terminationNotes:terminated?'Saída registrada pelo RH.':'',dailyRate:150,version:1}];
 if(scheduled)Object.assign(data.employees[0],{status:'desligamento_agendado',active:true,endDate:'2026-11-03',terminationType:'pedido_demissao',terminationReason:'Pedido de demissão',terminationNotes:'Prazo conferido'});
 data.attendance={person:{'2026-10-23':{status:'P',obraId:data.obras[0].id}}};data.advances=[];
 const originalAttendance=JSON.stringify(data.attendance),originalPayments=JSON.stringify(data.payments),commands=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
 await page.addInitScript(({id,terminated,screen})=>{sessionStorage.setItem(`arcd-section:${id}`,screen||(terminated?'equipe':'ponto_geral'));if(terminated&&!screen)sessionStorage.setItem('arcd_editar_funcionario','person');localStorage.setItem('arcd-theme','operacional');},{id:profile.id,terminated,screen});
 await page.route('https://**/*',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));
 await page.route('**/api/data',route=>{const body=route.request().postDataJSON()||{};if(body.action==='profiles')return route.fulfill({json:{usuarios:[actor],precisaSetup:false}});
 if(body.action==='operational-command'){commands.push(body.command);if(failDismissal)return route.fulfill({status:409,json:{ok:false,reason:'Falha simulada no desligamento.'}});const result=applyOperationalCommand(data,{...body.command,actorId:profile.id,actorName:profile.nome},"2026-11-01T15:00:00Z");if(result.ok)data=result.data;return route.fulfill({status:result.ok?200:409,json:{...result,data,updatedAt:'2026-11-01T15:01:00Z'}});}
 return route.fulfill({json:{ok:true,usuarios:[actor],precisaSetup:false,usuario:actor,data,accessToken:'local',refreshToken:'local',updatedAt:'2026-11-01T15:00:00Z'}});});
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

test('Equipes oferece Desligar sem abrir detalhes e cancelar não grava',async({page},info)=>{
 const app=await enter(page,{screen:'equipe'});const row=page.locator('.team-row').first();const action=row.getByRole('button',{name:'Desligar',exact:true});await expect(action).toBeInViewport();await expect(row.locator('.team-row__detail')).toHaveCount(0);await expect(row.getByRole('button',{name:'Ficha',exact:true})).toHaveCount(0);const details=row.getByRole('button',{name:'Detalhes',exact:true});await details.click();await expect(details).toHaveAttribute('aria-expanded','true');await expect(row.locator('.team-row__detail')).toBeVisible();await details.click();await expect(details).toHaveAttribute('aria-expanded','false');await page.screenshot({path:info.outputPath('desligar-na-lista.png'),animations:'disabled'});
 await action.click();await expect(page.getByRole('dialog')).toHaveCount(1);const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Registrar desligamento',exact:true})).toBeVisible();await expect(dialog.getByLabel('Último dia trabalhado *',{exact:true})).toBeVisible();await expect(dialog.getByLabel('Tipo de desligamento *',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();expect(app.commands).toHaveLength(0);app.checkHistory();
 await row.getByRole('button',{name:'Abrir ficha de Pessoa do ponto QA',exact:true}).click();await expect(page.getByRole('region',{name:'Vínculo e desligamento'})).toBeInViewport();
});
test('Desligar diretamente da lista agenda a saída após a confirmação',async({page})=>{
 const app=await enter(page,{screen:'equipe'});await page.getByRole('button',{name:'Desligar',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Último dia trabalhado *',{exact:true}).fill('2026-11-03');await dialog.getByLabel('Tipo de desligamento *',{exact:true}).selectOption('pedido_demissao');expect(app.commands).toHaveLength(0);await dialog.getByRole('button',{name:'Confirmar desligamento',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(app.employee()).toMatchObject({active:true,status:'desligamento_agendado',endDate:'2026-11-03'});await expect(page.getByRole('button',{name:'Rever saída',exact:true})).toBeVisible();expect(app.commands).toHaveLength(1);app.checkHistory();
});
test('Rever saída preenche o agendamento e falha preserva a confirmação',async({page})=>{
 const app=await enter(page,{screen:'equipe',scheduled:true,failDismissal:true});if(page.viewportSize().width<768)await page.locator('.team-status-select select').selectOption('desligamento_agendado');else await page.getByRole('button',{name:/^Agendados/}).click();await page.getByRole('button',{name:'Rever saída',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Último dia trabalhado *',{exact:true})).toHaveValue('2026-11-03');await expect(dialog.getByLabel('Tipo de desligamento *',{exact:true})).toHaveValue('pedido_demissao');await dialog.getByRole('button',{name:'Confirmar desligamento',exact:true}).click();await expect(page.getByText('Falha simulada no desligamento.',{exact:true})).toBeVisible();await expect(dialog.getByLabel('Último dia trabalhado *',{exact:true})).toHaveValue('2026-11-03');expect(app.commands).toHaveLength(1);app.checkHistory();
});
test('Ponto por obra abre a ficha pelo nome e preserva a data no retorno',async({page})=>{
 const app=await enter(page,{screen:'ponto'});await page.getByLabel('Data',{exact:true}).fill('2026-10-23');await page.getByRole('button',{name:'Pessoa do ponto QA',exact:true}).click();await expect(page.getByRole('region',{name:'Vínculo e desligamento'})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Voltar a Ponto por obra',exact:true}).click();await expect(page.getByLabel('Data',{exact:true})).toHaveValue('2026-10-23');expect(app.commands).toHaveLength(0);app.checkHistory();
});
test('perfil de engenharia não recebe ação de desligamento',async({page})=>{
 const app=await enter(page,{screen:'equipe',role:'engenheiro'});await expect(page.locator('.team-row')).toHaveCount(1);await expect(page.getByRole('button',{name:'Desligar',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Rever saída',exact:true})).toHaveCount(0);expect(app.commands).toHaveLength(0);app.checkHistory();
});

test('perfil RH encontra Desligar diretamente na lista',async({page})=>{
 const app=await enter(page,{screen:'equipe',role:'rh'});await page.getByRole('button',{name:'Desligar',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Registrar desligamento',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();expect(app.commands).toHaveLength(0);app.checkHistory();
});
