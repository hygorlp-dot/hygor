import {describe,it,expect} from 'vitest';
import {buildFinancialLedger} from './ledger.js';
import {todayQueues,overviewEntries,financialEntry} from './workspace.js';

const data={obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}],
  notasFiscais:[{id:'nf',obraId:'a',numero:'123',status:'aprovada',emissao:'2026-01-02',vencimento:'2026-01-20',valorBruto:100,documentos:[{nome:'NF',url:'https://example.com/nf.pdf'}],pagamentos:[{id:'pg',data:'2026-01-10',valor:30}]}],
  medicoes:[{id:'m',obraId:'a',competencia:'2026-01',dataEmissao:'2026-01-01',dataVencimento:'2026-01-19',valorPrevisto:200,recebimentos:[{id:'r',data:'2026-01-05',valor:50}]},{id:'other',obraId:'b',competencia:'2026-01',dataEmissao:'2026-01-01',dataVencimento:'2026-01-20',valorPrevisto:999}]};
describe('workspace financeiro',()=>{
  it('enriquece a ficha documental da medição com cliente da obra e número da parcela',()=>{
    const d={obras:[{id:'o',name:'Obra A',cliente:'Cliente da obra'}],medicoes:[{id:'m',obraId:'o',numeroParcela:'PAR-12',descricao:'Medição de fundação'}]};
    expect(financialEntry(d,{sourceType:'medicao',sourceId:'m'})).toMatchObject({counterparty:'Cliente da obra',documentNumber:'PAR-12'});
  });
  it('encontra fornecedor por cadastro sem atribuir o cliente da obra a uma despesa',()=>{
    const d={obras:[{id:'o',name:'Obra A',cliente:'Cliente da obra'}],fornecedores:[{id:'f',nome:'Fornecedor do pedido'}],pedidos:[{id:'p',obraId:'o',fornecedorId:'f'}],outrasDesp:[{id:'d',obraId:'o',documento:'REC-1'}]};
    expect(financialEntry(d,{sourceType:'pedido',sourceId:'p'}).counterparty).toBe('Fornecedor do pedido');
    expect(financialEntry(d,{sourceType:'outra_despesa',sourceId:'d'})).toMatchObject({documentNumber:'REC-1'});
    expect(financialEntry(d,{sourceType:'outra_despesa',sourceId:'d'}).counterparty||'').not.toBe('Cliente da obra');
  });
  it('encaminha data impossível à fila sem vencimento preservando o valor e a origem',()=>{
    const d={medicoes:[{id:'bad',obraId:'a',dataEmissao:'2026-02-01',dataVencimento:'2026-02-30',valorPrevisto:100}]};
    const queues=todayQueues(d,buildFinancialLedger(d),'a','2026-03-02');
    expect(queues.find(q=>q.id==='undated')).toMatchObject({amountCents:10000,items:[{sourceId:'bad',metadata:{vencimento:'2026-02-30',vencimentoInvalido:true}}]});
    expect(queues.find(q=>q.id==='overdue').items).toHaveLength(0);
  });
  it('usa saldo parcial, vencimento da nota e obra selecionada na fila Hoje',()=>{
    const q=todayQueues(data,buildFinancialLedger(data),'a','2026-01-20');
    expect(q.find(x=>x.id==='payToday').amountCents).toBe(7000);
    expect(q.find(x=>x.id==='receiveToday').items).toHaveLength(0);
    expect(q.find(x=>x.id==='overdue').amountCents).toBe(15000);
    expect(q.find(x=>x.id==='payToday').items[0].record.documentos[0].url).toContain('nf.pdf');
  });
  it('não inclui liquidações futuras nem títulos de outra obra na posição',()=>{
    const future={...data,notasFiscais:[{...data.notasFiscais[0],pagamentos:[{id:'future',data:'2026-02-01',valor:100}]}]};
    expect(todayQueues(future,buildFinancialLedger(future),'a','2026-01-20')[0].amountCents).toBe(10000);
  });
  it('preserva o recorte dos movimentos e a posição acumulada nos indicadores',()=>{
    const selected={ledger:buildFinancialLedger(data),per0:'2026-01-01',perF:'2026-01-31'};
    expect(overviewEntries(data,selected,'a','cashIn').reduce((s,e)=>s+e.amountCents,0)).toBe(5000);
    expect(overviewEntries(data,selected,'a','payable')[0].amountCents).toBe(7000);
    expect(overviewEntries(data,{...selected,per0:'2026-02-01',perF:'2026-02-28'},'a','cashIn')).toEqual([]);
  });
  it('resolve documento de pagamento de nota e não copia usuários ou configuração',()=>{
    const e=financialEntry({...data,usuarios:[{secret:'não copiar'}]},{sourceType:'pagamento_nota',sourceId:'nf',amountCents:3000});
    expect(e.record.numero).toBe('123');expect(JSON.stringify(e)).not.toContain('não copiar');
  });
});
