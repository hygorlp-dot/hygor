import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';
import {readFile} from 'node:fs/promises';
import {validateNoPhysicalDeletes} from '../server/section-authorizations.js';
import {buildFinancialLedger,selectDRE} from '../src/domains/financeiro/ledger.js';
import {budgetStageLevel} from '../src/domains/orcamentos/tree.js';

async function setup(page){
 const user={id:'budget-local',nome:'Engenharia local',email:'budget@local.test',role:'engenheiro',obraId:'w',active:true};
 let state={config:{},usuarios:[user],obras:[{id:'w',name:'Obra seis níveis',status:'active'}],employees:[],attendance:{},
 orcamentos:[{id:'b',obraId:'w',nome:'Orçamento seis níveis',status:'rascunho',versionStatus:'rascunho',fonte:'SINAPI',bdi:10,
 etapas:Array.from({length:5},(_,i)=>({id:'s'+i,nome:'Etapa '+(i+1),parentId:i?'s'+(i-1):''})),itens:[{id:'i',etapaId:'s4',descricao:'Serviço original',unidade:'M2',quantidade:2,precoUnit:100}]}],
 baseFavoritos:[{id:'ref',codigo:'10',descricao:'Serviço da base',unidade:'M2',fonte:'SINAPI',precoUnit:100,precoDesonerado:100,precoNaoDesonerado:100}],
 outrasDesp:[{id:'cost',obraId:'w',data:'2026-11-01',valor:80,etapaId:'s4'}]};
 const errors=[],writes=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Erro no navegador isolado:',e.message);});
 await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[]}}));
 await page.route('**/api/data',async route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(['save','save-sections'].includes(body.action)){
   let next={...state,...(body.sections||body.payload||{})};
   for(const [key,delta] of Object.entries(body.sectionDeltas||{})){
    const removed=new Set(delta.removed||[]),changes=new Map((delta.changed||[]).map(row=>[row.id,row]));
    next[key]=(state[key]||[]).filter(row=>!removed.has(row.id)&&!changes.has(row.id)).concat([...changes.values()]);
   }
   const error=validateNoPhysicalDeletes(state,next);if(error)return route.fulfill({status:403,json:{error}});
   writes.push(body);state=JSON.parse(JSON.stringify(next));
  }
  return route.fulfill({json:{ok:true,usuario:user,data:state,accessToken:'local-budget-token',refreshToken:'local-budget-refresh',updatedAt:new Date().toISOString()}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('local-test');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
 const open=async()=>{await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill('Orçamento');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Orçamento'}).first().click();
  if(await page.getByRole('button',{name:'Abrir',exact:true}).count())await page.getByRole('button',{name:'Abrir',exact:true}).first().click();
  await expect(page.locator('#budget-stage-s4')).toBeVisible();};
 await open();return {state:()=>state,writes,errors,open};
}
async function menu(page,code,action){await page.getByRole('button',{name:'Mais ações da etapa '+code,exact:true}).click();await page.getByRole('menuitem',{name:action,exact:true}).click();}
async function tools(page){const summary=page.locator('summary').filter({hasText:'Análises e ferramentas'});if(!await summary.locator('..').evaluate(el=>el.open))await summary.click();await page.getByRole('button',{name:'Ferramentas do orçamento',exact:true}).click();}
async function spreadsheet(page,invalid=false){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Orçamento');sheet.addRow(['Tipo','Ordem','Código','Descrição','Unidade','Quantidade','Preço']);
 for(let i=0;i<6;i++)sheet.addRow([i?'Nível '+(i+1):'Nível',Array(i+1).fill('1').join('.'),'','Importada '+(i+1),'','','']);
 sheet.addRow(['Serviço',invalid?'9.1':'1.1.1.1.1.1.1','10','Origem da planilha','M2',3,100]);
 const bytes=await book.xlsx.writeBuffer();await page.getByRole('button',{name:'Importar planilha',exact:true}).first().locator('..').locator('input[type=file]').setInputFiles({name:'seis-niveis.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
 const map=page.getByRole('dialog',{name:'Onde está cada coluna?'});await expect(map).toBeVisible();await expect(map.getByRole('combobox',{name:'Numeração da etapa',exact:true})).toHaveValue('1');await map.getByRole('button',{name:'Confirmar e continuar',exact:true}).click();
 return page.getByRole('dialog',{name:'Conferir importação'});
}
test('cria sexto nível, preserva vínculos e DRE, move, recarrega e exporta numeração completa',async({page},info)=>{
 const app=await setup(page),dre=selectDRE(buildFinancialLedger(app.state()));
 await menu(page,'1.1.1.1.1','Criar subnível');const modal=page.getByRole('dialog',{name:'Novo subnível'});await expect(modal).toContainText('Será o nível 6 de 6');
 await modal.getByLabel('Nome da etapa *').fill('Sexto nível — acabamento de origem');
 await page.screenshot({path:info.outputPath('nivel-seis-formulario.png'),animations:'disabled'});
 await modal.getByRole('button',{name:'Ajuda da hierarquia'}).click();const help=page.getByRole('complementary',{name:'Central de ajuda'});await expect(help).toContainText('Hierarquia de seis níveis');await help.getByRole('button',{name:'Fechar ajuda'}).click();
 await modal.getByRole('button',{name:'Salvar',exact:true}).click();await expect(modal).toHaveCount(0);await expect.poll(()=>app.state().orcamentos[0].etapas.length).toBe(6);
 const stage=app.state().orcamentos[0].etapas.find(s=>!['s0','s1','s2','s3','s4'].includes(s.id));expect(budgetStageLevel(app.state().orcamentos[0].etapas,stage.id)).toBe(6);
 await page.locator('#budget-stage-'+stage.id).scrollIntoViewIfNeeded();await page.locator('.budget-sheet').evaluate(el=>{el.scrollLeft=0;});await page.screenshot({path:info.outputPath('nivel-seis-arvore.png'),animations:'disabled'});
 await page.getByRole('button',{name:'Mais ações da etapa 1.1.1.1.1.1',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Criar subnível',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await menu(page,'1.1.1.1.1.1','Editar nome e posição');const edit=page.getByRole('dialog',{name:'Editar etapa e posição'});await edit.getByLabel('Etapa superior').selectOption('s3');await edit.getByRole('button',{name:'Salvar',exact:true}).click();await expect(edit).toHaveCount(0);
 await expect.poll(()=>app.state().orcamentos[0].etapas.find(s=>s.id===stage.id).parentId).toBe('s3');expect(app.state().orcamentos[0].itens[0]).toMatchObject({id:'i',etapaId:'s4',quantidade:2,precoUnit:100});expect(selectDRE(buildFinancialLedger(app.state()))).toEqual(dre);
 await page.reload();await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();await app.open();await expect(page.locator('#budget-stage-'+stage.id)).toContainText(stage.nome);
 await page.locator('#budget-stage-'+stage.id).scrollIntoViewIfNeeded();await page.locator('.budget-sheet').evaluate(el=>{el.scrollLeft=0;});await page.screenshot({path:info.outputPath('nivel-seis-movida.png'),animations:'disabled'});expect(app.errors).toEqual([]);
});
test('importa seis níveis, confere hierarquia, bloqueia origem divergente e conserva o DRE',async({page},info)=>{
 const app=await setup(page),dre=selectDRE(buildFinancialLedger(app.state()));await tools(page);
 const preview=await spreadsheet(page);await expect(preview).toContainText('Nível 6 · 1.1.1.1.1.1 · Importada 6');
 const pending=preview.getByRole('checkbox',{name:'Importar também as linhas com pendência'});await pending.focus();await page.keyboard.press('Space');await expect(pending).not.toBeChecked();await page.keyboard.press('Space');await expect(pending).toBeChecked();
 await page.screenshot({path:info.outputPath('nivel-seis-importacao.png'),animations:'disabled'});await preview.getByRole('button',{name:'Importar',exact:true}).click();await expect(preview).toHaveCount(0);
 await expect.poll(()=>app.state().orcamentos[0].itens.length).toBe(2);const b=app.state().orcamentos[0],item=b.itens.find(i=>i.id!=='i');expect(budgetStageLevel(b.etapas,item.etapaId)).toBe(6);expect(item).toMatchObject({descricao:'SERVIÇO DA BASE',unidade:'M2',quantidade:3,precoUnit:100});expect(selectDRE(buildFinancialLedger(app.state()))).toEqual(dre);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Excel padrão',exact:true}).first().click();const download=await downloaded,book=new ExcelJS.Workbook();await book.xlsx.load(await readFile(await download.path()));const values=[];book.worksheets[0].eachRow(row=>values.push(row.values));expect(values.some(row=>row.includes('Nível 6'))).toBe(true);expect(values.some(row=>row.includes('2.1.1.1.1.1.1'))).toBe(true);
 const writes=app.writes.length,blocked=await spreadsheet(page,true);await expect(blocked.getByRole('alert')).toContainText('não pertence à etapa numerada anterior');await expect(blocked.getByRole('button',{name:'Importar',exact:true})).toBeDisabled();await blocked.getByRole('alert').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('nivel-seis-revisao.png'),animations:'disabled'});expect(app.writes.length).toBe(writes);expect(app.errors).toEqual([]);
});
