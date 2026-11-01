import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

async function enter(page,tab){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(({tab,user})=>{sessionStorage.setItem(`arcd-section:${user}`,tab);localStorage.setItem('arcd-theme','operacional');},{tab,user:profile.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
 await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'local-modules',refreshToken:'local-modules'}}));
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-modules');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 await expect(page.locator('.arcd-main')).toBeVisible();return errors;
}
test('Projetos: filtros alinhados e abertura do formulário',async({page})=>{
 const errors=await enter(page,'projetos');const filters=page.getByRole('region',{name:'Filtros dos projetos',exact:true});
 await expect(filters.getByRole('combobox')).toHaveCount(4);
 const search=filters.getByLabel('Buscar projetos',{exact:true});await search.fill('ponte');
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();await expect(search).toHaveValue('ponte');
 await page.getByRole('button',{name:'Novo projeto',exact:true}).click();await expect(page.getByRole('form',{name:'Novo projeto',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Nome do projeto *',exact:true})).toBeFocused();
 expect(errors).toEqual([]);
});
test('Arquivos: agrupamento preserva a obra selecionada ao consultar ajuda',async({page})=>{
 const errors=await enter(page,'arquivos');const filters=page.getByRole('region',{name:'Contexto dos arquivos',exact:true});
 const work=filters.getByLabel('Obra dos arquivos',{exact:true});await work.selectOption(data.obras[1].id);
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();await expect(work).toHaveValue(data.obras[1].id);expect(errors).toEqual([]);
});
test('Patrimônio: busca e estado sem resultados mantêm o contexto',async({page})=>{
 const errors=await enter(page,'patrimonio');const filters=page.getByRole('region',{name:'Filtros do patrimônio',exact:true});
 await filters.getByLabel('Buscar',{exact:true}).fill('identificador-inexistente');await expect(page.getByText('Nenhum patrimônio encontrado.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();await expect(filters.getByLabel('Buscar',{exact:true})).toHaveValue('identificador-inexistente');expect(errors).toEqual([]);
});
test('Marcos e Curva A: controles compartilhados mantêm parâmetros e áreas',async({page})=>{
 const errors=await enter(page,'plan_suprimentos');
 await expect(page.getByLabel('Perfil de fornecimento',{exact:true})).toBeVisible();
 const label='Áreas dos suprimentos estratégicos';
 if(page.viewportSize().width<1100)await page.getByRole('combobox',{name:label,exact:true}).selectOption('config');
 else await page.getByRole('navigation',{name:label,exact:true}).getByRole('button',{name:'Configuração',exact:true}).click();
 await expect(page.getByLabel('Limite da classe A (%)',{exact:true})).toHaveAttribute('max','94');await expect(page.getByLabel('Limite da classe B (%)',{exact:true})).toHaveAttribute('max','100');expect(errors).toEqual([]);
});
test('Orçamento: ação explícita abre o formulário sem gravar',async({page})=>{
 const errors=await enter(page,'orc');await page.getByRole('button',{name:'Novo orçamento',exact:true}).click();await expect(page.getByRole('dialog',{name:'Novo orçamento',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(errors).toEqual([]);
});

test('Conciliação: botão de importação abre o seletor pelo teclado',async({page})=>{
 const errors=await enter(page,'conc');const button=page.getByRole('button',{name:'Importar extrato',exact:true});
 await button.focus();const chooser=page.waitForEvent('filechooser');await button.press('Enter');await chooser;
 await expect(button).toBeFocused();expect(errors).toEqual([]);
});

test('Fundamentos: ajustes centrais alcançam título e ação sem editar o módulo',async({page})=>{
 const errors=await enter(page,'cmp');const title=page.getByRole('heading',{name:'Compras',exact:true});const action=page.getByRole('button',{name:'Nova solicitação',exact:true});
 await expect(title).toHaveCSS('font-size','24px');
 await page.evaluate(()=>{
  const root=document.documentElement;
  root.style.setProperty('--arcd-type-page-title','28px');
  root.style.setProperty('--arcd-type-control','16px');
  root.style.setProperty('--arcd-button-weight','600');
 });
 await expect(title).toHaveCSS('font-size','28px');await expect(action).toHaveCSS('font-size','16px');await expect(action).toHaveCSS('font-weight','600');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 expect(errors).toEqual([]);
});
