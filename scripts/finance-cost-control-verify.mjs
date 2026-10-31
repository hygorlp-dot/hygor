import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';

const user={id:'cost-qa',nome:'Financeiro QA',role:'admin',email:'cost@local.test',active:true};
const fixture={usuarios:[user],config:{paymentHolidays:[]},employees:[],attendance:{},obras:[{id:'a',name:'Obra Alfa QA',status:'active',startDate:'2026-10-01'}],
 budgetBaselines:[{obraId:'a',tipo:'controle',ativo:true,budgetId:'budget'}],
 orcamentos:[{id:'budget',obraId:'a',nome:'Controle QA',etapas:[{id:'s',nome:'Estrutura'},{id:'p',nome:'Pintura'}],itens:[{id:'i',etapaId:'s',descricao:'Concreto usinado',quantidade:1,precoUnit:1000},{id:'j',etapaId:'p',descricao:'Pintura paredes',quantidade:1,precoUnit:200}]}],
 notasFiscais:[{id:'nf',obraId:'a',descricao:'Concreto usinado',numero:'123',tipo:'nfe',emissao:'2026-10-01',competencia:'2026-10',valorBruto:400,valorLiquido:400,status:'aprovada',documentos:[{id:'doc',nome:'Nota original',url:'https://example.com/nota.pdf'}],pagamentos:[{id:'pg',data:'2026-10-02',valor:100}]}],
 outrasDesp:[{id:'d',obraId:'a',descricao:'Pintura paredes',data:'2026-10-01',valor:50,etapaId:'p'}]};
const browser=await chromium.launch({headless:true}),passed=[],errors=[];
await mkdir('artifacts/financeiro',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});let data=structuredClone(fixture),writes=0,rejectNext=true;
 page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
 await page.route('**/api/**',route=>{
  let body={};try{body=route.request().postDataJSON()||{};}catch{}
  if(body.action==='operational-command'){
   writes++;const command={...body.command,now:'2026-10-30T15:00:00Z'};
   if(rejectNext){command.expectedVersion++;rejectNext=false;}
   const result=applyOperationalCommand(data,command);console.log(width,command.type,result.ok,result.reason||'');if(result.ok)data=result.data;
   return route.fulfill({status:result.ok?200:409,json:{...result,error:result.reason,updatedAt:'2026-10-30T15:00:01Z'}});
  }
  return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated',refreshToken:'isolated',usuario:user,data:structuredClone(data),updatedAt:'2026-10-30T15:00:00Z'}});
 });
 const enter=async()=>{
  await page.goto(process.argv[2]||'http://127.0.0.1:4190');
  await expect(page.locator('#login-email').or(page.getByRole('button',{name:width<1100?'Abrir Financeiro':'Financeiro ›',exact:true})).first()).toBeVisible({timeout:20000});
  if(await page.locator('#login-email').isVisible()){await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();}
  if(width<1100){const target=page.locator('.mobile-subnav').getByRole('button',{name:'Gestão financeira',exact:true});if(!await target.isVisible())await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();await target.click();}
  else{const target=page.getByRole('button',{name:'Gestão financeira',exact:true});if(!await target.isVisible())await page.getByRole('button',{name:'Financeiro ›',exact:true}).click();await target.click();}
  await page.getByRole('navigation',{name:'Áreas do financeiro'}).getByRole('button',{name:'Custos por etapa',exact:true}).click();
 };
 await enter();const control=page.locator('.cost-control');
 await control.locator('summary').first().click();
 await expect(control.getByText('1 custo(s) · R$ 400,00', {exact:false})).toBeVisible();
 await expect(control.getByRole('combobox',{name:'Etapa para NFE 123'})).toHaveValue('s');
 await control.getByLabel('Justificativa da apropriação',{exact:true}).fill('Conferido com projeto e documento original');
 await control.getByRole('button',{name:'Ver origem e documentos',exact:true}).click();
 await expect(page.getByRole('dialog').locator('a[href="https://example.com/nota.pdf"]').first()).toBeVisible();
 await page.getByRole('button',{name:'Consultar na central de documentos',exact:true}).click();
 await page.getByRole('button',{name:'Voltar ao memorial de origem',exact:true}).click();await page.keyboard.press('Escape');
 await expect(control.getByLabel('Justificativa da apropriação',{exact:true})).toHaveValue('Conferido com projeto e documento original');expect(writes).toBe(0);
 passed.push(`${width}: sugestão explicada e rascunho preservado no memorial e documentos, sem gravação automática`);
 await control.getByRole('button',{name:'Confirmar apropriação',exact:true}).click();
 await expect(control.getByRole('alert')).toContainText('alterado por outra pessoa');
 await expect(control.getByLabel('Justificativa da apropriação',{exact:true})).toHaveValue('Conferido com projeto e documento original');
 await control.getByRole('button',{name:'Confirmar apropriação',exact:true}).click();
 await expect(control.getByText('Nenhum custo incorrido pendente neste recorte.',{exact:true})).toBeVisible();
 expect(data.notasFiscais[0].rateios[0].etapaId).toBe('s');expect(data.notasFiscais[0].pagamentos[0].valor).toBe(100);
 await expect(page.getByRole('button',{name:/^Obra Alfa QA, estrutura: Incorrido$/i})).toContainText('400,00');
 passed.push(`${width}: conflito visível, confirmação individual, totais e pagamento preservados`);
 await control.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('300');
 await control.getByLabel('Premissas da previsão',{exact:true}).fill('Saldo físico conferido com equipe da obra');
 await expect(control.locator('.cost-control__result')).toContainText('R$ 700,00');expect(writes).toBe(2);
 await page.screenshot({animations:'disabled',path:`artifacts/financeiro/custos-conferencia-${width}.png`});
 await control.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect(page.getByRole('button',{name:/^Obra Alfa QA, estrutura: Custo final estimado$/i})).toContainText('700,00');
 await expect(control.getByText('Previsão revisada em uso',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:/^Obra Alfa QA, estrutura: Custo final estimado$/i}).click();
 await expect(page.getByRole('dialog').getByText(/Previsão revisada por Financeiro QA/)).toBeVisible();await page.keyboard.press('Escape');
 expect(data.obras[0].costPlanning.history).toHaveLength(1);expect(writes).toBe(3);
 passed.push(`${width}: previsão auditada, cálculo incorrido + restante e premissas no memorial`);
 await control.locator('summary').first().click();
 if(width<700)expect(await page.locator('.work-stage-costs').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.locator('.work-stage-costs').screenshot({animations:'disabled',path:`artifacts/financeiro/custos-etapas-${width}.png`});
 data.outrasDesp.push({id:'new',obraId:'a',descricao:'Custo posterior',data:'2026-10-30',valor:50,etapaId:'s'});
 await enter();await control.locator('summary').first().click();
 await expect(control.getByText(/Revisão anterior precisa de reconferência/)).toBeVisible();
 await expect(page.getByRole('button',{name:/^Obra Alfa QA, estrutura: Custo final estimado$/i})).toContainText('1.000,00');
 passed.push(`${width}: fontes alteradas exigem reconferência, histórico preservado e referência automática restaurada`);
 await page.close();
}expect(errors).toEqual([]);await writeFile('artifacts/financeiro/custos-browser.json',JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors},null,2));}finally{await browser.close();}
