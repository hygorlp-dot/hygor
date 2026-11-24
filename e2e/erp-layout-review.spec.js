import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {ROLE_TABS} from '../src/domains/administracao/abas-acesso.js';
import {selectFinanceArea} from '../scripts/finance-browser-navigation.mjs';

// Read the app's real tab catalogue so the sweep cannot quietly omit a new area.
const source=readFileSync(new URL('../src/domains/administracao/LegacySettings.jsx',import.meta.url),'utf8').split('export const TAB_META_BASE = {')[1].split('\n};')[0];
const labels=Object.fromEntries([...source.matchAll(/\b(\w+)\s*:\s*\{\s*label:\s*"([^"]+)"/g)].map(([,id,label])=>[id,label]));
const tabs=ROLE_TABS.admin.map(id=>({id,label:labels[id]??id}));
const sharedTableAreas=new Set(['cmp','fin','conferencia','config','equip_fin','fornecedores','ponto_geral','com_management','com_relatorios']);

async function enter(page,id,extraData={}){
  let data=structuredClone({...fixture,...extraData});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
  await page.addInitScript(({id,user,theme})=>{sessionStorage.setItem(`arcd-section:${user}`,id);localStorage.setItem('arcd-theme',theme);},{id,user:profile.id,theme:process.env.MARCELL_TEST_THEME||'marcell'});
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>{
    const body=r.request().postDataJSON()||{};
    if(['save','save-sections'].includes(body.action)){
      data={...data,...(body.sections||body.payload||{})};
      for(const [key,delta] of Object.entries(body.sectionDeltas||{})){
        const removed=new Set(delta.removed||[]),changed=new Map((delta.changed||[]).map(row=>[row.id,row]));
        data[key]=(data[key]||[]).filter(row=>!removed.has(row.id)&&!changed.has(row.id)).concat([...changed.values()]);
      }
    }
    return r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'layout-local-only',refreshToken:'layout-local-only',updatedAt:'2026-11-01T15:00:00Z'}});
  });
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('layout-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  await expect(page.locator('.arcd-app-shell')).toHaveAttribute('data-tab',id);
  await expect(page.locator('.arcd-main :is(h1,h2,h3)').first()).toBeAttached();
  await expect(page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
  await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
  return errors;
}

for(const tab of tabs)test(`${tab.id} · ${tab.label}`,async({page},info)=>{
  const errors=await enter(page,tab.id);
  await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Alterar aparência',exact:true})).toBeVisible();
  const geometry=await page.evaluate(()=>({width:innerWidth,page:document.documentElement.scrollWidth,header:document.querySelector('.arcd-topbar')?.scrollWidth,headerWidth:document.querySelector('.arcd-topbar')?.clientWidth,actualTab:document.querySelector('.arcd-app-shell')?.dataset.tab,
    screenHeaders:[...document.querySelectorAll('main .mrc-screen-header')].map(el=>{
      const title=el.querySelector('h1,h2,h3');
      const probe=document.createElement('span');
      probe.hidden=true;
      probe.style.fontSize='var(--arcd-type-page-title)';
      el.append(probe);
      const expectedFontSize=getComputedStyle(probe).fontSize;
      probe.remove();
      return {primaryActions:el.querySelectorAll('[data-mrc-role="primary"],.arcd-btn[data-variant="primary"]').length,title:title?.textContent,background:getComputedStyle(el).backgroundColor,padding:getComputedStyle(el).padding,fontSize:title?getComputedStyle(title).fontSize:null,expectedFontSize};
    }),
    overflow:[...document.querySelectorAll('main button,main input,main select')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&r.right>innerWidth+1;}).slice(0,8).map(el=>({text:el.textContent?.slice(0,60)||el.getAttribute('aria-label'),class:el.className}))}));
  await info.attach('geometry',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
  await writeFile(info.outputPath('geometry.json'),JSON.stringify(geometry,null,2));
  await page.screenshot({path:info.outputPath('view.png'),animations:'disabled'});
  expect.soft(geometry.page,JSON.stringify(geometry.overflow)).toBeLessThanOrEqual(geometry.width+1);
  expect.soft(geometry.header).toBeLessThanOrEqual(geometry.headerWidth+1);
  expect.soft(geometry.actualTab).toBe(tab.id);
  // Etapa 1 do redesign: um único cabeçalho padrão por tela (a TV é painel de
  // parede), título na escala comum e no máximo uma ação primária.
  if(tab.id!=='tv'){
    expect.soft(geometry.screenHeaders.length,`Cabeçalho padrão em ${tab.id}`).toBe(1);
    if(geometry.screenHeaders.length){
      expect.soft(geometry.screenHeaders[0].fontSize,`Título do cabeçalho em ${tab.id}`).toBe(geometry.screenHeaders[0].expectedFontSize);
      expect.soft(geometry.screenHeaders[0].primaryActions,`Ações primárias no cabeçalho de ${tab.id}`).toBeLessThanOrEqual(1);
    }
    if(process.env.MARCELL_TEST_THEME==='operacional'&&geometry.screenHeaders.length)expect.soft(geometry.screenHeaders[0].background).toBe('rgb(255, 255, 255)');
  }
  if(sharedTableAreas.has(tab.id)){
    const tables=page.locator('.arcd-main table:visible');
    if(geometry.width>=1100)expect.soft(await tables.count(),`Tabelas de ${tab.id}`).toBeGreaterThan(0);
    for(const table of await tables.all()){
      await expect.soft(table).toHaveClass(/\barcd-data-table__table\b/);
      const cells=await table.locator(':scope > :is(thead, tbody) > tr > :is(th, td):visible').evaluateAll(elements=>{
        if(!elements.length)return {expected:null,sizes:[],misaligned:[]};
        const probe=document.createElement('span');
        probe.hidden=true;
        probe.style.fontSize='var(--arcd-type-table)';
        elements[0].append(probe);
        const expected=getComputedStyle(probe).fontSize;
        probe.remove();
        const sizes=[...new Set(elements.map(cell=>getComputedStyle(cell).fontSize))];
        const misaligned=elements.filter(cell=>cell.dataset.align==='end'&&getComputedStyle(cell).textAlign!=='right').map(cell=>cell.textContent);
        return {expected,sizes,misaligned};
      });
      expect.soft(cells.sizes.filter(size=>size!==cells.expected),`Tipografia da tabela em ${tab.id}`).toEqual([]);
      expect.soft(cells.misaligned,`Colunas numéricas em ${tab.id}`).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test('Compras: alinhamento, seleção, foco, menus e ação principal',async({page},info)=>{
  const errors=await enter(page,'cmp');await expect(page.getByRole('group',{name:'Comandos de Compras',exact:true})).toBeVisible();
  const header=page.getByRole('group',{name:'Comandos de Compras',exact:true});
  const create=header.getByRole('button',{name:'Nova solicitação',exact:true});
  if(page.viewportSize().width>=1100){
    const field=await header.getByLabel('Obra',{exact:true}).boundingBox(),action=await create.boundingBox();
    expect(Math.abs(field.y+field.height-action.y-action.height)).toBeLessThanOrEqual(2);
    const controls=await header.locator('input,select,button').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {top:r.top,height:r.height};}));
    expect(Math.max(...controls.map(r=>r.height))-Math.min(...controls.map(r=>r.height))).toBeLessThanOrEqual(1);
    expect(Math.max(...controls.map(r=>r.top))-Math.min(...controls.map(r=>r.top))).toBeLessThanOrEqual(1);
    const labels=await header.locator('.arcd-field__label').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().top));
    expect(Math.max(...labels)-Math.min(...labels)).toBeLessThanOrEqual(1);
    const nav=page.getByRole('navigation',{name:'Fluxo de compras',exact:true});
    const current=nav.getByRole('button',{name:/^Fila de trabalho(?: \d+)?$/});
    await expect(current).toHaveAttribute('aria-current','page');
    const other=nav.getByRole('button',{name:/^Pedidos(?: \d+)?$/});
    const currentStyle=await current.evaluate(el=>({background:getComputedStyle(el).backgroundColor,indicator:getComputedStyle(el).boxShadow}));
    const otherBackground=await other.evaluate(el=>getComputedStyle(el).backgroundColor);
    expect(currentStyle.background!==otherBackground||currentStyle.indicator!=='none').toBe(true);
    await expect(other).toHaveCSS('cursor','pointer');
    const beforeHover=await other.evaluate(el=>getComputedStyle(el).backgroundColor);await other.hover();await expect.poll(()=>other.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(beforeHover);
    await page.keyboard.press('Tab');await other.focus();await expect(other).toBeFocused();await expect(other).toHaveCSS('outline-style','solid');await other.press('Enter');await expect(other).toHaveAttribute('aria-current','page');
    await nav.getByRole('button',{name:/^Fila de trabalho(?: \d+)?$/}).click();
    const tools=page.locator('.purchase-tools');await tools.locator('summary').click();await expect(tools.getByRole('navigation')).toBeVisible();await tools.locator('summary').press('Escape');await expect(tools).not.toHaveAttribute('open');
  }
  await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();await expect(page.locator('.theme-menu')).toBeVisible();await page.locator('.theme-menu').getByLabel('Tema',{exact:true}).press('Escape');
  await create.click();await expect(page.getByRole('dialog',{name:'Solicitar materiais para Compras',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  await page.screenshot({path:info.outputPath('interactive-purchases.png'),animations:'disabled'});expect(errors).toEqual([]);
});

test('Planejamento: escala selecionada e opções respondem pelo padrão comum',async({page})=>{
  const errors=await enter(page,'plan');
  const disclosure=page.locator('details:not([open]) > summary').getByText('Escala, calendário e colunas',{exact:true});
  if(await disclosure.isVisible())await disclosure.click();
  const controls=page.getByRole('group',{name:'Escala e opções do cronograma',exact:true});
  const month=controls.getByRole('button',{name:'Mês',exact:true});await month.click();await expect(month).toHaveAttribute('aria-pressed','true');
  await expect(controls.getByRole('button',{name:'Semana',exact:true})).toHaveAttribute('aria-pressed','false');
  const columns=controls.getByRole('button',{name:'Colunas',exact:true});await columns.click();await expect(columns).toHaveAttribute('aria-expanded','true');
  await expect(page.getByText('Colunas do cronograma',{exact:true})).toBeVisible();await columns.click();await expect(columns).toHaveAttribute('aria-expanded','false');
  expect(errors).toEqual([]);
});

test('cabeçalho mantém alturas alinhadas nas densidades e no celular estreito',async({page})=>{
  await enter(page,'cmp');
  for(const density of ['compact','comfortable']){
    await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();
    await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).selectOption(density);
    await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-density',density);
    if(page.viewportSize().width<1100)await page.setViewportSize({width:320,height:740});
    const heights=await page.locator('.app-header-actions :is(.mrc-button,.app-save-status)').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>r.height));
    expect(Math.max(...heights)-Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
});

for(const tab of ['obras','orc','cmp','fin','equip','tv'])test(`Tokens compartilhados · ${tab}`,async({page})=>{
  const errors=await enter(page,tab);
  const selectors='.arcd-main :is(.mrc-screen-header,.mrc-button[data-mrc-role],input[data-mrc-control],select[data-mrc-control]),.arcd-topbar .mrc-button[data-mrc-role]';
  const visible=page.locator(selectors).filter({visible:true});
  expect(await visible.count()).toBeGreaterThan(0);
  await page.evaluate(()=>{
    const root=document.documentElement;
    root.style.setProperty('--arcd-font-sans','Arial, sans-serif');
    root.style.setProperty('--arcd-button-weight','700');
  });
  const readings=await visible.evaluateAll(elements=>elements.map(element=>{
    const style=getComputedStyle(element);
    return {font:style.fontFamily,weight:style.fontWeight,role:element.dataset.mrcRole};
  }));
  expect(readings.filter(item=>!/^Arial, sans-serif$/i.test(item.font))).toEqual([]);
  const primary=readings.filter(item=>item.role==='primary');
  expect(primary.filter(item=>item.weight!=='700')).toEqual([]);
  if(tab==='tv'){
    const tabs=await page.locator('.arcd-tv-visoes [role="tab"]').evaluateAll(elements=>elements.map(element=>{
      const active=element.getAttribute('aria-selected')==='true';
      const probe=document.createElement('span');
      probe.style.color=active?'var(--arcd-tv-text)':'var(--arcd-tv-secondary)';
      element.append(probe);
      const expected=getComputedStyle(probe).color;
      probe.remove();
      return {expected,actual:getComputedStyle(element).color};
    }));
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.filter(tab=>tab.actual!==tab.expected)).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('Geometria compartilhada acompanha filtros abertos e formulário de Compras',async({page},info)=>{
  const errors=await enter(page,'cmp');
  const commands=page.getByRole('group',{name:'Comandos de Compras',exact:true});
  const filters=commands.getByRole('button',{name:'Filtros',exact:true});
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded','true');
  const create=commands.getByRole('button',{name:'Nova solicitação',exact:true});
  const checkGeometry=async (button,fields)=>{
    await expect(button).toHaveCSS('min-height','56px');
    await expect(button).toHaveCSS('border-radius','11px');
    await expect(button).toHaveCSS('column-gap','13px');
    expect(await fields.count()).toBeGreaterThan(0);
    for(const field of await fields.all()){
      await expect(field).toHaveCSS('height','56px');
      await expect(field).toHaveCSS('border-radius','11px');
    }
  };
  await page.addStyleTag({content:`
    :root { --arcd-radius-control:11px !important; --arcd-touch-target:56px !important; }
    [data-density] :is(.arcd-app-shell,.arcd-modal-overlay,.arcd-dialog-backdrop) {
      --arcd-control-height:56px !important; --arcd-button-gap:13px !important;
    }
  `});
  const oneLine='input[data-mrc-control]:not([type="checkbox"],[type="radio"],[type="file"],[type="range"],[type="color"]),select[data-mrc-control]:not([multiple],[size])';
  await checkGeometry(create,commands.locator(oneLine).filter({visible:true}));
  await create.click();
  const dialog=page.getByRole('dialog',{name:'Solicitar materiais para Compras'});
  await expect(dialog).toBeVisible();
  await checkGeometry(dialog.locator('button[data-mrc-role="primary"]:visible').last(),dialog.locator(oneLine).filter({visible:true}));
  await page.screenshot({path:info.outputPath('geometria-compartilhada.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});


for (const [id, selector, item, value] of [
  ['home', '.dashboard-executive-grid', '.dashboard-kpi', '.dashboard-kpi__value'],
  ['obras', '.work-overview-metrics', '.page-hero__stat', '.page-hero__stat-value'],
  ['cmp', '.purchase-queue-metrics', 'button', 'strong'],
  ['fin', '.finance-today__filters', 'button', 'strong'],
  ['dre', '.dre-kpi-grid', '.dre-kpi-card', '.dre-kpi-card > p:nth-of-type(2)'],
  ['folha', '.payroll-summary-strip', ':scope > div', '.payroll-summary-strip__net > strong'],
]) test(`Caixas e indicadores compartilham tokens · ${id}`, async ({page}, info) => {
  const errors = await enter(page, id);
  if (id === 'obras') await page.locator('.works-card-cover:visible').first().click();
  if (id === 'folha') {
    const disclosure = page.locator('details:not([open]) > summary').filter({hasText:'Composição do pagamento'});
    if (await disclosure.isVisible()) await disclosure.click();
  }
  const strip = page.locator(selector);
  await expect(strip).toBeVisible();
  await page.screenshot({path:info.outputPath('caixas-indicadores.png'), animations:'disabled'});
  await strip.screenshot({path:info.outputPath('faixa.png'), animations:'disabled'});
  await page.addStyleTag({content:`
    [data-theme] .arcd-main {
      --arcd-box-radius: 19px;
      --arcd-box-padding: 21px;
      --arcd-type-kpi: 26px;
    }
  `});
  await expect(strip).toHaveCSS('border-radius', '19px');
  await expect(strip.locator(`${item}:visible`).first()).toHaveCSS('padding-inline-start', '21px');
  await expect(strip.locator(`${value}:visible`).first()).toHaveCSS('font-size', '26px');
  if (id === 'obras') {
    const boxes = page.locator('.work-overview-grid .mrc-box');
    await expect(boxes).toHaveCount(2);
    for (const box of await boxes.all()) {
      await expect(box).toHaveCSS('border-radius', '19px');
      await expect(box.locator('.mrc-box__header')).toHaveCSS('padding-inline-start', '21px');
    }
  }
  if (id === 'dre') {
    const loss = strip.getByText(/-R\$\s*800,00/);
    await expect(loss).toHaveAttribute('data-tone', 'danger');
    const dangerColor = await loss.evaluate(element => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--arcd-danger-text)';
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(loss).toHaveCSS('color', dangerColor);
    await strip.getByRole('button',{name:/Total de custos/}).press('Enter');
    const details = page.getByRole('dialog',{name:'Pagamentos e custos do período'});
    await expect(details).toBeVisible();
    await details.getByRole('button',{name:'Fechar',exact:true}).click();
  }
  if (id === 'cmp' || id === 'fin') {
    const inactive = strip.locator('button[aria-pressed="false"]:visible').first();
    const name = await inactive.innerText();
    await inactive.press('Enter');
    await expect(strip.locator('button[aria-pressed="true"]:visible')).toHaveText(name.replace(/\s+/g, ' ').trim(), {useInnerText:true});
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(errors).toEqual([]);
});

for (const [area, selector] of [['equip_fin','.ro-kpis .arcd-summary-card'], ['relat','.arcd-chart-panel']]) {
  test(`Cartões e gráficos seguem a base · ${area}`, async ({page}, info) => {
    const extras = area === 'equip_fin' ? {
      locacoesEquip: [{
        id:'locacao-layout', equipamentoId:'eq-a', obraId:'a', inicio:'2026-11-01', fim:'',
        quantidade:1, status:'ativa', lifecycleState:'active', tarifas:{dia:100},
      }],
    } : {};
    const errors = await enter(page, area, extras);
    if (area === 'equip_fin') {
      const mobile = page.getByRole('combobox',{name:'Fluxo de equipamentos e locações',exact:true});
      if (await mobile.isVisible()) await mobile.selectOption('locacoes');
      else await page.getByRole('button',{name:/^Locações(?:\s|$)/}).click();
    }
    const panel = page.locator(selector).filter({visible:true}).first();
    await expect(panel).toBeVisible();
    await panel.screenshot({path:info.outputPath('painel.png'), animations:'disabled'});
    await page.addStyleTag({content:`
      [data-theme] .arcd-main {
        --arcd-box-radius: 19px;
        --arcd-box-padding: 21px;
        --arcd-type-kpi: 26px;
      }
    `});
    await expect(panel).toHaveCSS('border-radius', '19px');
    if (area === 'relat') {
      const heading = panel.locator('.mrc-box__header');
      await expect(heading).toHaveCSS('padding-inline-start', '21px');
      await expect(panel.locator('.recharts-wrapper')).toBeVisible();
      const benefitsBar = panel.locator('.recharts-bar [fill="var(--arcd-chart-3)"]').first();
      await expect(benefitsBar).toBeAttached();
      await panel.getByRole('button',{name:'Ponto',exact:true}).click();
      await expect(heading.getByRole('heading',{name:'Presença e disciplina operacional'})).toBeVisible();
    } else {
      await expect(panel).toHaveCSS('padding-inline-start', '21px');
      await expect(panel.locator('.arcd-summary-card__value')).toHaveCSS('font-size', '26px');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(errors).toEqual([]);
  });
}

for (const [area, triggerLabel, title, action] of [
  ['cmp', 'Nova solicitação', 'Solicitar materiais para Compras', 'Formalizar e enviar para Compras'],
  ['orc', 'Novo orçamento', 'Novo orçamento', 'Criar'],
]) test(`Formulários usam o diálogo compartilhado · ${area}`, async ({page}, info) => {
  const errors = await enter(page, area);
  const trigger = page.getByRole('button',{name:triggerLabel,exact:true});
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog',{name:title,exact:true});
  await expect(dialog).toBeVisible();
  const header = dialog.locator('.arcd-dialog__header');
  const body = dialog.locator('.arcd-dialog__body');
  const footer = dialog.locator('.arcd-dialog__footer');
  await expect(dialog).toHaveCSS('font-family', /Inter/i);
  await expect(header).toBeInViewport();
  await expect(footer).toBeInViewport();
  const close = header.getByRole('button',{name:'Fechar',exact:true});
  const primary = footer.getByRole('button',{name:action,exact:true});
  await expect(primary).toBeInViewport();
  await primary.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(primary).toBeFocused();
  if (area === 'cmp') {
    await primary.click();
    await expect(body.locator('[aria-invalid="true"]').first()).toBeVisible();
    await expect(footer).toBeInViewport();
  } else {
    await expect(body.getByLabel('Nome do orçamento *',{exact:true})).toBeVisible();
  }
  await page.screenshot({path:info.outputPath('dialogo.png'), animations:'disabled'});
  await page.addStyleTag({content:`
    [data-theme] .arcd-dialog-backdrop {
      --arcd-dialog-padding: 21px !important;
      --arcd-type-dialog-title: 23px !important;
    }
  `});
  for (const part of [header,body,footer]) await expect(part).toHaveCSS('padding-inline-start','21px');
  await expect(header.getByRole('heading',{name:title})).toHaveCSS('font-size','23px');
  await footer.getByRole('button',{name:'Cancelar',exact:true}).click();
  const prompt = page.getByRole('dialog',{name:'Descartar alterações?',exact:true});
  if (await prompt.isVisible()) await prompt.getByRole('button',{name:'Descartar alterações',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

for (const item of [
  {area:'obras', trigger:'Nova obra', title:'Nova obra', action:'Revisar cadastro'},
  {area:'orc', trigger:'Copiar de outra obra', title:'Copiar de outra obra', action:'Copiar'},
  {area:'orc', editBudget:true, trigger:'Dados', title:'Editar dados do orçamento', action:'Salvar dados'},
  {area:'cmp', section:'pedidos', tab:/^Pedidos(?:\s|$)/, trigger:'Novo pedido', title:'Novo pedido', action:'Salvar pedido', discard:'Descartar alterações do pedido?'},
  {area:'cmp', section:'cotacoes', tab:/^Cotar(?:\s|$)/, trigger:'Adicionar cotação', title:'Nova cotação', action:'Salvar cotação'},
  {area:'est', section:'materiais', tab:'Insumos', trigger:'Novo insumo', title:'Novo insumo', action:'Salvar'},
  {area:'est', section:'comp', tab:'Composições', trigger:'Nova composição', title:'Nova composição', action:'Salvar'},
]) test(`Rodapé comum em ${item.title}`, async ({page}, info) => {
  const errors = await enter(page, item.area);
  if (item.editBudget) {
    await page.locator('main').getByRole('button',{name:'Abrir',exact:true}).first().click();
    await page.locator('details > summary').getByText('Dados e versões',{exact:true}).click();
  }
  if (item.section) {
    const navigation = item.area === 'cmp' ? 'Fluxo de compras' : 'Áreas do estoque';
    const select = page.getByRole('combobox',{name:navigation,exact:true});
    if (await select.isVisible()) await select.selectOption(item.section);
    else {
      if (item.area === 'est') await page.locator('details > summary').getByText('Cadastros e análises',{exact:true}).click();
      await page.getByRole('button',{name:item.tab,exact:typeof item.tab==='string'}).click();
    }
  }
  const trigger = page.getByRole('button',{name:item.trigger,exact:true});
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog',{name:item.title,exact:true});
  const footer = dialog.locator('.arcd-dialog__footer');
  await expect(dialog).toHaveCSS('font-family', /Inter/i);
  await expect(dialog.getByRole('heading',{name:item.title,exact:true})).toBeVisible();
  await expect(footer.getByRole('button',{name:item.action,exact:true})).toBeInViewport();
  await expect(footer.getByRole('button',{name:'Cancelar',exact:true})).toBeInViewport();
  if (item.editBudget) await expect(dialog.getByRole('textbox',{name:'Descrição',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('dialogo.png'),animations:'disabled'});
  if (item.section==='cotacoes' && page.viewportSize().width<768) {
    const proposals=dialog.getByRole('region',{name:'Propostas por fornecedor'});
    await proposals.focus();
    await expect(proposals).toBeFocused();
    await proposals.press('ArrowRight');
    await expect.poll(()=>proposals.evaluate(region=>region.scrollLeft)).toBeGreaterThan(0);
  }
  if (item.discard) {
    const supplier = dialog.getByLabel('Fornecedor *',{exact:true});
    await supplier.selectOption({index:1});
    await footer.getByRole('button',{name:'Cancelar',exact:true}).click();
    const prompt = page.getByRole('dialog',{name:item.discard,exact:true});
    const promptActions = prompt.locator('.arcd-dialog__footer');
    await expect(promptActions.getByRole('button',{name:'Continuar editando'})).toBeInViewport();
    await promptActions.getByRole('button',{name:'Continuar editando'}).click();
    await expect(dialog).toBeVisible();
    await footer.getByRole('button',{name:'Cancelar',exact:true}).click();
    await promptActions.getByRole('button',{name:'Descartar alterações'}).click();
  } else await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

for (const [id, label, selector] of [
  ['pedidos', /^Pedidos(?:\s|$)/, '.purchase-order-toolbar'],
  ['cotacoes', /^Cotar(?:\s|$)/, '.purchase-quote-filters'],
]) test(`Filtros de Compras herdam o espaçamento · ${id}`, async ({page}, info) => {
  const errors=await enter(page,'cmp');
  const select=page.getByRole('combobox',{name:'Fluxo de compras',exact:true});
  if (await select.isVisible()) await select.selectOption(id);
  else await page.getByRole('navigation',{name:'Fluxo de compras',exact:true}).getByRole('button',{name:label}).click();
  const groups=page.locator(selector);
  const toggle=groups.getByRole('button',{name:/^Filtros/});
  if (await toggle.isVisible()) await toggle.click();
  const fields=groups.locator('.workspace-filters__fields');
  await expect(fields).toBeVisible();
  await page.screenshot({path:info.outputPath('filtros.png'),animations:'disabled'});
  await page.addStyleTag({content:'[data-theme] .arcd-main { --arcd-layout-gap: 17px; }'});
  await expect(fields).toHaveCSS('gap','17px');
  if (await toggle.isVisible()) {
    if (page.viewportSize().width<768) await expect(toggle).toHaveCSS('min-height','44px');
    await toggle.click();
    await expect(fields).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test('Cabeçalhos e filtros dos relatórios usam os tokens de tela e impressão', async ({page}, info) => {
  const errors=await enter(page,'fin');
  await selectFinanceArea(page,'Relatórios financeiros');
  await page.getByLabel('Visão dos relatórios',{exact:true}).selectOption('standard');
  const title='Central de relatórios financeiros';
  const report=page.getByRole('region',{name:title,exact:true});
  const heading=report.getByRole('heading',{name:title,exact:true});
  const filters=report.getByRole('group',{name:'Consulta financeira',exact:true});
  await expect(heading).toHaveCSS('font-family',/Inter/i);
  await expect(filters).toBeVisible();
  await page.screenshot({path:info.outputPath('relatorio.png'),animations:'disabled'});
  await page.addStyleTag({content:'[data-theme] .arcd-main { --arcd-layout-gap: 17px; --arcd-type-section-title: 24px; }'});
  await expect(heading).toHaveCSS('font-size','24px');
  await expect(filters).toHaveCSS('gap','17px');
  const fontToken=()=>page.locator('html').evaluate(root=>getComputedStyle(root).getPropertyValue('--arcd-font-sans'));
  expect(await fontToken()).toMatch(/Inter/);
  await page.emulateMedia({media:'print'});
  expect(await fontToken()).toMatch(/Nimbus Sans/);
  await page.emulateMedia({media:'screen'});
  expect(errors).toEqual([]);
});

test('Tabelas, caixas e indicadores financeiros respondem à base', async ({page}, info) => {
  const errors = await enter(page, 'fin');
  await selectFinanceArea(page, 'Visão financeira');
  const box = page.getByRole('region', {name:'Resultado por competência', exact:true});
  await expect(box).toBeVisible();
  await page.screenshot({path:info.outputPath('visao-financeira.png'), animations:'disabled'});
  await page.addStyleTag({content:`[data-theme] .arcd-main {
    --arcd-box-radius: 19px;
    --arcd-box-padding: 21px;
    --arcd-type-kpi: 26px;
    --arcd-type-table: 16px;
  }`});
  await expect(box).toHaveCSS('border-radius', '19px');
  await expect(box).toHaveCSS('padding-inline-start', '21px');
  await expect(box.getByRole('button', {name:'Consultar memorial: Resultado', exact:true})).toHaveCSS('font-size', '26px');
  await selectFinanceArea(page, 'Pagamentos');
  const payments = page.locator('.mrc-kpi-strip[aria-label="Resumo financeiro"]');
  await expect(payments).toHaveCSS('border-radius', '19px');
  await expect(payments.locator('.mrc-kpi__action').first()).toHaveCSS('padding-inline-start', '21px');
  await expect(payments.locator('.mrc-kpi__value').first()).toHaveCSS('font-size', '26px');
  await payments.getByRole('button').first().press('Enter');
  const memorial = page.getByRole('dialog');
  await expect(memorial).toBeVisible();
  await memorial.getByRole('button', {name:'Fechar memorial', exact:true}).click();
  await selectFinanceArea(page, 'Relatórios financeiros');
  await page.getByLabel('Visão dos relatórios', {exact:true}).selectOption('standard');
  const table = page.getByRole('region', {name:'Central de relatórios financeiros', exact:true}).getByRole('table').first();
  await expect(table).toHaveClass(/\barcd-data-table__table\b/);
  await expect(table.getByRole('columnheader').first()).toHaveCSS('font-size', '16px');
  await expect(table.getByRole('columnheader').first()).toHaveCSS('font-family', /Inter/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(errors).toEqual([]);
});

for (const [area, selector, checkPadding] of [
  ['ponto_geral', '.ponto-geral-controls', true],
  ['fornecedores', '.supplier-ranking-card', false],
]) test(`Bordas, cores e espaçamentos seguem a base · ${area}`, async ({page}, info) => {
  const errors = await enter(page, area);
  const panel = page.locator(selector).first();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('font-family', /Inter/i);
  await page.screenshot({path:info.outputPath('aparencia.png'), animations:'disabled'});
  await page.addStyleTag({content:`[data-theme] .arcd-main {
    --arcd-border-default: rgb(10, 77, 119);
    --arcd-border-width: 2px;
    --arcd-box-radius: 20px;
    --arcd-radius-control: 18px;
    ${checkPadding ? '--arcd-space-3: 20px; --arcd-space-4: 20px;' : ''}
  }`});
  await expect(panel).toHaveCSS('border-top-width', '2px');
  await expect(panel).toHaveCSS('border-top-color', 'rgb(10, 77, 119)');
  await expect(panel).toHaveCSS('border-radius', checkPadding ? '18px' : '20px');
  if (checkPadding) await expect(panel).toHaveCSS('padding-left', '20px');
  expect(errors).toEqual([]);
});

for(const [id,selector] of [['equipe','.team-toolbar'],['ponto_geral','.ponto-geral-filters'],['patrimonio','.patrimony-filters'],['conc','.reconciliation-toolbar']])test(`Alinhamento global · ${id}`,async({page})=>{
 const errors=await enter(page,id);
 if(id==='equipe'){
   const filters=page.locator('.workspace-filters__toggle[aria-expanded="false"]').filter({hasText:'Filtros'});
   if(await filters.isVisible())await filters.click();
 }
 const controls=await page.locator(`${selector} [data-mrc-control]`).evaluateAll(elements=>elements.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height};}));
 expect(controls.length).toBeGreaterThanOrEqual(2);
 expect(Math.max(...controls.map(r=>r.height))-Math.min(...controls.map(r=>r.height))).toBeLessThanOrEqual(1);
 if(page.viewportSize().width>=1100)expect(Math.max(...controls.map(r=>r.top))-Math.min(...controls.map(r=>r.top))).toBeLessThanOrEqual(1);
 else expect(Math.min(...controls.map(r=>r.height))).toBeGreaterThanOrEqual(44);
 expect(errors).toEqual([]);
});
