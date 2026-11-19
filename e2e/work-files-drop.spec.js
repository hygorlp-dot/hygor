import {test,expect} from '@playwright/test';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page){await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'arquivos'),profile.id);await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await expect(page.locator('.work-files')).toBeVisible();}
async function drop(page,name,content='Documento de teste local'){const transfer=await page.evaluateHandle(({name,content})=>{const data=new DataTransfer();data.items.add(new File([content],name,{type:'text/plain'}));return data;},{name,content});await page.getByRole('region',{name:'Documentos da obra',exact:true}).dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();}
for(const width of [1440,390])test(`arrastar, confirmar e recuperar documento em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));await enter(page);
 const name=`contrato-arrastado-${width}.txt`;let uploads=0;page.on('request',r=>{if(r.url().includes('/api/microsoft/onedrive')&&r.postDataJSON()?.action==='upload')uploads++;});
 await drop(page,name);await expect(page.getByLabel('Título do documento',{exact:false})).toHaveValue(name);await expect(page.getByRole('button',{name:'Trocar arquivo',exact:true})).toBeVisible();expect(uploads).toBe(0);
 await expect(page.getByLabel('Tipo de documento',{exact:true})).toHaveValue('file');await expect.poll(async()=>{const box=await page.getByLabel('Título do documento',{exact:false}).boundingBox();return box.y+box.height;}).toBeLessThan(820);await page.screenshot({path:`artifacts/files-drop-form-${width}.png`,fullPage:false});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Salvar documento',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Alteração salva.'})).toBeVisible();expect(uploads).toBe(1);
 await page.reload();await expect(page.getByRole('button',{name,exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('modelo completa subpastas sem duplicar e preserva documentos',async({page})=>{
 await enter(page);const complete=page.getByRole('button',{name:'Criar pastas padrão',exact:true});if(await complete.isVisible()){await complete.click();await expect(page.getByRole('status').filter({hasText:'Alteração salva.'})).toBeVisible();}
 const sidebar=page.locator('.work-files-sidebar');await expect(sidebar.getByRole('button',{name:'Projetos de Arquitetura',exact:true})).toHaveCount(1);await expect(sidebar.getByRole('button',{name:'Projetos de Engenharia',exact:true})).toHaveCount(1);
 await page.reload();await expect(sidebar.getByRole('button',{name:'Projetos de Arquitetura',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'contrato-arrastado-1440.txt',exact:true})).toBeVisible();await page.screenshot({path:'artifacts/files-drop-default-folders.png',fullPage:true});
});
