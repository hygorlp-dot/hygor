import {expect,test} from '@playwright/test';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';

async function enter(page,{withoutBudget=false}={}){
 const user={id:'flow-demo',nome:'Operador de teste',email:'flow@local.test',role:'admin',active:true};
 let state={usuarios:[user],config:{},employees:[],attendance:{},obras:[{id:'work',name:'Casa de teste',status:'active',startDate:'2026-10-01',contractType:'fixed_labor',contractValue:200000}],
 budgetBaselines:[{obraId:'work',tipo:'controle',ativo:true,budgetId:'b'}],orcamentos:[{id:'b',obraId:'work',nome:'Controle de teste',etapas:[{id:'s',nome:'Estrutura'}],itens:[{id:'i',etapaId:'s',descricao:'Estrutura',quantidade:1,precoUnit:100000}]}],
 pedidos:[{id:'o',obraId:'work',status:'enviado',data:'2026-10-31',itens:[{id:'l',qtd:1,precoUnit:50000,orcNivel1Id:'s'}]}],notasFiscais:[],outrasDesp:[{id:'labor',obraId:'work',data:'2026-10-31',valor:80000,etapaId:'s',descricao:'Mão de obra'}]};
 if(withoutBudget){state.budgetBaselines=[];state.orcamentos=[];}
 const errors=[],commands=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
 await page.route('**/api/data',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(body.action==='operational-command'){
   commands.push(body.command);
   const result=applyOperationalCommand(state,{...body.command,actorId:user.id,actorName:user.nome,actorRole:user.role});
   if(result.ok)state=result.data;
   return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:'2026-10-31T15:00:01Z'}});
  }
  if(['save','save-sections','financial-command'].includes(body.action))throw new Error(`Gravação fora do cenário: ${body.action}`);
  return route.fulfill({json:{ok:true,usuario:user,data:state,accessToken:'isolated',refreshToken:'isolated',updatedAt:'2026-10-31T15:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
 const open=async name=>{await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(name);await search.locator('xpath=../..').getByRole('button').filter({hasText:name}).first().click();};
 return {state:()=>state,open,errors,commands};
}

test('previsão e mudança com pendências atualizam o total sem alterar o contrato',async({page})=>{
 const app=await enter(page);await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await expect(page.getByRole('region',{name:'Mudanças e aditivos'})).toBeVisible();
 await page.getByText('Conferir apropriação e previsão · 0 custo(s) pendente(s)',{exact:true}).click();
 await page.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('70000');
 await page.getByLabel('Reserva de risco adicional (R$)',{exact:true}).fill('5000');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(1);
 expect(app.state().obras[0].costPlanning.stages.s.remainingCents).toBe(7000000);
 await expect(page.getByText('Premissas incompletas;', {exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Nova mudança ou aditivo',exact:true}).click();
 const modal=page.getByRole('dialog');await modal.getByLabel('O que muda *',{exact:true}).fill('Troca do piso da sala');
 await modal.getByLabel('Impacto no contrato (R$) — negativo para supressão',{exact:true}).fill('12000');
 await modal.getByRole('combobox',{name:'Etapa de custo',exact:true}).selectOption('s');
 await modal.getByRole('combobox',{name:'Situação da execução',exact:true}).selectOption('em_andamento');
 await modal.getByLabel('Impacto no custo restante (R$) — negativo para economia',{exact:true}).fill('8000');
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('adicional');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().obras[0].aditivosContrato[0]).toMatchObject({status:'proposto',execucaoStatus:'em_andamento',impactoCustoRestante:8000});
 expect(app.state().obras[0].contractValue).toBe(200000);
 await expect(page.getByText('Execução em andamento sem aprovação vigente do cliente.',{exact:true})).toBeVisible();
 await expect(page.getByText('Valor revisado preservado; reconferir base atual',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/163.000,00/);
 await page.getByRole('button',{name:'Registrar decisão',exact:true}).click();
 await modal.getByRole('button',{name:'Registrar decisão',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().obras[0].aditivosContrato[0].status).toBe('aprovado');
 await page.getByRole('button',{name:'Atualizar acompanhamento',exact:true}).click();
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('ja_incluido');
 await modal.getByLabel('Evidência da decisão do cliente',{exact:true}).fill('E-mail do cliente de hoje');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/155.000,00/);
 await page.getByText('Previsão para concluir por etapa',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('previsao-por-etapa.png')});
 await page.getByRole('button',{name:'Ajuda da previsão',exact:true}).click();
 const help=page.getByRole('complementary',{name:'Central de ajuda'});await expect(help).toContainText('R$ 163 mil');
 await help.getByRole('button',{name:'Fechar ajuda'}).click();
 await page.getByRole('button',{name:'Ajuda de mudanças',exact:true}).click();await expect(help).toContainText('Mudanças e aditivos');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:test.info().outputPath('previsao-e-ajuda.png')});
 await help.getByRole('button',{name:'Fechar ajuda'}).click();await app.open('Casa de teste');
 await expect(page.getByRole('region',{name:'Mudanças e aditivos'})).toBeVisible();
 await expect(page.getByText('Custo final estimado',{exact:true}).locator('..')).toContainText('155.000,00');
 expect(app.errors).toEqual([]);
});

test('previsão sem orçamento continua em Sem apropriação com aviso',async({page})=>{
 const app=await enter(page,{withoutBudget:true});await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await page.getByText('Conferir apropriação e previsão · 1 custo(s) pendente(s)',{exact:true}).click();
 await page.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('100000');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(1);
 expect(app.state().obras[0].costPlanning.stages.unassigned).toMatchObject({remainingCents:10000000,budgetId:''});
 await expect(page.getByText('Revisão salva.',{exact:false})).toContainText('sem orçamento');
 await expect(page.getByRole('button',{name:/Casa de teste, Sem apropriação: Custo final estimado/i})).toHaveText(/180.000,00/);
 expect(app.errors).toEqual([]);
});

test('possível duplicidade avisa, salva sem bloqueio e permite conferência ou correção',async({page})=>{
 const app=await enter(page);await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await page.getByText('Conferir apropriação e previsão · 0 custo(s) pendente(s)',{exact:true}).click();
 const remaining=page.getByLabel('Custo restante para concluir (R$)',{exact:true});
 await remaining.fill('70000');await page.getByLabel('Reserva de risco adicional (R$)',{exact:true}).fill('5000');
 await page.getByLabel('Premissas da previsão',{exact:true}).fill('Compras pendentes e serviços estimados');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(1);
 await page.getByRole('button',{name:'Nova mudança ou aditivo',exact:true}).click();const modal=page.getByRole('dialog');
 await modal.getByLabel('O que muda *',{exact:true}).fill('Porcelanato da sala');
 await modal.getByRole('combobox',{name:'Etapa de custo',exact:true}).selectOption('s');
 await modal.getByLabel('Impacto no custo restante (R$) — negativo para economia',{exact:true}).fill('8000');
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('adicional');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 const amendments=page.getByRole('region',{name:'Mudanças e aditivos'}),form=remaining.locator('xpath=ancestor::fieldset');
 const warning=()=>form.getByRole('status',{name:'Possíveis duplicidades de custo'});
 await remaining.fill('78000');await expect(warning()).toBeVisible();await expect(warning()).toContainText('coincidindo com o impacto');
 await expect(page.getByRole('button',{name:'Confirmar previsão',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(2);
 await expect(amendments.getByRole('status',{name:'Possíveis duplicidades de custo'})).toBeVisible();
 const total=page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i});await expect(total).toHaveText(/171.000,00/);
 await warning().scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('duplicidade-aviso-sem-bloqueio.png')});
 const coverage=page.getByRole('combobox',{name:'Cobertura do aditivo 1',exact:true});
 await coverage.selectOption('separate');await expect(warning()).toHaveCount(0);
 await page.getByLabel('Justificativa da conferência do aditivo 1',{exact:true}).fill('Os R$ 78 mil são de outros serviços; piso deve continuar separado.');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();await expect.poll(()=>app.state().obras[0].costPlanning.version).toBe(3);
 await expect(amendments.getByRole('status',{name:'Possíveis duplicidades de custo'})).toHaveCount(0);await expect(total).toHaveText(/171.000,00/);
 await remaining.fill('79000');await expect(coverage).toHaveValue('unreviewed');await remaining.fill('78000');
 await coverage.selectOption('included');await expect(warning()).toContainText('declara este impacto dentro do restante');
 await page.getByLabel('Justificativa da conferência do aditivo 1',{exact:true}).fill('Piso incorporado à composição dos R$ 78 mil.');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();await expect.poll(()=>app.state().obras[0].costPlanning.version).toBe(4);
 await amendments.getByRole('button',{name:'Editar',exact:true}).click();
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('ja_incluido');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 await expect(amendments.getByRole('status',{name:'Possíveis duplicidades de custo'})).toHaveCount(0);await expect(warning()).toHaveCount(0);await expect(total).toHaveText(/163.000,00/);
 expect(app.state().obras[0].costPlanning.history.at(-1).amendmentCoverage).toEqual({[app.state().obras[0].aditivosContrato[0].id]:{mode:'included',amountCents:800000,remainingCents:7800000,justification:'Piso incorporado à composição dos R$ 78 mil.'}});
 const history=page.getByRole('region',{name:'Histórico de conferência das duplicidades'});
 await expect(history).toBeVisible();await expect(history).toContainText('Operador de teste');await expect(history).toContainText('31/10/2026');await expect(history).toContainText('Custo separado do restante');await expect(history).toContainText('Já está no restante');await expect(history).toContainText('Os R$ 78 mil são de outros serviços');await expect(history).toContainText('Piso incorporado à composição');
 const count=app.commands.length;await history.getByRole('combobox',{name:'Aditivo do histórico',exact:true}).selectOption(app.state().obras[0].aditivosContrato[0].id);expect(app.commands.length).toBe(count);
 expect(await history.evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);await history.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('historico-conferencias.png')});
 await page.getByRole('button',{name:'Ajuda da previsão',exact:true}).click();const help=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(help).toContainText('R$ 171 mil');await help.getByText('Possível duplicidade de custo',{exact:true}).click();await expect(help).toContainText('É possível continuar mesmo sem resolver o aviso');
 expect(await help.evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);expect(app.errors).toEqual([]);
});
