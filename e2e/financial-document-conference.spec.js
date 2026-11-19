import {test,expect} from '@playwright/test';
import {openFinanceModule,selectFinanceArea} from '../scripts/finance-browser-navigation.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';

const user={id:'qa-documentos',nome:'Financeiro QA',email:'documentos@local.test',role:'admin',active:true};
const date='2026-11-18';
const file='https://files.example.test/nota.xml';
const record={id:'note',numero:'QA-01',emissao:date,obraId:'a',pedidoId:'order',categoria:'material',status:'aprovada',valorBruto:100,valorLiquido:95,chave:'nota-qa',
 retencoes:{iss:5},rateios:[{obraId:'a',valor:100}],documentos:[{id:'xml',nome:'Original QA.xml',url:file}],pagamentos:[{id:'pay',valor:95,data:date,origem:'empresa'}]};
const initial=()=>({
 usuarios:[user],obras:[{id:'a',name:'Obra QA',status:'active'}],config:{},
 notasFiscais:[record,{...record,id:'duplicate',numero:'QA-02',pedidoId:'',emissao:'2026-10-01',documentos:[],rateios:[{obraId:'a',valor:90}],pagamentos:[]}],
 pedidos:[{id:'order',numero:'PC-QA',obraId:'a',status:'recebido',itens:[{id:'i',descricao:'Insumo QA',qtd:2,qtdRecebida:2,precoUnit:50,recebimentos:[{id:'r',data:date,qtd:2}]}]}],
 despesasEmpresa:Array.from({length:7},(_,i)=>({id:`expense-${i+1}`,descricao:`Tarifa QA ${i+1}`,valor:25,categoria:'outros',origem:'banco',transacaoId:`bank-${i+1}`,data:date})),
 transacoes:Array.from({length:7},(_,i)=>({id:`bank-${i+1}`,descricao:i===0?'Pix enviado: "Cp :18236120-M4 SERVIÇOS E COMÉRCIO DO NORDESTE LTDA"':`PIX QA ${i+1}`,data:date,valor:-25,status:'conciliado'})),
});

for(const [width,theme] of [[390,'marcell'],[390,'noite'],[1440,'marcell'],[1440,'noite']]){
 test(`Etapa 4 · documentos e origem bancária · ${width} · ${theme}`,async({page},info)=>{
  const before=structuredClone(initial()),commands=[],writes=[],errors=[];
  let data=structuredClone(before);
  await page.setViewportSize({width,height:900});
  await page.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
  await page.addInitScript(theme=>localStorage.setItem('arcd-theme',theme),theme);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',route=>route.abort());
  await page.route('https://files.example.test/**',route=>route.fulfill({contentType:'text/xml',body:'<NFe>Original QA</NFe>'}));
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],bases:[]}}));
  await page.route('**/api/data',route=>{
   const {action,command}=route.request().postDataJSON()||{};
   if(action==='operational-command'){
    commands.push(command);
    const result=applyOperationalCommand(data,command,'2026-11-19T15:00:01Z');
    if(result.ok)data=result.data;
    return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:'2026-11-19T15:00:01Z'}});
   }
   if(['save','save-sections','financial-command','reconciliation-command'].includes(action)){
    writes.push(action);return route.fulfill({status:409,json:{ok:false}});
   }
   return route.fulfill({json:{ok:true,usuario:user,usuarios:[user],accessToken:'local-fixture',refreshToken:'local-fixture',data,updatedAt:'2026-11-19T15:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-senha').fill('isolado');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  await openFinanceModule(page);
  await selectFinanceArea(page,'Documentos');
  const search=page.getByLabel('Pesquisar documento ou fornecedor',{exact:true});
  await page.getByLabel('Competência ou mês de emissão',{exact:true}).fill('2026-11');
  await search.fill('QA-01');
  await page.getByRole('button',{name:'Conferir documentos',exact:true}).click();
  const aside=page.getByRole('complementary',{name:'Documento e dados para conferência'});
  await expect(aside).toBeFocused();
  await expect(aside).toContainText('PC-QA');
  await expect(aside).toContainText('Pedido, recebimento e notas conferem');
  await expect(aside).toContainText('Originais da nota fiscal');
  await expect(aside).toContainText('Retenções');
  await expect(aside).toContainText('Original QA');
  await aside.getByText('1 recebimento detalhado',{exact:true}).click();
  await expect(aside).toContainText('Insumo QA');
  await aside.screenshot({path:info.outputPath('nota-e-origens.png'),animations:'disabled'});
  await aside.getByRole('button',{name:'Fechar conferência',exact:true}).click();
  await expect(page.getByRole('button',{name:'Conferir documentos',exact:true})).toBeFocused();
  await page.getByLabel('Competência ou mês de emissão',{exact:true}).fill('2026-10');
  await search.fill('QA-02');
  await expect(page.getByRole('article').filter({hasText:'QA-02'}).getByText(/Sem documento.*Possível duplicidade.*Rateio divergente/)).toBeVisible();
  await page.getByLabel('Competência ou mês de emissão',{exact:true}).fill('2026-11');
  await search.fill('');
  const filter=page.getByRole('combobox',{name:'Conferência',exact:true});
  await filter.selectOption('bankEvidence');
  await expect(filter.locator('option:checked')).toHaveText('Despesa bancária sem evidência · 7');
  const expense=page.getByRole('article').filter({hasText:'Tarifa QA 1'});
  await search.fill('m4 servicos');
  await expect(page.getByRole('article').filter({hasText:'Tarifa QA'})).toHaveCount(1);
  await expect(expense.getByText(/Nome no Pix · M4 SERVIÇOS E COMÉRCIO DO NORDESTE LTDA/)).toBeVisible();
  await search.fill('');
  await expense.screenshot({path:info.outputPath('contraparte-pix.png'),animations:'disabled'});
  await expense.getByRole('button',{name:'Conferir documentos',exact:true}).click();
  await expect(aside.getByText('Nome no Pix · M4 SERVIÇOS E COMÉRCIO DO NORDESTE LTDA',{exact:true})).toBeVisible();
  await aside.getByRole('button',{name:'Revisar movimento na Conciliação',exact:true}).click();
  await expect(page.getByText('Conciliação automática pausada',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Voltar a Gestão financeira',exact:true}).click();
  await expect(filter).toHaveValue('bankEvidence');
  await expect(aside).toContainText('Nome no Pix · M4 SERVIÇOS E COMÉRCIO DO NORDESTE LTDA');
  expect(commands).toEqual([]);
  await aside.getByRole('button',{name:'Vincular evidência à despesa',exact:true}).click();
  const editor=page.getByRole('dialog');
  await editor.getByLabel('Nome da referência').fill('Comprovante QA');
  await editor.getByLabel('Endereço do documento').fill(file);
  await editor.getByRole('button',{name:'Adicionar referência',exact:true}).click();
  await editor.getByLabel('Motivo da correção').fill('Comprovante localizado na origem.');
  await editor.getByRole('button',{name:'Salvar correção da origem',exact:true}).click();
  await expect(editor).toBeHidden();
  await expect(filter.locator('option:checked')).toHaveText('Despesa bancária sem evidência · 6');
  expect(commands).toHaveLength(1);
  expect(commands[0].payload.sourceId).toBe('expense-1');
  expect(data.despesasEmpresa.find(item=>item.id==='expense-1').valor).toBe(25);
  expect(data.transacoes).toEqual(before.transacoes);
  expect(data.notasFiscais).toEqual(before.notasFiscais);
  expect(data.pedidos).toEqual(before.pedidos);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:info.outputPath('fila-despesas.png'),animations:'disabled'});
  await page.getByRole('article').filter({hasText:'Tarifa QA 2'}).getByRole('button',{name:'Conferir documentos',exact:true}).click();
  await aside.getByRole('button',{name:'Conferir no fechamento',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Fechamento mensal imutável',exact:true})).toBeVisible();
  await expect(page.getByLabel('Competência',{exact:true})).toHaveValue('2026-11');
  await page.getByRole('button',{name:'Voltar à central de documentos',exact:true}).click();
  await expect(filter).toHaveValue('bankEvidence');
  expect(commands).toHaveLength(1);
  expect(writes).toEqual([]);
 });
}
