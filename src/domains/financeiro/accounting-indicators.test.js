import {describe,it,expect} from 'vitest';
import {accountingPrintHtml,accountingExportSheets} from './accounting-report-export.js';
import {data as original,accountingCsv} from '../../../scripts/fixtures/accounting-data.mjs';
import {ACCOUNTING_COMMAND,parseAccountingCsv,accountingStatement,accountingIndicators,accountingErpComparison,applyAccountingCommand,validateAccountingSnapshotPolicy,accountingReportSheets} from './accounting-indicators.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {projectDataForUser} from '../../../server/data-projection.js';
const fixture=()=>structuredClone(original);
const command=(type,payload,expectedVersion=0,role='admin')=>({type,payload,expectedVersion,idempotencyKey:`accounting-test-${payload.id}-${type}`,actorId:'finance-user',actorName:'Financeiro fictício',actorRole:role,now:'2026-11-02T18:00:00Z'});
const importCommand=(id='base-one',csv=accountingCsv)=>command(ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED,{id,csv,filename:'balancete-ficticio.csv',entity:'MARCELL fictícia',document:'Balancete fictício de outubro',start:'2026-10-01',end:'2026-10-31',note:'Importação fictícia para conferir os indicadores'});
function review(data,id='base-one',patch={}){return applyOperationalCommand(data,command(ACCOUNTING_COMMAND.ACCOUNTING_BASE_REVIEWED,{id,completeCoverage:true,erpFingerprint:accountingErpComparison(data,'2026-10-01','2026-10-31').fingerprint,reconciliationNote:'Diferenças fictícias de classificação e receitas para testar a conferência.',...patch},1));}
const reviewed=()=>review(applyOperationalCommand(fixture(),importCommand()).data).data.accountingBases[0];
describe('base contábil importada e conferível',()=>{
 it('reconcilia saldo por conta, partidas, balanço e resultado em aberto sem duplicar o PL',()=>{
  const parsed=parseAccountingCsv(accountingCsv);expect(parsed.ok).toBe(true);const r=accountingStatement(parsed.accounts);
  expect(r.issues).toEqual([]);expect(r.totals).toEqual({opening:0,debit:26600000,credit:26600000,closing:0});
  expect(r.balance).toMatchObject({assets:22000000,ac:15500000,cash:4500000,pc:5000000,pnc:5000000,equityAccounts:10000000,closingResult:2000000,equity:12000000});expect(r.income).toMatchObject({netRevenue:9000000,gross:4000000,operating:2500000,net:2000000});
 });
 it('lê BOM, CRLF, conta entre aspas e centavos brasileiros; não interpreta código como fórmula',()=>{
  const csv='\uFEFFcodigo;conta;grupo;saldo_inicial;debitos;creditos;saldo_final\r\n001;"Conta; com ""aspas""";caixa;-1.234,56;1.234,56;0;0';
  const r=parseAccountingCsv(csv);expect(r.ok).toBe(true);expect(r.accounts[0]).toMatchObject({code:'001',name:'Conta; com "aspas"',opening:-123456,debit:123456,closing:0,sourceLine:2});
 });
 it('rejeita coluna, código ou grupo inválido, duplicidade, valor vazio, negativo em movimentação e overflow',()=>{
  for(const csv of [accountingCsv.replace('saldo_final','saldo'),accountingCsv+'\n'+accountingCsv.split('\n')[1],accountingCsv.replace(';caixa;',';inventado;'),accountingCsv.replace(';40000,00;',';;'),accountingCsv.replace(';83000,00;',';-83000,00;'),accountingCsv.replace(';40000,00;',';9007199254740999,00;'),'codigo;conta;grupo;saldo_inicial;debitos;creditos;saldo_final\n1;"sem fechar;caixa;0;0;0;0'])expect(parseAccountingCsv(csv).ok).toBe(false);
 });
 it('rascunho não libera indicadores; conferência explícita conserva memória, origem, justificativa e autor',()=>{
  const data=fixture(),before=JSON.stringify(data),draft=applyOperationalCommand(data,importCommand());expect(draft.ok).toBe(true);expect(JSON.stringify(data)).toBe(before);
  expect(accountingIndicators(draft.data.accountingBases[0]).metrics.every(row=>row.value===null&&row.reason)).toBe(true);
  const result=review(draft.data);expect(result.ok).toBe(true);expect(result.data.accountingBases[0]).toMatchObject({status:'conferida',version:2,reviewedById:'finance-user',reviewedOn:'2026-11-02',completeCoverage:true,sourceFile:'balancete-ficticio.csv'});
  expect(result.data.accountingBases[0].accounts).toHaveLength(18);
 });
 it('avisa documentação faltante, período incompleto/futuro e cobertura não confirmada',()=>{
  for(const patch of [{document:''},{entity:''},{note:'curto'},{start:'2026-10-02'},{end:'2026-10-30'},{start:'2026-11-01',end:'2026-11-30'}]){const c=importCommand();Object.assign(c.payload,patch);expect(applyOperationalCommand(fixture(),c).ok).toBe(false);}
  const draft=applyOperationalCommand(fixture(),importCommand()).data;expect(review(draft,'base-one',{completeCoverage:false}).ok).toBe(false);
 });
 it('saldo inconsistente permanece conferível em rascunho, mas bloqueia confirmação e todos os KPIs',()=>{
  const draft=applyOperationalCommand(fixture(),importCommand('bad',accountingCsv.replace(';45000,00',';45000,01')));expect(draft.ok).toBe(true);
  const report=accountingIndicators(draft.data.accountingBases[0]);expect(report.statement.issues.length).toBeGreaterThan(0);expect(review(draft.data,'bad').reason).toMatch(/divergências/);expect(report.metrics.every(row=>row.value===null)).toBe(true);
 });
 it('uma revisão não edita a base anterior; snapshot direto, exclusão e repetição são protegidos',()=>{
  const draft=applyOperationalCommand(fixture(),importCommand()),first=review(draft.data).data,copy=JSON.stringify(first.accountingBases[0]);
  const next=importCommand('base-two');next.expectedVersion=1;const second=applyOperationalCommand(first,next);expect(second.ok).toBe(true);expect(second.data.accountingBases[1]).toMatchObject({revision:2,revisionOf:'base-one'});expect(JSON.stringify(second.data.accountingBases[0])).toBe(copy);
  expect(validateAccountingSnapshotPolicy(first,{...first,accountingBases:[]})).toMatch(/histórico/);expect(validateAccountingSnapshotPolicy(first,first)).toBe('');expect(applyOperationalCommand(draft.data,importCommand()).idempotent).toBe(true);
 });
 it('exige reconciliação quando o ERP difere ou não possui base e detecta concorrência de fatos',()=>{
  const data=applyOperationalCommand(fixture(),importCommand()).data;expect(review(data,'base-one',{reconciliationNote:''}).reason).toMatch(/Explique/);expect(review(data,'base-one',{erpFingerprint:'stale'}).reason).toMatch(/mudaram/);
  const empty={...data,medicoes:[],notasFiscais:[],outrasDesp:[],medicoesTerc:[],employees:[],attendance:{}};const comparison=accountingErpComparison(empty,'2026-10-01','2026-10-31');expect(comparison.result===null||Number.isSafeInteger(comparison.result)).toBe(true);
 });
 it('restringe comandos e leitura à empresa inteira, inclusive administrador vinculado a uma obra',()=>{
  const data=applyOperationalCommand(fixture(),importCommand()).data,c=importCommand('other');
  for(const user of [{role:'engenheiro'},{role:'financeiro',obraId:'a'},{role:'admin',obraId:'a'},{role:'financeiro',active:false}]){expect(validateOperationalCommandScope({user,data,command:c}).ok).toBe(false);expect(projectDataForUser(data,user).accountingBases).toBeUndefined();}
  expect(validateOperationalCommandScope({user:{role:'financeiro'},data,command:c}).ok).toBe(true);expect(projectDataForUser(data,{role:'financeiro'}).accountingBases).toHaveLength(1);
 });
});
describe('rentabilidade, liquidez e endividamento',()=>{
 it('calcula fórmulas com numerador e denominador verificáveis e saldos finais explícitos',()=>{
  const r=accountingIndicators(reviewed()),m=Object.fromEntries(r.metrics.map(row=>[row.id,row]));expect(r.ready).toBe(true);
  expect(m.gross.value).toBeCloseTo(4/9);expect(m.net.value).toBeCloseTo(2/9);expect(m.roa.value).toBeCloseTo(2/22);expect(m.roe.value).toBeCloseTo(2/12);
  expect(m.current.value).toBe(3.1);expect(m.quick.value).toBe(2.5);expect(m.immediate.value).toBe(.9);expect(m.general.value).toBe(1.65);expect(m.debt_assets.value).toBeCloseTo(10/22);expect(m.debt_equity.value).toBeCloseTo(10/12);expect(m.debt_profile.value).toBe(.5);
  expect(m.current).toMatchObject({numerator:15500000,denominator:5000000,unit:'ratio'});
 });
 it('denominador zero ou PL negativo não vira infinito nem rentabilidade positiva falsa',()=>{
  const base=reviewed();for(const row of base.accounts){row.debit=0;row.credit=0;row.opening=row.closing=0;}
  const none=accountingIndicators(base);expect(none.ready).toBe(true);expect(none.metrics.every(row=>row.value===null&&row.reason.includes('positivo'))).toBe(true);
  const a=base.accounts.find(row=>row.group==='caixa'),p=base.accounts.find(row=>row.group==='passivo_curto'),e=base.accounts.find(row=>row.group==='patrimonio');a.opening=a.closing=1000000;p.opening=p.closing=-3000000;e.opening=e.closing=2000000;
  const loss=accountingIndicators(base);expect(loss.ready).toBe(true);expect(loss.metrics.find(row=>row.id==='roe').value).toBeNull();expect(loss.metrics.find(row=>row.id==='debt_assets').value).toBe(3);
 });
 it('mantém prejuízo negativo e não anualiza o mês nem soma pagamentos ao resultado',()=>{
  const base=reviewed(),cash=base.accounts.find(row=>row.group==='caixa'),tax=base.accounts.find(row=>row.group==='tributos_lucro');tax.debit=tax.closing=5000000;cash.credit+=4500000;cash.closing=0;
  const r=accountingIndicators(base);expect(r.ready).toBe(true);expect(r.statement.income.net).toBe(-2500000);expect(r.metrics.find(row=>row.id==='net').value).toBeCloseTo(-25/90);
 });
 it('exporta oito seções e escapa nomes de contas e origem na apresentação',()=>{
  const base=reviewed();base.document='<img src=x onerror=alert(1)>';base.accounts[0].name='<script>test</script>';const report=accountingIndicators(base);const sheets=accountingExportSheets(base,report),html=accountingPrintHtml(base,report);expect(Object.keys(sheets)).toHaveLength(8);expect(sheets.Balanço.flat()).toContain(120000);expect(html).toContain('&lt;script&gt;test&lt;/script&gt;');expect(html).not.toContain('<img src=x');expect(html).toContain('22,22%');
 });
 it('preserva base, fórmula e contas nas exportações e trata corrupção numérica sem travar',()=>{
  const base=reviewed(),before=JSON.stringify(base),sheets=accountingReportSheets(base);expect(sheets.Contas).toHaveLength(19);expect(sheets.Indicadores.flat()).toContain('Liquidez corrente');expect(sheets.Base.flat()).toContain('balancete-ficticio.csv');expect(JSON.stringify(base)).toBe(before);
  base.accounts[0].closing=Number.MAX_VALUE;expect(accountingIndicators(base).ready).toBe(false);expect(accountingIndicators(base).metrics.every(row=>row.value===null)).toBe(true);
 });
});
