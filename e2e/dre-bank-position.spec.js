import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {projectDataForUser} from '../server/data-projection.js';

const movement=(id,valor,data='2026-11-17',contaBancariaId='a')=>({id,descricao:id,valor,data,contaBancariaId,status:'conciliado'});

for(const width of [390,1440])for(const theme of ['marcell','noite'])test.describe(`${width} px · ${theme}`,()=>{
  test.use({viewport:{width,height:width===390?844:1000},hasTouch:width===390,isMobile:width===390});
  test('confere saldo, troca de recorte e abre a conciliação sem gravar',async({page},info)=>{
    const user={...profile,role:theme==='noite'?'financeiro':'admin'};
    const data={...structuredClone(fixture),usuarios:[user],contasBancarias:[{id:'a',nome:'Conta corrente'},{id:'b',nome:'Conta reserva',ativa:false}],
      transacoes:[movement('Aporte exemplo',4999.19),movement('PIX de cliente',300),movement('Pagamento exemplo',-200),movement('Movimento fora do mês',900,'2026-10-31'),movement('Entrada em outra conta',50,'2026-11-17','b')],
      caixaObra:[{id:'aporte',tipo:'aporte',transacaoId:'Aporte exemplo',naturezaEntrada:'aporte_socio',valor:4999.19,efeitoDRE:'sem_efeito'}],
      fechamentosBancarios:[{id:'close',status:'fechado',contaBancariaId:'a',dataInicio:'2026-11-01',dataFim:'2026-11-19',saldoInicialCentavos:100000,
        creditosCentavos:529919,debitosCentavos:20000,saldoCalculadoCentavos:609919,saldoBancoCentavos:609919}]};
    const reads=['auth-login','auth-refresh','profiles','load','obras-custo-acumulado'];
    const writes=[],errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-19T12:00:00-03:00'));
    await page.addInitScript(({id,theme})=>{
      sessionStorage.setItem(`arcd-section:${id}`,'dre_emp');
      localStorage.setItem('arcd-theme',theme);
    },{id:user.id,theme});
    await page.route('https://**/*',route=>route.abort());
    await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],bases:[],obras:{}}}));
    await page.route('**/api/data',route=>{
      const request=route.request().postDataJSON()||{};
      if(request.action==='financial-company-dre-report')return route.fulfill({json:{ok:true,source:'canonical_ledger',current:{faturamentoTotal:3100,receitaLiquida:3000,ebitda:800,lucroLiquido:700}}});
      if(!reads.includes(request.action)){writes.push(request.action);return route.fulfill({status:403,json:{error:'Gravação bloqueada no teste local.'}});}
      return route.fulfill({json:{ok:true,usuario:user,usuarios:[user],data:projectDataForUser(data,user),precisaSetup:false,accessToken:'local-test',refreshToken:'local-test',updatedAt:'2026-11-19T15:00:00Z'}});
    });
    await page.goto('/');
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-senha').fill('somente-local');
    await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();

    const bank=page.getByRole('region',{name:'Saldo em conta'});
    const account=bank.getByRole('combobox',{name:'Conta bancária'});
    const month=page.getByRole('combobox',{name:'Mês',exact:true});
    const figures=bank.locator('dd');
    const kpis=page.locator('.dre-company-kpis');
    await expect(bank).toContainText('01/11/2026 a 19/11/2026');
    await expect(figures).toHaveText([/1\.000,00/,/5\.299,19/,/4\.999,19/,/200,00/,/6\.099,19/]);
    await expect(bank).toContainText('Saldo final conferido');
    await expect(kpis).toContainText('700,00');
    await bank.evaluate(section=>section.scrollIntoView({block:'center',behavior:'instant'}));
    await bank.screenshot({path:info.outputPath('saldo-em-conta.png'),animations:'disabled'});
    await account.selectOption('b');
    await expect(figures).toHaveText(['Indisponível',/50,00/,/0,00/,/0,00/,'Indisponível']);
    await expect(kpis).toContainText('700,00');
    await account.selectOption('a');
    await month.selectOption('9');
    await expect(bank).toContainText('01/10/2026 a 31/10/2026');
    await expect(figures).toHaveText(['Indisponível',/900,00/,/0,00/,/0,00/,'Indisponível']);
    await month.selectOption('11');
    await expect(bank).toContainText('Ainda não há movimentação bancária para este mês.');
    await expect(figures).toHaveCount(0);
    await month.selectOption('10');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await bank.getByRole('button',{name:'Abrir Conciliação'}).click();
    await expect(page.getByRole('heading',{name:'Conciliação Bancária'})).toBeVisible();
    await expect(page.getByRole('combobox',{name:'Conta da fila'})).toHaveValue('a');
    await expect(page.getByText('Origem: Conta corrente · 01/11/2026 a 19/11/2026 · Automação pausada')).toBeVisible();
    await expect(page.getByText('Aporte exemplo',{exact:true})).toBeVisible();
    await expect(page.getByText('Movimento fora do mês',{exact:true})).toHaveCount(0);
    await expect(page.getByText('Entrada em outra conta',{exact:true})).toHaveCount(0);
    await page.getByRole('navigation',{name:'Retornar ao contexto anterior'}).getByRole('button').click();
    await expect(account).toHaveValue('a');
    await expect(month).toHaveValue('10');
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
});
