import {expect,it} from 'vitest';
import {buildFinancialLedger} from './ledger.js';
import {workCommitments} from './work-commitments.js';

const fixture=()=>({obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}],pedidos:[{id:'p',obraId:'a',status:'enviado',data:'2026-10-01',itens:[{qtd:1,precoUnit:1000}]}],
 terceirizados:[{id:'t',obraId:'a',name:'Prestador',tipoContrato:'medicao',active:true,contractValue:8000,etapas:[{id:'e',valor:8000}]}],
 medicoesTerc:[{id:'m',tercId:'t',obraId:'a',status:'aprovada',data:'2026-10-01',total:3000}],pagsTerceiros:[],
 notasFiscais:[{id:'nf',obraId:'a',pedidoId:'p',status:'aprovada',valorBruto:400,emissao:'2026-10-02'}]});
const report=data=>workCommitments(data,buildFinancialLedger(data),'a');

it('separa saldo de compra, saldo a medir e obrigação sem alterar custo, dados ou previsão',()=>{
 const data=fixture(),before=JSON.stringify(data),ledger=buildFinancialLedger(data);
 const result=workCommitments(data,ledger,'a');
 expect(result).toMatchObject({purchaseCents:60000,serviceCents:500000,incompleteCount:0});
 expect(result.services[0]).toMatchObject({contractCents:800000,approvedCents:300000,balanceCents:300000,remainingCents:500000});
 expect(result.services[0].entry.amountCents).toBe(500000);
 expect(JSON.stringify(data)).toBe(before);expect(buildFinancialLedger(data)).toEqual(ledger);
 expect(result).not.toHaveProperty('totalCents');
});

it('baixa espelhada na nota e na medição reduz a pagar uma vez, sem reduzir saldo a medir',()=>{
 const data=fixture(),payment={id:'pg',valor:1000,amount:1000,data:'2026-10-03',date:'2026-10-03',obraId:'a',tercId:'t',medicaoTercId:'m',status:'ativo'};
 data.pagsTerceiros=[payment];data.medicoesTerc[0].notaFiscalId='service-nf';
 data.notasFiscais.push({id:'service-nf',obraId:'a',medicaoTercId:'m',status:'aprovada',valorBruto:3000,emissao:'2026-10-01',pagamentos:[payment]});
 expect(report(data).services[0]).toMatchObject({approvedCents:300000,balanceCents:200000,remainingCents:500000});
});

it('medição em revisão não reduz o saldo; rejeição e cancelamento não viram custo aprovado',()=>{
 const data=fixture();data.medicoesTerc.push({id:'draft',tercId:'t',obraId:'a',status:'rascunho',total:500},
 {id:'rejected',tercId:'t',obraId:'a',status:'rejeitada',total:9999},{id:'cancelled',tercId:'t',obraId:'a',status:'cancelada',total:9999});
 expect(report(data).services[0]).toMatchObject({approvedCents:300000,pendingCents:50000,remainingCents:500000});
});

it('isola a obra e não inclui receita contratual do cliente, contratos inativos ou medições de outra obra',()=>{
 const data=fixture();data.commercialContractRecords=[{obraId:'a',valor:99999}];
 data.terceirizados.push({...data.terceirizados[0],id:'other',obraId:'b'},...['arquivado','cancelado','encerrado'].map(status=>({...data.terceirizados[0],id:status,status})),{...data.terceirizados[0],id:'inactive',active:false});
 data.medicoesTerc.push({id:'wrong-work',tercId:'t',obraId:'b',status:'aprovada',total:7777});
 const result=report(data);expect(result.services).toHaveLength(1);expect(result.serviceCents).toBe(500000);
 expect(result.services[0].issues.join(' ')).toContain('obra ausente ou divergente');
 expect(workCommitments(data,buildFinancialLedger(data),'missing')).toBeNull();
});

it('mantém contratos inválidos para conferência e declara o subtotal calculável',()=>{
 const data=fixture();data.terceirizados.push({...data.terceirizados[0],id:'invalid',contractValue:'inválido'},
 {...data.terceirizados[0],id:'missing',contractValue:'',etapas:[]});
 const result=report(data);expect(result.incompleteCount).toBe(2);expect(result.serviceCents).toBe(500000);
 expect(result.services.find(row=>row.id==='invalid').remainingCents).toBeNull();expect(result.reviewCount).toBe(2);
});

it('não reduz saldo por adiantamento sem vínculo e sinaliza medição acima do contrato',()=>{
 const data=fixture();data.pagsTerceiros=[{id:'advance',tercId:'t',obraId:'a',date:'2026-10-03',amount:500,reconhecerCusto:false}];
 expect(report(data).services[0]).toMatchObject({remainingCents:500000,balanceCents:300000});
 expect(report(data).services[0].issues.join(' ')).toContain('pagamento sem medição');
 data.medicoesTerc[0].total=9000;expect(report(data).services[0].remainingCents).toBe(0);
 expect(report(data).services[0].issues.join(' ')).toContain('superam o valor contratado');
});
