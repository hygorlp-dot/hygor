import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

for(const [i,id,name] of [[1,'precision','Precisão'],[2,'construction','Obra'],[3,'focus','Foco']]){
  test(`${name}: mesma fila, ações, busca, troca e ajuda`,async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
    await page.route('https://**/*',r=>r.abort());
    await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
    await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'local-study-only',refreshToken:'local-study-only',updatedAt:'2026-11-01T15:00:00Z'}}));
    await page.goto(`/prototypes/compras/?v=${i}`);
    const app=page.frameLocator('iframe');
    await app.locator('#login-email').fill(profile.email);await app.locator('#login-senha').fill('local-study-only');
    await app.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
    await expect(app.locator('.compras-view')).toBeVisible();
    await expect(app.locator('html')).toHaveAttribute('data-design-study',id);
    await expect(app.locator('.purchase-queue-table tbody tr')).toHaveCount(3);
    await expect(page.locator('.proto-picker button[aria-current=true]')).toHaveText(name);
    await expect(app.locator('.purchase-queue-metrics button')).toHaveCount(4);
    for(const metric of await app.locator('.purchase-queue-metrics button').all())await expect(metric).toBeVisible();
    expect(await app.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`${id}.png`),animations:'disabled'});
    await app.getByLabel('Buscar na fila',{exact:true}).fill('inexistente');
    await expect(app.getByText('Nenhum resultado para estes filtros',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Foco',exact:true}).click();
    await expect(app.getByLabel('Buscar na fila',{exact:true})).toHaveValue('inexistente');
    await app.getByRole('button',{name:'Mostrar todos os registros',exact:true}).click();
    await expect(app.locator('.purchase-queue-table tbody tr')).toHaveCount(3);
    await page.getByRole('button',{name,exact:true}).click();
    await app.getByRole('button',{name:'Filtros',exact:true}).click();
    await expect(app.getByLabel('Etapa do fluxo',{exact:true})).toBeVisible();
    await app.getByRole('button',{name:'Filtros',exact:true}).click();
    await app.getByRole('button',{name:'Nova solicitação',exact:true}).click();
    await expect(app.getByRole('dialog',{name:'Solicitar materiais para Compras',exact:true})).toBeVisible();
    await app.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
    await app.getByRole('button',{name:'Analisar solicitação · SC-001',exact:true}).click();
    await expect(app.locator('.compras-view')).toContainText('SC-001');
    await app.getByRole('button',{name:'Ajuda',exact:true}).click();
    await expect(app.getByRole('complementary',{name:'Central de ajuda',exact:true})).toBeVisible();
    expect(errors).toEqual([]);
    await page.locator('.study-heading strong').click();await page.keyboard.press('1');
    // An operational help panel owns keyboard input; the study must not steal it.
    await expect(page.locator('.proto-picker button[aria-current=true]')).toHaveText(name);
    await app.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
    await page.locator('.study-heading strong').click();await page.keyboard.press('2');
    await expect(page.locator('.proto-picker button[aria-current=true]')).toHaveText('Obra');
    await expect(app.locator('html')).toHaveAttribute('data-design-study','construction');
  });
}
