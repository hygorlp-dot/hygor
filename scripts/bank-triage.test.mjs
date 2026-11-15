import {describe,it,expect} from 'vitest';
import {triageBankTransactions,triageCsv} from './lib/bank-triage.mjs';
const transaction=(id,extra={})=>({id,extratoId:'s',data:'2026-07-20',valor:-50,descricao:'Movimento sem documento',status:'pendente',...extra});
const data=transactions=>({obras:[],employees:[],config:{},extratos:[{id:'s',status:'ativo',banco:'Banco',conta:'123'}],transacoes:transactions});
describe('triagem bancária por origem, sem execução',()=>{
 it('cobre todo aviso, incluindo pendências em extrato arquivado, sem mutação',()=>{
  const state=data([transaction('a'),transaction('b',{extratoId:'old'})]);state.extratos.push({id:'old',status:'arquivado'});
  const before=structuredClone(state),report=triageBankTransactions(state);
  expect(report.summary.unclassified).toBe(2);expect(report.summary.scope).toEqual({arquivado:1,ativo:1});
  expect(report.cases.find(c=>c.id==='b').classification).toBe('archived');expect(report.cases.every(c=>c.executable===false)).toBe(true);expect(state).toEqual(before);
 });
 it('não inclui ignorados ou movimentos com efeito de caixa já vinculado',()=>{
  const state=data([transaction('ignored',{status:'ignorado'}),transaction('cash',{status:'conciliado'})]);
  state.obras=[{id:'a'}];state.outrasDesp=[{id:'paid',obraId:'a',valor:50,data:'2026-07-20',pago:true,transacaoId:'cash'}];
  expect(triageBankTransactions(state).cases).toEqual([]);
 });
 it('preserva a trava de composição do aporte sem classificá-lo como receita',()=>{
  const state=data([transaction('mt7l9lt5xrta',{valor:7160})]);const report=triageBankTransactions(state);
  expect(report.cases[0]).toMatchObject({classification:'hold',priority:'P0',automationEligible:false,executable:false});expect(report.summary.executedCommands).toBe(0);
 });
 it('não transforma REFNUM repetido em prova de duplicidade de negócio',()=>{
  const report=triageBankTransactions(data([transaction('a',{fitid:'F1',txid:'077',metadadosImportacao:{refnum:'077'}}),transaction('b',{fitid:'F2',txid:'077',metadadosImportacao:{refnum:'077'}})]));
  expect(report.summary.genericRefnumInTxid).toBe(2);expect(report.summary.sameFitidWarnings).toBe(0);expect(report.cases).toHaveLength(2);
 });
 it('sinaliza FITID repetido no mesmo escopo sem apagar nem executar',()=>{
  const report=triageBankTransactions(data([transaction('a',{fitid:'F1'}),transaction('b',{fitid:'F1'})]));
  expect(report.summary.sameFitidWarnings).toBe(2);expect(report.cases[0].duplicates.sameFitidIds).toEqual(['b']);expect(report.cases[0].duplicates.proofOfBusinessDuplicate).toBe(false);
 });
 it('não confunde identificadores iguais de contas diferentes ou desconhecidas',()=>{
  const state=data([transaction('a',{fitid:'F1'}),transaction('b',{fitid:'F1',extratoId:'other'})]);state.extratos.push({id:'other',status:'ativo',banco:'Banco',conta:'456'});
  expect(triageBankTransactions(state).summary.sameFitidWarnings).toBe(0);
  state.extratos=[];expect(triageBankTransactions(state).summary.sameFitidWarnings).toBe(0);
 });
 it('reconhece a revisão anterior pelo ID, sem escolher destino',()=>{
  const report=triageBankTransactions(data([transaction('a')]),{previousReviewIds:['a']});
  expect(report.summary.previouslyReviewed).toBe(1);expect(report.cases[0].hypothesis?.confirmed||false).toBe(false);
 });
 it('não trata nome de funcionário como CPF/Pix exato',()=>{
  const state=data([transaction('a',{contraparteNome:'Pessoa conhecida'} )]);state.employees=[{id:'e',name:'Pessoa conhecida',dailyRate:100,active:true}];
  const report=triageBankTransactions(state);expect(report.summary.exactIdentity).toBe(0);expect(report.summary.automationEligible).toBe(0);
 });
 it('separa caixa existente para revisão sem torná-lo elegível à automação',()=>{
  const state=data([transaction('a',{valor:50})]);state.obras=[{id:'work'}];state.caixaObra=[{id:'cash',obraId:'work',tipo:'aporte',valor:50,data:'2026-07-20'}];
  const report=triageBankTransactions(state);
  expect(report.cases[0]).toMatchObject({classification:'candidate_review',hypothesis:{type:'caixaObra',financialTarget:true,confirmed:false},automationEligible:false,executable:false});
 });
 it('mantém trava de aporte mesmo em extrato arquivado',()=>{
  const state=data([transaction('mt7l9lt5xrta')]);state.extratos[0].status='arquivado';
  expect(triageBankTransactions(state).cases[0]).toMatchObject({classification:'archived',priority:'P0'});
 });
 it('recusa identificação repetida e valor inválido',()=>{
  expect(()=>triageBankTransactions(data([transaction('a'),transaction('a')]))).toThrow(/Identificação/);
  expect(()=>triageBankTransactions(data([transaction('a',{valor:Infinity})]))).toThrow(/Valor bancário/);
 });
 it('compara o movimento canônico pelo ID legado e preserva divergência para revisão',()=>{
  const report=triageBankTransactions(data([transaction('a')]),{tables:{bank_transactions:[{id:'native',amount:-51,metadata:{legacyId:'a'}}]}});
  expect(report.summary.nativeBankMismatches).toBe(1);expect(report.cases[0].nativeBank).toMatchObject({count:1,amountMatches:false,directionMatches:null});
 });
 it('compara módulo e direção separadamente no espelho canônico',()=>{
  const state=data([transaction('a')]),bank={id:'native',amount:50,direction:'out',metadata:{legacyId:'a'}};
  expect(triageBankTransactions(state,{tables:{bank_transactions:[bank]}}).summary.nativeBankMismatches).toBe(0);
  expect(triageBankTransactions(state,{tables:{bank_transactions:[{...bank,direction:'in'}]}}).summary.nativeBankMismatches).toBe(1);
 });
 it('neutraliza fórmulas no CSV de revisão',()=>{
  const csv=triageCsv([{id:'a',reason:'=HYPERLINK("x")',amountCents:5000}]);
  expect(csv).toContain("'=HYPERLINK");expect(csv).toContain('5000');
 });
});
