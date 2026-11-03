import {test,expect} from '@playwright/test';
import {data as baseData,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

// "Adicionar item à etapa": cada resultado é um botão padrão. Com a lista
// maior que a altura do modal, o min-height do botão deixava o flex encolher
// os cartões até 40 px, e o texto de duas linhas invadia o cartão vizinho.
const data=structuredClone(baseData);
data.baseFavoritos=Array.from({length:8},(_,i)=>({fonte:'PRÓPRIA',codigo:`ARCD${String(i+1).padStart(3,'0')}`,unidade:'UN',precoUnit:100+i,
  descricao:`Muro em alvenaria de bloco cerâmico com colunas e cintamento superior e inferior em concreto armado, item de teste número ${i+1}`}));

test('os resultados da busca de item não se sobrepõem e ficam alinhados à esquerda',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({user})=>{sessionStorage.setItem(`arcd-section:${user}`,'orc');localStorage.setItem('arcd-theme','marcell');},{user:profile.id});
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'busca-local-only',refreshToken:'busca-local-only',updatedAt:'2026-11-01T15:00:00Z'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('busca-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
  await page.locator('main').getByRole('button',{name:'Abrir',exact:true}).first().click();
  await page.locator('main').getByRole('button',{name:'+ Item',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Adicionar item à etapa'});
  await expect(dialog.getByText('Seus favoritos')).toBeVisible();
  const cards=dialog.getByRole('button').filter({hasText:'Muro em alvenaria'});
  await expect(cards).toHaveCount(8);
  const boxes=await cards.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();const inner=el.firstElementChild.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,left:r.left,width:r.width,fits:el.scrollHeight<=el.clientHeight+1,innerLeft:inner.left,innerWidth:inner.width};}));
  for(const [i,box] of boxes.entries()){
    expect(box.fits,`cartão ${i+1} corta o texto`).toBe(true);
    if(i)expect(box.top,`cartão ${i+1} invade o anterior`).toBeGreaterThanOrEqual(boxes[i-1].bottom-0.5);
    // O conteúdo ocupa a largura do cartão (sem ficar centralizado).
    expect(box.innerWidth).toBeGreaterThan(box.width*0.85);
  }
  expect(errors).toEqual([]);
});
