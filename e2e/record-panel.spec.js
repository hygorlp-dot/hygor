import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page,tab,{many=false}={}){
 const data=structuredClone(fixture),writes=[],errors=[];data.condominios=[];data.orcamentos=[];
 const a=data.obras[0].id,b=data.obras[1].id;data.obras[0].name='Obra Alfa P2';data.obras[1].name='Obra Beta P2';
 const request=data.solicitacoesCompra[0];data.solicitacoesCompra=[{...request,id:'req-a',numero:'SC-A',obraId:a,status:'enviada',necessidade:'2026-10-30',itens:[{...request.itens[0],descricaoRef:'Cimento Alfa'}]},{...request,id:'req-b',numero:'SC-B',obraId:b,status:'enviada',necessidade:'2026-11-04',itens:[{...request.itens[0],descricaoRef:'Cimento Beta'}]}];data.cotacoes=[];data.pedidos=[{...data.pedidos[0],id:'order-a',numero:'PC-A',obraId:a,status:'enviado'}];
 if(many)for(let i=3;i<30;i++)data.solicitacoesCompra.push({...data.solicitacoesCompra[0],id:`req-${i}`,numero:`SC-${i}`});
 const dates=['2026-10-31','2026-11-01','2026-11-02','2026-11-08','2026-11-09',''];
 data.notasFiscais=dates.map((vencimento,i)=>({id:`nf-p2-${i}`,obraId:a,numero:`NF-P2-${i}`,status:'aprovada',emissao:'2026-10-01',valorBruto:100,vencimento,pagamentos:i===0?[{id:'partial',data:'2026-10-20',valor:30}]:[]}));
 data.medicoes=dates.map((dataVencimento,i)=>({id:`med-p2-${i}`,obraId:a,descricao:`Cliente P2 ${i}`,dataEmissao:'2026-10-01',dataVencimento,valorPrevisto:200,recebimentos:[]}));
 for(const key of ['outrasDesp','despesasEmpresa','medicoesTerc','titulosFolha','payments','rescisoes','caixaObra'])data[key]=[];
 await page.clock.setFixedTime(new Date('2026-11-01T15:00:00Z'));await page.addInitScript(({id,tab})=>sessionStorage.setItem(`arcd-section:${id}`,tab),{id:profile.id,tab});
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));await page.route('**/api/data',r=>{const body=r.request().postDataJSON()||{};if(body.action==='operational-command')writes.push(body.command);return r.fulfill({json:{ok:true,usuarios:[profile],usuario:profile,data,precisaSetup:false,accessToken:'local',refreshToken:'local',updatedAt:'2026-11-01T15:00:00Z'}});});
 if(process.env.MARCELL_P3_STRESS){await page.route('**/fonts/**',r=>r.abort());await page.addInitScript(()=>window.addEventListener('DOMContentLoaded',()=>{if(innerWidth>1000)document.documentElement.style.fontSize='200%';}));}
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return {a,b,check:()=>{expect(writes).toEqual([]);expect(errors).toEqual([]);}};
}

test('Compras: consulta, ajuda, ação curta e retorno à ficha',async({page},info)=>{
 const app=await enter(page,'cmp');
 await page.getByLabel('Buscar na fila',{exact:true}).fill('PC-A');
 const opener=page.getByRole('button',{name:'Consultar PC-A',exact:true});await opener.click();
 const panel=page.getByRole('dialog',{name:'Compra · PC-A',exact:true});await expect(panel).toBeVisible();await expect(panel).toContainText('Obra Alfa P2');
 const bounds=await panel.boundingBox();if(page.viewportSize().width<768)expect(bounds.width).toBeGreaterThan(page.viewportSize().width-4);else expect(bounds.x).toBeGreaterThan(0);
 expect(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await panel.getByRole('button',{name:'Voltar à fila',exact:true}).focus();await page.keyboard.press('Tab');await expect(panel.getByRole('button',{name:'Fechar',exact:true})).toBeFocused();
 await panel.getByRole('button',{name:'Ajuda',exact:true}).click();const help=page.getByRole('complementary',{name:'Central de ajuda',exact:true});await expect(help).toContainText('Compras · Ficha rápida');await page.keyboard.press('Escape');await expect(help).toHaveCount(0);await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Receber materiais',exact:true}).click();const form=page.getByRole('dialog').last();await expect(form).not.toHaveAttribute('aria-label','Compra · PC-A');await form.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Voltar à fila',exact:true}).click();await expect(panel).toHaveCount(0);await expect(opener).toBeFocused();await expect(page.getByLabel('Buscar na fila',{exact:true})).toHaveValue('PC-A');app.check();
 await opener.click();await page.screenshot({animations:'disabled',path:info.outputPath('compras-ficha.png')});await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);
});
test('Compras: área completa conserva busca e ficha ao voltar',async({page})=>{
 const app=await enter(page,'cmp');await page.getByLabel('Buscar na fila',{exact:true}).fill('SC-B');await page.getByRole('button',{name:'Consultar SC-B',exact:true}).click();let panel=page.getByRole('dialog',{name:'Compra · SC-B',exact:true});await panel.getByRole('button',{name:'Analisar solicitação',exact:true}).click();await expect(panel).toHaveCount(0);await page.getByRole('button',{name:'Voltar para solicitação SC-B',exact:true}).click();await expect(panel).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByLabel('Buscar na fila',{exact:true})).toHaveValue('SC-B');app.check();
});
test('Financeiro: ficha, detalhamento e retorno sem registrar operações',async({page},info)=>{
 const app=await enter(page,'fin');const opener=page.locator('.finance-today__table tbody tr').first().getByRole('button',{name:/^Consultar/});await opener.click();const panel=page.getByRole('dialog',{name:'Ficha financeira',exact:true});await expect(panel).toBeVisible();await expect(panel).toContainText('Saldo em aberto');
 await panel.getByRole('button',{name:'Consultar detalhamento',exact:true}).click();const memorial=page.locator('dialog.financial-memorial');await expect(memorial).toBeVisible();await page.keyboard.press('Escape');await expect(memorial).toHaveCount(0);await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toContainText('Financeiro · Ficha rápida');await page.keyboard.press('Escape');await expect(panel).toBeVisible();await page.screenshot({animations:'disabled',path:info.outputPath('financeiro-ficha.png')});
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(opener).toBeFocused();app.check();
});

test('Compras: paginação e posição sobrevivem à área completa',async({page})=>{
 const app=await enter(page,'cmp',{many:true});await page.getByRole('button',{name:'Próxima',exact:true}).click();await expect(page.getByText('Página 2 de 2',{exact:true})).toBeVisible();
 const opener=page.locator('.purchase-queue-table tbody tr[data-record]').last().getByRole('button',{name:/^Consultar/});await opener.scrollIntoViewIfNeeded();const name=await opener.getAttribute('aria-label');const before=await page.locator('main').evaluate(n=>n.scrollTop);
 await opener.click();const panel=page.locator('.mrc-record-panel');await panel.getByRole('button',{name:'Analisar solicitação',exact:true}).click();await page.getByRole('button',{name:/^Voltar para solicitação SC-/}).click();await expect(panel).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByText('Página 2 de 2',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name,exact:true})).toBeFocused();await expect.poll(()=>page.locator('main').evaluate(n=>n.scrollTop)).toBeCloseTo(before,0);app.check();
});
test('Financeiro: ação na ficha e retorno conservam Kanban, prazo e rolagem',async({page})=>{
 const app=await enter(page,'fin');await page.getByLabel('Visualização',{exact:true}).selectOption('kanban');const board=page.getByRole('region',{name:'Compromissos por vencimento',exact:true}),later=board.getByRole('region',{name:'Depois',exact:true});await later.getByRole('button',{name:/^Consultar/}).click();const position=await board.evaluate(n=>n.scrollLeft);const panel=page.locator('.mrc-record-panel');await panel.getByRole('button',{name:'Conferir documento',exact:true}).click();await expect(panel).toHaveCount(0);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Voltar à fila financeira',exact:true}).click();await expect(panel).toBeVisible();await panel.getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toContainText('Financeiro · Ficha rápida');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await expect(board).toBeVisible();await expect.poll(()=>board.evaluate(n=>n.scrollLeft)).toBeCloseTo(position,0);await expect(page.getByLabel('Movimentação',{exact:true})).toHaveValue('A pagar');app.check();
});
