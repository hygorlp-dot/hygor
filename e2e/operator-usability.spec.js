import {test,expect} from '@playwright/test';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {montarEquipeObras} from '../src/domains/ponto-eletronico/equipe-obras.js';

for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 for(const area of ['home','cmp','terc','equipe_obras'])test(`consulta e ajuda em sessão nova: ${area}`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/Encountered two children with the same key/.test(message.text()))errors.push(message.text());});
  if(area==='terc')await page.route('**/api/data',async route=>{
   const response=await route.fetch(),body=await response.json();
   if(body.data){body.data.terceirizados=['Alfa','Beta'].map((name,index)=>({id:`terc-${index}`,name:`Prestador ${name}`,obraId:index?'b':'a',tipoContrato:'empreitada',status:'andamento',active:true,contractValue:6000,etapas:[{id:`stage-${index}`,nome:'Pintura',valor:6000}]}));body.data.medicoesTerc=[{id:'pending',tercId:'terc-0',obraId:'a',status:'rascunho',data:'2026-11-15',valorPeriodo:600,valorTotal:600,itens:[{etapaId:'stage-0',nome:'Pintura',pctAnt:0,pctPeriodo:10,pctAcum:10,valorPeriodo:600}]}];}
   return route.fulfill({response,json:body});
  });
  if(area==='equipe_obras')await page.route('**/api/data',async route=>{
   if(route.request().postDataJSON()?.action!=='ponto-equipe-obras')return route.continue();
   const obras=[{id:'a',name:'Obra com equipe'},{id:'b',name:'Obra vazia'}];
   const employees=[{id:'operador',name:'Operador local',role:'Pedreiro',obra:'a',active:true},{id:'sem-batida',name:'Funcionário sem registro',obra:'a',active:true}];
   const agora=Date.parse('2026-11-15T14:00:00Z');
   const pessoas=montarEquipeObras({employees,obras,agora,marcacoes:[{eventId:'entrada',employeeId:'operador',obraId:'a',tipoRegistro:'ponto',tipoEvento:'entrada',marcadoEm:'2026-11-15T10:00:00Z',horaConfiavel:true}]});
   return route.fulfill({json:{pessoas,obras,dia:'2026-11-15',fuso:'America/Recife',servidorMs:agora,limitacoes:[]}});
  });
  await page.addInitScript(({id,area})=>sessionStorage.setItem(`arcd-section:${id}`,area),{id:profile.id,area});
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await expect(page.locator('main.arcd-main')).toBeVisible();
  if(area==='terc'){
   await expect(page.getByRole('textbox',{name:'Buscar prestador ou documento',exact:true})).toBeVisible();
   if(width===390)await expect(page.locator('.terceiros-tabs select')).toHaveValue('cadastro');
   await page.getByRole('textbox',{name:'Buscar prestador ou documento',exact:true}).fill('Alfa');
   await expect(page.getByText('Prestador Alfa',{exact:true}).first()).toBeVisible();
   await expect(page.getByText('Prestador Beta',{exact:true})).toHaveCount(0);
   if(width===390)await page.locator('.terceiros-tabs select').selectOption('kanban');
   else await page.locator('.terceiros-tabs').getByRole('button',{name:/Quadro/}).click();
   await expect(page.getByText('Prestador Alfa',{exact:true}).first()).toBeVisible();
   await expect(page.getByText('Prestador Beta',{exact:true})).toHaveCount(0);
   if(width===390)await page.locator('.terceiros-tabs select').selectOption('medicoes');
   else await page.locator('.terceiros-tabs').getByRole('button',{name:/Medições/}).click();
   await expect(page.locator('summary').filter({hasText:'Aprovações pendentes · 1'})).toBeVisible();
   await page.locator('summary').filter({hasText:'Aprovações pendentes · 1'}).click();
   await expect(page.getByText('Medições aguardando aprovação',{exact:true})).toBeVisible();
  }
  if(area==='cmp')await expect(page.getByRole('heading',{name:'Compras',exact:true})).toBeVisible();
  if(area==='equipe_obras'){
   await expect(page.getByRole('heading',{name:'Obra com equipe',exact:true})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Obra vazia',exact:true})).toHaveCount(0);
   await page.locator('summary').filter({hasText:'Obras vazias neste filtro'}).click();
   await page.getByRole('button',{name:'Mostrar obras vazias',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Obra vazia',exact:true})).toBeVisible();
   await expect(page.getByText('Funcionário sem registro',{exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Ajuda',exact:true}).click();
  const panel=page.getByRole('complementary',{name:'Central de ajuda'});
  await expect(panel).toBeVisible();
  const summary=panel.locator('summary').filter({hasText:'Cuidados, permissões e recuperação'});
  await summary.focus();await page.keyboard.press('Enter');
  await expect(summary.locator('..')).toHaveAttribute('open','');
  await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
  await page.screenshot({path:`artifacts/operator-${area}-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 });
 test('obra, cobrança, avanço, planejamento e documentos mantêm seus destinos',async({page})=>{
  const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/Encountered two children with the same key/.test(message.text()))errors.push(message.text());});
  // Complete the synthetic fixture's existing budget version. Otherwise the
  // established planning import sync runs on entry, independently of this UI.
  await page.route('**/api/**',async route=>{
   let action;try{action=route.request().postDataJSON()?.action;}catch{}
   if(action==='list-folder')return route.fulfill({json:{ok:true,items:[]}});
   if(['save','save-sections','operational-command','financial-command'].includes(action))return route.continue();
   const response=await route.fetch();let body;try{body=await response.json();}catch{return route.fulfill({response});}
   for(const plan of body.data?.planos||[]){const budget=body.data.orcamentos?.find(item=>item.id===plan.budgetId&&item.obraId===plan.obraId);if(budget&&!plan.budgetVersionId)plan.budgetVersionId=budget.versionId||budget.id;}
   for(const work of body.data?.obras||[]){work.oneDriveDriveId='local-drive';work.oneDriveFolderId=`local-work-${work.id}`;}
   await route.fulfill({response,json:body});
  });
  page.on('request',request=>{if(request.url().includes('/api/')){try{const action=request.postDataJSON()?.action;if(['save','save-sections','operational-command','financial-command'].includes(action))writes.push(request.postDataJSON());}catch{}}});
  await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'obras'),profile.id);
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.getByRole('heading',{name:'Residencial Horizonte',exact:true}).click();
  const navigate=async(id,group,label)=>{
   if(width<600)await page.getByRole('combobox',{name:'Telas da obra',exact:true}).selectOption(id);
   else {await page.getByRole('button',{name:group,exact:true}).first().click();if(label)await page.locator('.work-detail-navigation__desktop').getByRole('button',{name:label,exact:true}).click();}
  };
  await page.getByRole('button',{name:'Medições',exact:true}).click();
  await page.getByRole('button',{name:'Abrir Medições a faturar',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Obra das medições',exact:true})).toHaveValue('b');
  const disclosure=page.locator('summary').filter({hasText:'Cobranças próximas e vencidas'});
  await disclosure.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Registrar recebimento',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Registrar recebimento',exact:true}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Obra das medições',exact:true})).toBeDisabled();
  await page.getByRole('dialog').getByRole('button',{name:/Cancelar/}).click();
  await expect(page.getByRole('combobox',{name:'Obra das medições',exact:true})).toBeEnabled();
  await page.screenshot({path:`artifacts/operator-billing-${width}.png`});
  // Reload the existing session into Obras, retaining the selected work context.
  await page.evaluate(id=>sessionStorage.setItem(`arcd-section:${id}`,'obras'),profile.id);await page.reload();
  await page.getByRole('heading',{name:'Residencial Horizonte',exact:true}).click();
  await navigate('med','Obra','Medição física');
  await expect(page.getByText('Sem base de valor',{exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Buscar serviço da medição',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Buscar serviço da medição',exact:true}).fill('serviço inexistente');
  await expect(page.getByText(/Nenhum serviço/).first()).toBeVisible();
  await page.getByRole('textbox',{name:'Buscar serviço da medição',exact:true}).fill('');
  await page.screenshot({path:`artifacts/operator-measurement-${width}.png`});
  await navigate('plan','Obra','Planejamento');
  await expect(page.locator('summary').filter({hasText:'Escala, calendário e colunas'})).toBeVisible();
  await page.screenshot({path:`artifacts/operator-planning-${width}.png`});
  await navigate('dre','Financeiro');
  await expect(page.getByRole('textbox',{name:'Buscar serviço da medição',exact:true})).toHaveCount(0);
  await navigate('arquivos','Recursos','Pastas do OneDrive');
  await page.getByRole('button',{name:'Abrir central de documentos',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Obra dos arquivos',exact:true})).toHaveValue('b');
  await page.screenshot({path:`artifacts/operator-files-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);expect(writes).toEqual([]);
 });
});
