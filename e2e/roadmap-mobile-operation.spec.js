import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {snapshotChanges,recoveryScope} from '../src/domains/sync/snapshot-journal.js';

async function enter(page,tab,{protectedEdit=false,allowCommercialSave=false}={}){
 const data=structuredClone(fixture),errors=[],writes=[];data.usuarios=[profile];
 data.obras=Array.from({length:26},(_,i)=>({...structuredClone(fixture.obras[i<2?i:0]),id:i===0?'a':i===1?'b':`work-${i}`,name:i<2?fixture.obras[i].name:`Obra ${String(i+1).padStart(2,'0')} · nome completo da residência`,oneDriveStructureVersion:2}));
 data.employees=Array.from({length:30},(_,i)=>({...fixture.employees[0],id:`person-${i}`,name:`Pessoa ${String(i+1).padStart(2,'0')} Nome completo para trabalho em campo`,obra:i===29?'':'a',startDate:'2026-09-01',examExpiresAt:i===0?'2026-01-01':''}));
 data.dailyCheckDate='2026-11-17';
 data.fornecedores=Array.from({length:30},(_,i)=>({...fixture.fornecedores[0],id:i===0?'central':`supplier-${i}`,nome:`Fornecedor ${String(i+1).padStart(2,'0')} Comércio de materiais e serviços`,ativo:true}));
 data.comercial={leads:Array.from({length:28},(_,i)=>({id:`lead-${i}`,nome:`Contato ${String(i+1).padStart(2,'0')} Nome completo da oportunidade`,etapa:'novo',status:'ativo',temperatura:'morno',responsavelId:profile.id,orcamentoEstimado:1000+i,probabilidade:34.4826,etapaDesde:'2026-11-01',proximaAtividade:'Conferir proposta e prazo',proximaAtividadeEm:i%2?'2026-11-10T12:00':'2026-12-01T12:00'})),atividades:[],reunioes:[],contratos:[],propostas:[],clientes:[],vendas:[]};
 data.orcamentos[0].etapas=Array.from({length:22},(_,i)=>({id:`stage-${i}`,nome:`Serviço ${String(i+1).padStart(2,'0')} execução de estrutura`,ordem:i,parentId:''}));
 data.orcamentos[0].itens=data.orcamentos[0].etapas.map((e,i)=>({...fixture.orcamentos[0].itens[0],id:`item-${i}`,etapaId:e.id,descricao:e.nome,quantidade:10,precoUnit:100}));
 data.planos[0].tarefas=data.orcamentos[0].etapas.map((e,i)=>({id:`task-${i}`,etapaId:e.id,nome:e.nome,inicio:'2026-11-01',fim:'2026-12-01',progresso:25}));
 data.terceirizados=[{id:'terc',name:'Equipe Estrutura',obraId:'a',specialty:'estrutura',active:true,contractValue:10000,tipoContrato:'empreitada',etapas:[{id:'terc-stage',nome:'Estrutura',valor:10000}]}];data.medicoesTerc=[{id:'previous',tercId:'terc',obraId:'a',data:'2026-11-01',status:'aprovada',total:3448.26,itens:[{etapaId:'terc-stage',pctAnterior:0,pctAcum:34.4826,valor:3448.26}]}];data.rdos=[];data.eventosEmpresa=[{id:'event',titulo:'Evento já confirmado',data:'2026-11-17',tipo:'outro'}];
 const fingerprint=JSON.stringify(data);
 await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({tab,id})=>{sessionStorage.setItem('arcd-section:'+id,tab);sessionStorage.setItem('marcell-recovery-tab','mobile-review');localStorage.setItem('arcd-theme','marcell');},{tab,id:profile.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>{const body=r.request().postDataJSON()||{};
  if(['save','save-sections','operational-command','financial-command','attendance-upsert','attendance-batch-upsert'].includes(body.action)){
   writes.push(body);
   if(allowCommercialSave&&body.action==='save-sections'&&body.sections?.comercial){data.comercial=body.sections.comercial;return r.fulfill({json:{ok:true,data,updatedAt:'2026-11-17T15:01:00Z'}});}
   return r.fulfill({status:409,json:{ok:false,error:'Gravação bloqueada na revisão local.'}});
  }
  return r.fulfill({json:{ok:true,data,usuarios:[profile],usuario:profile,precisaSetup:false,accessToken:'stage4-local',refreshToken:'stage4-local',updatedAt:'2026-11-17T15:00:00Z',current:null,history:[],items:[],bases:[],presencas:[],ajustes:[],connected:false,obras:{}}});
 });
 await page.goto('/');await page.locator('#login-email').waitFor();
 if(protectedEdit){const row={owner:profile.id,tab:'mobile-review',revision:'protected',scope:recoveryScope(profile),createdAt:'2026-11-16T15:00:00Z',changes:snapshotChanges({eventosEmpresa:[{...data.eventosEmpresa[0],titulo:'Antes'}]},{eventosEmpresa:data.eventosEmpresa})};
  await page.evaluate(async row=>{await new Promise((resolve,reject)=>{const request=indexedDB.open('marcell-workspace-edits-v1',10);request.onupgradeneeded=()=>{const store=request.result.createObjectStore('edits',{keyPath:['owner','tab']});store.createIndex('owner','owner');};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('edits','readwrite');tx.objectStore('edits').put(row);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},row);
 }
 await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('stage4-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return {data,writes,check:({changedFixture=false}={})=>{expect(errors).toEqual([]);if(!allowCommercialSave){expect(writes).toEqual([]);if(!changedFixture)expect(JSON.stringify(data)).toBe(fingerprint);}}};
}
const fit=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
const shot=(page,name,width)=>page.screenshot({path:`artifacts/roadmap-usabilidade-etapa4/${name}-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 for(const [tab,label,queryName,query,expected] of [
  ['obras','obras','Buscar por obra, cliente, endereço, responsável ou fase...','Obra 26','Obra 26'],
  ['fornecedores','fornecedores','Nome, CNPJ ou ramo...','Fornecedor 30','Fornecedor 30'],
  ['equipe','funcionários','Nome, função, CPF ou telefone','Pessoa 30','Pessoa 30'],
  ['ponto','funcionários no ponto','Nome ou função','Pessoa 30','Pessoa 30'],
  ['med','serviços','Nome do serviço','Serviço 22','Serviço 22']
 ])test(`${tab}: busca alcança registro fora da primeira página sem gravar`,async({page})=>{
  const app=await enter(page,tab);const results=page.getByRole('region',{name:`Resultados de ${label}`,exact:true});await expect(results).toBeVisible();await expect(results).toContainText('1–12 de');await results.getByRole('button',{name:'Próxima',exact:true}).click();await expect(results).toContainText('13–');await page.getByPlaceholder(queryName,{exact:true}).fill(query);await expect(results).toContainText('1–1 de 1');await expect((tab==='obras'?page.locator('.works-card'):page.locator('main')).getByText(expected,{exact:false}).first()).toBeVisible();await fit(page);await shot(page,tab,width);await page.getByPlaceholder(queryName,{exact:true}).fill('não existe xyz');await expect(results).toContainText('Nenhum resultado');await fit(page);app.check();
 });
 test('DRE pagina o resumo e mantém indicadores consolidados',async({page})=>{
  const app=await enter(page,'dre');const results=page.getByRole('region',{name:'Resultados de obras no DRE',exact:true});await expect(results).toContainText('1–12 de');await results.getByRole('button',{name:'Próxima',exact:true}).click();await expect(results).toContainText('13–');await page.getByRole('textbox',{name:'Pesquisar obra no resumo do DRE',exact:true}).fill('Obra 26');await expect(results).toContainText('1–1 de 1');await expect(page.getByRole('note').filter({hasText:'Resumo por obra'})).toContainText('não alteram os totais');await fit(page);app.check();
 });
 test('Pipeline move por seletor e botão, sem arraste, em base fictícia',async({page})=>{
  const app=await enter(page,'com_funil',{allowCommercialSave:true});
  const view=page.getByRole('combobox',{name:'Visualização do Pipeline',exact:true});
  if(width<768){
   await expect(page.getByRole('button',{name:/^Contato 02 /})).toBeInViewport();
   await expect(view).toBeHidden();
   const options=page.locator('summary').filter({hasText:'Visualização e prioridade'});
   await options.click();
   await view.selectOption('board');
   await expect(view).toHaveValue('board');
   await view.selectOption('list');
   await expect(view).toBeHidden();
  }else await view.selectOption('list');
  await page.getByRole('textbox',{name:'Pesquisar no Pipeline',exact:true}).fill('Contato 28');
  const selector=page.getByRole('combobox',{name:/Mover etapa de Contato 28/});
  if(width<768){
   await expect(selector).toBeHidden();
   await expect(page.getByText(/Próxima ação: Conferir proposta e prazo/)).toBeVisible();
   await page.locator('summary').getByText('Mover etapa',{exact:true}).click();
  }
  await selector.selectOption('primeiro_contato');
  expect(app.writes).toEqual([]);
  const moveButton=page.getByRole('button',{name:'Mover lead',exact:true});
  if(width<600)await moveButton.tap();else{await moveButton.focus();await page.keyboard.press('Enter');}
  await expect.poll(()=>app.data.comercial.leads.find(l=>l.id==='lead-27').etapa).toBe('primeiro_contato');
  expect(app.writes).toHaveLength(1);
  expect(app.data.comercial.leads.find(l=>l.id==='lead-27').historico.at(-1).texto).toContain('Movido para');
  await fit(page);await shot(page,'pipeline',width);app.check();
 });
 test('equipe filtra documentação e RH orienta consulta operacional',async({page})=>{
  const app=await enter(page,'equipe');await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.getByRole('combobox',{name:'Pendências da equipe',exact:true}).selectOption('documents');await expect(page.getByRole('region',{name:'Resultados de funcionários',exact:true})).toContainText('1–1 de 1');await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Indicadores');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Indicadores'}).first().click();await expect(page.getByRole('button',{name:'Consultar Folha',exact:true})).toBeVisible();await expect(page.locator('main')).not.toContainText('labor-cost-engine');await fit(page);app.check();
 });
 test('medição mostra leitura curta e precisão completa sem alterar valor ao focar',async({page})=>{
  const app=await enter(page,'terc');if(width<600)await page.getByRole('combobox',{name:'Selecionar visão',exact:true}).selectOption('medicoes');else await page.getByRole('button',{name:/^Medições/}).click();await page.getByRole('combobox',{name:'Contrato',exact:true}).selectOption('terc');await page.getByRole('button',{name:'Nova medição',exact:true}).click();const modal=page.getByRole('dialog').filter({has:page.getByRole('textbox',{name:'Percentual de Estrutura',exact:true})}),field=modal.getByRole('textbox',{name:'Percentual de Estrutura',exact:true});await expect(field).toHaveValue('34,48');await field.focus();await expect(field).toHaveValue('34,4826');await modal.getByRole('textbox',{name:'Percentual de Estrutura',exact:true}).press('Tab');await expect(field).toHaveValue('34,48');await expect(modal.getByText('Anterior: 34,48%',{exact:true})).toBeVisible();await shot(page,'percentuais',width);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();expect(app.data.medicoesTerc[0].itens[0].pctAcum).toBe(34.4826);await fit(page);app.check();
 });
 test('recuperação preserva edição quando o servidor mudou após a consulta',async({page})=>{
  const app=await enter(page,'conc',{protectedEdit:true});await page.getByRole('button',{name:'Resolver salvamento',exact:true}).first().click();const modal=page.getByRole('dialog',{name:'Recuperar salvamento',exact:true});await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(modal.getByRole('button',{name:'Concluir conferência',exact:true})).toBeVisible();app.data.eventosEmpresa[0].titulo='Mudança posterior no servidor fictício';await modal.getByRole('button',{name:'Concluir conferência',exact:true}).click();await expect(modal).toContainText('A versão do servidor mudou');await expect(modal).toBeVisible();await expect(page.getByTestId('save-recovery')).toBeVisible();app.check({changedFixture:true});
 });
 test('recuperação identifica a área e encerra revisão confirmada sem envio',async({page})=>{
  const app=await enter(page,'conc',{protectedEdit:true});await expect(page.getByTestId('save-recovery')).toContainText('Eventos da empresa');await shot(page,'recuperacao-aviso',width);await page.getByRole('button',{name:'Resolver salvamento',exact:true}).first().click();const modal=page.getByRole('dialog',{name:'Recuperar salvamento',exact:true});await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(modal).toContainText('já consta');await shot(page,'recuperacao-conferencia',width);await modal.getByRole('button',{name:'Concluir conferência',exact:true}).click();await expect(modal).toHaveCount(0);await expect(page.getByTestId('save-recovery')).toHaveCount(0);await fit(page);await shot(page,'recuperacao',width);app.check();
 });
});
test('320px com texto ampliado mantém filtros e ações acessíveis',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const app=await enter(page,'com_pipeline');
 const firstCard=page.getByRole('button',{name:/^Contato 02 /}).locator('xpath=ancestor::section[1]');
 await expect(firstCard).toBeInViewport({ratio:1});
 const firstCardName=await firstCard.boundingBox();
 expect(firstCardName.y+firstCardName.height).toBeLessThan(780);
 await page.screenshot({path:test.info().outputPath('pipeline-primeiro-cartao.png')});
 await page.addStyleTag({content:'html{font-size:200%}'});
 await page.getByRole('textbox',{name:'Pesquisar no Pipeline',exact:true}).fill('Contato 28');
 await page.locator('summary').getByText('Mover etapa',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Mover lead',exact:true})).toBeVisible();
 await fit(page);app.check();
});
