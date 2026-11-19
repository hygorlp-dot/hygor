import {test,expect} from '@playwright/test';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {projectDataForUser} from '../server/data-projection.js';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {BANK_TRANSACTION_COMMAND} from '../src/domains/conciliacao/transaction-commands.js';

const entries=[4000,999.19,-200,-20,-18,-1500,-991,-980,-800];
const date=index=>index===0||index>=7?'2026-11-17':index===1||index>=3?'2026-11-18':'2026-11-19';
const transaction=(value,index)=>({
 id:`tx${index}`,fitid:`qa${index}`,chave:`fit:qa${index}`,data:date(index),valor:value,extratoId:'ofx-qa',
 status:'conciliado',descricao:`Movimento QA ${index+1}`,categoria:value>0?'aporte_socio':'',
});

function fixture(){
 const transacoes=entries.map(transaction);
 const movements=transacoes.map(t=>`<STMTTRN><DTPOSTED>${t.data.replaceAll('-','')}<TRNAMT>${t.valor}<FITID>${t.fitid}<MEMO>${t.descricao}</STMTTRN>`).join('');
 const ofx=Buffer.from(`<OFX><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>777<ACCTID>5550</BANKACCTFROM><BANKTRANLIST><DTSTART>20261020<DTEND>20261119${movements}</BANKTRANLIST><LEDGERBAL><BALAMT>490.19<DTASOF>20261119</LEDGERBAL></STMTRS></OFX>`);
 return {usuarios:[profile],contasBancarias:[{id:'account-qa',banco:'Banco QA',conta:'555-0',nome:'Conta principal QA',ativa:true}],
   extratos:[{id:'ofx-qa',arquivo:'Extrato QA.ofx',banco:'Banco QA',conta:'5550',status:'ativo',qtd:9,dataInicio:'2026-11-17',dataFim:'2026-11-19',
     importManifest:{ids:transacoes.map(row=>row.id)},originalFile:{size:ofx.length,dataUrl:`data:application/octet-stream;base64,${ofx.toString('base64')}`}}],
   transacoes,despesasEmpresa:transacoes.filter(row=>row.valor<0).map(row=>({id:`expense-${row.id}`,data:row.data,categoria:'outros',valor:-row.valor})),
 };
}

for(const [width,theme] of [[390,'marcell'],[390,'noite'],[1440,'marcell'],[1440,'noite']]){
 test(`vínculo e fechamento com OFX existente · ${width} · ${theme}`,async({page},info)=>{
  let data=fixture();
  const writes=[],errors=[];
  await page.setViewportSize({width,height:900});
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-25T12:00:00-03:00'));
  await page.addInitScript(({id,theme})=>{sessionStorage.setItem(`arcd-section:${id}`,'dre_emp');localStorage.setItem('arcd-theme',theme);},{id:profile.id,theme});
  await page.route('https://**/*',route=>route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],bases:[]}}));
  await page.route('**/api/data',route=>{
   const {action,command}=route.request().postDataJSON()||{};
   if(action==='operational-command'){
    writes.push(command?.type);
    if(command?.type!==BANK_TRANSACTION_COMMAND.BANK_STATEMENT_ACCOUNT_LINKED)return route.fulfill({status:403,json:{ok:false}});
    const applied=applyOperationalCommand(data,{...command,actorId:profile.id,actorRole:'admin',actorName:profile.nome,now:'2026-11-25T15:00:00Z'});
    if(!applied.ok)return route.fulfill({status:409,json:applied});
    data=applied.data;
    return route.fulfill({json:{ok:true,data:projectDataForUser(data,profile),summary:applied.summary,updatedAt:'2026-11-25T15:00:01Z'}});
   }
   if(action==='financial-command'){writes.push(action);return route.fulfill({status:403,json:{ok:false}});}
   if(action==='financial-company-dre-report')return route.fulfill({json:{ok:true,source:'canonical_ledger',current:{lucroLiquido:0}}});
   return route.fulfill({json:{ok:true,usuario:profile,usuarios:[profile],data:projectDataForUser(data,profile),accessToken:'local-only',refreshToken:'local-only',updatedAt:'2026-11-25T15:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(profile.email);
  await page.locator('#login-senha').fill('somente-local');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  const bank=page.getByRole('region',{name:'Saldo em conta'});
  await bank.getByRole('button',{name:'Abrir Conciliação'}).click();
  await page.getByText('Mais opções · extratos, regras e histórico',{exact:true}).click();
  if(width===390)await page.locator('details.reconciliation-support').getByRole('combobox',{name:'Selecionar visão'}).selectOption({label:'Extratos · 1'});
  else await page.locator('details.reconciliation-support').getByRole('button',{name:'Extratos · 1'}).click();
  await page.getByRole('button',{name:'Vincular à conta',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Vincular extrato à conta'});
  await expect(dialog).toContainText('9 movimentos importados');
  await expect(dialog).toContainText('20/10/2026 a 19/11/2026');
  await expect(dialog).toContainText('490,19');
  await dialog.getByRole('combobox',{name:'Conta bancária'}).selectOption('account-qa');
  await dialog.screenshot({path:info.outputPath('vinculo-ofx.png')});
  await dialog.getByRole('button',{name:'Confirmar vínculo'}).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:'Voltar a DRE empresa'}).click();
  await expect(bank.getByRole('combobox',{name:'Conta bancária'})).toHaveValue('account-qa');
  await expect(bank).toContainText('Saldo final informado pelo banco no OFX');
  if(width===390){
    await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();
    await page.getByRole('combobox',{name:'Telas de Financeiro',exact:true}).selectOption({label:'Gestão financeira'});
  }else{
    const financial=page.getByRole('button',{name:'Gestão financeira',exact:true});
    if(!await financial.isVisible())await page.getByRole('button',{name:/^Financeiro/}).click();
    await financial.click();
  }
  if(width===390)await page.getByRole('combobox',{name:'Áreas do financeiro'}).selectOption({label:'Fechamento'});
  else {
    await page.getByText('Mais áreas',{exact:true}).click();
    await page.getByRole('button',{name:'Fechamento',exact:true}).click();
  }
  await expect(page.getByRole('button',{name:'Fechar competência',exact:true})).toBeDisabled();
  await expect(page.getByText(/saldo informado pelo banco no último dia da competência/)).toBeVisible();
  await expect(page.getByText(/7 registros sem evidência/)).toBeVisible();
  await page.getByText(/saldo informado pelo banco no último dia da competência/).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('fechamento-bloqueado.png')});
  expect(data.transacoes).toHaveLength(9);
  expect(writes).toEqual([BANK_TRANSACTION_COMMAND.BANK_STATEMENT_ACCOUNT_LINKED]);
  expect(errors).toEqual([]);
 });
}
