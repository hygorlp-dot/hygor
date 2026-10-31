import {chromium, expect} from '@playwright/test';
import {openFinanceModule,selectFinanceArea,selectFinanceQueue,revealFinanceControl} from './finance-browser-navigation.mjs';
import {mkdir, writeFile} from 'node:fs/promises';

// All API calls are intercepted; this journey never writes to the live ERP.
const user = {id:'navigation-qa', nome:'Financeiro QA', email:'navigation@local.test', role:'admin', active:true};
const date = '2026-10-30';
const data = {
  usuarios:[user], config:{paymentHolidays:[]}, employees:[], attendance:{},
  obras:[{id:'a',name:'Obra Alfa QA',status:'active'},{id:'b',name:'Obra Beta QA',status:'active'}],
  notasFiscais:[{id:'nf',obraId:'a',tipo:'nfe',numero:'123',status:'aprovada',emissao:date,competencia:'2026-10',vencimento:date,valorBruto:1000,valorLiquido:1000,fornecedorNome:'Loja QA',documentos:[{nome:'Nota original QA',url:'https://example.com/nota.pdf'}],pagamentos:[]}],
};
const browser = await chromium.launch({headless:true});
const passed = [], errors = [];
await mkdir('artifacts/financeiro', {recursive:true});
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
    await page.route('**/api/**', route => {
      let body = {}; try { body = route.request().postDataJSON() || {}; } catch {}
      return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated',refreshToken:'isolated',usuario:user,data:structuredClone(data),updatedAt:date+'T15:00:00Z'}});
    });
    await page.goto(process.argv[2]||'http://127.0.0.1:4185');
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-senha').fill('isolated-test');
    await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
    await openFinanceModule(page);
    const nav = page.getByRole('navigation',{name:'Áreas do financeiro'});
    const area = name => selectFinanceArea(page,name);
    expect(await page.locator('.financial-navigation').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await expect(page.getByRole('heading',{name:'Hoje',exact:true})).toBeVisible();
    await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('a');
    await selectFinanceQueue(page,'receiveToday','Receber hoje');
    await area('Visão financeira');
    await expect(page.getByText('Análises e gráficos por obra',{exact:true}).locator('..')).not.toHaveAttribute('open');
    await revealFinanceControl(page.getByLabel('Horizonte',{exact:true}));
    await page.getByLabel('Horizonte',{exact:true}).selectOption('7');
    await page.getByLabel('Saldo inicial da simulação (R$)',{exact:true}).fill('1500');
    if(width===390)await page.locator('section[aria-labelledby="cash-forecast-heading"] .cash-forecast__controls').first().screenshot({animations:'disabled',path:'artifacts/financeiro/previsao-filtros-390.png'});
    await area('Documentos');
    await page.getByLabel('Competência ou mês de emissão',{exact:true}).fill('');
    await page.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill('Loja');
    await page.getByLabel('Conferência',{exact:true}).selectOption('category');
    await page.getByRole('button',{name:'Conferir documentos',exact:true}).click();
    await page.getByRole('button',{name:'Abrir ficha fiscal',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Voltar à conferência de documentos',exact:true}).click();
    await expect(page.getByLabel('Pesquisar documento ou fornecedor',{exact:true})).toHaveValue('Loja');
    await expect(page.getByLabel('Conferência',{exact:true})).toHaveValue('category');
    await expect(page.getByLabel('Competência ou mês de emissão',{exact:true})).toHaveValue('');
    await expect(page.getByRole('complementary',{name:'Documento e dados para conferência'}).getByRole('link')).toHaveAttribute('href','https://example.com/nota.pdf');
    passed.push(`${width}: ficha fiscal retorna com mês, busca, situação, obra e seleção`);

    await area('Hoje');
    const queueSelect=page.getByRole('combobox',{name:'Fila de vencimentos',exact:true});
    if(await queueSelect.isVisible())await expect(queueSelect).toHaveValue('receiveToday');
    else await expect(page.getByRole('button',{name:/Receber hoje ·/})).toHaveAttribute('aria-pressed','true');
    await selectFinanceQueue(page,'payToday','Pagar hoje');
    await page.getByRole('button',{name:'Ver memorial',exact:true}).click();
    await page.getByRole('dialog').getByRole('searchbox').fill('123');
    await page.getByRole('button',{name:'Consultar na central de documentos',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('complementary',{name:'Documento e dados para conferência'}).getByRole('link')).toBeVisible();
    await page.getByRole('button',{name:'Ver memorial',exact:true}).click();
    await page.getByRole('button',{name:'Consultar na central de documentos',exact:true}).click();
    await page.getByRole('button',{name:'Voltar ao memorial de origem',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Voltar ao memorial de origem',exact:true})).toBeVisible();
    passed.push(`${width}: consultas encadeadas preservam o retorno anterior e navegação sem rolagem lateral`);
    await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('b');
    await page.getByRole('button',{name:'Voltar ao memorial de origem',exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('searchbox')).toHaveValue('123');
    await expect(page.getByRole('dialog').locator('.dre-memorial__entry')).toHaveAttribute('open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox',{name:'Obra',exact:true})).toHaveValue('a');
    await area('Documentos');
    await expect(page.getByLabel('Pesquisar documento ou fornecedor',{exact:true})).toHaveValue('Loja');
    await expect(page.getByLabel('Conferência',{exact:true})).toHaveValue('category');
    passed.push(`${width}: memorial → documento → memorial preserva pesquisa, expansão e recorte original`);
    await page.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill('inexistente');
    await expect(page.getByRole('complementary',{name:'Documento e dados para conferência'})).toHaveCount(0);
    await page.getByRole('button',{name:'Limpar busca e situação',exact:true}).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    passed.push(`${width}: filtros não deixam conferência de item fora do recorte`);
    await area('Visão financeira');
    await expect(page.getByLabel('Horizonte',{exact:true})).toHaveValue('7');
    await expect(page.getByLabel('Saldo inicial da simulação (R$)',{exact:true})).toHaveValue('1500');
    passed.push(`${width}: cenário preservado entre áreas; gráficos recolhidos`);
    await area('Hoje');
    await page.getByRole('heading',{name:'Hoje',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/financeiro/operacional-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await area('Documentos');
    await page.getByRole('button',{name:'Conferir documentos',exact:true}).click();
    await page.screenshot({path:`artifacts/financeiro/continuidade-documentos-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.close();
  }
  expect(errors).toEqual([]);
  await writeFile('artifacts/financeiro/continuidade-browser.json',JSON.stringify({passed,errors},null,2));
  console.log(JSON.stringify({passed,errors},null,2));
} finally {
  await browser.close();
}
