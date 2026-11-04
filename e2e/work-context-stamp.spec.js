import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

// Carimbo de contexto (Etapa 1): a obra escolhida no topo vale para as telas
// que o seguem, e trocar a obra nessas telas atualiza o carimbo.
async function enter(page,tab,dados=data){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
  await page.addInitScript(({tab,user})=>{sessionStorage.setItem(`arcd-section:${user}`,tab);localStorage.setItem('arcd-theme','marcell');},{tab,user:profile.id});
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data:dados,current:null,history:[],accessToken:'stamp-local-only',refreshToken:'stamp-local-only',updatedAt:'2026-11-01T15:00:00Z'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('stamp-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
  return errors;
}
const stamp=page=>page.getByTestId('work-context-stamp').locator('select');
const screenObra=page=>page.locator('main').getByLabel('Obra',{exact:true});

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
