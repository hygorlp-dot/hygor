import {test,expect} from '@playwright/test';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page){await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'arquivos'),profile.id);await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('.work-files')).toBeVisible();}
for(const width of [1440,390])test(`lote com falha, retomada e persistência em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));await enter(page);
 const names=[`lote-a-${width}.txt`,`lote-b-${width}.txt`,`lote-c-${width}.txt`];let uploads=0,commands=0;
 await page.route('**/api/microsoft/onedrive',async route=>{const body=route.request().postDataJSON();if(body?.action==='upload'){uploads++;if(uploads===2){await route.fulfill({status:503,json:{error:'Falha simulada no OneDrive'}});return;}}await route.continue();});
 page.on('request',request=>{if(request.url().includes('/api/data')&&request.postData()?.includes('ARQUIVOS_LOTE_ADICIONADO'))commands++;});
 if(width===1440){const transfer=await page.evaluateHandle(names=>{const dt=new DataTransfer();names.forEach(name=>dt.items.add(new File(['exemplo'],name,{type:'text/plain'})));return dt;},names);await page.getByRole('region',{name:'Documentos da obra',exact:true}).dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();}
 else{await page.getByRole('button',{name:'Adicionar arquivos',exact:true}).click();await page.getByLabel('Arquivos do lote',{exact:true}).setInputFiles(names.map(name=>({name,mimeType:'text/plain',buffer:Buffer.from('exemplo')})));}
 const queue=page.getByRole('list',{name:'Lista de arquivos do lote',exact:true});for(const name of names)await expect(queue).toContainText(name);expect(uploads).toBe(0);
 await page.getByRole('button',{name:'Enviar arquivos',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Falha simulada');expect(uploads).toBe(2);expect(commands).toBe(0);
 await page.screenshot({path:`artifacts/files-batch-${width}.png`,fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Enviar arquivos',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Alteração salva.'})).toBeVisible();expect(uploads).toBe(4);expect(commands).toBe(1);
 await page.reload();for(const name of names)await expect(page.getByRole('button',{name,exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Memorial descritivo · Exemplo fictício',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
