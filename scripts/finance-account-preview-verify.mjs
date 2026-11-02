import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const user={id:'preview-qa',nome:'QA',email:'preview@local.test',role:'admin',active:true};
const data={usuarios:[user],obras:[],employees:[],attendance:{},config:{},contasBancarias:[],
 extratos:[{id:'s',banco:'Banco Intermedium S/A',conta:'000009896',arquivo:'Extrato QA.ofx',dataInicio:'2026-07-01',dataFim:'2026-07-03',status:'arquivado'}],
 transacoes:[{id:'t1',extratoId:'s',data:'2026-07-01',valor:100,status:'pendente',descricao:'Entrada QA'},{id:'t2',extratoId:'s',data:'2026-07-02',valor:-20,status:'conciliado',descricao:'Pagamento QA'},{id:'t3',extratoId:'s',data:'2026-07-02',valor:-5,status:'ignorado',descricao:'Tarifa QA'},{id:'t4',extratoId:'s',data:'2026-07-03',valor:-10,status:'pendente',descricao:'Saída QA'}]};
const before=JSON.stringify(data),output='artifacts/financeiro/previa-conta';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});let writes=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());await page.route('http://127.0.0.1:4203/**',route=>route.abort());
 await page.route('**/api/**',route=>{const body=route.request().postDataJSON()||{};
  if(['save','save-sections','financial-command','operational-command'].includes(body.action))writes++;
  return route.fulfill({json:body.action==='status'?{ok:true,connected:true,localReview:true,readOnly:true}:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated-preview',refreshToken:'isolated-preview',usuario:user,data:structuredClone(data),updatedAt:new Date().toISOString()}});
 });
 await page.goto('http://127.0.0.1:4192/?local-review=account-cash&account-preview=9896');
 await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 const preview=page.getByRole('region',{name:'Prévia local da conta final 9896'});
 await expect(preview.getByRole('heading',{name:'Prévia local · conta final 9896',exact:true})).toBeVisible({timeout:15000});
 const position=preview.locator('.account-cash');
 for(const label of ['Saldo de abertura da conta (R$)','Data de abertura','Data de referência do caixa'])await expect(position.getByLabel(label,{exact:true})).toHaveValue('');
 await expect(position.getByText('Posição ainda não calculada',{exact:true})).toBeVisible();
 await preview.getByText('Identificação e campos não confirmados',{exact:true}).click();
 for(const label of ['Agência','Titular','CPF/CNPJ do titular','Tipo de conta','Situação da conta','Chave PIX'])await expect(preview.getByLabel(label,{exact:true})).toHaveValue('');
 await expect(preview.getByLabel('Conta de origem',{exact:true})).toHaveValue('000009896');
 await preview.getByText('Identificação e campos não confirmados',{exact:true}).click();
 await preview.getByRole('button',{name:'Pendentes na prévia: 2',exact:true}).click();const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('Entrada QA');await expect(dialog).toContainText('Saída QA');await expect(dialog).toContainText('Prévia local, não aplicada');await expect(dialog).not.toContainText('Tarifa QA');await page.keyboard.press('Escape');
 await preview.getByRole('button',{name:'Ignorados na prévia: 1',exact:true}).click();await expect(dialog).toContainText('Tarifa QA');await page.keyboard.press('Escape');
 await position.getByLabel('Saldo de abertura da conta (R$)',{exact:true}).fill('100');await position.getByLabel('Data de abertura',{exact:true}).fill('2026-07-01');await position.getByLabel('Data de referência do caixa',{exact:true}).fill('2026-07-03');
 await expect(position.getByText(/Posição calculada: R\$\s165,00/)).toBeVisible();
 await expect(page.getByLabel('Saldo inicial da simulação (R$)',{exact:true})).toHaveValue('');
 await preview.getByRole('button',{name:'Limpar saldo e datas da prévia',exact:true}).click();
 await expect(position.getByText('Posição ainda não calculada',{exact:true})).toBeVisible();
 await position.scrollIntoViewIfNeeded();await position.screenshot({path:`${output}/campos-em-branco-${width}.png`});
 await preview.getByRole('heading',{name:'Prévia local · conta final 9896',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/previa-${width}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('http://127.0.0.1:4192/?local-review=account-cash');
 await expect(page.getByText(/Nenhuma conta bancária está cadastrada na base carregada/)).toBeVisible({timeout:15000});
 await expect(page.locator('.local-account-preview')).toHaveCount(0);expect(writes).toBe(0);expect(JSON.stringify(data)).toBe(before);
 checks.push({width,unknownFieldsBlank:true,memorialWorks:true,simulationCleared:true,basePreserved:true,writes});await page.close();
}expect(errors).toEqual([]);await writeFile(`${output}/verificacao.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));}finally{await browser.close();}
