import {test,expect} from '@playwright/test';
for(const width of [1440,390])for(const theme of ['marcell','noite','plataforma'])test(`Minha equipe: filtros, cadastro e permissões sem gravação · ${width} · ${theme}`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});
 const user={id:'users-qa',nome:'Administrador QA',email:'admin@local.test',role:'admin',active:true};
 const state={usuarios:[user,{id:'e',nome:'Engenheira QA',email:'engenheira@local.test',role:'engenheiro',active:true,obraId:'work',accessTabs:['home','obras','ponto']},{id:'inactive',nome:'Membro Inativo QA',email:'inativo@local.test',role:'compras',active:false,accessTabs:['home','compras']}],obras:[{id:'work',name:'Obra QA',status:'active'}],config:{paymentHolidays:[]},employees:[],attendance:{}};
 const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(theme=>{
  localStorage.setItem('arcd-theme',theme);
  sessionStorage.setItem('arcd-section:users-qa',theme==='plataforma'?'admin_central':'config');
 },theme);
 await page.route('https://**/*',r=>r.abort());await page.route('**/api/**',r=>{const b=r.request().postDataJSON()||{};if(['save','save-sections','operational-command','auth-provision-user','auth-set-pin'].includes(b.action))writes.push(b.action);return r.fulfill({json:b.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,usuario:user,data:structuredClone(state),accessToken:'qa',refreshToken:'qa',presencas:[],items:[],bases:[],updatedAt:'2026-11-01T12:00:00Z'}});});
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:/Acessar central/}).click();
 if(theme==='plataforma'){
  const area=page.getByRole('region',{name:'Áreas da administração',exact:true});
  await expect(area).toBeVisible();
  const menu=area.getByRole('combobox',{name:'Áreas da administração',exact:true});
  if(await menu.isVisible())await menu.selectOption('usuarios');
  else await area.getByRole('button',{name:'Usuários e permissões',exact:true}).click();
 }else if(width===390){
  await page.locator('summary').filter({hasText:/^Usuários e permissões$/}).click();
 }
 const directory=page.getByRole('region',{name:'Minha equipe MARCELL',exact:true});await expect(directory).toBeVisible({timeout:20000});
 if(theme==='plataforma'){
  await page.getByRole('button',{name:'Ajuda',exact:true}).click();
  await expect(page.getByText(/Em Minha equipe, use Restrição por obra/)).toBeVisible();
  await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 }
 const workScope=directory.getByLabel('Restrição por obra',{exact:true});
 await workScope.selectOption('work:work');
 await expect(directory.locator('tbody tr')).toHaveCount(1);
 await expect(directory.getByRole('button',{name:'Engenheira QA',exact:true})).toBeVisible();
 await workScope.selectOption('unrestricted');
 await expect(directory.locator('tbody tr')).toHaveCount(2);
 await expect(directory.getByRole('button',{name:'Engenheira QA',exact:true})).toHaveCount(0);
 await workScope.selectOption('');
 await directory.getByLabel('Buscar membro').fill('Engenheira');await expect(directory.locator('tbody tr')).toHaveCount(1);await directory.getByRole('button',{name:'Engenheira QA',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('tab',{name:'Dados do membro'})).toHaveAttribute('aria-selected','true');await expect(dialog.getByLabel('Nome completo *',{exact:true})).toHaveValue('Engenheira QA');
 await dialog.screenshot({path:info.outputPath('cadastro.png')});
 await dialog.getByRole('tab',{name:'Permissões de acesso'}).click();await expect(dialog).toContainText('ACESSOS DESTE USUÁRIO');await expect(dialog.getByRole('checkbox',{name:'Obras',exact:true})).toBeChecked();
 await dialog.getByRole('tab',{name:'Dados do membro'}).click();await expect(dialog.getByLabel('Nome completo *',{exact:true})).toHaveValue('Engenheira QA');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 await directory.getByLabel('Buscar membro').fill('');await directory.getByLabel('Situação do membro').selectOption('inactive');await expect(directory.locator('tbody tr')).toHaveCount(1);await expect(directory).toContainText('Membro Inativo QA');await directory.getByLabel('Situação do membro').selectOption('all');
 await directory.getByRole('button',{name:'Adicionar membro'}).click();await expect(dialog.getByLabel('Nome completo *',{exact:true})).toHaveValue('');await dialog.getByRole('tab',{name:'Permissões de acesso'}).click();await expect(dialog).toContainText('Dashboard é liberado automaticamente');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);if(width===390){await expect(directory.locator('thead')).toBeHidden();expect((await directory.locator('tbody tr').first().locator('td').first().boundingBox()).width).toBeGreaterThan(200);const member=await directory.locator('.user-directory__member').first().boundingBox(),cell=await directory.locator('tbody tr').first().locator('td').first().boundingBox();expect(member.y+member.height).toBeLessThanOrEqual(cell.y);}await directory.scrollIntoViewIfNeeded();await directory.screenshot({path:info.outputPath('equipe.png')});expect(writes).toEqual([]);expect(errors).toEqual([]);
});
