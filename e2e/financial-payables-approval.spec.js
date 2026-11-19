import {test,expect} from '@playwright/test';
import {openFinanceModule,selectFinanceArea} from '../scripts/finance-browser-navigation.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {validateOperationalCommandScope} from '../server/operational-command-policy.js';

const approver={id:'approver',nome:'Fiscal QA',email:'fiscal@local.test',role:'financeiro',active:true};
const payer={id:'payer',nome:'Financeiro QA',email:'pagamentos@local.test',role:'financeiro',active:true};
const date='2026-11-19';
const now=date+'T15:00:00Z';
const receipt='https://files.example.test/comprovante.pdf';
const entry={
 id:'note',tipo:'nfe',numero:'NF-QA-05',obraId:'work',status:'recebida',emissao:date,vencimento:'2026-11-30',competencia:'2026-11',
 fornecedorNome:'Fornecedor QA',categoria:'material',valorBruto:100,valorLiquido:100,criadoPor:'Compras QA',criadoEm:now,
 pagamentos:[],documentos:[{id:'original',nome:'Nota original',url:'https://files.example.test/nota.xml'}],rateios:[{id:'r',obraId:'work',valor:100}],
};

for(const [width,theme] of [[390,'marcell'],[390,'noite'],[1440,'marcell'],[1440,'noite']]){
 test(`Contas a pagar · ${width} · ${theme}`,async({browser},info)=>{
  let data={usuarios:[approver,payer],obras:[{id:'work',name:'Obra QA',status:'active'}],notasFiscais:[structuredClone(entry)],config:{},
   transacoes:[{id:'qa-bank',data:date,descricao:'PIX QA',status:'pendente',valor:-40,contaBancariaId:'qa-account'}],
   contasBancarias:[{id:'qa-account',nome:'Conta QA',ativa:true}]};
  const commands=[],writes=[],uploads=[],errors=[];
  async function session(user){
   const context=await browser.newContext({viewport:{width,height:900}});
   const page=await context.newPage();
   await page.clock.setFixedTime(new Date(now));
   await page.addInitScript(theme=>localStorage.setItem('arcd-theme',theme),theme);
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://**/*',route=>route.abort());
   await page.route('https://files.example.test/**',route=>route.fulfill({body:'<NFe>Original QA</NFe>',contentType:'application/xml'}));
   await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
   await page.route('**/api/microsoft/onedrive',route=>{
    const {action}=route.request().postDataJSON()||{};
    if(action==='upload'){
     uploads.push(action);
     return route.fulfill({json:{ok:true,url:receipt,item:{id:'proof-qa',webUrl:receipt,parentReference:{driveId:'drive-qa'}}}});
    }
    return route.fulfill({json:{ok:true,url:receipt}});
   });
   await page.route('**/api/data',route=>{
    const {action,command}=route.request().postDataJSON()||{};
    if(action==='operational-command'){
     const allowed=validateOperationalCommandScope({user,data,command});
     if(!allowed.ok)return route.fulfill({status:403,json:{error:allowed.error}});
     commands.push(command.type);
     const result=applyOperationalCommand(data,{...command,actorId:user.id,actorName:user.nome,actorRole:user.role},now);
     if(result.ok)data=result.data;
     return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:now}});
    }
    if(['save','save-sections','financial-command','reconciliation-command'].includes(action)){writes.push(action);return route.fulfill({status:403,json:{ok:false}});}
    return route.fulfill({json:{ok:true,data,usuario:user,usuarios:[user],accessToken:'qa-local',refreshToken:'qa-local',updatedAt:now}});
   });
   await page.goto('/');
   await page.locator('#login-email').fill(user.email);
   await page.locator('#login-senha').fill('isolado');
   await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
   await openFinanceModule(page);
   return {context,page};
  }
  const fiscal=await session(approver);
  await selectFinanceArea(fiscal.page,'Notas fiscais');
  await fiscal.page.getByRole('button',{name:'Concluir conferência fiscal',exact:true}).click();
  await expect.poll(()=>data.notasFiscais[0].aprovadoPor).toBe(approver.nome);
  await fiscal.context.close();
  const {context,page}=await session(payer);
  await selectFinanceArea(page,'Pagamentos');
  const card=page.getByRole('article').filter({hasText:'NF-QA-05'});
  await expect(card).toContainText('Autorizada a pagar');
  await card.getByRole('button',{name:'Registrar pagamento',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Valor pago *',{exact:true}).fill('40');
  await dialog.getByLabel('Vincular à transação bancária (opcional)',{exact:true}).selectOption('qa-bank');
  await dialog.locator('input[type=file]').setInputFiles({name:'Comprovante QA.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA')});
  await expect(dialog.getByText(/Saldo após esta baixa/)).toContainText('60,00');
  await expect(dialog.getByText(/ficará associado à baixa/)).toBeVisible();
  await page.screenshot({path:info.outputPath('baixa-parcial.png'),animations:'disabled'});
  await dialog.getByRole('button',{name:'Registrar pagamento',exact:true}).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText('Pagamento parcial');
  await expect(card).toContainText('60,00');
  await card.getByText(/Histórico e evidências/).click();
  for(const label of ['Compras QA','Fiscal QA','Financeiro QA','40,00','Movimento vinculado: qa-bank','Comprovante QA.pdf']){
   await expect(card).toContainText(label);
  }
  await expect(card.getByRole('link',{name:'Comprovante QA.pdf'})).toBeVisible();
  await page.screenshot({path:info.outputPath('historico-obrigacao.png'),animations:'disabled'});
  await card.getByRole('button',{name:'Revisar conciliação',exact:true}).click();
  await expect(page.getByText('Conciliação automática pausada',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Retornar ao contexto anterior'}).getByRole('button').click();
  await expect(card).toBeVisible();
  expect(data.transacoes[0].status).toBe('conciliado');
  expect(data.notasFiscais[0].pagamentos).toHaveLength(1);
  expect(commands).toEqual(['NOTA_FISCAL_APROVADA','PAGAMENTO_OBRIGACAO_REGISTRADO']);
  expect(uploads).toEqual(['upload']);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await context.close();
 });
}
