import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page,tab,{many=false,readonly=false,reject=0}={}){
 const account={...profile,...(readonly?{role:"visualizador",accessTabs:["home","cmp","fin"]}:{})};
 let data=structuredClone(fixture),writes=[],errors=[];data.usuarios=[account];data.condominios=[];data.orcamentos=[];
 const a=data.obras[0].id,b=data.obras[1].id;data.obras[0].name='Obra Alfa P2';data.obras[1].name='Obra Beta P2';
 const request=data.solicitacoesCompra[0];data.solicitacoesCompra=[{...request,id:'req-a',numero:'SC-A',obraId:a,status:'enviada',necessidade:'2026-10-30',itens:[{...request.itens[0],descricaoRef:'Cimento Alfa'}]},{...request,id:'req-b',numero:'SC-B',obraId:b,status:'enviada',necessidade:'2026-11-04',itens:[{...request.itens[0],descricaoRef:'Cimento Beta'}]}];data.cotacoes=[];data.pedidos=[{...data.pedidos[0],id:'order-a',numero:'PC-A',obraId:a,status:'enviado'}];
 if(many)for(let i=3;i<30;i++)data.solicitacoesCompra.push({...data.solicitacoesCompra[0],id:`req-${i}`,numero:`SC-${i}`});
 data.pedidos[0].itens[0]={...data.pedidos[0].itens[0],qtd:10,qtdRecebida:2,precoUnit:25};data.pedidos[0].pagamentos=[{id:'old',valor:20,tipo:'adiantamento',data:'2026-10-20',origem:'empresa'}];
 const dates=['2026-10-31','2026-11-01','2026-11-02','2026-11-08','2026-11-09',''];
 data.notasFiscais=dates.map((vencimento,i)=>({id:`nf-p2-${i}`,obraId:a,numero:`NF-P2-${i}`,status:'aprovada',emissao:'2026-10-01',valorBruto:100,vencimento,pagamentos:i===0?[{id:'partial',data:'2026-10-20',valor:30}]:[]}));
 data.notasFiscais[0].pedidoId='order-a';
 data.medicoes=dates.map((dataVencimento,i)=>({id:`med-p2-${i}`,obraId:a,descricao:`Cliente P2 ${i}`,dataEmissao:'2026-10-01',dataVencimento,valorPrevisto:200,recebimentos:[]}));
 for(const key of ['outrasDesp','despesasEmpresa','medicoesTerc','titulosFolha','payments','rescisoes','caixaObra'])data[key]=[];
 await page.clock.setFixedTime(new Date('2026-11-01T15:00:00Z'));await page.addInitScript(({id,tab})=>sessionStorage.setItem(`arcd-section:${id}`,tab),{id:profile.id,tab});
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));await page.route('**/api/data',async r=>{const body=r.request().postDataJSON()||{};
 if(body.action==='operational-command'){
  writes.push(body.command);
  if(reject===503)await new Promise(resolve=>setTimeout(resolve,350));
  if([401,403,409].includes(reject))return r.fulfill({status:reject,json:{ok:false,error:reject===401?'Sua sessão expirou. Entre novamente antes de confirmar.':reject===409?'O pedido foi alterado por outra pessoa. Confira a versão atual.':'Seu acesso foi revogado. Os dados não foram gravados.'}});
  const result=applyOperationalCommand(data,{...body.command,actorRole:account.role},'2026-11-01T15:00:00Z');
  if(!result.ok)return r.fulfill({status:400,json:{ok:false,error:result.reason||result.error}});
  data=result.data;
  if(writes.length===1&&reject===503)return r.fulfill({status:503,json:{ok:false,error:'A resposta se perdeu. Mantenha a ficha aberta.'}});
  return r.fulfill({json:{...result,updatedAt:'2026-11-01T15:00:00Z'}});
 }
 return r.fulfill({json:{ok:true,usuarios:[account],usuario:account,data,precisaSetup:false,accessToken:'local',refreshToken:'local',updatedAt:'2026-11-01T15:00:00Z'}});
 });
 if(process.env.MARCELL_P3_STRESS){await page.route('**/fonts/**',r=>r.abort());await page.addInitScript(()=>window.addEventListener('DOMContentLoaded',()=>{if(innerWidth>1000)document.documentElement.style.fontSize='200%';}));}
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return {a,b,writes,getData:()=>data,check:()=>{expect(errors).toEqual([]);}};
}


async function capture(page,info,name){
 const panel=page.getByRole('dialog').last();expect(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({animations:'disabled',path:info.outputPath(name)});
}
test('Parciais: pedido, pagamento antecipado e saldo financeiro ficam explícitos',async({page},info)=>{
 const app=await enter(page,'cmp');await page.getByRole('button',{name:'Consultar PC-A',exact:true}).click();const panel=page.locator('.mrc-record-panel');await expect(panel).toContainText('Pagamento parcial');await expect(panel).toContainText('Saldo a pagar');await expect(panel).toContainText('R$ 230,00');await expect(panel).toContainText('1 adiantamento registrado');await capture(page,info,'parcial.png');app.check();expect(app.writes).toHaveLength(0);
});
test('Recebimento: resposta perdida e nova tentativa geram uma única entrada parcial',async({page},info)=>{
 const app=await enter(page,'cmp',{reject:503});await page.getByRole('button',{name:'Receber materiais · PC-A',exact:true}).click();const modal=page.getByRole('dialog').last(),input=modal.getByLabel(/Chegou agora/).first();await input.fill('3');await modal.getByRole('button',{name:'Dar entrada no estoque',exact:true}).click();await expect(modal).toContainText('Sem confirmação do servidor');await expect(input).toBeDisabled();await capture(page,info,'recebimento-sem-confirmacao.png');await modal.getByRole('button',{name:'Dar entrada no estoque',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().pedidos[0].itens[0].qtdRecebida).toBe(5);expect(app.getData().movEstoque.filter(x=>x.pedidoId==='order-a')).toHaveLength(1);app.check();
});
test('Pagamento: adiantamento e recuperação da resposta não duplicam a baixa',async({page},info)=>{
 const app=await enter(page,'cmp',{reject:503});if(page.viewportSize().width<768)await page.getByRole('combobox',{name:'Fluxo de compras',exact:true}).selectOption('financeiro');else await page.getByRole('button',{name:'Pagamentos',exact:true}).click();await page.getByRole('button',{name:'Registrar pagamento',exact:true}).first().click();const modal=page.getByRole('dialog').last();await modal.getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toContainText('Compras · Registrar pagamento');await page.keyboard.press('Escape');await modal.getByLabel('Valor pago *',{exact:true}).fill('100');await expect(modal).toContainText('Este valor será registrado como adiantamento');await modal.getByLabel('Motivo do adiantamento (recomendado)',{exact:true}).fill('Sinal para reservar material');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await page.keyboard.press('Escape');await expect(modal).toBeVisible();await expect(modal).toContainText('Sem confirmação do servidor');await expect(modal.getByLabel('Valor pago *',{exact:true})).toBeDisabled();await capture(page,info,'pagamento-sem-confirmacao.png');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().pedidos[0].pagamentos).toHaveLength(2);expect(app.getData().pedidos[0].pagamentos.at(-1).tipo).toBe('adiantamento');app.check();
});
for(const status of [401,403,409])test(`Rejeição ${status}: mantém quantidades e permite revisão`,async({page})=>{
 const app=await enter(page,'cmp',{reject:status});await page.getByRole('button',{name:'Receber materiais · PC-A',exact:true}).click();const modal=page.getByRole('dialog').last(),input=modal.getByLabel(/Chegou agora/).first();await input.fill('3');await modal.getByRole('button',{name:'Dar entrada no estoque',exact:true}).click();await expect(modal).toContainText(status===401?'Sua sessão expirou':status===409?'O pedido foi alterado':'Seu acesso foi revogado');await expect(input).toHaveValue('3');await expect(input).toBeEnabled();expect(app.getData().pedidos[0].itens[0].qtdRecebida).toBe(2);app.check();
});
test('Consulta restrita: ficha acessível sem oferecer recebimento ou revisão financeira',async({page})=>{
 const app=await enter(page,'cmp',{readonly:true});await page.getByRole('button',{name:'Consultar PC-A',exact:true}).click();await expect(page.locator('.mrc-record-panel')).toContainText('Seu perfil permite somente consultar esta etapa');await expect(page.locator('.mrc-record-panel').getByRole('button',{name:'Receber materiais',exact:true})).toHaveCount(0);app.check();expect(app.writes).toHaveLength(0);
});

test('Financeiro restrito: valor original, liquidado e saldo sem ação operacional',async({page},info)=>{
 const app=await enter(page,'fin',{readonly:true});await page.locator('.finance-today__table tbody tr').first().getByRole('button',{name:/^Consultar/}).click();const panel=page.locator('.mrc-record-panel');await expect(panel).toContainText('Valor original');await expect(panel).toContainText('Liquidado');await expect(panel).toContainText('Há pagamento no pedido ainda sem vínculo com a nota');await expect(panel).toContainText('R$ 30,00');await expect(panel).toContainText('R$ 70,00');await expect(panel.getByRole('button',{name:'Conferir documento',exact:true})).toHaveCount(0);await capture(page,info,'financeiro-restrito-parcial.png');app.check();
});

test('Financeiro: resposta perdida preserva a operação e a próxima confirmação não duplica pagamento',async({page},info)=>{
 const app=await enter(page,'fin',{reject:503});if(page.viewportSize().width<768)await page.getByRole('combobox',{name:'Áreas do financeiro',exact:true}).selectOption('pagamentos');else await page.getByRole('navigation',{name:'Áreas do financeiro'}).getByRole('button',{name:'Pagamentos',exact:true}).click();
 await page.getByLabel('Pesquisar pagamentos',{exact:true}).fill('NF-P2-0');await page.locator('.payment-workspace article').getByRole('button',{name:'Registrar pagamento',exact:true}).click();const modal=page.getByRole('dialog').last();await expect(modal).toContainText('Há pagamento no pedido ainda sem vínculo');await modal.getByLabel('Valor pago *',{exact:true}).fill('10');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await page.keyboard.press('Escape');await expect(modal).toBeVisible();await expect(modal).toContainText('Sem confirmação do servidor');await expect(modal.getByLabel('Valor pago *',{exact:true})).toBeDisabled();await capture(page,info,'financeiro-reenvio.png');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().notasFiscais[0].pagamentos).toHaveLength(2);app.check();
});
