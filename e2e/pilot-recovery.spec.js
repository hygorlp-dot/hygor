import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page,tab,{many=false,readonly=false,reject=0,legacyDraft=false,saveFailure=0,loadFailure=false,reapplyFailure=false}={}){
 const account={...profile,...(readonly?{role:"visualizador",accessTabs:["home","cmp","fin"]}:{})};
 let data=structuredClone(fixture),writes=[],saves=[],errors=[];let blockLoads=loadFailure;data.usuarios=[account];data.condominios=[];data.orcamentos=[];
 const a=data.obras[0].id,b=data.obras[1].id;data.obras[0].name='Obra Alfa P2';data.obras[1].name='Obra Beta P2';
 const request=data.solicitacoesCompra[0];data.solicitacoesCompra=[{...request,id:'req-a',numero:'SC-A',obraId:a,status:'enviada',necessidade:'2026-10-30',itens:[{...request.itens[0],descricaoRef:'Cimento Alfa'}]},{...request,id:'req-b',numero:'SC-B',obraId:b,status:'enviada',necessidade:'2026-11-04',itens:[{...request.itens[0],descricaoRef:'Cimento Beta'}]}];data.cotacoes=[];data.pedidos=[{...data.pedidos[0],id:'order-a',numero:'PC-A',obraId:a,status:'enviado'}];
 if(many)for(let i=3;i<30;i++)data.solicitacoesCompra.push({...data.solicitacoesCompra[0],id:`req-${i}`,numero:`SC-${i}`});
 data.pedidos[0].itens[0]={...data.pedidos[0].itens[0],qtd:10,qtdRecebida:2,precoUnit:25};data.pedidos[0].pagamentos=[{id:'old',valor:20,tipo:'adiantamento',data:'2026-10-20',origem:'empresa'}];
 const dates=['2026-10-31','2026-11-01','2026-11-02','2026-11-08','2026-11-09',''];
 data.notasFiscais=dates.map((vencimento,i)=>({id:`nf-p2-${i}`,obraId:a,numero:`NF-P2-${i}`,status:'aprovada',emissao:'2026-10-01',valorBruto:100,vencimento,pagamentos:i===0?[{id:'partial',data:'2026-10-20',valor:30}]:[]}));
 data.notasFiscais[0].pedidoId='order-a';data.pedidos[0].pagamentos=[{id:'old',valor:80,tipo:'adiantamento',data:'2026-10-20',origem:'empresa',transacaoId:'advance-bank',conciliado:true}];data.transacoes=[{id:'advance-bank',data:'2026-10-20',valor:-80,status:'conciliado'},{id:'ignored-bank',data:'2026-10-20',valor:-10,status:'ignorado',descricao:'Movimento ignorado'},{id:'used-bank',data:'2026-10-20',valor:-10,descricao:'Movimento já vinculado'},{id:'free-bank',data:'2026-10-20',valor:-10,descricao:'Movimento disponível'}];data.notasFiscais[1].pagamentos=[{id:'linked',data:'2026-10-20',valor:10,transacaoId:'used-bank'}];
 data.medicoes=dates.map((dataVencimento,i)=>({id:`med-p2-${i}`,obraId:a,descricao:`Cliente P2 ${i}`,dataEmissao:'2026-10-01',dataVencimento,valorPrevisto:200,recebimentos:[]}));
 for(const key of ['outrasDesp','despesasEmpresa','medicoesTerc','titulosFolha','payments','rescisoes','caixaObra'])data[key]=[];
 await page.clock.setFixedTime(new Date('2026-11-01T15:00:00Z'));await page.addInitScript(({id,tab})=>sessionStorage.setItem(`arcd-section:${id}`,tab),{id:profile.id,tab});
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));await page.route('**/api/data',async r=>{const body=r.request().postDataJSON()||{};
 if(body.action==='auth-refresh'&&saveFailure===401)return r.fulfill({status:401,json:{ok:false,error:'Sessão expirada no ensaio.'}});
 if(body.action==='load'&&saves.length&&blockLoads)return r.fulfill({status:503,json:{ok:false,error:'Leitura indisponível no ensaio.'}});
 if(['save','save-sections'].includes(body.action)){
  saves.push(body);
  if(saveFailure===409&&saves.length===1)return r.fulfill({status:409,json:{ok:false,conflict:true,currentData:data,currentUpdatedAt:'2026-11-01T15:00:30Z'}});
  if(reapplyFailure&&saves.length>1&&saves.length<6)return r.fulfill({status:503,json:{ok:false,error:'Reaplicação indisponível no ensaio.'}});
  if((saveFailure===401||saves.length<=(saveFailure===503?4:1))&&saveFailure)return r.fulfill({status:saveFailure,json:{ok:false,error:saveFailure===401?'Sessão expirada no ensaio.':saveFailure===403?'Seu acesso foi revogado.':'Servidor indisponível no ensaio.'}});
  await new Promise(resolve=>setTimeout(resolve,350));
  return r.fulfill({json:{ok:true,updatedAt:'2026-11-01T15:01:00Z'}});
 }
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
 await page.goto('/');if(legacyDraft)await page.evaluate(async({owner,obraId})=>{await new Promise((resolve,reject)=>{const request=indexedDB.open('marcell-confirmations-v1',10);request.onupgradeneeded=()=>{const table=request.result.createObjectStore('records',{keyPath:'key'});table.createIndex('owner','owner');table.createIndex('kind','kind');};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put({key:JSON.stringify(['draft',owner,'nota','nf-p2-0']),owner,kind:'draft',type:'nota',id:'nf-p2-0',createdAt:'2026-11-01T15:00:00Z',context:{pageId:'fin',obraId,label:'Pagamento · NF-P2-0'},value:{valor:'12.34',data:'2026-11-01',origem:'empresa',referencia:'Versão anterior',observacao:'Conferir documento',comprovanteFile:new File(['%PDF-1.4 preservado'],'legado.pdf',{type:'application/pdf'})}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},{owner:profile.id,obraId:a});await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return {a,b,writes,saves,allowLoads:()=>{blockLoads=false;},account,getData:()=>data,check:()=>{expect(errors).toEqual([]);}};
}



const financePayments=async page=>{if(page.viewportSize().width<768)await page.getByRole('combobox',{name:'Áreas do financeiro',exact:true}).selectOption('pagamentos');else await page.getByRole('navigation',{name:'Áreas do financeiro'}).getByRole('button',{name:'Pagamentos',exact:true}).click();await page.getByLabel('Pesquisar pagamentos',{exact:true}).fill('NF-P2-0');await page.locator('.payment-workspace article').getByRole('button',{name:'Registrar pagamento',exact:true}).click();};
test('P5 rascunho de pagamento reaparece após recarga e não grava ao ser reaberto',async({page},info)=>{
 const app=await enter(page,'cmp');if(page.viewportSize().width<768)await page.getByRole('combobox',{name:'Fluxo de compras',exact:true}).selectOption('financeiro');else await page.getByRole('button',{name:'Pagamentos',exact:true}).click();await page.getByRole('button',{name:'Registrar pagamento',exact:true}).first().click();const modal=page.getByRole('dialog').last();await modal.getByLabel('Valor pago *',{exact:true}).fill('41.50');await modal.getByLabel('Observação',{exact:true}).fill('Rascunho para conferir amanhã');await expect(modal).toContainText('Rascunho salvo neste navegador.');
 await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await page.getByRole('dialog',{name:'Rascunhos e confirmações'}).getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toContainText('Não é backup');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Reabrir rascunho',exact:true}).click();const restored=page.getByRole('dialog').last();await expect(restored.getByLabel('Valor pago *',{exact:true})).toHaveValue('41.50');await expect(restored.getByLabel('Observação',{exact:true})).toHaveValue('Rascunho para conferir amanhã');expect(app.writes).toHaveLength(0);expect(await restored.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('rascunho-recuperado.png')});
});
test('P5 resposta perdida é retomada depois de recarregar com o mesmo comando',async({page},info)=>{
 const app=await enter(page,'fin',{reject:503});await financePayments(page);const modal=page.getByRole('dialog').last();await modal.getByLabel('Valor pago *',{exact:true}).fill('10');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(modal).toContainText('Sem confirmação do servidor');expect(app.writes).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await expect(page.getByRole('button',{name:'Reabrir rascunho',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Retomar confirmação',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rascunhos e confirmações'})).toContainText('Operação confirmada');expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().notasFiscais[0].pagamentos).toHaveLength(2);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('confirmacao-recuperada.png')});
});
test('P5 aloca parcialmente e desfaz sem gerar nova saída de caixa',async({page},info)=>{
 const app=await enter(page,'fin');await page.locator('.finance-today__table tbody tr').first().getByRole('button',{name:/^Consultar/}).click();await page.locator('.mrc-record-panel').getByRole('button',{name:'Alocar adiantamento',exact:true}).click();let modal=page.getByRole('dialog').last();await modal.getByLabel('Valor a alocar',{exact:true}).fill('20');await modal.getByRole('button',{name:'Alocar adiantamento',exact:true}).click();await expect(page.locator('.mrc-payment-dialog')).toHaveCount(0);expect(app.getData().notasFiscais[0].pagamentos).toHaveLength(2);expect(app.getData().pedidos[0].pagamentos).toHaveLength(1);expect(app.getData().notasFiscais[0].pagamentos.at(-1)).toMatchObject({pedidoPagamentoId:'old',valor:20});
 await page.locator('.mrc-record-panel').getByRole('button',{name:'Alocar adiantamento',exact:true}).click();modal=page.getByRole('dialog').last();await modal.getByRole('button',{name:'Desfazer alocação',exact:true}).click();await modal.getByLabel('Motivo para desfazer a alocação',{exact:true}).fill('Revisar a nota de destino');await modal.getByRole('button',{name:'Confirmar desfazer alocação',exact:true}).click();await expect(page.locator('.mrc-payment-dialog')).toHaveCount(0);expect(app.getData().notasFiscais[0].pagamentos.at(-1).status).toBe('estornado');expect(app.getData().pedidos[0].pagamentos[0].status).not.toBe('estornado');app.check();await page.screenshot({animations:'disabled',path:info.outputPath('alocacao-desfeita.png')});
});

test('P5 recebimento sem resposta sobrevive à recarga com uma única entrada no estoque',async({page})=>{
 const app=await enter(page,'cmp',{reject:503});await page.getByRole('button',{name:'Receber materiais · PC-A',exact:true}).click();const modal=page.getByRole('dialog').last();await modal.getByLabel(/Chegou agora/).first().fill('3');await modal.getByRole('button',{name:'Dar entrada no estoque',exact:true}).click();await expect(modal).toContainText('Sem confirmação do servidor');await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await page.getByRole('button',{name:'Retomar confirmação',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rascunhos e confirmações'})).toContainText('Operação confirmada');expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().pedidos[0].itens[0].qtdRecebida).toBe(5);expect(app.getData().movEstoque.filter(x=>x.pedidoId==='order-a')).toHaveLength(1);app.check();
});
test('P5 alocação sem resposta impede novo pagamento e retoma após recarga',async({page},info)=>{
 const app=await enter(page,'fin',{reject:503});await financePayments(page);const modal=page.getByRole('dialog').last();await modal.getByLabel('Valor a alocar',{exact:true}).fill('20');await modal.getByRole('button',{name:'Alocar adiantamento',exact:true}).click();await expect(modal).toContainText('Sem confirmação do servidor');await expect(modal.getByRole('button',{name:'Registrar pagamento',exact:true})).toBeDisabled();await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();const manager=page.getByRole('dialog',{name:'Rascunhos e confirmações'});await expect(manager.getByRole('button',{name:'Fechar',exact:true})).toBeInViewport();expect(await manager.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);await page.screenshot({animations:'disabled',path:info.outputPath('alocacao-pendente.png')});await page.getByRole('button',{name:'Retomar confirmação',exact:true}).click();await expect(manager).toContainText('Operação confirmada');expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().notasFiscais[0].pagamentos.filter(p=>p.pedidoPagamentoId)).toHaveLength(1);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('alocacao-recuperada.png')});
});
test('P5 comprovante selecionado é recuperado sem envio e pode ser removido',async({page})=>{
 const app=await enter(page,'fin');await financePayments(page);let modal=page.getByRole('dialog').last();await modal.locator('input[type=file]').setInputFiles({name:'comprovante-local.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 local')});await expect(modal).toContainText('Rascunho salvo neste navegador.');await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await page.getByRole('button',{name:'Reabrir rascunho',exact:true}).click();modal=page.getByRole('dialog').last();await expect(modal).toContainText('comprovante-local.pdf');await modal.getByRole('button',{name:'Remover comprovante',exact:true}).click();await expect(modal).not.toContainText('comprovante-local.pdf');expect(app.writes).toHaveLength(0);app.check();
});
test('P5 armazenamento bloqueado impede envio e orienta recuperação',async({page},info)=>{
 await page.addInitScript(()=>{Object.defineProperty(IDBFactory.prototype,'open',{value(){throw new DOMException('blocked','SecurityError');}});});const app=await enter(page,'fin');await financePayments(page);const modal=page.getByRole('dialog').last();await expect(modal).toContainText('Armazenamento local indisponível');await expect(modal.getByRole('button',{name:'Registrar pagamento',exact:true})).toBeDisabled();expect(app.writes).toHaveLength(0);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('armazenamento-bloqueado.png')});
});

test('P5 formulário oferece somente transações livres para novo pagamento',async({page})=>{const app=await enter(page,'fin');await financePayments(page);const options=await page.getByRole('dialog').last().getByLabel('Vincular à transação bancária (opcional)',{exact:true}).locator('option').allTextContents();expect(options.join(' ')).toContain('Movimento disponível');expect(options.join(' ')).not.toContain('Movimento ignorado');expect(options.join(' ')).not.toContain('Movimento já vinculado');expect(app.writes).toHaveLength(0);app.check();});

test('P5 perda do perfil operacional bloqueia retomada sem descartar a confirmação',async({page})=>{const app=await enter(page,'fin',{reject:503});await financePayments(page);const modal=page.getByRole('dialog').last();await modal.getByLabel('Valor pago *',{exact:true}).fill('10');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(modal).toContainText('Sem confirmação do servidor');app.account.role='visualizador';app.account.accessTabs=['home','cmp','fin'];await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();const manager=page.getByRole('dialog',{name:'Rascunhos e confirmações'});await expect(manager.getByRole('button',{name:'Retomar confirmação',exact:true})).toBeDisabled();await expect(manager).toContainText('Confira o registro e as permissões');expect(app.writes).toHaveLength(1);app.check();});

async function savedNoteDraft(page){const app=await enter(page,'fin');await financePayments(page);await page.getByRole('dialog').last().getByLabel('Valor pago *',{exact:true}).fill('10');await expect(page.getByRole('dialog').last()).toContainText('Rascunho salvo neste navegador.');return app;}
test('P5 crítica: retomada respeita a obra atual e bloqueia o acesso antigo',async({page},info)=>{const app=await savedNoteDraft(page);app.getData().notasFiscais[0].obraId=app.b;app.account.role='financeiro';app.account.obraId=app.a;app.getData().usuarios=[app.account];await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();const manager=page.getByRole('dialog',{name:'Rascunhos e confirmações'});await expect(manager.getByRole('button',{name:'Reabrir rascunho',exact:true})).toBeDisabled();await expect(manager).not.toContainText('Obra Beta P2');expect(app.writes).toHaveLength(0);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('obra-restrita.png')});});
test('P5 crítica: consulta administrativa usa a obra atual do registro salvo',async({page},info)=>{const app=await savedNoteDraft(page);app.getData().notasFiscais[0].obraId=app.b;await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();const manager=page.getByRole('dialog',{name:'Rascunhos e confirmações'});await expect(manager).toContainText('Obra Beta P2');await expect(manager).not.toContainText('Obra Alfa P2');expect(app.writes).toHaveLength(0);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('obra-atual.png')});});
test('P5 crítica: registro ausente mantém o rascunho sem oferecer retomada inválida',async({page},info)=>{const app=await savedNoteDraft(page);app.getData().notasFiscais=app.getData().notasFiscais.filter(n=>n.id!=='nf-p2-0');await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();const manager=page.getByRole('dialog',{name:'Rascunhos e confirmações'});await expect(manager.getByRole('button',{name:'Reabrir rascunho',exact:true})).toBeDisabled();await expect(manager).toContainText('Registro indisponível');expect(app.writes).toHaveLength(0);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('registro-ausente.png')});});

test('P5 crítica: confirmação bloqueada por mudança de obra volta com a mesma identidade',async({page},info)=>{const app=await enter(page,'fin',{reject:503});await financePayments(page);const modal=page.getByRole('dialog').last();await modal.getByLabel('Valor pago *',{exact:true}).fill('10');await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(modal).toContainText('Sem confirmação do servidor');app.getData().notasFiscais[0].obraId=app.b;app.account.role='financeiro';app.account.obraId=app.a;app.getData().usuarios=[app.account];await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rascunhos e confirmações'}).getByRole('button',{name:'Retomar confirmação',exact:true})).toBeDisabled();expect(app.writes).toHaveLength(1);app.getData().notasFiscais[0].obraId=app.a;await page.reload();await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await page.getByRole('button',{name:'Retomar confirmação',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rascunhos e confirmações'})).toContainText('Operação confirmada');expect(app.writes).toHaveLength(2);expect(app.writes[1]).toEqual(app.writes[0]);expect(app.getData().notasFiscais[0].pagamentos).toHaveLength(2);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('confirmacao-obra-recuperada.png')});});

test('P5 crítica: atualização recupera rascunho e comprovante da versão anterior',async({page},info)=>{const app=await enter(page,'fin',{legacyDraft:true});await page.getByRole('button',{name:'Retomar trabalho salvo',exact:true}).click();await page.getByRole('button',{name:'Reabrir rascunho',exact:true}).click();const modal=page.getByRole('dialog').last();await expect(modal.getByLabel('Valor pago *',{exact:true})).toHaveValue('12.34');await expect(modal).toContainText('legado.pdf');const bytes=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('marcell-confirmations-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('operations').objectStore('operations').getAll();q.onerror=()=>reject(q.error);q.onsuccess=async()=>{const row=q.result.find(x=>x.kind==='draft');const text=await row.value.comprovanteFile.text();db.close();resolve(text);};};}));expect(bytes).toBe('%PDF-1.4 preservado');expect(app.writes).toHaveLength(0);app.check();await page.screenshot({animations:'disabled',path:info.outputPath('rascunho-anterior.png')});});

test('P5 crítica: abrir a consulta não cria uma falha de salvamento',async({page})=>{const app=await enter(page,'fin');await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');expect(app.writes).toHaveLength(0);app.check();});

async function failCalendarSave(page,status,options={}){
 const app=await enter(page,'home',{saveFailure:status,...options});
 await page.getByRole('button',{name:'Novo evento',exact:true}).click();
 const modal=page.getByRole('dialog');
 await modal.getByLabel('Título *',{exact:true}).fill('Revisão de obra preservada');
 await modal.getByRole('button',{name:'Salvar',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state',status===403?'idle':status===409?'conflict':'failed',{timeout:20000});
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 return app;
}
test('P5 revisão: retomar falha definitiva sem nova edição ou comando financeiro',async({page},info)=>{
 const app=await failCalendarSave(page,503),banner=page.getByTestId('save-recovery');
 await expect(banner).toContainText('recarregar perde as edições');
 expect(app.saves).toHaveLength(4);
 expect(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})).toBe(true);
 await banner.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:info.outputPath('falha-com-retomada.png')});
 expect(await banner.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const retry= banner.getByRole('button',{name:'Tentar salvar novamente',exact:true});await retry.focus();await expect(retry).toBeFocused();await retry.press('Enter');
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');
 await expect(banner).toHaveCount(0);
 expect(app.saves).toHaveLength(5);
 expect(app.saves.at(-1)).toEqual(app.saves[0]);
 expect(app.writes).toHaveLength(0);app.check();
});
test('P5 revisão: recusa de acesso desfaz edição e não oferece reenvio',async({page})=>{
 const app=await failCalendarSave(page,403);
 await expect(page.getByTestId('save-rejected')).toContainText('Seu acesso foi revogado.');
 await expect(page.getByRole('button',{name:'Tentar salvar novamente',exact:true})).toHaveCount(0);
 expect(app.saves).toHaveLength(1);expect(app.writes).toHaveLength(0);app.check();
});

test('P5 revisão: falha ao ler servidor conserva conflito e edição para nova tentativa',async({page})=>{
 const app=await failCalendarSave(page,409,{loadFailure:true});
 await page.getByRole('button',{name:'Reaplicar minhas alterações',exact:true}).click();
 await expect(page.getByText('Não foi possível atualizar. Mantenha esta aba aberta e tente novamente.',{exact:true})).toBeVisible();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','conflict');
 await expect(page.getByRole('button',{name:'Reaplicar minhas alterações',exact:true})).toBeVisible();
 expect(app.saves).toHaveLength(1);
 expect(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})).toBe(true);
 app.allowLoads();await page.getByRole('button',{name:'Reaplicar minhas alterações',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');
 expect(JSON.stringify(app.saves.at(-1))).toContain('Revisão de obra preservada');expect(app.saves).toHaveLength(2);expect(app.saves[1].sectionDeltas).toEqual(app.saves[0].sectionDeltas);
 expect(app.writes).toHaveLength(0);app.check();
});
test('P5 revisão: reaplicação recusada por indisponibilidade continua na fila',async({page})=>{
 const app=await failCalendarSave(page,409,{reapplyFailure:true});
 await page.getByRole('button',{name:'Reaplicar minhas alterações',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','failed',{timeout:20000});
 const retry=page.getByRole('button',{name:'Tentar salvar novamente',exact:true});
 await expect(retry).toBeVisible();expect(app.saves).toHaveLength(5);
 await retry.click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');
 expect(JSON.stringify(app.saves.at(-1))).toContain('Revisão de obra preservada');expect(app.saves).toHaveLength(6);expect(app.saves.at(-1).sectionDeltas).toEqual(app.saves[1].sectionDeltas);
 expect(app.writes).toHaveLength(0);app.check();
});

test('P5 revisão: sessão expirada conserva edição e exige renovar o acesso',async({page})=>{
 const app=await failCalendarSave(page,401);
 await expect(page.getByTestId('save-recovery')).toContainText('Sessão expirada no ensaio.');
 await expect(page.getByTestId('save-recovery')).toContainText('Copie as edições antes de sair.');
 await expect(page.getByRole('button',{name:'Tentar salvar novamente',exact:true})).toHaveCount(0);
 expect(app.saves).toHaveLength(1);expect(app.writes).toHaveLength(0);app.check();
});
