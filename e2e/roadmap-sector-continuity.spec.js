import {selectWorkspaceArea} from './helpers/workspace-navigation.js';
import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

async function enter(page,tab,{restricted=false}={}){
 const data=structuredClone(fixture),user=restricted?{...profile,id:'eng',role:'engenheiro',obraId:'a'}:profile,errors=[],writes=[];
 data.usuarios=[user,{id:'eng',role:'engenheiro',nome:'Engenheiro responsável',active:true}];
 data.comercial={leads:[{id:'empty',nome:'Lead sem contrato',etapa:'novo',temperatura:'morno',responsavelId:user.id,orcamentoEstimado:1000,probabilidade:20},{id:'linked',nome:'Lead com proposta',etapa:'novo',temperatura:'morno',responsavelId:user.id,orcamentoEstimado:2000,probabilidade:50}],propostas:[{id:'proposal',leadId:'linked',valor:2000,status:'rascunho'}],contratos:[],atividades:[],reunioes:[],clientes:[],vendas:[]};
 const model={id:'administration',name:'Administração',version:1};
 data.commercialContractRecords=[{id:'right',number:'CT-CERTO',titulo:'Contrato com vínculo explícito',propostaId:'proposal',obraId:'a',revision:1,modelo:model,status:'rascunho'},{id:'wrong',number:'CT-OUTRO',titulo:'Lead com proposta',clienteId:'same',obraId:'a',revision:1,modelo:model,status:'rascunho'}];
 data.solicitacoesCompra=[{...data.solicitacoesCompra[0],id:'legacy',numero:'SC-0005',obraId:'a',aprovacaoInstanciaId:'missing'},{...data.solicitacoesCompra[0],id:'formal',numero:'SC-0006',obraId:'a',aprovacaoInstanciaId:'approval'},{...data.solicitacoesCompra[0],id:'other',numero:'SC-OUTRA-OBRA',obraId:'b',aprovacaoInstanciaId:'missing'}];
 data.instanciasAprovacao=[{id:'approval',entidadeTipo:'solicitacaoCompra',entidadeId:'formal',status:'em_andamento',contexto:{obraId:'a'},snapshotPolitica:{etapas:[{id:'past',nome:'Etapa passada'},{id:'now',nome:'Conferência administrativa'},{id:'later',nome:'Etapa futura'}]},resultadosEtapas:[{status:'concluida',aprovadoresElegiveis:[user]},{status:'em_andamento',aprovadoresElegiveis:restricted?[]:[user]},{status:'pendente',aprovadoresElegiveis:[user]}]}];
 data.conferencias=[{id:'conference',obraId:'a',codigo:7,data:'2026-11-15',responsavelId:profile.id,responsavel:'Auditoria técnica',status:'em_andamento',pendencias:[{id:'finding',descricao:'Corrigir acabamento da parede',ajusteNecessario:'Enviar evidência da correção',status:'em_ajuste',impacto:'medio',categoria:'inconformidade',responsavelAjusteId:'eng',responsavelAjusteNome:'Engenheiro responsável',prazo:'2026-11-20',fotos:[]},{id:'resolved',descricao:'Ajuste já validado',status:'resolvida',impacto:'baixo',responsavelAjusteId:'eng',validadoEm:'2026-11-15T10:00:00Z',validadoPor:'Auditoria técnica',fotos:[]},{id:'canceled',descricao:'Ajuste cancelado',status:'cancelada',responsavelAjusteId:'eng',fotos:[]},{id:'private',descricao:'Pendência de outro responsável',status:'aberta',responsavelAjusteId:'other',fotos:[]}]}];
 const snapshot=JSON.stringify(data);
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-16T12:00:00-03:00'));
 await page.addInitScript(({tab,id})=>{sessionStorage.setItem('arcd-section:'+id,tab);localStorage.setItem('arcd-theme','marcell');},{tab,id:user.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>{const body=r.request().postDataJSON()||{};if(['save','save-sections','operational-command','financial-command'].includes(body.action)){writes.push(body.action);return r.fulfill({status:409,json:{ok:false}});}return r.fulfill({json:{ok:true,data,usuarios:[user],usuario:user,precisaSetup:false,accessToken:'stage3-local',refreshToken:'stage3-local',current:null,history:[],items:[],ajustes:[],connected:false,bases:[],presencas:[],obras:{}}});});
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('stage3-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return ()=>{expect(errors).toEqual([]);expect(writes).toEqual([]);expect(JSON.stringify(data)).toBe(snapshot);};
}
const fits=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
const shot=async(page,name,width)=>page.screenshot({path:`artifacts/roadmap-usabilidade-etapa3/${name}-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});

for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 test('lead sem contrato orienta e retorna da central preservando a edição',async({page})=>{
  const check=await enter(page,'com_leads');await page.getByRole('button').filter({hasText:'Lead sem contrato'}).first().click();
  const modal=page.getByRole('dialog',{name:'Lead · Lead sem contrato',exact:true});await modal.getByRole('textbox',{name:'Observações',exact:true}).fill('Edição local preservada');
  await selectWorkspaceArea(page,'Áreas do lead','Contratos');await expect(modal.getByRole('heading',{name:'Nenhum contrato vinculado a este lead',exact:true})).toBeVisible();await shot(page,'lead-vazio',width);
  await modal.getByRole('button',{name:'Abrir contratos deste lead',exact:true}).click();await expect(page.getByRole('heading',{name:'Nenhum contrato atual vinculado a este lead',exact:true})).toBeVisible();await expect(page.getByText('CT-OUTRO',{exact:false})).toHaveCount(0);
  await page.getByRole('button',{name:'Voltar à ficha do lead',exact:true}).click();await expect(modal).toBeVisible();await selectWorkspaceArea(page,'Áreas do lead','Visão geral');await expect(modal.getByRole('textbox',{name:'Observações',exact:true})).toHaveValue('Edição local preservada');await fits(page);check();
 });
 test('central usa a proposta, não nomes iguais, e permite ampliar a consulta',async({page})=>{
  const check=await enter(page,'com_leads');await page.getByRole('button').filter({hasText:'Lead com proposta'}).first().click();const modal=page.getByRole('dialog');await selectWorkspaceArea(page,'Áreas do lead','Contratos');await expect(modal).toContainText('CT-CERTO');await expect(modal).not.toContainText('CT-OUTRO');await modal.getByRole('button',{name:'Abrir contratos deste lead',exact:true}).click();await expect(page.getByText('CT-CERTO · Contrato com vínculo explícito',{exact:true})).toBeVisible();await expect(page.getByText('CT-OUTRO',{exact:false})).toHaveCount(0);await shot(page,'central-vinculada',width);
  await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.getByRole('combobox',{name:'Situação',exact:true}).selectOption('assinado');await page.getByRole('button',{name:/^Filtros/}).click();await expect(page.getByRole('heading',{name:'Nenhum contrato neste recorte',exact:true})).toBeVisible();await page.getByRole('button',{name:/^Filtros/}).click();await expect(page.getByRole('combobox',{name:'Situação',exact:true})).toHaveValue('assinado');await page.getByRole('combobox',{name:'Situação',exact:true}).selectOption('');
  await page.getByRole('button',{name:'Consultar toda a central',exact:true}).click();await expect(page.getByText('CT-OUTRO · Lead com proposta',{exact:true})).toBeVisible();await fits(page);check();
 });
 test('aprovação distingue fluxo incompatível e consulta a origem sem decidir',async({page})=>{
  const check=await enter(page,'aprov_pend');await expect(page.getByRole('button',{name:'Aprovar',exact:true})).toBeVisible();await shot(page,'aprovacoes',width);await page.locator('summary').filter({hasText:'Solicitações sem fluxo de aprovação compatível'}).click();const diagnostic=page.locator('section').filter({has:page.getByRole('heading',{name:'Solicitações sem fluxo de aprovação compatível',exact:true})}).last();await expect(diagnostic).toBeVisible();await expect(diagnostic.getByRole('button',{name:'Aprovar',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Aprovar',exact:true})).toHaveCount(1);await expect(page.getByText('Etapa futura',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Abrir solicitação · SC-0005',exact:true}).click();await expect(page.locator('#purchase-record-legacy')).toBeFocused();await expect(page.locator('#purchase-record-legacy')).toHaveAttribute('data-purchase-highlight','true');await page.getByRole('navigation',{name:'Retornar ao contexto anterior'}).getByRole('button').click();await expect(page.getByRole('heading',{name:'Minhas aprovações pendentes',exact:true})).toBeVisible();await fits(page);check();
 });
 test('Comunicação abre o achado exato, preserva filtro e mostra conclusão',async({page})=>{
  const check=await enter(page,'chat');
  const stamp=page.getByTestId('work-context-stamp').locator('select');
  const heading=name=>page.getByRole('heading',{name,exact:true});
  const openTask=name=>page.locator('section').filter({has:heading(name)}).last().getByRole('button',{name:'Abrir pendência · CONF-007',exact:true}).click();
  const back=page.getByRole('navigation',{name:'Retornar ao contexto anterior'}).getByRole('button');
  const taskStatus=page.getByRole('combobox',{name:'Situação das tarefas',exact:true});
  await stamp.selectOption('b');
  await expect(heading('Corrigir acabamento da parede')).toBeVisible();
  await expect(heading('Ajuste cancelado')).toHaveCount(0);
  await expect(heading('Ajuste já validado')).toHaveCount(0);
  await shot(page,'tarefas',width);
  await openTask('Corrigir acabamento da parede');
  await expect(page.getByText('Corrigir acabamento da parede',{exact:true})).toBeVisible();
  await expect(page.getByText('Pendência de outro responsável',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Pendência de origem',{exact:false})).toBeVisible();
  await shot(page,'origem',width);
  await back.click();
  await expect(stamp).toHaveValue('b');
  await taskStatus.selectOption('closed');
  await expect(heading('Ajuste já validado')).toBeVisible();
  await expect(page.getByText(/Conclusão:.*15\/11\/2026/)).toBeVisible();
  await openTask('Ajuste já validado');
  await expect(page.getByText('Ajuste já validado',{exact:true})).toBeVisible();
  await back.click();
  await expect(taskStatus).toHaveValue('closed');
  await fits(page);
  check();
 });
 test('indicadores comerciais explicam bases e limite financeiro',async({page})=>{
  const check=await enter(page,'com_dash');await page.getByText('Como são contados os indicadores comerciais',{exact:true}).click();await expect(page.getByRole('note').filter({hasText:'Vendas e conversão'})).toContainText('Não é a conversão do mês');await expect(page.getByRole('note').filter({hasText:'Resultado financeiro'})).toContainText('não são recebimento');await fits(page);check();
 });
 test('perfil de obra não vê tarefas ou solicitações de outro acesso',async({page})=>{
  const check=await enter(page,'chat',{restricted:true});await expect(page.getByRole('heading',{name:'Corrigir acabamento da parede',exact:true})).toBeVisible();await expect(page.getByText('Pendência de outro responsável',{exact:true})).toHaveCount(0);
  await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Minhas aprovações');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Minhas aprovações'}).first().click();
  await expect(page.getByRole('heading',{name:'Nenhuma decisão formal pendente para você',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Aprovar',exact:true})).toHaveCount(0);await page.locator('summary').filter({hasText:'Solicitações sem fluxo de aprovação compatível'}).click();await expect(page.getByRole('heading',{name:'SC-0005',exact:true})).toBeVisible();await expect(page.getByText('SC-OUTRA-OBRA',{exact:true})).toHaveCount(0);await fits(page);check();
 });
});
