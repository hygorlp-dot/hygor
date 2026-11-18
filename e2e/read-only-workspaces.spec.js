import { expect, test } from '@playwright/test';
import { data as fixture, profile } from '../scripts/fixtures/workflow-priorities-data.mjs';
import { expandSectionDelta } from '../src/domains/sync/section-delta.js';

async function openWorkspace(page, tab, prepare = () => {}) {
  const data = structuredClone(fixture);
  const user = { ...profile, role: 'admin', obraId: '' };
  data.usuarios = [user];
  prepare(data);
  const operations = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));
  await page.addInitScript(({ id, tab }) => sessionStorage.setItem('arcd-section:' + id, tab), { id: user.id, tab });
  await page.context().route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' || !['GET', 'HEAD'].includes(request.method())) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
  await page.route('**/api/**', route => {
    const body = route.request().postDataJSON() || {};
    const action = body.action;
    if (action === 'sync-workspaces') {
      operations.push({ action, payload: body.obras });
      const first = body.obras[0];
      return route.fulfill({ json: { ok: true, resultados: [{ id: first.id, ok: true, workspace: { folderId: 'qa-pasta' } }] } });
    }
    if (action === 'save-sections') {
      operations.push({ action, sections: body.sections, deltas: body.sectionDeltas });
      Object.assign(data, body.sections);
      for (const [section, delta] of Object.entries(body.sectionDeltas || {})) {
        data[section] = expandSectionDelta(delta, data[section]).incoming;
      }
    } else if (action === 'save' || /command|upload|upsert/.test(action || '')) {
      operations.push({ action });
      return route.fulfill({ status: 403, json: { ok: false, error: 'Operação não esperada no ensaio' } });
    }
    return route.fulfill({ json: {
      ok: true, connected: true, usuario: user, user, usuarios: [user], precisaSetup: false,
      accessToken: 'qa-local', refreshToken: 'qa-local', data, updatedAt: '2026-11-17T15:00:00Z',
      items: [], bases: [], presencas: [], current: null,
    } });
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-senha').fill('qa-local');
  await page.getByRole('button', { name: 'Acessar central MARCELL' }).click();
  await expect(page.locator(`.arcd-app-shell[data-tab="${tab}"]`)).toBeVisible();
  return { data, operations, pageErrors };
}

const capture = async (page, name) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({ path: test.info().outputPath(name + '.png'), animations: 'disabled' });
};

for (const width of [390, 1440]) test.describe(`${width}px`, () => {
  test.use({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600 });

  test('Obras consulta sem preparar pastas e conserva a ação administrativa', async ({ page }) => {
    const { data, operations, pageErrors } = await openWorkspace(page, 'obras', data => {
      data.obras[0].oneDriveStructureVersion = 1;
    });
    await page.locator('summary').filter({ hasText: /^Arquivos e pastas$/ }).click();
    const prepare = page.getByRole('button', { name: 'Preparar pastas' });
    await expect(prepare).toBeVisible();
    expect(operations).toEqual([]);
    await prepare.click();
    await expect.poll(() => operations.map(operation => operation.action)).toEqual(['sync-workspaces', 'save-sections']);
    expect(data.obras[0]).toMatchObject({
      oneDriveFolderId: 'qa-pasta', oneDriveStructureVersion: 2,
    });
    expect(pageErrors).toEqual([]);
  });

  test('Planejamento só alinha as etapas por iniciativa do operador', async ({ page }) => {
    const { data, operations, pageErrors } = await openWorkspace(page, 'plan', data => {
      const plan = data.planos[0];
      const budget = data.orcamentos.find(b => b.obraId === plan.obraId);
      plan.budgetId = budget.id;
      delete plan.budgetVersionId;
      plan.tarefas = [plan.tarefas[0], { id: 'avulsa-qa', nome: 'Tarefa avulsa QA', inicio: '2026-11-01', fim: '2026-11-04', progresso: 20 }];
    });
    const current = structuredClone(data.planos[0]);
    const untouched = structuredClone(data.planos[1]);
    const align = page.getByRole('button', { name: 'Atualizar cronograma pelo orçamento' });
    await expect(align).toBeEnabled();
    expect(operations).toEqual([]);
    await capture(page, 'planejamento');
    await align.click();
    await expect.poll(() => operations.map(operation => operation.action)).toEqual(['save-sections']);
    const written = data.planos;
    const changed = written.find(plan => plan.id === current.id);
    expect(changed.tarefas).toEqual(expect.arrayContaining(current.tarefas.map(task => expect.objectContaining(task))));
    expect(changed.tarefas.length).toBeGreaterThan(current.tarefas.length);
    expect(written.find(plan => plan.id === untouched.id)).toMatchObject(untouched);
    expect(operations[0].sections).not.toHaveProperty('pagamentosFolha');
    expect(operations[0].deltas).not.toHaveProperty('pagamentosFolha');
    await expect(align).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('Diário deixa a busca e o resultado acessíveis e conserva os filtros', async ({ page }) => {
    const { operations, pageErrors } = await openWorkspace(page, 'rdo', data => {
      data.rdos = [{ id: 'rdo-qa', obraId: 'a', codigo: 12, data: '2026-11-16', descricao: 'Instalação de tubulação QA', status: 'concluido' }];
    });
    const start = page.getByLabel('Data inicial', { exact: true });
    const search = page.getByRole('textbox', { name: 'Pesquisar', exact: true });
    await expect(search).toBeVisible();
    await expect(page.getByText('Instalação de tubulação QA')).toBeVisible();
    await capture(page, 'diario');
    if (width < 600) {
      await expect(start).toBeHidden();
      const summary = page.locator('summary').filter({ hasText: /^Filtros/ });
      await summary.click();
      await start.fill('2026-11-17');
      await summary.click();
      await expect(summary).toContainText('1 ativo');
      await expect(page.getByText('Nenhum diário encontrado')).toBeVisible();
      await page.getByRole('button', { name: 'Limpar filtros' }).click();
    }
    await search.fill('tubulação');
    await expect(page.getByText('Instalação de tubulação QA')).toBeVisible();
    expect(operations).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('DRE preserva o recorte e abre uma obra pelo resumo no celular', async ({ page }) => {
    const { data, operations, pageErrors } = await openWorkspace(page, 'dre');
    const period = page.getByRole('combobox', { name: 'Apuração', exact: true });
    if (width < 600) {
      await expect(period).toBeHidden();
      await page.locator('summary').filter({ hasText: /^Período de análise/ }).click();
    }
    await period.selectOption('q1');
    if (width < 600) {
      const rows = page.getByRole('button', { name: /^Abrir DRE de / });
      const first = data.obras.find(work => work.id === 'a');
      await page.getByRole('textbox', { name: 'Pesquisar obra no resumo do DRE' }).fill(first.name);
      await expect(rows).toHaveCount(1);
      await rows.first().click();
      await expect(page.getByRole('combobox', { name: 'Obra em análise' })).toHaveValue(first.id);
      await expect(period).toHaveValue('q1');
      const details = page.locator('summary').filter({ hasText: /^Demonstrativo da obra$/ });
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(page, 'dre-entrada');
      await details.click();
      await expect(details.locator('..').getByText('Faturamento emitido', { exact: true })).toBeVisible();
    }
    await capture(page, 'dre');
    expect(operations).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Folha encontra funcionários fora da primeira página sem alterar o total', async ({ page }) => {
    const { operations, pageErrors } = await openWorkspace(page, 'folha', data => {
      const employee = data.employees[0];
      data.employees = Array.from({ length: 15 }, (_, index) => ({
        ...employee, id: `qa-${index}`, name: `Funcionário QA ${String(index + 1).padStart(2, '0')}`,
        obra: 'a', active: true, remunerationMode: 'daily', dailyRate: 150, startDate: '2026-01-01',
      }));
      data.attendance = Object.fromEntries(data.employees.map(person => [person.id, { '2026-11-16': { status: 'P', obraId: 'a' } }]));
    });
    const cycle = page.getByRole('combobox', { name: 'Ciclo da folha' });
    if (width < 600) await page.locator('summary').filter({ hasText: /^Competência e escopo/ }).click();
    await cycle.selectOption('1');
    if (width < 600) {
      await page.locator('summary').filter({ hasText: /^Competência e escopo/ }).click();
      await expect(cycle).toBeHidden();
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(page, 'folha-entrada');
      const list = page.getByRole('region', { name: 'Resultados de funcionários da folha' });
      await expect(list).toContainText('1–12 de 15');
      const total = page.locator('.page-hero__stats').first();
      const original = await total.innerText();
      await list.getByRole('button', { name: 'Próxima' }).click();
      await expect(list).toContainText('13–15 de 15');
      await page.getByRole('textbox', { name: 'Buscar funcionário na folha' }).fill('QA 15');
      await expect(list).toContainText('1–1 de 1');
      await expect(page.getByText('Funcionário QA 15', { exact: true })).toBeVisible();
      await expect(total).toHaveText(original, { useInnerText: true });
    } else {
      await expect(page.getByText('Funcionário QA 15', { exact: true })).toBeVisible();
    }
    await capture(page, 'folha');
    expect(operations).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.use({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
test('seleção de telas tem largura suficiente e preserva o acesso aos módulos', async ({ page }) => {
  const { operations, pageErrors } = await openWorkspace(page, 'home');
  await page.getByRole('button', { name: 'Abrir mais módulos' }).click();
  await page.getByRole('dialog', { name: 'Mais módulos' }).getByRole('button', { name: 'Pessoas e terceiros', exact: true }).click();
  const people = page.getByRole('combobox', { name: 'Telas de Pessoas e terceiros', exact: true });
  await expect(people).toBeVisible();
  const previousSelect = await people.elementHandle();
  await page.getByRole('button', { name: 'Abrir mais módulos' }).click();
  await page.getByRole('dialog', { name: 'Mais módulos' }).getByRole('button', { name: 'Comercial', exact: true }).click();
  const commercial = page.getByRole('combobox', { name: 'Telas de Comercial', exact: true });
  await expect(commercial).toBeVisible();
  await expect(commercial.getByRole('option', { name: 'Pipeline' })).toHaveCount(1);
  expect(await previousSelect.evaluate(node => node.isConnected)).toBe(false);
  const commercialSelect = await commercial.elementHandle();
  await commercial.selectOption({ label: 'Pipeline' });
  await expect(commercial).toBeVisible();
  expect(await commercialSelect.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Abrir mais módulos' }).click();
  await page.getByRole('dialog', { name: 'Mais módulos' }).getByRole('button', { name: 'Administração', exact: true }).click();
  const menu = page.getByRole('combobox', { name: 'Telas de Administração' });
  await expect(menu).toBeVisible();
  expect((await menu.boundingBox()).width).toBeGreaterThan(260);
  await menu.selectOption('admin_central');
  await expect(page.getByRole('heading', { name: 'Central do Administrador' })).toBeVisible();
  expect(await page.locator('.mobile-primary-nav__label').evaluateAll(labels =>
    labels.every(label => label.scrollWidth <= label.clientWidth))).toBe(true);
  await capture(page, 'menu');
  expect(operations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
