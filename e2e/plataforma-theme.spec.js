import {test,expect} from '@playwright/test';
import {DEFAULT_THEME,enabledThemeIds} from '../src/design-system/themes/themeRegistry.js';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {openFinanceModule,selectFinanceArea} from '../scripts/finance-browser-navigation.mjs';

async function enter(page, fixture = data){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data:fixture,accessToken:'local-theme-test',refreshToken:'local-theme-test'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-theme-test');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  return errors;
}
async function purchases(page){
  if(page.viewportSize().width<1100) await page.getByRole('button',{name:'Abrir Compras e suprimentos · Compras',exact:true}).click();
  else {
    const sidebar=page.locator('.arcd-sidebar');const group=sidebar.locator('.nav-grp-hd').filter({hasText:/^Compras/});
    const body=group.locator('xpath=following-sibling::*[contains(@class,"nav-body")][1]');
    if(!await body.isVisible())await group.click();await body.locator('.nav-item').filter({hasText:/^Compras$/}).click();
  }
  await expect(page.locator('.purchase-workspace')).toBeVisible();
}
async function appearance(page,theme,density='comfortable'){
  await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();
  await page.locator('.theme-menu').getByLabel('Tema',{exact:true}).selectOption(theme);
  await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).selectOption(density);
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}

test('Densidade Compacta reduz a escala do ERP em todos os temas', async ({ page }) => {
  await enter(page);
  await purchases(page);
  const main = page.locator('.arcd-main');
  const title = main.getByRole('heading', { name: 'Compras', exact: true });
  const compactTitle = page.viewportSize().width < 768 ? '18px' : '20px';

  for (const theme of enabledThemeIds) {
    await appearance(page, theme, 'compact');
    await expect(title).toHaveCSS('font-size', compactTitle);
    await expect(main).toHaveCSS('font-size', '12px');
    await fits(page);
  }

  await page.getByRole('button', { name: 'Nova solicitação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Solicitar materiais para Compras' })).toHaveCSS('font-size', '14px');
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toHaveCSS(
    'min-height', page.viewportSize().width < 768 ? '44px' : '32px',
  );
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();

  await appearance(page, 'plataforma', 'comfortable');
  await expect(title).toHaveCSS('font-size', '22px');
  await expect(main).toHaveCSS('font-size', '13px');
});

test('Plataforma preserva consulta, preferência e leitura nos temas existentes',async({page},info)=>{
  const errors=await enter(page);await purchases(page);
  const search=page.getByLabel('Buscar na fila',{exact:true});await search.fill('cimento');
  const before=await page.locator('.purchase-queue-table tbody').innerText();
  for(const theme of ['marcell','noite','cristal','plataforma']){
    await appearance(page,theme,'compact');await expect(search).toHaveValue('cimento');
    expect(await page.locator('.purchase-queue-table tbody').innerText()).toBe(before);await fits(page);
    // Settle the inherited theme color transitions before comparison captures.
    await page.waitForTimeout(400);
    await page.screenshot({path:info.outputPath(`compras-${theme}.png`),fullPage:true,animations:'disabled'});
  }
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','plataforma');
  if(await page.locator('#login-email').isVisible()){await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-theme-test');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();}
  await expect(page.locator('.arcd-main')).toBeVisible();
  await purchases(page);await search.fill('cimento');
  await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();
  await expect(page.locator('.theme-menu').getByLabel('Tema',{exact:true})).toHaveValue('plataforma');
  await page.keyboard.press('Escape');
  await openFinanceModule(page);await selectFinanceArea(page,'Hoje');await fits(page);
  await expect(page.locator('.finance-today')).toBeVisible();
  await page.screenshot({path:info.outputPath('financeiro-plataforma.png'),fullPage:true});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await expect(page.locator('.finance-today__filters').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

test('Obras mantém o painel e a seleção visível ao voltar à mesma obra', async ({ page }, info) => {
  const errors = await enter(page);
  await appearance(page, 'plataforma', 'compact');
  const mobile = page.viewportSize().width < 1100;
  if (mobile) {
    await page.getByRole('button', { name: /^Abrir Obras/ }).click();
  } else {
    const group = page.getByRole('button', { name: /^Obras e projetos/ });
    const obras = page.getByRole('button', { name: 'Obras', exact: true });
    if (!await obras.isVisible()) await group.click();
    await obras.click();
  }
  const openWork = name => page.getByRole('article').filter({
    has: page.getByRole('button', { name: new RegExp(name, 'i') }),
  }).getByRole('button', { name: /^Abrir obra/ }).click();
  await openWork('Residencial Alameda');
  const tabs = page.getByRole('tablist', { name: 'Informações da obra' });
  await expect(tabs.getByRole('tab')).toHaveCount(14);
  const summary = tabs.getByRole('tab', { name: 'Resumo', exact: true });
  const details = tabs.getByRole('tab', { name: 'Detalhes gerais', exact: true });
  const activity = tabs.getByRole('tab', { name: 'Atualizações da obra', exact: true });
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await summary.press('ArrowRight');
  await expect(details).toBeFocused();
  await details.press('Enter');
  await expect(page.getByRole('tabpanel', { name: 'Detalhes gerais' })).toContainText('Valor do contrato');
  const receipts = tabs.getByRole('tab', { name: 'Próximos recebimentos', exact: true });
  await receipts.click();
  const receiptsPanel = page.getByRole('tabpanel', { name: 'Próximos recebimentos', exact: true });
  for (const theme of ['marcell', 'noite', 'cristal', 'plataforma']) {
    await appearance(page, theme, 'compact');
    await expect(receipts).toHaveAttribute('aria-selected', 'true');
    await expect(receiptsPanel.getByRole('button', { name: 'Abrir Medições a faturar' })).toBeVisible();
    await fits(page);
    await page.screenshot({ path: info.outputPath(`recebimentos-${theme}.png`), animations: 'disabled' });
  }
  await activity.click();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.getByRole('tabpanel', { name: 'Atualizações da obra' })).toBeVisible();
  await page.getByRole('button', { name: 'Todas as obras', exact: true }).click();
  await openWork('Residencial Horizonte');
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Todas as obras', exact: true }).click();
  await openWork('Residencial Alameda');
  await expect(activity).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Atualizações da obra' })).toBeVisible();
  await fits(page);
  await page.screenshot({ path: info.outputPath('obra-retorno.png'), animations: 'disabled' });
  const activeVisible = () => activity.evaluate(el => {
    const selected = el.getBoundingClientRect();
    const strip = el.parentElement.getBoundingClientRect();
    return selected.left >= strip.left && selected.right <= strip.right + 1;
  });
  await expect.poll(activeVisible).toBe(true);
  expect(errors).toEqual([]);
});

async function openWorkBudget(page) {
  const mobile = page.viewportSize().width < 1100;
  if (mobile) {
    await page.getByRole('button', { name: /^Abrir Obras/ }).click();
  } else {
    const group = page.getByRole('button', { name: /^Obras e projetos/ });
    const works = page.getByRole('button', { name: 'Obras', exact: true });
    if (!await works.isVisible()) await group.click();
    await works.click();
  }
  const main = page.getByRole('main');
  await main.getByRole('article').filter({ hasText: 'Residencial Alameda' })
    .getByRole('button', { name: /^Abrir obra/ }).click();
  if (mobile) await main.getByRole('combobox', { name: 'Telas da obra' }).selectOption('orc');
  else await main.getByRole('button', { name: 'Obra', exact: true }).click();
  return main;
}

test('Orçamento da obra abre a versão única e filtra itens sem mudar o total', async ({ page }, info) => {
  const failures = [];
  const writes = [];
  page.on('response', response => { if (response.status() >= 500) failures.push(response.status()); });
  page.on('request', request => {
    if (!request.url().endsWith('/api/data') || request.method() !== 'POST') return;
    const action = request.postDataJSON()?.action;
    if (typeof action === 'string' && /save|command|delete/i.test(action)) writes.push(action);
  });
  const errors = await enter(page);
  await appearance(page, 'plataforma', 'compact');
  const main = await openWorkBudget(page);
  await expect(main.getByText('Sem orçamento de controle aprovado', { exact: true })).toBeVisible();
  const sheetActions = main.getByRole('toolbar', { name: 'Ações da planilha' });
  await expect(main.getByText('R$ 61.950,00', { exact: true }).first()).toBeVisible();
  const row = main.getByRole('textbox', { name: /^Descrição do item 1\.1/ });
  await expect(row).toBeVisible();
  for (const theme of ['marcell', 'noite', 'cristal', 'plataforma']) {
    await appearance(page, theme, 'compact');
    await expect(row).toBeVisible();
    await fits(page);
    await page.evaluate(() => document.fonts.ready);
    const totalDisclosure = main.getByText('Ver composição', { exact: true });
    if (await totalDisclosure.isVisible()) await totalDisclosure.click();
    const totals = await main.locator('.budget-kpis > .budget-kpi').evaluateAll(cells => cells.map(cell => {
      const label = cell.querySelector('span');
      const amount = cell.querySelector('strong');
      const labelBox = label.getBoundingClientRect();
      const amountBox = amount.getBoundingClientRect();
      return {
        labelY: labelBox.top,
        amountY: amountBox.top,
        aligned: Math.abs(labelBox.left - amountBox.left) < 1,
        amountSize: getComputedStyle(amount).fontSize,
      };
    }));
    expect(totals).toHaveLength(4);
    for (const total of totals) {
      expect(total.aligned).toBe(true);
      expect(total.amountSize).toBe('14px');
    }
    const columns = page.viewportSize().width <= 767 ? 2 : 4;
    for (let index = 0; index < totals.length; index += columns) {
      const band = totals.slice(index, index + columns);
      expect(band.every(item => Math.abs(item.labelY - band[0].labelY) < 1 && Math.abs(item.amountY - band[0].amountY) < 1)).toBe(true);
    }
    if (await totalDisclosure.isVisible()) await totalDisclosure.click();
    await page.screenshot({ path: info.outputPath(`orcamento-${theme}.png`), animations: 'disabled' });
  }
  const firstItemY = await row.evaluate(element => Math.round(element.getBoundingClientRect().top));
  await info.attach('posição do primeiro item', { body: JSON.stringify({ firstItemY, viewport: page.viewportSize() }), contentType: 'application/json' });

  const sheetOptions = sheetActions.getByText('Opções da planilha', { exact: true });
  if (await sheetOptions.isVisible()) await sheetOptions.click();
  await sheetActions.getByRole('button', { name: 'Recolher todas' }).click();
  await expect(row).toBeHidden();
  await main.getByRole('button', { name: 'Expandir etapa 1', exact: true }).click();
  await expect(row).toBeVisible();
  await expect(main.getByRole('textbox', { name: /^Descrição do item 2\.1/ })).toBeHidden();
  const filter = main.getByRole('searchbox', { name: 'Buscar itens por código ou descrição' });
  const item2 = main.getByRole('textbox', { name: /^Descrição do item 2\.1/ });
  await filter.fill('armacao');
  await expect(item2).toBeVisible();
  await expect(row).toBeHidden();
  await expect(main.getByText('R$ 61.950,00', { exact: true }).first()).toBeVisible();
  await filter.fill('01');
  await expect(row).toBeVisible();
  await expect(item2).toBeHidden();
  await filter.fill('xyz inexistente');
  await expect(main.getByRole('status').filter({hasText:'Nenhum item encontrado'})).toBeVisible();
  await filter.clear();
  await expect(row).toBeVisible();
  await expect(item2).toBeHidden();

  const columns = sheetActions.getByRole('button', { name: 'Colunas', exact: true });
  await columns.click();
  await expect(main.getByText('Colunas visíveis', { exact: true })).toBeVisible();
  await columns.click();
  await fits(page);
  await main.getByRole('button', { name: '← Orçamentos', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Abrir', exact: true })).toHaveCount(1);
  expect(failures).toEqual([]);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('Orçamento da obra exibe a lista quando há duas versões', async ({ page }) => {
  const fixture = structuredClone(data);
  fixture.orcamentos.push({ ...structuredClone(fixture.orcamentos[0]), id: 'budget-revision', nome: 'Revisão de teste', versionNumber: 2 });
  await enter(page, fixture);
  const main = await openWorkBudget(page);
  await expect(main.getByRole('button', { name: 'Abrir', exact: true })).toHaveCount(2);
  await expect(main.getByRole('toolbar', { name: 'Ações da planilha' })).toHaveCount(0);
});
