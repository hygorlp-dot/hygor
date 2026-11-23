import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {buildFinancialLedger,selectDRE} from '../src/domains/financeiro/ledger.js';
import {buildRequestedDreProjectionRows} from '../server/dre-projection.js';

// Carimbo de contexto (Etapa 1): a obra escolhida no topo vale para as telas
// que o seguem, e trocar a obra nessas telas atualiza o carimbo.
async function enter(page,tab,dados=data,theme='marcell'){
  let state=structuredClone(dados),revision=0;
  // This scenario starts from an already synchronized plan. Missing version
  // links trigger a separate budget migration, unrelated to the work stamp.
  state.condominios??=[];
  for(const plan of state.planos||[]){
    const budget=(state.orcamentos||[]).find(item=>item.id===plan.budgetId);
    if(budget)plan.budgetVersionId??=budget.versionId||budget.id;
  }
  const financialSnapshot=value=>({
    dre:selectDRE(buildFinancialLedger(value),{competence:'2026-11'}),
    company:buildRequestedDreProjectionRows(value,[{year:2026,month:10,period:'mes',scope:'company_dre'}])[0].payload.lucroLiquido,
  });
  const before=financialSnapshot(state);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
  await page.addInitScript(({tab,user,theme})=>{sessionStorage.setItem(`arcd-section:${user}`,tab);localStorage.setItem('arcd-theme',theme);},{tab,user:profile.id,theme});
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>{
    const body=r.request().postDataJSON()||{};
    if(body.action==='financial-dre-report'){
      const [row]=buildRequestedDreProjectionRows(state,[{year:body.year,month:body.month,period:body.period,scope:body.obraId}]);
      return r.fulfill({json:{ok:true,source:'canonical_ledger',current:row?.payload}});
    }
    if(['save','save-sections'].includes(body.action)){
      const next={...state,...(body.sections||body.payload||{})};
      for(const [key,delta] of Object.entries(body.sectionDeltas||{})){
        const removed=new Set(delta.removed||[]),changed=new Map((delta.changed||[]).map(row=>[row.id,row]));
        next[key]=(state[key]||[]).filter(row=>!removed.has(row.id)&&!changed.has(row.id)).concat([...changed.values()]);
      }
      expect(financialSnapshot(next)).toEqual(before);
      state=structuredClone(next);revision++;
    }
    return r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data:state,current:null,history:[],accessToken:'stamp-local-only',refreshToken:'stamp-local-only',updatedAt:new Date(Date.UTC(2026,10,1,15,0,revision)).toISOString()}});
  });
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('stamp-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
  return errors;
}
const stamp=page=>page.getByTestId('work-context-stamp').locator('select');
const screenObra=page=>page.locator('main').getByLabel('Obra',{exact:true});

test('Materiais e compras abre o pedido recebido da etapa',async({page},info)=>{
  const state=structuredClone(data);
  const plan=state.planos.find(item=>item.obraId==='a');
  const stage=plan.tarefas.find(task=>task.etapaId&&!task.titulo);
  state.solicitacoesCompra=[{id:'req-stage',numero:'SC-ETAPA',obraId:'a',status:'enviada',
    planningOrigin:{planId:plan.id,stageId:stage.etapaId}}];
  state.pedidos=[{id:'order-stage',obraId:'a',numero:'PC-ETAPA',status:'recebido',solicitacaoId:'req-stage',
    itens:[{id:'order-line',materialId:'steel',qtd:10,qtdRecebida:10,recebimentos:[{data:'2026-11-04',qtd:10}]}]}];
  const theme=page.viewportSize().width<768?'noite':'marcell';
  const errors=await enter(page,'plan',state,theme);
  await screenObra(page).selectOption('a');
  await page.getByRole('button',{name:'Materiais e compras',exact:true}).click();
  const panel=page.getByRole('region',{name:'Materiais e compras da etapa'});
  const stageSelect=panel.getByLabel('Etapa do planejamento');
  await stageSelect.selectOption(stage.id);
  await expect(panel).toContainText('Último recebimento em 04/11/2026');
  const order=panel.getByRole('button',{name:'Abrir pedido PC-ETAPA'});
  await expect(order).toBeVisible();
  await stageSelect.hover();
  await expect.poll(()=>stageSelect.evaluate(element=>{
    const luminance=color=>color.match(/\d+/g).slice(0,3).map(value=>{
      const channel=Number(value)/255;
      return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
    }).reduce((total,value,index)=>total+value*[0.2126,0.7152,0.0722][index],0);
    const style=getComputedStyle(element);
    const levels=[luminance(style.color),luminance(style.backgroundColor)];
    return (Math.max(...levels)+0.05)/(Math.min(...levels)+0.05);
  })).toBeGreaterThanOrEqual(4.5);
  await panel.screenshot({path:info.outputPath(`planejamento-compra-${theme}.png`)});
  await order.click();
  await expect(page.getByRole('dialog')).toContainText('PC-ETAPA');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('separa avanço, boletim e custo reconhecido da obra no mês',async({page},info)=>{
  const state=structuredClone(data);
  state.medicoesObra=[
    {id:'approved',obraId:'a',status:'aprovada',dataMedicao:'2026-10-22',numero:1,avancoFisico:31.25},
    {id:'cancelled',obraId:'a',status:'cancelada',dataMedicao:'2026-10-29',numero:2,avancoFisico:99},
  ];
  state.notasFiscais=[{id:'cost',obraId:'a',numero:'77',status:'aprovada',valorBruto:731,competencia:'2026-11',emissao:'2026-11-01'}];
  const theme=page.viewportSize().width<768?'noite':'marcell';
  const errors=await enter(page,'plan',state,theme);
  await screenObra(page).selectOption('a');
  const summary=page.getByRole('group',{name:'Avanço e orçamento'});
  await expect(summary).toContainText('Valor do avanço informado');
  await expect(summary).toContainText('31,25%');
  await expect(summary).toContainText('Medição 1 · 22/10/2026');
  await expect(summary).not.toContainText('99%');
  await expect(page.getByRole('note').filter({hasText:'Vínculos por item com valor'})).toBeVisible();
  await summary.screenshot({path:info.outputPath(`planejamento-avanco-${theme}.png`)});
  const dre=page.getByRole('region',{name:'Integração com o DRE'});
  await dre.getByText('Resultado no DRE · 11/2026',{exact:true}).click();
  await dre.getByRole('button',{name:'Consultar valores no DRE'}).click();
  await expect(dre).toContainText(/R\$\s*1\.531,00/);
  await screenObra(page).selectOption('b');
  await expect(summary).toContainText('Sem boletim aprovado');
  await expect(dre).not.toContainText('1.531,00');
  await dre.getByText('Resultado no DRE · 11/2026',{exact:true}).click();
  await dre.getByRole('button',{name:'Consultar valores no DRE'}).click();
  await expect(dre).toContainText(/R\$\s*0,00/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('o calendário indica dias trabalhados e distingue feriados por ano',async({page},info)=>{
  const state=structuredClone(data);
  const plan=state.planos.find(item=>item.obraId==='a');
  plan.diasSemana=[1,2,3,4,5,6];
  plan.pularFeriados=true;
  plan.feriados=[{data:'2026-12-25',nome:'Natal'},{data:'2027-12-25',nome:'Natal'}];
  const theme=page.viewportSize().width<768?'noite':'marcell';
  const errors=await enter(page,'plan',state,theme);
  await screenObra(page).selectOption('a');
  const days=page.getByRole('button',{name:'Dias',exact:true});
  if(!await days.isVisible())await page.getByText('Escala, calendário e colunas',{exact:true}).click();
  await days.click();
  const dialog=page.getByRole('dialog',{name:'Calendario de trabalho',exact:true});
  const sunday=dialog.getByRole('button',{name:'Dom',exact:true});
  const saturday=dialog.getByRole('button',{name:'Sab',exact:true});
  await expect(sunday).toHaveAttribute('aria-pressed','false');
  await expect(saturday).toHaveAttribute('aria-pressed','true');
  expect(await saturday.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(
    await sunday.evaluate(el=>getComputedStyle(el).backgroundColor));
  await expect(dialog).toContainText('25/12/2026');
  await expect(dialog).toContainText('25/12/2027');
  await dialog.screenshot({path:info.outputPath(`planejamento-calendario-${theme}.png`)});
  await sunday.press('Space');
  await expect(sunday).toHaveAttribute('aria-pressed','true');
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
  await days.click();
  await expect(sunday).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});

test('o cronograma identifica o orçamento de controle ou o rascunho vinculado',async({page},info)=>{
  const state=structuredClone(data);
  const original=state.orcamentos.find(budget=>budget.id==='budget-a');
  state.orcamentos.push({...original,id:'budget-a-revision',versionId:'budget-a-revision',versionNumber:2,nome:'Revisão R02',updatedAt:'2026-10-31'});
  const approved=state.orcamentos.find(budget=>budget.id==='budget-b');
  Object.assign(approved,{versionId:'budget-b',versionNumber:3,versionStatus:'aprovado',lockedAt:'2026-10-25'});
  state.budgetBaselines=[{id:'baseline-b',obraId:'b',budgetId:'budget-b',budgetVersionId:'budget-b',tipo:'controle',ativo:true}];
  const theme=page.viewportSize().width<768?'noite':'marcell';
  const errors=await enter(page,'plan',state,theme);
  const source=page.getByRole('note').filter({hasText:'Orçamento em uso no cronograma'});
  await screenObra(page).selectOption('a');
  await expect(source).toContainText(`V1 · ${original.nome} · Rascunho vinculado ao plano.`);
  await expect(source).not.toContainText('Revisão R02');
  await source.screenshot({path:info.outputPath(`planejamento-origem-${theme}.png`)});
  await screenObra(page).selectOption('b');
  await expect(source).toContainText(`V3 · ${approved.nome} · Orçamento de controle ativo.`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Obras mantém a versão de controle do orçamento até o levantamento diário · ${theme}`,async({page},info)=>{
  const state=structuredClone(data);
  const budget=state.orcamentos.find(item=>item.id==='budget-b');
  Object.assign(budget,{versionId:budget.id,versionNumber:3,versionStatus:'aprovado',lockedAt:'2026-10-25'});
  state.budgetBaselines=[{id:'baseline-b',obraId:'b',budgetId:budget.id,budgetVersionId:budget.id,tipo:'controle',ativo:true}];
  const mobile=page.viewportSize().width<768;
  const errors=await enter(page,'obras',state,theme);
  const main=page.getByRole('main');
  await main.getByRole('article').filter({hasText:'Residencial Horizonte'}).getByRole('button',{name:/^Abrir obra/}).click();
  const screen=main.getByRole('combobox',{name:'Telas da obra',exact:true});
  if(mobile)await screen.selectOption('orc');
  else await main.getByRole('button',{name:'Obra',exact:true}).click();
  await expect(main.getByText('Controle ativo',{exact:true})).toBeVisible();
  await expect(main.getByText('V3 · APROVADA',{exact:true})).toBeVisible();
  if(mobile)await screen.selectOption('plan');
  else await main.getByRole('button',{name:'Planejamento',exact:true}).click();
  const note=main.getByRole('note').filter({hasText:'Orçamento em uso no cronograma'});
  await expect(note).toContainText(`V3 · ${budget.nome} · Orçamento de controle ativo.`);
  await note.screenshot({path:info.outputPath(`planejamento-controle-${theme}.png`)});
  if(mobile)await screen.selectOption('rdo');
  else await main.getByRole('button',{name:'Diário de obra',exact:true}).click();
  await main.getByRole('button',{name:'Novo relatório'}).click();
  await expect(main.getByLabel('Obra',{exact:true})).toHaveValue('Residencial Horizonte');
  await main.getByRole('button',{name:'+ Serviço',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Novo serviço'});
  const source=dialog.getByRole('note').filter({hasText:'Orçamento de controle da obra'});
  await expect(source).toContainText(`V3 · ${budget.nome}`);
  const item=budget.itens.find(row=>row.tipo!=='titulo'&&row.unidade&&Number(row.quantidade)>0);
  await dialog.getByLabel('Item do orçamento da atividade').selectOption(item.id);
  await expect(dialog.getByLabel('Unidade da produção')).toHaveValue(item.unidade);
  await source.screenshot({path:info.outputPath(`diario-controle-${theme}.png`)});
  expect(errors).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Obras mantém o contexto em licenciamento, qualidade e medição · ${theme}`,async({page},info)=>{
  const state=structuredClone(data);
  const budget=state.orcamentos.find(item=>item.id==='budget-b');
  Object.assign(budget,{versionId:budget.id,versionNumber:3,versionStatus:'aprovado',lockedAt:'2026-10-25'});
  state.budgetBaselines=[{id:'baseline-b',obraId:'b',budgetId:budget.id,budgetVersionId:budget.id,tipo:'controle',ativo:true}];
  const mobile=page.viewportSize().width<768;
  const errors=await enter(page,'obras',state,theme);
  const main=page.getByRole('main');
  await main.getByRole('article').filter({hasText:'Residencial Horizonte'}).getByRole('button',{name:/^Abrir obra/}).click();
  const screen=main.getByRole('combobox',{name:'Telas da obra',exact:true});
  if(mobile)await screen.selectOption('licenca');
  else {
    await main.getByRole('button',{name:'Recursos',exact:true}).click();
    await main.getByRole('button',{name:'Licenciamento',exact:true}).click();
  }
  await expect(main.getByLabel('Obra',{exact:true})).toHaveValue('Residencial Horizonte');
  await expect(main.getByRole('group',{name:'Situação dos documentos'})).toContainText('Pendentes');
  await main.getByRole('group',{name:'Situação dos documentos'}).screenshot({path:info.outputPath('licenciamento.png')});
  if(mobile)await screen.selectOption('qualidade');
  else await main.getByRole('button',{name:'Gestão da qualidade',exact:true}).click();
  const quality=main.getByRole('note').filter({hasText:'Orçamento de controle para gerar fichas'});
  await expect(quality).toContainText(`V3 · ${budget.nome}`);
  await expect(main.getByRole('button',{name:'Gerar/atualizar plano'})).toBeEnabled();
  await quality.screenshot({path:info.outputPath('qualidade.png')});
  if(mobile)await screen.selectOption('med');
  else {
    await main.getByRole('button',{name:'Obra',exact:true}).click();
    await main.getByRole('button',{name:'Medição física',exact:true}).click();
  }
  const measurement=main.getByRole('note').filter({hasText:'Orçamento de controle da medição'});
  await expect(measurement).toContainText(`V3 · ${budget.nome}`);
  await expect(main.getByRole('button',{name:'Confirmar medição'})).toBeVisible();
  await measurement.screenshot({path:info.outputPath('medicao.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Estoques e equipamentos preservam a obra e o pedido exato · ${theme}`,async({page},info)=>{
  const state=structuredClone(data);
  const original=state.pedidos[0];
  const order={...original,id:'pedido-horizonte-estoque',obraId:'b',numero:'PC-EST-71'};
  const material=state.materiais.find(item=>item.id===order.itens[0].materialId);
  state.pedidos.push(order,{...original,id:'pedido-outra-obra',numero:order.numero,obraId:'a'});
  state.movEstoque.push({id:'entrada-horizonte',pedidoId:order.id,obraId:'b',materialId:material.id,tipo:'entrada',qtd:4,data:'2026-10-30'});
  const mobile=page.viewportSize().width<768;
  const errors=await enter(page,'obras',state,theme);
  const main=page.getByRole('main');
  await main.getByRole('article').filter({hasText:'Residencial Horizonte'}).getByRole('button',{name:/^Abrir obra/}).click();
  const screen=main.getByRole('combobox',{name:'Telas da obra',exact:true});
  if(mobile)await screen.selectOption('equip');
  else await main.getByRole('button',{name:'Recursos',exact:true}).click();
  await expect(main.getByRole('note').filter({hasText:'Obra de referência'})).toContainText('Residencial Horizonte');
  if(mobile)await screen.selectOption('est');
  else {
    await main.getByRole('button',{name:'Suprimentos',exact:true}).click();
    await main.getByRole('button',{name:'Estoque',exact:true}).click();
  }
  await expect(main.getByRole('note').filter({hasText:'Obra do estoque'})).toContainText('Residencial Horizonte');
  if(mobile)await main.getByRole('combobox',{name:'Áreas do estoque'}).selectOption('movs');
  else await main.getByRole('button',{name:'Movimentos',exact:true}).click();
  await main.getByLabel('Buscar insumo',{exact:true}).fill(material.descricao);
  const origin=main.getByRole('button',{name:`Abrir pedido ${order.numero}`,exact:true});
  await expect(origin).toBeVisible();
  await origin.screenshot({path:info.outputPath('pedido-de-origem.png')});
  await origin.click();
  const dossier=page.getByRole('dialog',{name:'Ficha completa da compra conjunta'});
  await expect(dossier).toContainText(order.numero);
  await expect(dossier).toContainText('Obra do pedido: Residencial Horizonte');
  await dossier.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('button',{name:'Voltar a Residencial Horizonte',exact:true}).click();
  await expect(main.getByLabel('Buscar insumo',{exact:true})).toHaveValue(material.descricao);
  await expect(origin).toBeVisible();
  expect(errors).toEqual([]);
});

test('a obra do carimbo vale para Planejamento e Avanço físico, nos dois sentidos',async({page})=>{
  const errors=await enter(page,'plan');
  await expect(stamp(page)).toBeVisible();
  await stamp(page).selectOption('b');
  await expect(screenObra(page)).toHaveValue('b');
  // Outra tela que segue o carimbo abre já na obra escolhida.
  await page.evaluate(()=>{sessionStorage.setItem('arcd_med_obra','');});
  await page.keyboard.press('Control+k');
  const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill('Avanço físico');
  await search.locator('xpath=../..').getByRole('button').filter({hasText:'Avanço físico'}).first().click();
  await expect(page.getByRole('heading',{name:'Avanço físico',exact:true})).toBeVisible();
  await expect(screenObra(page)).toHaveValue('b');
  // Trocar a obra na tela muda o carimbo.
  await screenObra(page).selectOption('a');
  await expect(stamp(page)).toHaveValue('a');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('Compras e Financeiro seguem o carimbo, inclusive em "Todas as obras"',async({page})=>{
  const errors=await enter(page,'cmp');
  const comprasObra=page.getByRole('group',{name:'Comandos de Compras'}).getByLabel('Obra',{exact:true});
  await expect(comprasObra).toHaveValue('all');await expect(stamp(page)).toHaveValue('');
  await stamp(page).selectOption('b');
  await expect(comprasObra).toHaveValue('b');
  async function open(label){
    await page.keyboard.press('Control+k');
    const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
    await search.fill(label);
    await search.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();
  }
  await open('Gestão financeira');
  const finObra=page.getByRole('group',{name:'Comandos do Financeiro'}).getByLabel('Obra',{exact:true});
  await expect(finObra).toHaveValue('b');
  // "Todas as obras" na tela limpa o carimbo; o carimbo vazio volta Compras a "Todas".
  await finObra.selectOption('all');
  await expect(stamp(page)).toHaveValue('');
  await open('Compras');
  await expect(comprasObra).toHaveValue('all');
  expect(errors).toEqual([]);
});

test('o Diário segue o carimbo na lista e no editor',async({page})=>{
  const errors=await enter(page,'rdo');
  await expect(screenObra(page)).toHaveValue('all');
  await stamp(page).selectOption('b');
  await expect(screenObra(page)).toHaveValue('b');
  // "Todas" no filtro da lista limpa o carimbo; escolher de novo volta a obra.
  await screenObra(page).selectOption('all');
  await expect(stamp(page)).toHaveValue('');
  await stamp(page).selectOption('b');
  // O relatório novo abre na obra do carimbo, e trocar o carimbo troca a obra do editor.
  await page.locator('main').getByRole('button',{name:'Novo relatório'}).click();
  await expect(screenObra(page)).toHaveValue('b');
  await stamp(page).selectOption('a');
  await expect(screenObra(page)).toHaveValue('a');
  // Trocar a obra no editor muda o carimbo.
  await screenObra(page).selectOption('b');
  await expect(stamp(page)).toHaveValue('b');
  expect(errors).toEqual([]);
});

test('Estoque, Licenciamento, Marcos e Curva A e Terceirizados seguem o carimbo',async({page})=>{
  // Começa em Compras: o Planejamento grava o plano ao trocar de obra, e a API
  // simulada deste teste não confirma gravações.
  const errors=await enter(page,'cmp');
  async function open(label){
    await page.keyboard.press('Control+k');
    const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
    await search.fill(label);
    await search.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();
    await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
    // O filtro de obra dos Terceirizados fica na aba Cadastro.
    // No celular as abas viram o seletor "Selecionar visão".
    if(label==='Terceirizados'){
      const visao=page.locator('main').getByLabel('Selecionar visão');
      if(await visao.isVisible())await visao.selectOption({label:'Cadastro'});
      else await page.locator('main').getByRole('tab',{name:'Cadastro',exact:true}).or(page.locator('main').getByRole('button',{name:'Cadastro',exact:true})).first().click();
    }
  }
  await stamp(page).selectOption('b');
  for(const label of ['Estoque','Licenciamento','Marcos e Curva A','Terceirizados']){
    await open(label);
    await expect(screenObra(page),label).toHaveValue('b');
  }
  // "Todas as obras" nos Terceirizados limpa o carimbo. Com o carimbo vazio o
  // Estoque abre na primeira obra; trocar a obra nele grava o carimbo.
  await screenObra(page).selectOption('all');
  await expect(stamp(page)).toHaveValue('');
  await open('Estoque');
  await expect(screenObra(page)).toHaveValue('a');
  await screenObra(page).selectOption('b');
  await expect(stamp(page)).toHaveValue('b');
  await open('Terceirizados');
  await expect(screenObra(page)).toHaveValue('b');
  expect(errors).toEqual([]);
});

test('o nome da obra no topo aparece inteiro, também no celular',async({page})=>{
  const errors=await enter(page,'cmp');
  await stamp(page).selectOption('b');
  // Largura natural = a de uma cópia sem limite de largura (cabe a maior obra da lista).
  const largura=await stamp(page).evaluate(el=>{
    const copia=el.cloneNode(true);copia.style.cssText='position:absolute;visibility:hidden;width:auto;max-width:none;min-width:0;flex:none';
    el.parentNode.appendChild(copia);const natural=copia.getBoundingClientRect().width;copia.remove();
    return {natural:Math.ceil(natural),atual:Math.floor(el.getBoundingClientRect().width)};
  });
  expect(largura.atual,`seletor com ${largura.atual}px, precisa de ${largura.natural}px`).toBeGreaterThanOrEqual(largura.natural-1);
  const caixa=await page.getByTestId('work-context-stamp').boundingBox();
  expect(caixa.x+caixa.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('Relatórios mensais de mão de obra seguem o carimbo, inclusive em "Todas as obras"',async({page})=>{
  const errors=await enter(page,'relat');
  const escopo=page.locator('main').getByLabel('Escopo da análise',{exact:true});
  await expect(escopo).toHaveValue('all');
  await stamp(page).selectOption('b');
  await expect(escopo).toHaveValue('b');
  // Trocar o escopo na tela atualiza o carimbo; "Todas as obras" limpa.
  await escopo.selectOption('a');
  await expect(stamp(page)).toHaveValue('a');
  await escopo.selectOption('all');
  await expect(stamp(page)).toHaveValue('');
  expect(errors).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Relatórios exibem os filtros que afetam cada consulta · ${theme}`,async({page},info)=>{
  const errors=await enter(page,'relat',data,theme);
  const main=page.locator('main');
  const month=main.getByLabel('Mês do relatório',{exact:true});
  const year=main.getByLabel('Ano do relatório',{exact:true});
  const view=main.getByLabel('Selecionar visão',{exact:true});
  async function openReport(value,name){
    if(await view.isVisible())await view.selectOption(value);
    else await main.getByRole('button',{name,exact:true}).click();
  }
  await month.selectOption('9');
  await stamp(page).selectOption('b');
  await expect(main.getByRole('note').filter({hasText:'Indicadores e exportação'})).toContainText(/Residencial Horizonte.*outubro 2026/i);
  await page.screenshot({path:info.outputPath('painel-analitico.png'),animations:'disabled'});
  await openReport('caixa','Caixa de obra');
  await expect(month).toHaveCount(0);
  await expect(year).toHaveCount(0);
  await expect(main.getByRole('note').filter({hasText:'Escopo do caixa de obra'})).toContainText('Saldo acumulado');
  await openReport('compras','Relatório de compras');
  await expect(month).toHaveCount(0);
  await expect(year).toHaveCount(0);
  await expect(main.getByLabel('De',{exact:true})).toBeVisible();
  await expect(main.getByLabel('Até',{exact:true})).toBeVisible();
  await expect(main.getByLabel('Quem pagou',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('relatorio-de-compras.png'),animations:'disabled'});
  await openReport('custos','Painel analítico');
  await expect(month).toHaveValue('9');
  await expect(year).toHaveValue('2026');
  await expect(stamp(page)).toHaveValue('b');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('DRE obras identifica a obra consultada independentemente do carimbo',async({page})=>{
  const errors=await enter(page,'dre',data,'plataforma');
  const main=page.locator('main');
  const scope=main.getByRole('note').filter({hasText:'Recorte deste DRE'});
  await stamp(page).selectOption('a');
  await expect(scope).toContainText('Consolidado do seu acesso');
  const view=main.getByLabel('Visão do DRE',{exact:true});
  if(await view.isVisible())await view.selectOption('obra');
  else await main.getByRole('button',{name:/^Por obra/}).click();
  await main.getByLabel('Obra em análise',{exact:true}).selectOption('b');
  await expect(scope).toContainText(/Obra Residencial Horizonte.*novembro 2026.*mês completo/i);
  await expect(stamp(page)).toHaveValue('a');
  expect(errors).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Folha leva obra, quinzena e grupo para revisar o ponto · ${theme}`,async({page},info)=>{
  const state=structuredClone(data);
  const employee=state.employees[0];
  employee.role='Pedreira';
  state.attendance[employee.id]={
    '2026-10-23':{status:'P',obraId:'a'},
    '2026-10-26':{status:'F',obraId:'a'},
  };
  const writes=[];
  page.on('request',request=>{
    if(!request.url().endsWith('/api/data')||request.method()!=='POST')return;
    const action=request.postDataJSON()?.action;
    if(['save','save-sections','attendance-upsert','operational-command'].includes(action))writes.push(action);
  });
  const errors=await enter(page,'folha',state,theme);
  const payroll=page.locator('.payroll-workspace');
  const payrollScope=payroll.getByRole('region',{name:'Competência e escopo da folha'});
  const revealScope=async()=>{
    if(!await payrollScope.isVisible())await payroll.locator('summary').filter({hasText:'Competência e escopo'}).click();
  };
  await payroll.getByRole('heading',{name:'Folha de Pagamento'}).waitFor();
  await revealScope();
  await payrollScope.getByLabel('Mês de referência',{exact:true}).selectOption('9');
  await payrollScope.getByLabel('Ciclo da folha',{exact:true}).selectOption('2');
  await payrollScope.getByLabel('Obra',{exact:true}).selectOption('a');
  await payrollScope.getByRole('button',{name:'Pessoal de obra',exact:true}).click();
  await page.screenshot({path:info.outputPath('folha-recorte.png'),animations:'disabled'});
  await payroll.getByRole('button',{name:'Revisar ponto',exact:true}).click();
  const point=page.locator('.ponto-geral');
  await expect(point.getByLabel('Mês',{exact:true})).toHaveValue('9');
  await expect(point.getByLabel('Ano',{exact:true})).toHaveValue('2026');
  await expect(point.getByLabel('Ciclo',{exact:true})).toHaveValue('2');
  await expect(point.getByLabel('Obra',{exact:true})).toHaveValue('a');
  await expect(point.getByRole('button',{name:'Pessoal de obra',exact:true})).toHaveAttribute('aria-current','page');
  await expect(point.getByRole('heading',{name:'Ponto da quinzena'})).toBeVisible();
  const employeeRow=point.getByRole('row').filter({hasText:employee.name});
  await expect(employeeRow.getByTitle('Presente',{exact:true})).toHaveCount(1);
  await expect(employeeRow.getByTitle('Falta',{exact:true})).toHaveCount(1);
  expect(await employeeRow.getByTitle('Sem registro',{exact:true}).count()).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('ponto-mesmo-recorte.png'),animations:'disabled'});
  await page.getByRole('button',{name:/^Voltar a Folha$/}).click();
  await payroll.getByRole('heading',{name:'Folha de Pagamento'}).waitFor();
  await revealScope();
  await expect(payrollScope.getByLabel('Obra',{exact:true})).toHaveValue('a');
  await expect(payrollScope.getByLabel('Mês de referência',{exact:true})).toHaveValue('9');
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Equipes conta situações dentro da lotação e da busca · ${theme}`,async({page},info)=>{
  const errors=await enter(page,'equipe',data,theme);
  const team=page.locator('.people-workspace');
  const mobile=team.getByRole('combobox',{name:'Situação da equipe',exact:true});
  const assertActive=async count=>{
    if(await mobile.isVisible())await expect(mobile.locator('option[value=ativo]')).toHaveText(`Ativos · ${count}`);
    else await expect(team.getByRole('button',{name:new RegExp(`^Ativos\\s*${count}$`)})).toBeVisible();
  };
  await team.getByRole('heading',{name:'Equipes',exact:true}).waitFor();
  await assertActive(3);
  const allocation=team.getByLabel('Filtrar por lotação',{exact:true});
  if(!await allocation.isVisible())await team.getByRole('button',{name:'Filtros',exact:true}).click();
  await allocation.selectOption('a');
  await assertActive(2);
  await team.getByLabel('Pesquisar na equipe',{exact:true}).fill('Ana Maria');
  await assertActive(1);
  await expect(team.getByRole('button',{name:/^Abrir ficha de Ana Maria/})).toBeVisible();
  await page.screenshot({path:info.outputPath('equipe-contagem-filtrada.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

for(const theme of ['marcell','noite','plataforma'])test(`Terceirizados distingue o filtro do cadastro do resumo e das filas · ${theme}`,async({page},info)=>{
  const state=structuredClone(data);
  state.terceirizados=[
    {id:'terc-a',obraId:'a',name:'Equipe Alfa',specialty:'outros',active:true,contractValue:1000,etapas:[]},
    {id:'terc-b',obraId:'b',name:'Equipe Beta',specialty:'outros',active:true,contractValue:2000,etapas:[]},
  ];
  const errors=await enter(page,'terc',state,theme);
  const main=page.locator('main');
  await main.getByLabel('Obra do cadastro',{exact:true}).selectOption('b');
  await expect(main.getByRole('note').filter({hasText:'Resumo e filas'})).toContainText('Todas as obras disponíveis');
  await expect(main.getByRole('region',{name:'Resumo dos terceirizados'})).toContainText('3.000,00');
  await expect(main.getByText('1 contrato encontrado',{exact:true})).toBeVisible();
  await expect(main.getByText('Equipe Beta',{exact:true}).first()).toBeVisible();
  await expect(main.getByText('Equipe Alfa',{exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('terceiros-resumo-e-cadastro.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

test('Orçamento destaca a obra em foco sem esconder os outros orçamentos',async({page})=>{
  // Um orçamento sem obra (fase comercial) precisa continuar visível com o carimbo ligado.
  const dados=structuredClone(data);
  dados.orcamentos.push({...structuredClone(dados.orcamentos[0]),id:'budget-prospect',obraId:'',nome:'Proposta sem obra'});
  dados.obras.find(o=>o.id==='c').status='active'; // obra ativa sem orçamento
  const errors=await enter(page,'orc',dados);
  const grupo=nome=>page.getByRole('region',{name:nome,exact:true});
  const nomes=async nome=>(await grupo(nome).getByText(/orçamento executivo|Proposta sem obra/).allTextContents());
  await expect(page.getByText('Proposta sem obra',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:/^Obra em foco/})).toHaveCount(0);
  await stamp(page).selectOption('b');
  await expect(grupo('Obra em foco · Residencial Horizonte')).toBeVisible();
  expect(await nomes('Obra em foco · Residencial Horizonte')).toEqual(['Horizonte — orçamento executivo']);
  expect(await nomes('Outros orçamentos')).toEqual(['Residencial Alameda — orçamento executivo','Proposta sem obra']);
  // Obra sem orçamento: diz isso e mantém todos os orçamentos logo abaixo.
  await stamp(page).selectOption('c');
  await expect(grupo('Obra em foco · Edifício Jardim das Palmeiras — áreas comuns')).toContainText('Nenhum orçamento vinculado a esta obra.');
  expect(await nomes('Outros orçamentos')).toHaveLength(3);
  // Sem carimbo, a lista volta a ser uma só.
  await stamp(page).selectOption('');
  await expect(page.getByRole('heading',{name:'Outros orçamentos'})).toHaveCount(0);
  await expect(page.getByText('Proposta sem obra',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
