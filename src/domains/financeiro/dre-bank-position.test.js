import {describe,expect,it} from 'vitest';
import {dreBankPeriod,dreBankPosition} from './dre-bank-position.js';
import {buildFinancialLedger,selectDRE} from './ledger.js';

const period={start:'2026-11-01',end:'2026-11-30'};
const movement=(id,valor,data='2026-11-17',rest={})=>({id,valor,data,status:'conciliado',contaBancariaId:'a',...rest});
const closing=(rest={})=>({contaBancariaId:'a',status:'fechado',dataInicio:'2026-11-01',dataFim:'2026-11-30',
  saldoInicialCentavos:100000,creditosCentavos:529919,debitosCentavos:20000,saldoBancoCentavos:609919,saldoCalculadoCentavos:609919,...rest});
const base=()=>({
  transacoes:[movement('aporte-1',4000),movement('aporte-2',999.19,'2026-11-18'),movement('cliente',100,period.start),
    movement('transf',200,period.end,{vinculo:{tipo:'transferencia_interna'}}),movement('saida',-200,'2026-11-17',{status:'ignorado'}),
    movement('outra-conta',-200,'2026-11-17',{contaBancariaId:'b'}),movement('mes-anterior',50,'2026-10-31'),
    movement('futuro',100,'2026-12-01'),movement('revertido',490,'2026-11-19',{importReversal:'r'}),
    movement('sem-conta',570,'2026-11-19',{contaBancariaId:''})],
  caixaObra:[{id:'x1',transacaoId:'aporte-1',categoria:'capital_socio',tipo:'aporte',efeitoDRE:'sem_efeito',valor:4000},
    {id:'x2',transacaoId:'aporte-2',naturezaEntrada:'aporte_socio',tipo:'aporte',efeitoDRE:'sem_efeito',valor:999.19}],
  extratos:[{id:'x',status:'arquivado'}],fechamentosBancarios:[closing()],
});

describe('saldo bancário no DRE da empresa',()=>{
  it('fecha em centavos e mantém aportes dentro das entradas, com transferências por conta',()=>{
    const data=base(),before=structuredClone(data);
    const dre=selectDRE(buildFinancialLedger(data),{competence:'2026-11'});
    expect(dreBankPosition(data,'a',period)).toMatchObject({state:'checked',asOf:period.end,
      opening:100000,incoming:529919,contributions:499919,outgoing:20000,ending:609919,movements:5});
    expect(dreBankPosition(data,'b',period)).toMatchObject({state:'missing',incoming:0,outgoing:20000,opening:null,ending:null});
    expect(selectDRE(buildFinancialLedger(data),{competence:'2026-11'})).toEqual(dre);
    expect(data).toEqual(before);
  });
  it('considera só a parte de aporte do rateio e não soma a origem outra vez',()=>{
    const data=base();
    data.transacoes[0].rateios=[{categoria:'capital_socio',valor:3000},{categoria:'receita_servicos',valor:1000}];
    expect(dreBankPosition(data,'a',period).contributions).toBe(399919);
    data.transacoes[0].rateios[0].valor=4001;
    expect(dreBankPosition(data,'a',period)).toMatchObject({contributions:null,ending:609919});
  });
  it('preserva no saldo o movimento cujo extrato saiu da fila ativa por arquivamento',()=>{
    const data=base();
    data.transacoes[0].extratoId='x';
    expect(dreBankPosition(data,'a',period)).toMatchObject({state:'checked',incoming:529919,ending:609919,archived:1});
  });
  it('distingue saldo zero verificado de ausência de saldo',()=>{
    const zero={saldoBancoCentavos:0,saldoCalculadoCentavos:0,saldoInicialCentavos:0,creditosCentavos:0,debitosCentavos:0};
    expect(dreBankPosition({fechamentosBancarios:[closing(zero)]},'a',period)).toMatchObject({state:'checked',opening:0,ending:0});
    expect(dreBankPosition({contasBancarias:[{id:'a',saldoInicial:1000}],fechamentosBancarios:[closing({...zero,saldoBancoCentavos:null})]},'a',period)).toMatchObject({state:'missing',opening:null,ending:null});
  });
  it('atualiza a posição com movimentos importados após a data-base, sem repetir o dia fechado',()=>{
    const data=base();
    data.fechamentosBancarios=[closing({dataInicio:'2026-09-01',dataFim:'2026-10-29',saldoBancoCentavos:65000,saldoCalculadoCentavos:65000})];
    data.transacoes.push(movement('dia-do-fechamento',900,'2026-10-29'));
    expect(dreBankPosition(data,'a',period)).toMatchObject({state:'estimated',opening:70000,ending:579919,asOf:'2026-10-29'});
    expect(dreBankPosition(data,'a',{start:period.start,end:'2026-11-17'})).toMatchObject({state:'estimated',incoming:410000,contributions:400000,ending:460000});
  });
  it('sinaliza divergência de saldo ou composição e recusa duplicidade ou datas inválidas',()=>{
    const data=base();
    for(const item of [closing({saldoBancoCentavos:1}),closing({creditosCentavos:529920})]){
      expect(dreBankPosition({...data,fechamentosBancarios:[item]},'a',period)).toMatchObject({state:'divergent',ending:null,incoming:529919});
    }
    data.transacoes[0].fitid='duplicado';data.transacoes[1].fitid='duplicado';
    expect(dreBankPosition(data,'a',period)).toMatchObject({state:'invalid',ending:null,incoming:null});
    expect(dreBankPosition({...base(),transacoes:[movement('sem-data',10,'')]},'a',period).state).toBe('invalid');
  });
  it('sinaliza quando a abertura diverge do saldo bancário do dia anterior',()=>{
    const data=base();
    data.fechamentosBancarios.push(closing({dataInicio:'2026-10-01',dataFim:'2026-10-31',saldoBancoCentavos:99900,saldoCalculadoCentavos:99900}));
    expect(dreBankPosition(data,'a',period)).toMatchObject({state:'divergent',opening:null,ending:null});
  });
  it('desconsidera fechamentos reabertos e mantém pendências sem remover a entrada',()=>{
    const data=base();
    data.fechamentosBancarios[0].status='reaberto';
    data.transacoes[0].status='parcial';
    expect(dreBankPosition(data,'a',period)).toMatchObject({state:'missing',incoming:529919,pending:1,contributions:499919});
  });
  it('usa a competência selecionada, respeita hoje e reconhece fevereiro bissexto',()=>{
    expect(dreBankPeriod(2028,1,'2028-03-15')).toEqual({start:'2028-02-01',end:'2028-02-29'});
    expect(dreBankPeriod(2026,10,'2026-11-19')).toEqual({start:'2026-11-01',end:'2026-11-19'});
    expect(dreBankPosition({},'a',dreBankPeriod(2026,11,'2026-11-19')).state).toBe('future');
  });
});
