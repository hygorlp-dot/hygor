import {test,expect} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
const root='artifacts/batch-trash-demo';
for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({isMobile:width<600,hasTouch:width<600});
 test('seleção explícita, confirmação única, falha parcial, recarga e retomada segura',async({page})=>{
  await page.setViewportSize({width,height:844});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'arquivos'),profile.id);
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  const names=[width,width+1].map(n=>`Documento para excluir ${n}.pdf`),blocked=`Documento para excluir ${width+2}.pdf`;
  const before=JSON.parse(await readFile(`${root}/demo-state.json`,'utf8')),cabinet=before.workFileCabinets[0],docs=cabinet.documents.filter(d=>names.includes(d.name)),fileNames=docs.flatMap(d=>d.revisions.map(r=>`${r.itemId}.bin`));
  await expect(page.getByRole('checkbox',{name:`Selecionar ${blocked}`,exact:true})).toBeDisabled();
  await page.getByRole('button',{name:names[0],exact:true}).click();await expect(page.getByRole('checkbox',{name:`Selecionar ${names[0]}`,exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Fechar detalhes',exact:true}).click();
  await page.getByRole('checkbox',{name:`Selecionar ${names[0]}`,exact:true}).check();
  await page.getByRole('searchbox',{name:'Buscar documentos em toda a obra'}).fill('sem resultado');await expect(page.getByRole('button',{name:/Excluir selecionados/})).toHaveCount(0);
  await page.getByRole('searchbox',{name:'Buscar documentos em toda a obra'}).fill('');
  await page.getByRole('checkbox',{name:'Selecionar disponíveis',exact:true}).check();await expect(page.getByRole('checkbox',{name:`Selecionar ${blocked}`,exact:true})).not.toBeChecked();
  await page.getByRole('button',{name:'Limpar seleção',exact:true}).click();
  for(const name of names){const checkbox=page.getByRole('checkbox',{name:`Selecionar ${name}`,exact:true});if(width===390){const box=await checkbox.locator('..').boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked();}

  await page.getByRole('button',{name:'Excluir selecionados (2)',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Excluir documentos selecionados?',exact:true});await expect(dialog).toContainText('2 documentos · 4 revisões');for(const name of names)await expect(dialog).toContainText(name);
  let calls=0;await page.route('**/api/microsoft/onedrive',async route=>{if(route.request().postDataJSON()?.action!=='trash-document')return route.continue();calls++;if(calls===1){await route.fetch();return route.fulfill({status:503,json:{error:'Resposta perdida na conexão.'}});}return route.continue();});
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();expect(calls).toBe(0);await expect(page.getByRole('button',{name:'Excluir selecionados (2)',exact:true})).toBeFocused();
  await page.screenshot({path:`artifacts/batch-trash-selection-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Excluir selecionados (2)',exact:true}).click();await expect(dialog).toHaveCSS('opacity','1');
  const button=dialog.getByRole('button',{name:'Excluir 2 documentos',exact:true});if(width===390)expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:`artifacts/batch-trash-confirm-${width}.png`,animations:'disabled'});await button.click();
  dialog=page.getByRole('dialog',{name:'Resultado da exclusão',exact:true});await expect(dialog).toContainText('1 excluído. 1 não concluído.');await expect(dialog).toContainText('Resposta perdida');expect(calls).toBe(2);
  expect((await readdir(`${root}/trash`)).filter(n=>fileNames.includes(n))).toHaveLength(4);
  await page.screenshot({path:`artifacts/batch-trash-partial-${width}.png`,animations:'disabled'});
  if(width===1440){await dialog.getByRole('button',{name:'Tentar os não concluídos',exact:true}).click();await expect(dialog).toContainText('2 excluídos. 0 não concluídos.');expect(calls).toBe(3);await dialog.getByRole('button',{name:'Fechar',exact:true}).last().click();}
  else {
  await dialog.getByRole('button',{name:'Fechar',exact:true}).last().click();
  await page.reload();await page.getByRole('checkbox',{name:`Selecionar ${names[0]}`,exact:true}).check();await expect(page.getByRole('button',{name:names[1],exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Excluir selecionados (1)',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Excluir 1 documento',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Resultado da exclusão',exact:true});await expect(dialog).toContainText('1 excluído. 0 não concluídos.');expect(calls).toBe(3);await dialog.getByRole('button',{name:'Fechar',exact:true}).last().click();
  }
  await page.reload();await expect(page.getByRole('button',{name:'Memorial descritivo · Exemplo fictício',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:blocked,exact:true})).toBeVisible();for(const name of names)await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  await page.getByText('Histórico de organização da obra',{exact:true}).click();
  for(const name of names)await expect(page.getByText(`Documento excluído: ${name}`,{exact:false})).toBeVisible();
  const after=JSON.parse(await readFile(`${root}/demo-state.json`,'utf8')),final=after.workFileCabinets[0];expect(final.folders).toEqual(cabinet.folders);expect(final.history.slice(0,cabinet.history.length)).toEqual(cabinet.history);
  for(const doc of docs){const removed=final.documents.find(d=>d.id===doc.id);expect(removed.deletedAt).toBeTruthy();expect(removed.revisions).toEqual(doc.revisions);expect(final.history.filter(e=>e.type==='ARQUIVOS_EXCLUSAO_CONCLUIDA'&&e.detail.includes(doc.name))).toHaveLength(1);}
  expect(final.documents.filter(d=>!docs.some(old=>old.id===d.id))).toEqual(cabinet.documents.filter(d=>!docs.some(old=>old.id===d.id)));
  const {workFileCabinets:_b,operationalCommandReceipts:_r,...businessBefore}=before,{workFileCabinets:_a,operationalCommandReceipts:_s,...businessAfter}=after;expect(businessAfter).toEqual(businessBefore);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 });
});
