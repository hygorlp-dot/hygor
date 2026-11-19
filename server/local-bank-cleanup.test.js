// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {previewLocalBankCleanup,applyLocalBankCleanup} from './local-bank-cleanup.js';
const fixture=()=>({companyId:'arcd',localOnly:true,revision:0,data:{localCompanySimulation:{enabled:true,companyId:'arcd'},contasBancarias:[{id:'other',nome:'Outra conta'}],
  transacoes:[{id:'bank',extratoId:'statement',contaBancariaId:'',valor:-800,data:'2026-11-01',status:'conciliado',gerados:[{tipo:'despesasEmpresa',id:'cost'}]},{id:'keep-bank',contaBancariaId:'other',valor:-50,status:'pendente',gerados:[]}],
  extratos:[{id:'statement',contaBancariaId:''}],despesasEmpresa:[{id:'cost',valor:800,data:'2026-11-01',competencia:'2026-11',transacaoId:'bank'},{id:'independent',valor:10}],historicoConc:[{transacaoId:'bank'}]},
  tables:{bank_transactions:[{id:'native-bank',metadata:{legacyId:'bank'},account_id:null}],financial_titles:[{id:'title',metadata:{legacyType:'despesa_empresa',legacyId:'cost'}}],settlements:[{id:'settlement',bank_transaction_id:'native-bank',title_id:'title'}],reconciliation_links:[{id:'link',bank_transaction_id:'native-bank',title_id:'title',settlement_id:'settlement'}]}});
const command=state=>({companyId:'arcd',scope:'unassigned',reason:'Conferência da simulação local',confirmation:'Movimentos sem conta',expectedRevision:previewLocalBankCleanup(state,'unassigned').revision});
describe('limpeza de conciliação na simulação',()=>{
  it('remove só o valor criado pela conciliação e todas suas projeções, preservando outra conta',()=>{
    const state=fixture(),original=structuredClone(state),result=applyLocalBankCleanup(state,command(state),{id:'admin',role:'admin'});
    expect(result.ok).toBe(true);expect(state).toEqual(original);
    expect(result.state.data.transacoes.map(row=>row.id)).toEqual(['keep-bank']);expect(result.state.data.despesasEmpresa.map(row=>row.id)).toEqual(['independent']);
    for(const key of ['bank_transactions','financial_titles','settlements','reconciliation_links'])expect(result.state.tables[key]).toEqual([]);
    expect(result.state.data.contasBancarias).toEqual(original.data.contasBancarias);expect(result.preview.values.removedCosts).toBe(800);
  });
  it('preserva um pagamento preexistente e remove somente seu vínculo bancário',()=>{
    const state=fixture();state.data.transacoes[0].gerados=[];state.data.despesasEmpresa=[];state.data.payments=[{id:'independent',amount:800,transacaoId:'bank',conciliado:true}];state.tables={};
    const result=applyLocalBankCleanup(state,command(state),{id:'admin',role:'admin'});expect(result.ok).toBe(true);expect(result.state.data.payments).toHaveLength(1);expect(result.state.data.payments[0].transacaoId).toBeFalsy();expect(result.state.data.payments[0].amount).toBe(800);
  });
  it('recusa empresa, perfil, confirmação e revisão incorretos',()=>{
    const state=fixture();expect(applyLocalBankCleanup(state,{...command(state),companyId:'mrc'},{role:'admin'}).ok).toBe(false);
    expect(applyLocalBankCleanup(state,command(state),{role:'financeiro'}).ok).toBe(false);
    expect(applyLocalBankCleanup(state,{...command(state),confirmation:'outra'},{role:'admin'}).ok).toBe(false);
    expect(applyLocalBankCleanup(state,{...command(state),expectedRevision:'old'},{role:'admin'}).ok).toBe(false);
    delete state.data.localCompanySimulation;expect(applyLocalBankCleanup(state,command(state),{role:'admin'}).ok).toBe(false);
  });
  it('bloqueia lançamentos sem prova de origem, períodos fechados e liquidação nativa preexistente',()=>{
    const a=fixture();a.data.despesasEmpresa[0].transacaoId='other';expect(previewLocalBankCleanup(a,'unassigned').blockers.length).toBeGreaterThan(0);
    const b=fixture();b.data.fechamentosBancarios=[{status:'fechado',dataInicio:'2026-11-01',dataFim:'2026-11-30'}];expect(previewLocalBankCleanup(b,'unassigned').blockers.length).toBeGreaterThan(0);
    const c=fixture();c.tables.settlements[0].title_id='preexisting-title';expect(previewLocalBankCleanup(c,'unassigned').blockers.length).toBeGreaterThan(0);
  });
  it('recusa identidade repetida e divergência de conta entre movimento e extrato',()=>{
    const a=fixture();a.data.transacoes[0].gerados.push({...a.data.transacoes[0].gerados[0]});expect(previewLocalBankCleanup(a,'unassigned').blockers.join(' ')).toContain('repetido');
    const b=fixture();b.data.extratos[0].contaBancariaId='other';expect(previewLocalBankCleanup(b,'unassigned').blockers.join(' ')).toContain('diverge');
  });
  it('retira vínculos inativos pelo ID exato e bloqueia rateio múltiplo',()=>{
    const state=fixture();state.data.reconciliationLinks=[{transactionId:'bank',status:'reversed'},{transactionId:'keep-bank',status:'reversed'}];
    const result=applyLocalBankCleanup(state,command(state),{id:'admin',role:'admin'});expect(result.ok).toBe(true);expect(result.state.data.reconciliationLinks).toEqual([{transactionId:'keep-bank',status:'reversed'}]);
    const multiple=fixture();multiple.data.transacoes[0].vinculo={tipo:'conciliacao_multipla',id:'multi'};expect(previewLocalBankCleanup(multiple,'unassigned').blockers.join(' ')).toContain('múltiplo');
  });
});
