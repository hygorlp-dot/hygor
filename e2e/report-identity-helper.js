import {expect} from '@playwright/test';
export async function confirmReportIdentity(page,brand='marcell'){
 const dialog=page.getByRole('dialog',{name:'Identidade do relatório',exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel('Logomarca do relatório',{exact:true}).selectOption(brand);await expect(dialog.getByRole('button',{name:'Gerar relatório',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Gerar relatório',exact:true}).click();
}
