import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

// Dashboard com obras reais da fixture, lido a 100% e com o texto a 200% (zoom só de
// texto: a largura em px não muda, então media query não ajuda). Nada pode passar da
// tela, a tabela "Suas obras hoje" não pode rolar de lado e nenhuma célula corta texto.
async function entrar(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
  await page.addInitScript(user=>{sessionStorage.setItem(`arcd-section:${user}`,'dashboard');localStorage.setItem('arcd-theme','saas');},profile.id);
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'zoom-local-only',refreshToken:'zoom-local-only',updatedAt:'2026-11-01T15:00:00Z'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('zoom-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  await expect(page.getByRole('table',{name:'Situação das obras ativas'})).toBeVisible();
  return errors;
}

test('dashboard e "Suas obras hoje" cabem na tela com texto a 100% e 200%',async({page})=>{
  const errors=await entrar(page);
  for(const escala of ['100%','200%']){
    await page.evaluate(v=>document.documentElement.style.fontSize=v,escala);
    const medida=await page.evaluate(()=>{
      const lista=document.querySelector('.gav-lista'),card=document.querySelector('.gav').getBoundingClientRect();
      const nome=[...document.querySelectorAll('.gav-obra__nome')].find(b=>b.textContent==='Residencial Alameda');
      return {
        paginaPassa:document.documentElement.scrollWidth-innerWidth,
        tabelaRola:lista.scrollWidth-lista.clientWidth,
        celulasCortadas:[...document.querySelectorAll('.gav-linha [role=cell], .gav-placar__item')].filter(c=>c.scrollWidth>c.clientWidth+1).map(c=>c.textContent.trim()),
        foraDoCard:[...document.querySelectorAll('.gav *')].filter(e=>e.getBoundingClientRect().right>card.right+1).map(e=>e.textContent.trim().slice(0,40)),
        nomeCortado:nome.scrollWidth>nome.clientWidth+1,
      };
    });
    expect.soft(medida.paginaPassa,`página a ${escala}`).toBeLessThanOrEqual(1);
    expect.soft(medida.tabelaRola,`tabela a ${escala}`).toBeLessThanOrEqual(1);
    expect.soft(medida.celulasCortadas,`células a ${escala}`).toEqual([]);
    expect.soft(medida.foraDoCard,`fora do card a ${escala}`).toEqual([]);
    expect.soft(medida.nomeCortado,`nome curto cortado a ${escala}`).toBe(false);
  }
  await expect(page.getByText('30/03/2027',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
