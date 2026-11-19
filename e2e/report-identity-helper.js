import {expect} from '@playwright/test';
export async function confirmReportIdentity(page){
 const dialog=page.getByRole('dialog',{name:'Identidade do relatório',exact:true});
 await expect(dialog.getByRole('img',{name:'Logomarca MARCELL',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Gerar relatório',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'Gerar relatório',exact:true}).click();
}
