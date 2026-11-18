import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';

async function enter(page,tab,{explicitPix='',emptyReport=false}={}){
 const data=structuredClone(fixture),user={...profile,role:'admin'};
 data.usuarios=[user];data.config={...data.config,reconciliationAutoEnabled:false};
 data.transacoes=[{id:'bank-a',descricao:'PIX Fornecedor Exemplo',valor:-1500,data:'2026-11-17',status:'pendente',chave:'fit:202611170772',chavePix:explicitPix,contraparteNome:'Fornecedor Exemplo'}];
 data.fornecedores=[{id:'supplier',nome:'Fornecedor Exemplo',chavePix:'fornecedor@example.test'}];
 data.notasFiscais=[{id:'note-a',numero:'NF-10',valorLiquido:1500,fornecedorId:'supplier',fornecedorNome:'Fornecedor Exemplo',vencimento:'2026-11-17',status:'aprovada',pagamentos:[]}];
 data.pedidos=[];data.reconciliationLinks=[];data.historicoConc=[];
 data.solicitacoesCompra=[{...data.solicitacoesCompra[0],id:'req-top',numero:'SC-0005',criadoEm:'2026-11-17T10:00:00Z'},{...data.solicitacoesCompra[0],id:'req-exact',numero:'SC-0004',criadoEm:'2026-11-16T10:00:00Z'}];
 const shadow={ok:true,engineEnforced:true,prontoParaAtivar:false,contagens:{fatosLegados:2,projecoesDRE:696},divergencias:[],divergenciasDRE:emptyReport?[]:Array.from({length:678},(_,i)=>({sourceId:'2026-11:mes:a',path:`costs[${i}].amount`,expected:100,canonical:120,difference:20})),activationGate:{ready:false,checks:[{code:'dre_divergence',ok:emptyReport,detail:emptyReport?'DRE sem diferenças.':'678 divergências do DRE.'},{code:'legacy_hashes',ok:false,detail:'Verificação da atualidade dos vínculos não concluída.'}]}};
 if(!emptyReport)shadow.canonicalIntegrity={findings:[{code:'audit-warning',severity:'warning',message:'Aviso de integridade QA'}]};
 const before=JSON.stringify(data),writes=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({tab,id})=>{sessionStorage.setItem(`arcd-section:${id}`,tab);localStorage.setItem('arcd-theme','marcell');},{tab,id:user.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],bases:[],connected:false}}));
 await page.route('**/api/data',r=>{const b=r.request().postDataJSON()||{};if(b.action==='financial-shadow-report')return r.fulfill({json:shadow});if(!['auth-login','auth-refresh','load','profiles','financial-company-dre-report','financial-dre-report','obras-custo-acumulado'].includes(b.action)){writes.push(b.action);return r.fulfill({status:403,json:{error:'Gravação bloqueada no ensaio local.'}});}return r.fulfill({json:{ok:true,data,usuarios:[user],usuario:user,precisaSetup:false,accessToken:'audit-local',refreshToken:'audit-local',updatedAt:'2026-11-17T12:00:00Z',obras:{},custoAte:'2026-10'}});});
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('audit-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return()=>{expect(errors).toEqual([]);expect(writes).toEqual([]);expect(JSON.stringify(data)).toBe(before);};
}
const fit=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
for(const width of [320,390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768});
 test('homologação separa ativação, detalhes DRE, busca e paginação sem gravar',async({page})=>{
  const check=await enter(page,'fin');await expect(page.getByRole('heading',{name:'Financeiro',exact:true})).toBeVisible();
  await selectWorkspaceArea(page,'Áreas do financeiro','Homologação');
  await expect(page.getByRole('heading',{name:'Homologação financeira',exact:true})).toBeVisible();
  const report=page.getByRole('region',{name:'Resultado da homologação financeira',exact:true});
  await expect(report).toContainText('Motor financeiro ativo');await expect(report).toContainText('1–12 de 679');
  const types=report.getByRole('combobox',{name:'Tipo de ocorrência',exact:true});
  if(width<768){
   for(const field of [report.getByRole('textbox',{name:'Buscar diferença ou origem'}),types,report.getByRole('combobox',{name:'Grupo da conferência'})]){
    await expect(field).toBeInViewport({ratio:1});
    expect((await field.boundingBox()).y+(await field.boundingBox()).height).toBeLessThan(780);
   }
   await page.screenshot({path:test.info().outputPath('homologacao-filtros-iniciais.png')});
  }
  await types.selectOption('warning');
  await expect(report).toContainText('1–1 de 1');
  await expect(report.getByText('Conferir: Aviso de integridade QA',{exact:true})).toBeVisible();
  await types.selectOption('error');
  await expect(report).toContainText('1–12 de 678');
  await expect(report).not.toContainText('Motor permanece em sombra');await expect(report).not.toContainText('Todos os totais homologados coincidem');
  await report.getByRole('button',{name:'Próxima',exact:true}).click();await expect(report).toContainText('13–24 de 678');
  await report.getByRole('textbox',{name:'Buscar diferença ou origem',exact:true}).fill('costs[677]');await expect(report).toContainText('1–1 de 1');
  await expect(report).toContainText('Competência 2026-11');
  await report.getByText('Diagnóstico do registro',{exact:true}).click();await expect(report.locator('pre')).toContainText('costs[677].amount');
  await expect(report.getByText('Referência de origem: 2026-11:mes:a', {exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ajuda',exact:true}).first().click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toContainText('Grupo da conferência');await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
  await expect(report.getByRole('textbox',{name:'Buscar diferença ou origem',exact:true})).toHaveValue('costs[677]');
  await page.screenshot({path:`artifacts/correcoes-auditoria-20261117/homologacao-${process.env.AUDIT_MODE||'dev'}-${width}.png`,fullPage:true});await fit(page);check();
 });
 test('zero diferenças não dispensa a verificação pendente',async({page})=>{
  const check=await enter(page,'fin',{emptyReport:true});await selectWorkspaceArea(page,'Áreas do financeiro','Homologação');
  const report=page.getByRole('region',{name:'Resultado da homologação financeira'});
  const checks=report.getByRole('region',{name:'Verificações da homologação'});
  if(width<768){
   const summary=report.locator('summary').filter({hasText:'Verificações da homologação · Pendências (1)'});
   await expect(checks).toBeHidden();
   await summary.click();
  }
  await expect(checks.getByText('Verificação da atualidade dos vínculos não concluída.',{exact:true})).toBeVisible();
  await fit(page);check();
 });
 test('FITID aparece sem chave PIX inventada, preservando impedimento de PIX explícito',async({page})=>{
  const check=await enter(page,'conc');await expect(page.getByRole('heading',{name:'Conciliação Bancária',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Comparar e buscar',exact:true}).click();
  const evidence=page.locator('.reconciliation-evidence');const pix=evidence.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Chave PIX',exact:true})});
  await expect(pix).toContainText('Não informado');await expect(pix).not.toContainText('fit:');await expect(pix).not.toContainText('Divergente');
  await expect(page.getByText('Chave PIX não informada no extrato.',{exact:false})).toBeVisible();
  await page.screenshot({path:`artifacts/correcoes-auditoria-20261117/pix-${process.env.AUDIT_MODE||'dev'}-${width}.png`,fullPage:true});await fit(page);check();
 });
 test('chave PIX explícita diferente mantém a divergência e não confirma pagamento',async({page})=>{
  const check=await enter(page,'conc',{explicitPix:'outra@example.test'});await page.getByRole('button',{name:'Comparar e buscar',exact:true}).click();
  const evidence=page.locator('.reconciliation-evidence');await expect(evidence).toContainText('outra@example.test');await expect(evidence.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Chave PIX',exact:true})})).toContainText('Divergente');
  await expect(page.getByRole('region',{name:'Comparar e resolver movimento'})).toContainText('Chave PIX incompatível');check();
 });
 test('atualização sem conexão mantém consulta sem inventar edição protegida',async({page})=>{
  const check=await enter(page,'home');await expect(page.getByRole('button',{name:'Atualizar',exact:true})).toBeVisible();
  await page.route('**/api/data',r=>r.fulfill({status:503,json:{error:'Sem conexão no ensaio local.'}}));
  await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();await expect(page.getByText('Sem conexão. Reconecte-se e tente atualizar novamente. Os dados exibidos foram mantidos.',{exact:true})).toBeVisible();await expect(page.getByText('A edição protegida foi mantida.',{exact:true})).toHaveCount(0);check();
 });
 test('fornecedor mostra nota geral e abre critérios detalhados com alvo de toque adequado',async({page},info)=>{
  const check=await enter(page,'fornecedores');
  const filters=page.getByRole('region',{name:'Filtros do ranking'});
  const period=filters.getByRole('combobox',{name:'Período',exact:true});
  if(width<768){
   await expect(period).toBeHidden();
   await filters.getByText('Obra e período',{exact:true}).click();
   await expect(period).toBeVisible();
   await filters.getByText('Obra e período',{exact:true}).click();
   await expect(page.locator('.arcd-mobile-record-card').getByText('Nota geral',{exact:true})).toBeVisible();
  }
  const button=page.getByRole('button',{name:'Ver detalhes de Fornecedor Exemplo',exact:true});
  await expect(button).toBeVisible();
  const rect=await button.boundingBox();
  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:info.outputPath('fornecedores.png')});
  await button.click();
  const detail=page.locator('.supplier-detail');
  await expect(detail).toContainText('Fornecedor Exemplo');
  await expect(detail.getByText('Preço',{exact:true})).toBeVisible();
  await fit(page);check();
 });
 test('célula do ponto respeita altura mínima de toque',async({page})=>{
  const check=await enter(page,'ponto_geral');const button=page.locator('.ponto-dia-cell > button:first-child').first();await expect(button).toBeVisible();const rect=await button.boundingBox();expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);await fit(page);check();
 });
 test('próxima ação da ficha de compra posiciona o registro exato',async({page})=>{
  const check=await enter(page,'cmp');await selectWorkspaceArea(page,'Fluxo de compras','Fila de trabalho');await page.getByRole('button',{name:'Consultar SC-0004',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Compra · SC-0004',exact:true});await panel.getByRole('button',{name:'Analisar solicitação',exact:true}).click();await expect(panel).toHaveCount(0);const record=page.locator('#purchase-record-req-exact');await expect(record).toBeFocused();await expect(record).toHaveAttribute('data-purchase-highlight','true');await fit(page);check();
 });
});
