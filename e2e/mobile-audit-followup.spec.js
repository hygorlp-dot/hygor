import { expect, test } from '@playwright/test';
import { data as fixture, profile } from '../scripts/fixtures/workflow-priorities-data.mjs';

const projection = faturamento => ({ faturamento, recebido: 0, totalCustos: 0, lucroBruto: faturamento });

async function enter(page, tab, { prepare, report } = {}) {
  const data = structuredClone(fixture);
  const user = { ...profile, role: 'admin', obraId: '' };
  data.usuarios = [user];
  prepare?.(data);
  const operations = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));
  await page.addInitScript(({ id, tab }) => sessionStorage.setItem('arcd-section:' + id, tab), { id: user.id, tab });
  await page.context().route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!url.pathname.startsWith('/api/')) {
      return ['GET', 'HEAD'].includes(request.method()) ? route.continue() : route.abort();
    }
    const body = request.postDataJSON() || {};
    if (body.action === 'financial-dre-report' && report) return report(route, body);
    if (/save|command|upsert|upload|delete|sync/.test(body.action || '')) {
      operations.push(body.action);
      return route.fulfill({ status: 403, json: { ok: false } });
    }
    return route.fulfill({ json: {
      ok: true, user, usuario: user, usuarios: [user], data, precisaSetup: false,
      accessToken: 'qa-local', refreshToken: 'qa-local', updatedAt: '2026-11-17T15:00:00Z',
      items: [], bases: [], presencas: [],
    } });
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-senha').fill('simulacao');
  await page.getByRole('button', { name: 'Acessar central MARCELL' }).click();
  await expect(page.locator(`.arcd-app-shell[data-tab="${tab}"]`)).toBeVisible();
  return async name => {
    expect(operations).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
    await page.screenshot({ path: test.info().outputPath(name + '.png'), animations: 'disabled' });
  };
}

for (const width of [390, 1440]) test.describe(`${width}px`, () => {
  test.use({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768 });

  test('DRE aguarda a obra atual antes de mostrar valores e liberar exportações', async ({ page }) => {
    let finishB;
    const delayed = new Promise(resolve => { finishB = resolve; });
    const check = await enter(page, 'dre', {
      prepare(data) {
        data.outrasDesp = [
          { id: 'desp-a', obraId: 'a', competencia: '2026-11', categoria: 'material', descricao: 'Despesa QA da obra A', valor: 100 },
          { id: 'desp-b', obraId: 'b', competencia: '2026-11', categoria: 'material', descricao: 'Despesa QA da obra B', valor: 200 },
        ];
      },
      report: async (route, body) => {
        if (body.obraId === 'b') await delayed;
        const faturamento = body.obraId === 'b' ? 222222 : 111111;
        return route.fulfill({ json: { ok: true, source: 'canonical_ledger', current: projection(faturamento) } });
      },
    });
    if (width < 768) await page.getByRole('combobox', { name: 'Visão do DRE' }).selectOption('obra');
    else await page.getByRole('button', { name: /^Por obra/ }).click();
    const work = page.getByRole('combobox', { name: 'Obra em análise' });
    await work.selectOption('a');
    const revenue = page.locator('.dre-kpi-card').filter({ has: page.getByText('Faturamento', { exact: true }) });
    await expect(revenue).toContainText('111.111,00');
    await work.selectOption('b');
    try {
      await expect(work).toHaveValue('b');
      await expect(page.getByRole('status', { name: 'Carregando o DRE da obra…' })).toBeVisible();
      await expect(revenue).toHaveCount(0);
      await expect(page.getByText('Despesa QA da obra A', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'DRE PDF', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Excel Completo', exact: true })).toBeDisabled();
      await check('dre-carregando');
      await work.selectOption('a');
      await expect(revenue).toContainText('111.111,00');
      const lateResponse = page.waitForResponse(response =>
        response.url().endsWith('/api/data') && response.request().postDataJSON()?.obraId === 'b');
      finishB();
      await lateResponse;
      await expect(work).toHaveValue('a');
      await expect(revenue).toContainText('111.111,00');
    } finally {
      finishB();
    }
    await work.selectOption('b');
    await expect(revenue).toContainText('222.222,00');
    await expect(page.getByText('Despesa QA da obra A', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Despesa QA da obra B', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'DRE PDF', exact: true })).toBeEnabled();
    await check('dre-obra-atual');
  });

  test('DRE sinaliza cálculo local e só reabre o PDF com o relatório da obra', async ({ page }) => {
    let responseMode = 'failure';
    const check = await enter(page, 'dre', {
      report: (route, body) => {
        if (body.obraId === 'b' && responseMode === 'failure') {
          return route.fulfill({ status: 503, json: { error: 'Razão indisponível no ensaio' } });
        }
        if (body.obraId === 'b' && responseMode === 'incomplete') {
          return route.fulfill({ json: { ok: true, source: 'canonical_ledger', current: { faturamento: 99 } } });
        }
        const closed = body.obraId === 'b';
        return route.fulfill({ json: {
          ok: true, source: closed ? 'closed_snapshot' : 'canonical_ledger',
          current: projection(closed ? 222222 : 111111),
        } });
      },
    });
    if (width < 768) await page.getByRole('combobox', { name: 'Visão do DRE' }).selectOption('obra');
    else await page.getByRole('button', { name: /^Por obra/ }).click();
    const work = page.getByRole('combobox', { name: 'Obra em análise' });
    const pdf = page.getByRole('button', { name: 'DRE PDF', exact: true });
    const notice = page.getByRole('status').filter({ hasText: 'Cálculo local da obra' });
    const revenue = page.locator('.dre-kpi-card').filter({ has: page.getByText('Faturamento', { exact: true }) });
    await work.selectOption('a');
    await expect(revenue).toContainText('111.111,00');
    await expect(pdf).toBeEnabled();
    await work.selectOption('b');
    await expect(notice).toBeVisible();
    await expect(revenue).not.toContainText('111.111,00');
    await expect(pdf).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Excel Completo' })).toBeEnabled();
    await check('dre-calculo-local');

    responseMode = 'incomplete';
    const incomplete = page.waitForResponse(response => response.request().postDataJSON()?.obraId === 'b');
    await notice.getByRole('button', { name: 'Tentar novamente' }).click();
    await incomplete;
    await expect(notice).toBeVisible();
    await expect(pdf).toBeDisabled();

    responseMode = 'snapshot';
    await notice.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(notice).toHaveCount(0);
    await expect(revenue).toContainText('222.222,00');
    await expect(pdf).toBeEnabled();
    await pdf.click();
    const identity = page.getByRole('dialog', { name: 'Identidade do relatório' });
    const popupWaiting = page.waitForEvent('popup');
    await identity.getByRole('button', { name: 'Gerar relatório' }).click();
    const popup = await popupWaiting;
    await expect(popup.locator('.kpis')).toContainText('222222,00');
    await expect(popup.locator('.kpis')).not.toContainText('111111,00');
    await expect(popup.locator('.dre-table')).toContainText('222222,00');
    await popup.close();
    await check('dre-razao-restaurado');
  });

  test('Patrimônio localiza bens de outras páginas e conserva ações', async ({ page }) => {
    const check = await enter(page, 'patrimonio', {
      prepare(data) {
        data.companyAssets = Array.from({ length: 15 }, (_, i) => ({
          id: 'bem-' + i, name: 'Bem QA ' + String(i + 1).padStart(2, '0'),
          assetTag: 'PAT-QA-' + i, acquisitionValue: 150, status: 'ativo', active: true, location: { label: 'Sede' },
        }));
      },
    });
    const last = page.getByRole('button', { name: 'Abrir cadastro de Bem QA 15', exact: true });
    if (width < 768) {
      const pageResults = page.getByRole('region', { name: 'Resultados de bens patrimoniais' });
      await expect(last).toHaveCount(0);
      await expect(pageResults).toContainText('1–12 de 15');
      await pageResults.getByRole('button', { name: 'Próxima' }).click();
      await expect(last).toBeVisible();
      await page.locator('summary').filter({ hasText: /^Relatório e importação$/ }).click();
    }
    await expect(page.getByRole('button', { name: 'Importar NF' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar', exact: true }).fill('Bem QA 15');
    await expect(last).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mover', exact: true })).toBeVisible();
    await check('patrimonio');
  });

  test('Ajustes conserva a edição ao recolher uma seção', async ({ page }) => {
    const check = await enter(page, 'config');
    const company = page.getByRole('textbox', { name: 'Empresa', exact: true });
    const section = page.locator('summary').filter({ hasText: /^Empresa$/ });
    if (width < 768) {
      await expect(company).toBeHidden();
      await check('ajustes-fechados');
      await section.click();
    }
    await company.fill('Empresa editada QA');
    if (width < 768) {
      await section.click();
      await section.click();
    }
    await expect(company).toHaveValue('Empresa editada QA');
    await expect(page.getByRole('button', { name: 'Salvar configurações' })).toBeVisible();
    await check('ajustes-empresa');
  });

  test('Frota conserva as ações com período e detalhes em segundo plano', async ({ page }) => {
    const check = await enter(page, 'equip', {
      prepare(data) {
        data.equipamentos = [{ id: 'eq-qa', nome: 'Betoneira QA', categoria: 'Máquinas', ativo: true, quantidadeTotal: 3, status: 'disponivel' }];
      },
    });
    const card = page.locator('.equipment-fleet-card');
    await expect(card.getByRole('button', { name: 'Abrir cadastro de Betoneira QA' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Transferir', exact: true })).toBeVisible();
    const value = card.getByText('Lucro no mês', { exact: false }).first();
    const period = page.getByRole('combobox', { name: 'Período de referência' });
    if (width < 768) {
      await expect(value).toBeHidden();
      await expect(period).toBeHidden();
      await check('frota-compacta');
      await card.locator('summary').filter({ hasText: /^Detalhes do equipamento$/ }).click();
      await page.locator('summary').filter({ hasText: /^Período de referência/ }).click();
    }
    await expect(value).toBeVisible();
    await expect(period).toBeVisible();
    await check('frota-detalhes');
  });
});

test('atalho financeiro em 320 px cabe e mantém o nome acessível', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const check = await enter(page, 'home');
  const shortcut = page.getByRole('button', { name: 'Abrir Financeiro', exact: true });
  await expect(shortcut.getByText('Finanças', { exact: true })).toBeVisible();
  const labelsFit = await page.locator('.mobile-primary-nav__label').evaluateAll(labels =>
    labels.every(label => label.scrollWidth <= label.clientWidth));
  expect(labelsFit).toBe(true);
  await check('menu-320');
  await shortcut.click();
  await expect(page.locator('.arcd-app-shell[data-tab="fin"]')).toBeVisible();
});
