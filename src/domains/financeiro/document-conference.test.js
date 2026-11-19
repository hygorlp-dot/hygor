import {it,expect} from 'vitest';
import {documentConferenceRows,bankExpenseContext} from './document-conference.js';
import {documentRegister} from './document-register.js';
import {applyClosingCorrection,CLOSING_CORRECTION_COMMAND} from './closing-correction.js';
import {buildFinancialLedger,selectDRE} from './ledger.js';

const month='2026-11';
const date=month+'-18';
const original={id:'xml',url:'https://example.test/original.xml'};
const proof={id:'proof',url:'https://example.test/pagamento.pdf'};
const note={id:'n',numero:'100',pedidoId:'p',obraId:'a',emissao:date,categoria:'material',status:'aprovada',fornecedorId:'f',chave:'nota-100',
 valorBruto:100,retencoes:{iss:5},rateios:[{obraId:'a',valor:100}],documentos:[original],
 pagamentos:[{id:'payment',valor:95,transacaoId:'invoice-bank',comprovantes:[proof]}]};
const fixture=()=>({
 obras:[{id:'a',name:'Obra QA'}],
 pedidos:[{id:'p',numero:'PC-01',obraId:'a',status:'recebido',itens:[{id:'i',qtd:2,qtdRecebida:2,precoUnit:50,recebimentos:[{id:'receipt',data:date,qtd:2}]}]}],
 notasFiscais:[note],
 despesasEmpresa:Array.from({length:7},(_,i)=>({id:`expense-${i}`,data:date,status:'ativo',origem:'banco',transacaoId:`bank-${i}`,valor:25,categoria:'outros'})),
 transacoes:Array.from({length:7},(_,i)=>({id:`bank-${i}`,data:date,contaBancariaId:'account',status:'conciliado',valor:-25})),
});
const list=data=>documentConferenceRows(data,documentRegister(data,{competence:month}));

it('mostra o nome do Pix só na conferência quando não há contraparte cadastrada',()=>{
 const data=fixture();
 const pix='Pix enviado: "Cp :18236120-M4 SERVIÇOS E COMÉRCIO LTDA"';
 data.fornecedores=[{id:'supplier',nome:'Fornecedor cadastrado'}];
 data.despesasEmpresa[1].fornecedorId='supplier';
 data.despesasEmpresa[3].descricao='[Extrato] Pix enviado: "00019 123456789 Pessoa Exemplo"';
 data.transacoes[0].descricao=pix;
 data.transacoes[1].descricao=pix;
 data.transacoes[2].descricao='Pix enviado: "12345678901"';
 data.transacoes.splice(3,1);
 const before=structuredClone(data);
 const rows=list(data);
 const expense=index=>rows.find(row=>row.record.id===`expense-${index}`);
 expect(expense(0)).toMatchObject({pixName:'M4 SERVIÇOS E COMÉRCIO LTDA',entry:{counterparty:''}});
 expect(expense(1)).toMatchObject({pixName:'',entry:{counterparty:'Fornecedor cadastrado'}});
 expect(expense(2).pixName).toBe('');
 expect(expense(3).pixName).toBe('Pessoa Exemplo');
 expect(data).toEqual(before);
});

it('rastreia a nota completa ao pedido e ao recebimento sem confundir original e comprovante',()=>{
 const data=fixture();
 const before=structuredClone(data);
 const row=list(data).find(item=>item.id==='nota_fiscal:n');
 expect(row).toMatchObject({issues:[],order:{numero:'PC-01'},match:{receivedCents:10000,status:'conciliado'},allocationTotal:10000,originals:[original]});
 expect(row.docs).toContain(proof);
 expect(data).toEqual(before);
});

it('sinaliza a falta do original, a possível duplicidade e a divergência de rateio',()=>{
 const data=fixture();
 data.notasFiscais=[{...note,id:'a1',documentos:[],rateios:[{obraId:'a',valor:90}]},{...note,id:'a2',numero:'101',status:'recebida',emissao:'2026-10-15'}];
 const row=list(data).find(item=>item.id==='nota_fiscal:a1');
 expect(row.issues).toEqual(expect.arrayContaining(['missing','duplicate','rateio','purchase']));
 expect(row.duplicates).toEqual(['101']);
});

it('traz as sete despesas à fila e remove somente a despesa que recebeu evidência',()=>{
 const data=fixture();
 const rows=list(data).filter(row=>row.issues.includes('bankEvidence'));
 expect(rows).toHaveLength(7);
 const context=bankExpenseContext(rows[0],{role:'admin'});
 expect(context.transactionIds).toEqual(['bank-0']);
 expect(bankExpenseContext(rows[0],{role:'admin',obraId:'a'})).toBeNull();
 const result=applyClosingCorrection(data,{
  type:CLOSING_CORRECTION_COMMAND.CLOSING_SOURCE_CORRECTED,actorId:'qa',expectedVersion:0,
  payload:{sourceType:'despesa_empresa',sourceId:'expense-0',reason:'Original conferido na origem.',changes:{documentos:[proof]}},
 },'2026-11-20T13:00:00Z');
 expect(result.ok).toBe(true);
 expect(list(result.data).filter(row=>row.issues.includes('bankEvidence'))).toHaveLength(6);
 expect(result.data.transacoes).toBe(data.transacoes);
 expect(selectDRE(buildFinancialLedger(result.data),{competence:month})).toEqual(selectDRE(buildFinancialLedger(data),{competence:month}));
});

it('só reconhece exceção formal da própria competência e mantém casos sem identidade bancária explícita',()=>{
 const data=fixture();
 data.fechamentosFinanceiros=[{status:'fechado',competencia:month,documentException:{documentIds:['despesa_empresa:expense-2'],reason:'Aguardando original'}}];
 const rows=list(data);
 expect(rows.find(row=>row.record.id==='expense-2')).toMatchObject({exception:{reason:'Aguardando original'},issues:['missing']});
 const unlinked={id:'expense-no-link',data:date,valor:25,categoria:'outros'};
 const item=list({...data,despesasEmpresa:[unlinked]}).find(row=>row.record===unlinked);
 expect(item.transaction).toBeUndefined();
 expect(item.issues).not.toContain('bankEvidence');
});
