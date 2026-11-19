import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {buildFinancialLedger,selectDRE} from '../src/domains/financeiro/ledger.js';

test('novo orçamento herda a obra por ID, conserva edição e não gera lançamento',async({page})=>{
  const data=structuredClone(fixture),writes=[];
  data.obras=[{id:'work-a',name:'Obra A',cliente:'Cliente A',address:'Rua A',areaM2:120},{id:'work-b',name:'Obra B',cliente:'Cliente B',address:'Rua B',areaM2:240}];
  data.orcamentos=[];
  const before=selectDRE(buildFinancialLedger(data),{});
  await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'orc'),profile.id);
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
  await page.route('**/api/data',r=>{
    const body=r.request().postDataJSON()||{};
    if(['save','save-sections','operational-command'].includes(body.action))writes.push(body);
    return r.fulfill({json:{ok:true,usuarios:[profile],usuario:profile,data,precisaSetup:false,accessToken:'local',refreshToken:'local'}});
  });
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.getByRole('button',{name:'Novo orçamento',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Novo orçamento',exact:true});
  const work=dialog.getByLabel('Vincular a uma obra (opcional)',{exact:true});
  await work.selectOption('work-a');
  await expect(dialog.getByLabel('Cliente',{exact:true})).toHaveValue('Cliente A');
  await expect(dialog.getByLabel('Local / Endereço',{exact:true})).toHaveValue('Rua A');
  await expect(dialog.getByLabel('Área construída (m)',{exact:true})).toHaveValue('120');
  await dialog.getByLabel('Cliente',{exact:true}).fill('Contratante específico');
  await work.selectOption('work-b');
  await expect(dialog.getByLabel('Cliente',{exact:true})).toHaveValue('Contratante específico');
  await expect(dialog.getByLabel('Local / Endereço',{exact:true})).toHaveValue('Rua B');
  await expect(dialog.getByLabel('Área construída (m)',{exact:true})).toHaveValue('240');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(writes).toEqual([]);
  expect(selectDRE(buildFinancialLedger(data),{})).toEqual(before);
});
