import {test,expect} from '@playwright/test';

test('cópia real separa 16 obras e 2 obras, bloqueia gravações e conserva a escolha após recarregar',async({page,request},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const company=page.getByRole('combobox',{name:'Empresa',exact:true});
  await expect(company).toBeVisible({timeout:60000});await expect(company).toHaveValue('arcd');
  const load=()=>page.evaluate(async()=>{
    const session=JSON.parse(sessionStorage.getItem('arcd_auth_session'));
    const response=await fetch('/api/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...session,action:'load'})});
    const data=await response.json(),urls=[];const visit=value=>{if(typeof value==='string'&&(/https?:\/\//.test(value)||value.startsWith('/api/local-review-file?')))urls.push(value);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(data.data);
    return {status:response.status,companyId:data.companyId,works:data.data.obras.map(work=>({id:work.id,name:work.name})),companyName:data.data.config.companyName,approverEmail:data.data.config.approverEmail,oneDriveRootUrl:data.data.config.oneDriveRootUrl,urls:[...new Set(urls)]};
  });
  const arcd=await load();expect(arcd.status).toBe(200);expect(arcd.works).toHaveLength(16);expect(arcd.works.some(work=>['K1-10','I-8'].includes(work.name))).toBe(false);
  expect(arcd.urls.every(url=>url.startsWith('/api/local-review-file?'))).toBe(true);expect(arcd.urls.length).toBeGreaterThan(0);
  const localFile=arcd.urls[0];expect((await page.request.get(localFile)).status()).toBe(200);
  expect((await page.request.get(localFile.replace('companyId=arcd','companyId=mrc'))).status()).toBe(403);
  expect((await request.get(localFile)).status()).toBe(403);
  await company.selectOption('mrc');await expect(company).toHaveValue('mrc');
  const mrc=await load();expect(mrc.works.map(work=>work.name)).toEqual(['I-8','K1-10']);
  expect(mrc.approverEmail).toBe('');expect(mrc.oneDriveRootUrl).toBe('');
  expect(mrc.urls.every(url=>url.startsWith('/api/local-review-file?companyId=mrc'))).toBe(true);
  expect(arcd.works.some(work=>mrc.works.some(other=>other.id===work.id))).toBe(false);
  const checks=await page.evaluate(async foreignWork=>{
    const session=JSON.parse(sessionStorage.getItem('arcd_auth_session'));
    const call=async body=>{const response=await fetch('/api/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...session,...body})});return {status:response.status,body:await response.json()};};
    const write=await call({action:'save-sections',sections:{config:{companyName:'REVIEW_BLOCKED'}}});
    const foreign=await call({action:'financial-dre-report',year:2026,month:10,obraId:foreignWork});
    const dre=await call({action:'financial-company-dre-report',year:2026,month:10});
    return {write:{status:write.status,error:write.body.error},foreign:{status:foreign.status,code:foreign.body.code},dre:{status:dre.status,total:dre.body.current?.totalCSP}};
  },arcd.works[0].id);
  expect(checks.write.status).toBe(403);expect(checks.write.error).toContain('Revisão local');expect(checks.foreign.status).toBe(403);expect(checks.dre.status).toBe(200);
  expect((await load()).companyName).toBe(mrc.companyName);
  await page.screenshot({path:testInfo.outputPath('mrc-data-copy.png'),fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});await expect(company).toHaveValue('mrc',{timeout:60000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
