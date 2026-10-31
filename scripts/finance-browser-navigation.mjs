export async function openFinanceModule(page,label='Gestão financeira'){
 if(page.viewportSize().width<1100){
  const oldTarget=page.locator('.mobile-subnav').getByRole('button',{name:label,exact:true});
  const moduleSelect=page.getByRole('combobox',{name:'Telas de Financeiro',exact:true});
  if(!await oldTarget.isVisible()&&!await moduleSelect.isVisible())await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();
  if(await moduleSelect.isVisible())await moduleSelect.selectOption({label});else await oldTarget.click();
 }else{
  const target=page.getByRole('button',{name:label,exact:true});
  if(!await target.isVisible())await page.getByRole('button',{name:'Financeiro ›',exact:true}).click();
  await target.click();
 }
}
export async function selectFinanceArea(page,label){
 const select=page.getByRole('combobox',{name:'Áreas do financeiro',exact:true});
 if(await select.isVisible())await select.selectOption({label});
 else await page.getByRole('navigation',{name:'Áreas do financeiro'}).getByRole('button',{name:label,exact:true}).click();
}
export async function selectFinanceQueue(page,id,label){
 const select=page.getByRole('combobox',{name:'Fila de vencimentos',exact:true});
 if(await select.isVisible())await select.selectOption(id);
 else await page.getByRole('button',{name:new RegExp(`^${label} ·`)}).click();
}
export async function revealFinanceControl(control){
 for(let attempt=0;attempt<4&&!await control.isVisible();attempt++){
  const summaries=await control.locator('xpath=ancestor::details[not(@open)]/summary').all();
  let opened=false;
  for(const summary of summaries)if(await summary.isVisible()){await summary.click();opened=true;break;}
  if(!opened)throw new Error('O controle financeiro não está disponível para interação.');
 }
}
