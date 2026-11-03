import {expandSectionDelta} from '../src/domains/sync/section-delta.js';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page,tab,{many=false,readonly=false,reject=0,legacyDraft=false,saveFailure=0,loadFailure=false,reapplyFailure=false,storageUnavailable=false}={}){
 const account={...profile,...(readonly?{role:"visualizador",accessTabs:["home","cmp","fin"]}:{})};
 let updatedAt='2026-11-01T15:00:00Z';
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
 if(body.action==='auth-login'&&saves.length&&saveFailure===401)saveFailure=0;
 if(body.action==='auth-refresh'&&saveFailure===401)return r.fulfill({status:401,json:{ok:false,error:'Sessão expirada no ensaio.'}});
 if(body.action==='load'&&saves.length&&blockLoads)return r.fulfill({status:503,json:{ok:false,error:'Leitura indisponível no ensaio.'}});
 if(['save','save-sections'].includes(body.action)){
  saves.push(body);
  if(saveFailure===409&&saves.length===1)return r.fulfill({status:409,json:{ok:false,conflict:true,currentData:data,currentUpdatedAt:'2026-11-01T15:00:30Z'}});
  if(reapplyFailure&&saves.length>1&&saves.length<6)return r.fulfill({status:503,json:{ok:false,error:'Reaplicação indisponível no ensaio.'}});
  if((saveFailure===401||saves.length<=(saveFailure===503?4:1))&&saveFailure)return r.fulfill({status:saveFailure,json:{ok:false,error:saveFailure===401?'Sessão expirada no ensaio.':saveFailure===403?'Seu acesso foi revogado.':'Servidor indisponível no ensaio.'}});
  await new Promise(resolve=>setTimeout(resolve,350));
  if(body.action==='save')data=body.payload;else{data={...data,...body.sections};for(const [key,delta] of Object.entries(body.sectionDeltas||{}))data[key]=expandSectionDelta(delta,data[key]).incoming;}
  updatedAt='2026-11-01T15:01:00Z';return r.fulfill({json:{ok:true,updatedAt}});
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
 return r.fulfill({json:{ok:true,usuarios:[account],usuario:account,data,precisaSetup:false,accessToken:'local',refreshToken:'local',updatedAt}});
 });
 if(process.env.MARCELL_P3_STRESS){await page.route('**/fonts/**',r=>r.abort());await page.addInitScript(()=>window.addEventListener('DOMContentLoaded',()=>{if(innerWidth>1000)document.documentElement.style.fontSize='200%';}));}
 if(storageUnavailable)await page.addInitScript(()=>{const nativeOpen=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='marcell-workspace-edits-v1'&&!window.__allowWorkspaceStorage)throw new DOMException('Armazenamento bloqueado','SecurityError');return nativeOpen.call(this,name,...args);};});
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
async function reviewGeneral(page){
 await page.getByTestId('save-recovery').getByRole('button',{name:'Resolver salvamento',exact:true}).click();
 const modal=page.getByRole('dialog').last();await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();
 await expect(modal.getByRole('button',{name:'Salvar alterações revisadas',exact:true})).toBeEnabled();return modal;
}
test('Recuperação integral: recarga conserva intenção e não reenvia automaticamente',async({page},info)=>{
 const app=await failCalendarSave(page,503);expect(app.saves).toHaveLength(4);
 page.on('dialog',d=>d.accept());await page.reload();
 await expect(page.getByTestId('save-recovery')).toBeVisible();expect(app.saves).toHaveLength(4);
 const modal=await reviewGeneral(page);await modal.screenshot({path:info.outputPath('recuperacao-apos-recarga.png')});
 await modal.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');
 expect(app.saves).toHaveLength(5);expect(JSON.stringify(app.saves.at(-1))).toContain('Revisão de obra preservada');expect(app.writes).toHaveLength(0);app.check();
});
test('Recuperação integral: acesso ao aviso sem fechar formulário e edição antiga bloqueada',async({page})=>{
 const app=await enter(page,'home',{saveFailure:503});
 await page.getByRole('button',{name:'Novo evento',exact:true}).click();const editor=page.getByRole('dialog').first();
 await editor.getByLabel('Título *',{exact:true}).fill('Evento sem duplicação');await editor.getByRole('button',{name:'Salvar',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','failed',{timeout:20000});
 await editor.getByRole('button',{name:'Resolver salvamento',exact:true}).click();
 const recovery=page.getByRole('dialog').last();await recovery.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await recovery.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(editor.getByText('Edição atualizada pela recuperação. Feche e reabra o registro antes de editar novamente.',{exact:true})).toBeVisible();
 await expect(editor.getByRole('button',{name:'Salvar',exact:true})).toBeDisabled();expect(app.saves).toHaveLength(5);expect(app.writes).toHaveLength(0);app.check();
});
test('Recuperação integral: renovar sessão mantém editor e exige confirmação explícita',async({page})=>{
 const app=await failCalendarSave(page,401);await page.getByTestId('save-recovery').getByRole('button',{name:'Resolver salvamento',exact:true}).click();
 const modal=page.getByRole('dialog').last();await modal.getByLabel('Senha para renovar a sessão',{exact:true}).fill('local');await modal.getByRole('button',{name:'Renovar sessão',exact:true}).click();
 await expect(modal).toContainText('Acesso renovado');expect(app.saves).toHaveLength(1);
 await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await modal.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');expect(app.saves).toHaveLength(2);app.check();
});
test('Recuperação integral: leitura indisponível mantém edição protegida',async({page})=>{
 const app=await failCalendarSave(page,409,{loadFailure:true});await page.getByTestId('save-recovery').getByRole('button',{name:'Resolver salvamento',exact:true}).click();const modal=page.getByRole('dialog').last();
 await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(modal).toContainText('Leitura indisponível no ensaio.');expect(app.saves).toHaveLength(1);
 app.allowLoads();await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await modal.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','idle');expect(app.saves).toHaveLength(2);app.check();
});
test('Recuperação integral: recusa de acesso conserva edição sem reenvio automático',async({page})=>{
 const app=await failCalendarSave(page,403);await expect(page.getByTestId('save-rejected')).toContainText('Seu acesso foi revogado.');
 await expect(page.getByTestId('save-recovery')).toBeVisible();expect(app.saves).toHaveLength(1);
 const modal=await reviewGeneral(page);await modal.getByRole('combobox').selectOption('current');await modal.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(page.getByTestId('save-recovery')).toHaveCount(0);expect(app.saves).toHaveLength(1);expect(app.writes).toHaveLength(0);app.check();
});

test('Recuperação integral: conflito exige escolha e permite conservar servidor sem repetir gravação',async({page})=>{
 const app=await failCalendarSave(page,503);
 const event=(app.saves[0].sectionDeltas?.eventosEmpresa?.changed||app.saves[0].sections?.eventosEmpresa)[0];
 app.getData().eventosEmpresa=[{...event,titulo:'Título do servidor'}];
 await page.getByTestId('save-recovery').getByRole('button',{name:'Resolver salvamento',exact:true}).click();const modal=page.getByRole('dialog').last();
 await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();
 const save=modal.getByRole('button',{name:'Salvar alterações revisadas',exact:true});await expect(save).toBeDisabled();
 await expect(modal).toContainText('Título do servidor');await modal.getByRole('combobox').selectOption('current');await expect(save).toBeEnabled();await save.click();
 await expect(page.getByTestId('save-recovery')).toHaveCount(0);expect(app.saves).toHaveLength(4);expect(app.writes).toHaveLength(0);app.check();
});
test('Recuperação integral: cancelar revisão preserva o preenchimento do formulário',async({page})=>{
 const app=await enter(page,'home',{saveFailure:503});await page.getByRole('button',{name:'Novo evento',exact:true}).click();const editor=page.getByRole('dialog').first();
 await editor.getByLabel('Título *',{exact:true}).fill('Preenchimento preservado');await editor.getByRole('button',{name:'Salvar',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-state','failed',{timeout:20000});await editor.getByRole('button',{name:'Resolver salvamento',exact:true}).click();
 const recovery=page.getByRole('dialog').last();await recovery.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(1);await expect(editor.getByLabel('Título *',{exact:true})).toHaveValue('Preenchimento preservado');expect(app.saves).toHaveLength(4);app.check();
});
test('Recuperação integral: armazenamento indisponível bloqueia envio e permite voltar à edição',async({page})=>{
 const app=await enter(page,'home',{storageUnavailable:true});await page.getByRole('button',{name:'Novo evento',exact:true}).click();const editor=page.getByRole('dialog').first();
 await editor.getByLabel('Título *',{exact:true}).fill('Edição sem armazenamento');await editor.getByRole('button',{name:'Salvar',exact:true}).click();
 const recovery=page.getByRole('dialog').last();await expect(recovery.getByRole('button',{name:'Verificar armazenamento',exact:true})).toBeVisible();expect(app.saves).toHaveLength(0);
 expect(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})).toBe(true);
 await page.evaluate(()=>window.__allowWorkspaceStorage=true);await recovery.getByRole('button',{name:'Verificar armazenamento',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(1);await expect(editor.getByLabel('Título *',{exact:true})).toHaveValue('Edição sem armazenamento');
 await editor.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(app.saves).toHaveLength(1);expect(JSON.stringify(app.saves[0])).toContain('Edição sem armazenamento');app.check();
});
test('Recuperação integral: nova aba encontra edição própria e exige confirmação',async({page})=>{
 const first=await failCalendarSave(page,503);const other=await page.context().newPage();const second=await enter(other,'home');
 await expect(other.getByTestId('save-recovery')).toBeVisible();expect(second.saves).toHaveLength(0);
 const recovery=await reviewGeneral(other);await recovery.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(other.getByTestId('save-recovery')).toHaveCount(0);expect(first.saves).toHaveLength(4);expect(second.saves).toHaveLength(1);expect(second.writes).toHaveLength(0);second.check();await other.close();
});
test('Recuperação integral: acesso alterado bloqueia revisão e conserva intenção',async({page})=>{
 const app=await failCalendarSave(page,503);app.account.role='visualizador';app.account.accessTabs=['home'];
 await page.getByTestId('save-recovery').getByRole('button',{name:'Resolver salvamento',exact:true}).click();const recovery=page.getByRole('dialog').last();
 await recovery.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(recovery).toContainText('Acesso ou obra alterados.');await expect(recovery.getByRole('button',{name:'Salvar alterações revisadas',exact:true})).toHaveCount(0);expect(app.saves).toHaveLength(4);app.check();
});

test('Recuperação integral: segunda edição fica protegida enquanto a primeira aguarda revisão',async({page})=>{
 const app=await failCalendarSave(page,503);await page.getByRole('button',{name:'Novo evento',exact:true}).click();const editor=page.getByRole('dialog').first();
 await editor.getByLabel('Título *',{exact:true}).fill('Segundo trabalho protegido');await editor.getByRole('button',{name:'Salvar',exact:true}).click();
 const count=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('marcell-workspace-edits-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,r=db.transaction('edits').objectStore('edits').getAll();r.onsuccess=()=>{db.close();resolve(r.result.length);};};}));
 expect(count).toBeGreaterThanOrEqual(2);expect(app.saves).toHaveLength(4);
 const first=page.getByRole('dialog').last();await first.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await first.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(1);await editor.getByRole('button',{name:'Fechar',exact:true}).click();
 const second=await reviewGeneral(page);await expect(second).toContainText('Segundo trabalho protegido');await second.getByRole('button',{name:'Salvar alterações revisadas',exact:true}).click();
 await expect(page.getByTestId('save-recovery')).toHaveCount(0);await expect.poll(()=>app.getData().eventosEmpresa.map(e=>e.titulo).sort()).toEqual(['Revisão de obra preservada','Segundo trabalho protegido'].sort());expect(app.saves).toHaveLength(6);app.check();
});

test('Recuperação integral: troca de conta não expõe nem reenvia a edição anterior',async({page},info)=>{
 const app=await failCalendarSave(page,503);page.on('dialog',dialog=>dialog.accept());
 async function exit(){if(page.viewportSize().width<768)await page.getByRole('button',{name:'Abrir mais módulos',exact:true}).click();await page.getByRole('button',{name:'Sair do sistema',exact:true}).click();await expect(page.locator('#login-email')).toBeVisible();}
 async function login(){await page.locator('#login-email').fill(app.account.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();}
 await exit();app.account.id='other-user';app.account.nome='Outra conta';await login();
 await expect(page.getByRole('heading',{name:'Visão gerencial',exact:true})).toBeVisible();await expect(page.getByTestId('save-recovery')).toHaveCount(0);expect(app.saves).toHaveLength(4);
 await exit();app.account.id=profile.id;app.account.nome=profile.nome;await login();await expect(page.getByTestId('save-recovery')).toBeVisible();expect(app.saves).toHaveLength(4);app.check();
});


test('Recuperação integral: falha ao proteger segunda edição bloqueia confirmação até recuperar armazenamento',async({page})=>{
 const app=await failCalendarSave(page,503);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.__blockRecoveryWrites=true;IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name==='marcell-workspace-edits-v1'&&window.__blockRecoveryWrites)throw new DOMException('Sem espaço no ensaio','QuotaExceededError');return put.apply(this,args);};});
 await page.getByRole('button',{name:'Novo evento',exact:true}).click();const editor=page.getByRole('dialog').last();await editor.getByLabel('Título *',{exact:true}).fill('Segunda edição sem espaço');await editor.getByRole('button',{name:'Salvar',exact:true}).click();
 const recovery=page.getByRole('dialog').last();await expect(recovery).toContainText('1 preenchimento ainda está');await recovery.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(recovery.getByRole('button',{name:'Salvar alterações revisadas',exact:true})).toBeDisabled();expect(app.saves).toHaveLength(4);
 await recovery.getByRole('button',{name:'Proteger preenchimentos',exact:true}).click();await expect(recovery).toContainText('1 preenchimento ainda está');expect(app.saves).toHaveLength(4);
 await page.evaluate(()=>{window.__blockRecoveryWrites=false;});await recovery.getByRole('button',{name:'Proteger preenchimentos',exact:true}).click();await expect(recovery.getByRole('button',{name:'Proteger preenchimentos',exact:true})).toHaveCount(0);await expect(recovery.getByRole('button',{name:'Salvar alterações revisadas',exact:true})).toBeEnabled();expect(app.saves).toHaveLength(4);app.check();
});
