import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {projectDataForUser} from '../server/data-projection.js';

for(const width of [390,1440])for(const theme of ['marcell','noite'])test.describe(`${width} px · ${theme}`,()=>{
 test.use({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
 test('mostra o saldo do OFX sem cadastrar conta nem reimportar',async({page},info)=>{
  const user={...profile,role:theme==='noite'?'financeiro':'admin'};
  const ofx=Buffer.from('<OFX><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>777<ACCTID>TEST</BANKACCTFROM><BANKTRANLIST><DTSTART>20261020<DTEND>20261119<STMTTRN><DTPOSTED>20261117<TRNAMT>4999.19<FITID>in<MEMO>Aporte fictício</STMTTRN><STMTTRN><DTPOSTED>20261119<TRNAMT>-4509<FITID>out<MEMO>Saída fictícia</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>490.19<DTASOF>20261119</LEDGERBAL></STMTRS></OFX>');
  const data={...structuredClone(fixture),usuarios:[user],contasBancarias:width===1440?[{id:'new-account',nome:'Conta recém-cadastrada'}]:[],fechamentosBancarios:[],
   extratos:[{id:'file',arquivo:'test.ofx',conta:'TEST',status:'ativo',originalFile:{size:ofx.length,dataUrl:`data:application/octet-stream;base64,${ofx.toString('base64')}`}}],
   transacoes:[{id:'in',chave:'fit:in',extratoId:'file',data:'2026-11-17',valor:4999.19,status:'conciliado',descricao:'Aporte fictício'},{id:'out',chave:'fit:out',extratoId:'file',data:'2026-11-19',valor:-4509,status:'conciliado',descricao:'Saída fictícia'}],
   caixaObra:[{id:'funding',transacaoId:'in',naturezaEntrada:'aporte_socio',valor:4999.19,tipo:'aporte',efeitoDRE:'sem_efeito'}]};
  const writes=[];
  await page.clock.setFixedTime(new Date('2026-11-25T12:00:00-03:00'));
  await page.addInitScript(({id,theme})=>{sessionStorage.setItem(`arcd-section:${id}`,'dre_emp');localStorage.setItem('arcd-theme',theme);},{id:user.id,theme});
  await page.route('https://**/*',route=>route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],bases:[],obras:{}}}));
  await page.route('**/api/data',route=>{
   const {action}=route.request().postDataJSON()||{};
   if(action==='financial-company-dre-report')return route.fulfill({json:{ok:true,source:'canonical_ledger',current:{faturamentoTotal:0,receitaLiquida:0,ebitda:0,lucroLiquido:0}}});
   if(!['auth-login','auth-refresh','profiles','load','obras-custo-acumulado'].includes(action)){writes.push(action);return route.fulfill({status:403,json:{ok:false}});}
   return route.fulfill({json:{ok:true,usuario:user,usuarios:[user],data:projectDataForUser(data,user),accessToken:'local-qa',refreshToken:'local-qa',updatedAt:'2026-11-25T15:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-senha').fill('somente-local');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  const bank=page.getByRole('region',{name:'Saldo em conta'});
  await expect(bank.getByRole('combobox',{name:'Conta ou extrato'})).toHaveValue('ofx:file');
  await expect(bank.locator('dd')).toHaveText([/0,00/,/4\.999,19/,/4\.999,19/,/4\.509,00/,/490,19/]);
  await expect(bank).toContainText('01/11/2026 a 19/11/2026');
  await expect(bank).toContainText('Saldo final informado pelo banco no OFX');
  await bank.evaluate(section=>section.scrollIntoView({block:'center',behavior:'instant'}));
  await bank.screenshot({path:info.outputPath('saldo-do-ofx.png'),animations:'disabled'});
  if(width===1440){
   const source=bank.getByRole('combobox',{name:'Conta ou extrato'});
   await source.selectOption('new-account');
   await expect(bank.locator('dd').last()).toHaveText('Indisponível');
   await source.selectOption('ofx:file');
   await expect(bank.locator('dd').last()).toContainText('490,19');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await bank.getByRole('button',{name:'Abrir Conciliação'}).click();
  await expect(page.getByRole('combobox',{name:'Conta da fila'})).toHaveValue('unassigned');
  await expect(page.getByText('Aporte fictício',{exact:true})).toBeVisible();
  await expect(page.getByText('Conciliação automática pausada',{exact:true})).toBeVisible();
  expect(writes).toEqual([]);
 });
});
