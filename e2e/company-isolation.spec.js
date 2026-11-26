import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

test('administrador alterna a empresa, obras e navegação sem gravar dados',async({page},testInfo)=>{
  const errors=[],writes=[],calls=[],coverReads=[],directReads=[];
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=','base64');
  const otherCompany='company-file://arcd/projeto/2026/00000000-0000-0000-0000-000000000001.png';
  const ownCompany=otherCompany.replace('://arcd/', '://mrc/');
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({user,theme})=>{
    for(const company of ['arcd','mrc'])sessionStorage.setItem(`marcell:${company}:arcd-section:${user}`,'obras');
    localStorage.setItem('arcd-theme',theme);
  },{user:profile.id,theme:testInfo.project.name.includes('noite')?'noite':'marcell'});
  await page.route('https://**/*',route=>route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
  await page.route('**/api/microsoft/onedrive*',route=>{
    const request=route.request();
    if(request.method()==='GET'&&new URL(request.url()).searchParams.get('action')==='file'){
      directReads.push(request.url());
      return route.fulfill({status:403});
    }
    const body=request.postDataJSON();
    if(body?.action!=='read-file')return route.fulfill({json:{ok:true,connected:false}});
    coverReads.push({company:body.companyId,item:body.itemId});
    expect(body.accessToken).toBe('company-local-only');
    if(body.itemId==='capa-restrita')return route.fulfill({status:403,json:{error:'Sem permissão.'}});
    return route.fulfill({contentType:'image/png',body:png});
  });
  await page.route('**/capa-ficticia.png',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.route('**/api/upload',route=>{
    const body=route.request().postDataJSON();
    if(body?.action!=='signed-company-file')return route.fulfill({status:403});
    coverReads.push({company:body.companyId,reference:body.reference});
    if(body.reference!==ownCompany)return route.fulfill({status:403});
    return route.fulfill({json:{ok:true,url:'/capa-ficticia.png'}});
  });
  await page.route('**/api/data',route=>{
    const body=route.request().postDataJSON(),company=body.companyId||'arcd';calls.push({action:body.action,company});
    if(['save','save-sections','operational-command','financial-command'].includes(body.action))writes.push(body);
    const state=structuredClone(data);
    for(const [key,value] of Object.entries(state))if(Array.isArray(value))state[key]=[];
    state.usuarios=[profile];state.config={...state.config,companyId:company,companyName:company.toUpperCase()};state.condominios=[];
    state.obras=(company==='mrc'?[['k','K1-10','capa-restrita'],['i','I1-08',otherCompany],['m','Obra com arquivo privado',ownCompany]]:[['a','ARCD · Obra A','capa-autorizada']]).map(([id,name,cover])=>({
      ...data.obras[0],id,name,capaUrl:cover.startsWith('company-file:')?cover:`/api/microsoft/onedrive?action=file&companyId=${company}&driveId=fixture&itemId=${cover}`,
    }));
    return route.fulfill({json:{ok:true,precisaSetup:false,usuario:profile,companyId:company,companyIsolationEnabled:true,data:state,accessToken:'company-local-only',refreshToken:'company-local-only',updatedAt:`2026-11-18T12:00:0${company==='mrc'?1:0}Z`}});
  });
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('company-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  const select=page.getByRole('combobox',{name:'Empresa',exact:true});
  const cover=name=>page.locator('.works-card-cover').filter({hasText:name});
  await expect(select).toHaveValue('arcd');await expect(page.locator('main')).toContainText('ARCD · Obra A');await expect(page.locator('main')).not.toContainText('K1-10');
  await expect(cover('ARCD · Obra A')).toHaveAttribute('data-has-image','true');
  const loaded=await cover('ARCD · Obra A').evaluate(async el=>{
    const source=el.style.getPropertyValue('--work-cover-image');
    const image=new Image();
    image.src=JSON.parse(source.slice(4,-1));
    await image.decode();
    return {temporary:image.src.startsWith('blob:'),width:image.naturalWidth};
  });
  expect(loaded).toEqual({temporary:true,width:1});
  await page.screenshot({path:testInfo.outputPath('arcd.png'),fullPage:true});
  await select.selectOption('mrc');await expect(select).toHaveValue('mrc');
  await expect(page.locator('main')).toContainText('K1-10');await expect(page.locator('main')).toContainText('I1-08');await expect(page.locator('main')).not.toContainText('ARCD · Obra A');
  await expect.poll(()=>coverReads).toContainEqual({company:'mrc',item:'capa-restrita'});
  await expect(cover('K1-10')).toHaveAttribute('data-has-image','false');
  await expect(cover('I1-08')).toHaveAttribute('data-has-image','false');
  await expect(cover('Obra com arquivo privado')).toHaveAttribute('data-has-image','true');
  await page.getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByText('Aparência e navegação',{exact:true}).click();await expect(page.getByText('Escolher a empresa de trabalho',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();await expect(select).toHaveValue('mrc');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mrc.png'),fullPage:true});
  await select.selectOption('arcd');await expect(page.locator('main')).toContainText('ARCD · Obra A');
  await expect(cover('ARCD · Obra A')).toHaveAttribute('data-has-image','true');
  expect(directReads).toEqual([]);
  expect(coverReads).toContainEqual({company:'mrc',reference:ownCompany});
  expect(coverReads.some(read=>read.reference===otherCompany)).toBe(false);
  expect(writes).toEqual([]);expect(errors).toEqual([]);expect(calls.some(call=>call.action==='load'&&call.company==='mrc')).toBe(true);
});
