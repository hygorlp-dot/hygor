import {test,expect} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({isMobile:width<600,hasTouch:width<600});
 test(`exclusão com confirmação, falha e retomada em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'arquivos'),profile.id);
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 const name=`Documento para excluir ${width}.pdf`;await page.getByRole('button',{name,exact:true}).click();
 const doc=JSON.parse(await readFile('artifacts/files-trash-demo/demo-state.json','utf8')).workFileCabinets[0].documents.find(item=>item.id===`demo-trash-${width}`);
 const names=doc.revisions.map(revision=>`${revision.itemId}.bin`);let calls=0;
 await page.route('**/api/microsoft/onedrive',async route=>{
  if(route.request().postDataJSON()?.action!=='trash-document')return route.continue();
  calls++;if(calls===1){await route.fetch();return route.fulfill({status:503,json:{error:'Resposta perdida na conexão. Tente concluir a exclusão.'}});}return route.continue();
 });
 await page.getByRole('button',{name:'Excluir documento',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Excluir documento?',exact:true});await expect(dialog).toContainText(name);await expect(dialog).toContainText('2 revisões');
 if(width===1440){await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Excluir documento',exact:true})).toBeFocused();}else await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();expect(calls).toBe(0);await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Excluir documento',exact:true}).click();
 await expect(dialog).toHaveCSS('opacity','1');
 if(width===390){for(const label of ['Cancelar','Excluir documento']){const box=await dialog.getByRole('button',{name:label,exact:true}).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}}
 await page.screenshot({path:`artifacts/files-trash-confirm-${width}.png`,fullPage:false,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.getByRole('button',{name:'Excluir documento',exact:true}).click();dialog=page.getByRole('dialog',{name:'Concluir exclusão?',exact:true});await expect(dialog.getByRole('alert')).toContainText('Resposta perdida');
 expect((await readdir('artifacts/files-trash-demo/trash')).filter(item=>names.includes(item))).toHaveLength(2);
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByText('Exclusão pendente.',{exact:false}).first()).toBeVisible();
 await page.reload();await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name:'Nova revisão',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Concluir exclusão',exact:true}).click();dialog=page.getByRole('dialog',{name:'Concluir exclusão?',exact:true});
 await dialog.getByRole('button',{name:'Concluir exclusão',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);expect(calls).toBe(2);
 await page.reload();await expect(page.getByRole('button',{name:'Memorial descritivo · Exemplo fictício',exact:true})).toBeVisible();await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 await page.getByText('Histórico de organização da obra',{exact:true}).click();await expect(page.getByText(`Documento excluído: ${name}`,{exact:false})).toBeVisible();
 const current=JSON.parse(await readFile('artifacts/files-trash-demo/demo-state.json','utf8')).workFileCabinets[0];const removed=current.documents.find(item=>item.id===doc.id);expect(removed.deletedAt).toBeTruthy();expect(removed.revisions).toEqual(doc.revisions);expect(current.history.filter(item=>item.type==='ARQUIVOS_EXCLUSAO_CONCLUIDA'&&item.detail.includes(name))).toHaveLength(1);
 expect((await readdir('artifacts/files-trash-demo/trash')).filter(item=>names.includes(item))).toHaveLength(2);expect(errors).toEqual([]);
 await page.screenshot({path:`artifacts/files-trash-done-${width}.png`,fullPage:false,animations:'disabled'});
});

});
