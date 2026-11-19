import {test,expect} from '@playwright/test';
import {fixture,recordFixture,files,admin,user as seller} from '../src/domains/comercial/contracts/record-fixtures.test-helper.js';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {validateOperationalCommandScope} from '../server/operational-command-policy.js';
import {projectDataForUser} from '../server/data-projection.js';
import sourceModel from '../src/domains/comercial/contracts/administration-template.json' with {type:'json'};

async function setup(page,actor,{seed=false}={}){
  let failNext=false;let data=fixture();data.usuarios=data.usuarios.map(u=>({...u,email:`${u.id}@example.invalid`}));
  if(seed){const result=applyOperationalCommand(data,{type:'COMERCIAL_INSTRUMENTO_SALVO',idempotencyKey:'seed-browser-contract',actorId:admin.id,actorRole:admin.role,payload:{id:'seed-contract',record:recordFixture(),files:files()},expectedVersion:0,now:'2026-11-13T12:00:00Z'});data=result.data;}
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[]}}));
  await page.route('**/api/data',async route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==='profiles')return route.fulfill({json:{precisaSetup:false}});
    if(body.action==='commercial-contract-model')return route.fulfill({status:actor.role==='admin'?200:403,json:actor.role==='admin'?{ok:true,model:sourceModel}:{error:'Acesso restrito'}});
    if(body.action==='operational-command'){
      if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Falha temporária de teste. Tente salvar novamente.'}});}
      const command={...body.command,actorId:actor.id,actorRole:actor.role,actorObraId:actor.obraId||'',actorName:actor.nome};
      const access=validateOperationalCommandScope({data,user:actor,command});
      if(!access.ok)return route.fulfill({status:403,json:{error:access.error}});
      const result=applyOperationalCommand(data,command);
      if(!result.ok)return route.fulfill({status:409,json:{error:result.reason,reason:result.reason}});
      data=JSON.parse(JSON.stringify(result.data));
    }
    return route.fulfill({json:{ok:true,accessToken:'contracts-isolated-token',refreshToken:'isolated-refresh',usuario:{...actor,email:`${actor.id}@example.invalid`},data:projectDataForUser(data,actor),updatedAt:new Date().toISOString()}});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#login-email').fill(`${actor.id}@example.invalid`);await page.locator('#login-senha').fill('isolated-test');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Propostas e contratos');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Propostas e contratos'}).first().click();
  const nav=page.getByRole('navigation',{name:'Áreas do comercial'});
  if(page.viewportSize().width>=768)await nav.getByRole('button',{name:'Contratos',exact:true}).click();
  else await page.getByRole('combobox',{name:'Áreas do comercial',exact:true}).selectOption('com_contratos');
  await expect(page.getByRole('heading',{name:'Contratos',exact:true})).toBeVisible();
  return {getData:()=>data,failOnce:()=>{failNext=true;}};
}
async function step(page,value){const nav=page.getByRole('navigation',{name:'Etapas do contrato'});if(page.viewportSize().width>=768)await nav.getByRole('button').filter({hasText:new RegExp(`^${String.fromCharCode(65+value)}\\.`)}).click();else await page.getByRole('combobox',{name:'Etapas do contrato',exact:true}).selectOption(String(value));}

test('comercial cria, salva, reabre, cruza a obra, envia e conserva emissão desativada',async({page},testInfo)=>{
  const state=await setup(page,seller);
  await page.getByRole('button',{name:'Novo contrato',exact:true}).click();
  const dialog=page.getByRole('dialog').first();
  await dialog.getByLabel('Título do contrato').fill('Contrato de teste do navegador');await dialog.getByLabel('Cliente cadastrado',{exact:true}).selectOption('c1');await dialog.getByLabel('Obra vinculada',{exact:true}).selectOption('w1');
  await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords.length).toBe(1);
  await expect(dialog.getByRole('button',{name:'Gerar PDF',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Exportar DOCX',exact:true})).toBeDisabled();
  await step(page,3);await expect(dialog.getByText('Cruzamento com a obra cadastrada',{exact:true})).toBeVisible();
  await dialog.getByRole('checkbox',{name:/Área construída: contrato/}).locator('..').click();await dialog.getByRole('button',{name:'Aproveitar dados selecionados da obra',exact:true}).click();await expect(dialog.getByLabel('Área construída estimada (m²)',{exact:true})).toHaveValue('120');
  await page.screenshot({path:testInfo.outputPath('editor-work-link.png'),fullPage:false});
  await dialog.evaluate(el=>{el.scrollTop=0;for(const node of el.querySelectorAll('*'))if(node.scrollTop)node.scrollTop=0;});await page.screenshot({path:testInfo.outputPath('editor-top.png'),fullPage:false});
  await dialog.getByRole('button',{name:'Enviar para revisão',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords[0].status).toBe('em_revisao');
  await expect(dialog.getByRole('button',{name:'Aprovar revisão externa para assinatura',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('button',{name:'Abrir contrato',exact:true}).click();await step(page,3);await expect(page.getByLabel('Área construída estimada (m²)',{exact:true})).toHaveValue('120');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('administrador aprova revisão externa, registra via assinada e abre revisão preservando o original',async({page},testInfo)=>{
  const state=await setup(page,admin,{seed:true});await page.getByRole('button',{name:'Abrir contrato',exact:true}).click();
  await page.getByRole('button',{name:'Enviar para revisão',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords[0].status).toBe('em_revisao');
  await page.getByRole('button',{name:'Aprovar revisão externa para assinatura',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords[0].status).toBe('aprovado');
  await page.getByLabel('Motivo da decisão, mudança de situação ou nova revisão',{exact:true}).fill('Documento encaminhado externamente');await page.getByRole('button',{name:'Registrar aguardando assinatura',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords[0].status).toBe('aguardando_assinatura');
  await page.getByLabel('Via assinada',{exact:true}).selectOption('doc6|rev6');await page.getByRole('checkbox',{name:'Conferi as assinaturas na via vinculada',exact:true}).locator('..').click();await page.getByLabel('Motivo da decisão, mudança de situação ou nova revisão',{exact:true}).fill('Assinaturas conferidas');await page.getByRole('button',{name:'Registrar contrato assinado',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords[0].status).toBe('assinado');
  await page.getByLabel('Motivo da decisão, mudança de situação ou nova revisão',{exact:true}).fill('Ajuste cadastral posterior');await page.getByRole('button',{name:'Abrir nova revisão',exact:true}).click();await expect.poll(()=>state.getData().commercialContractRecords[0].revision).toBe(2);expect(state.getData().commercialContractRecords[0].revisions[0].status).toBe('assinado');
  await page.getByRole('dialog').first().evaluate(el=>{el.scrollTop=0;for(const node of el.querySelectorAll('*'))if(node.scrollTop)node.scrollTop=0;});await page.screenshot({path:testInfo.outputPath('revision-preserved.png'),fullPage:false});
  await page.getByText('Consultar histórico e revisões preservadas',{exact:true}).click();
  await page.getByText('Revisão 1 · Assinado',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Identificação preservada',exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'Contratantes preservados',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('history-readable.png'),fullPage:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('autosalva sem obra, preserva edição após falha e duplica somente as condições escolhidas',async({page},testInfo)=>{
  const state=await setup(page,seller);
  await expect(page.getByRole('button',{name:'Modelos de contrato',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Novo contrato',exact:true}).click();
  await page.getByLabel('Título do contrato',{exact:true}).fill('Rascunho sem obra');
  await expect.poll(()=>state.getData().commercialContractRecords.length).toBe(1);
  await expect(page.getByRole('button',{name:'Salvar rascunho',exact:true})).toBeDisabled();
  state.failOnce();await page.getByLabel('Título do contrato',{exact:true}).fill('Rascunho recuperado');
  await expect(page.getByRole('dialog').first().getByRole('alert').filter({hasText:'Falha temporária de teste'})).toBeVisible();
  await expect(page.getByLabel('Título do contrato',{exact:true})).toHaveValue('Rascunho recuperado');
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect.poll(()=>state.getData().commercialContractRecords[0].titulo).toBe('Rascunho recuperado');
  await page.getByRole('button',{name:'Duplicar contrato',exact:true}).click();
  await page.getByRole('checkbox',{name:'Comercial · Taxa de administração (%)',exact:true}).locator('..').click();
  await page.getByRole('button',{name:'Criar novo rascunho',exact:true}).click();
  await expect(page.getByLabel('Cliente cadastrado',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Obra vinculada',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect.poll(()=>state.getData().commercialContractRecords.length).toBe(2);
  expect(state.getData().commercialContractRecords[1].dados.comercial.taxa_administracao).toBe(12);
  expect(state.getData().commercialContractRecords[1].dados.comercial.cgr).toBe('');
  expect(state.getData().commercialContractRecords[1].partes[0].confirmado).toBe(false);
  await page.getByRole('dialog').first().getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByLabel('Pesquisar contrato',{exact:true}).fill('recuperado');
  await expect(page.getByRole('button',{name:'Abrir contrato',exact:true})).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('filtered-list.png'),fullPage:true});
});

test('administrador mantém cadastro central e consulta o modelo sem alterar cláusulas',async({page},testInfo)=>{
  const state=await setup(page,admin);
  const nav=page.getByRole('navigation',{name:'Áreas dos contratos'});
  if(page.viewportSize().width>=768)await nav.getByRole('button',{name:'Modelos de contrato',exact:true}).click();
  else await page.getByRole('combobox',{name:'Áreas dos contratos',exact:true}).selectOption('models');
  await page.getByRole('button',{name:'Editar cadastro da contratada',exact:true}).click();
  await page.getByLabel('Razão social',{exact:true}).fill('Empresa de teste atualizada');
  await page.getByRole('button',{name:'Salvar cadastro da contratada',exact:true}).click();
  await expect.poll(()=>state.getData().commercialContractCompany.version).toBe(2);
  await page.getByText('Consultar cláusulas e variáveis do modelo',{exact:true}).click();
  await expect(page.getByText('22.1.',{exact:false})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('protected-model.png'),fullPage:true});
});
