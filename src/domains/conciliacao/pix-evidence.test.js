import {describe,it,expect} from 'vitest';
import {criarIndicesFinanceiros} from './selectors.js';
import {gerarCandidatosConciliacao} from './matching.js';
import {criarRegistroIdentidades,identificarContraparte} from './identity.js';
import {findRegisteredEmployeePix} from './pix-card.js';

const data=()=>({fornecedores:[{id:'supplier',nome:'Fornecedor Exemplo',chavePix:'fornecedor@example.test'}],notasFiscais:[{id:'note',numero:'NF-1',valorLiquido:1500,fornecedorId:'supplier',fornecedorNome:'Fornecedor Exemplo',vencimento:'2026-11-17',pagamentos:[]}],pedidos:[],employees:[],terceirizados:[],medicoes:[],medicoesTerc:[],transacoes:[]});
const movement={id:'bank',valor:-1500,data:'2026-11-17',contraparteNome:'Fornecedor Exemplo',descricao:'PIX enviado'};
const candidate=(transaction,source)=>gerarCandidatosConciliacao(transaction,source,criarIndicesFinanceiros(source)).find(item=>item.entidadeId==='note');
describe('identificador bancário separado da evidência PIX',()=>{
 it.each(['fit:202611170772','h:2026-11-17|-1500|pix','12345678900','fornecedor@example.test'])('não transforma chave genérica %s em chave PIX nem bloqueia uma obrigação',key=>{
  const source=data(),before=JSON.stringify(source),base=candidate(movement,source);
  const result=candidate({...movement,chave:key},source);
  expect(result.bloqueios).toEqual(base.bloqueios);
  expect(result.evidenciaAutomatica.identidadeExata).toBe(base.evidenciaAutomatica.identidadeExata);
  expect(result.score).toBe(base.score);
  expect(JSON.stringify(source)).toBe(before);
 });
 it('mantém uma chave PIX explícita divergente como impedimento e aceita evidência explícita coincidente',()=>{
  const source=data();
  expect(candidate({...movement,chave:'fit:bank',chavePix:'outra@example.test'},source).bloqueios).toContain('Chave PIX incompatível com o fato financeiro');
  const match=candidate({...movement,chave:'fit:bank',pixKey:'fornecedor@example.test'},source);
  expect(match.bloqueios).not.toContain('Chave PIX incompatível com o fato financeiro');
  expect(match.evidenciaAutomatica.identidadeExata).toBe(true);
 });
 it('não identifica pessoa por chave de deduplicação, mesmo que ela coincida com um PIX cadastrado',()=>{
  const registry=criarRegistroIdentidades(data());
  expect(identificarContraparte({chave:'fornecedor@example.test'},registry).registro).toBeNull();
  expect(identificarContraparte({chavePix:'fornecedor@example.test'},registry).registro?.id).toBe('supplier');
 });
 it('não extrai telefone PIX de um FITID numérico para sugerir funcionário',()=>{
  const employees=[{id:'emp',name:'Pessoa Exemplo',pixKey:'12345678900',active:true}];
  expect(findRegisteredEmployeePix({valor:-100,chave:'fit:12345678900',descricao:'PIX Pessoa Exemplo'},employees)).toBeNull();
  expect(findRegisteredEmployeePix({valor:-100,chavePix:'12345678900',descricao:'PIX Pessoa Exemplo'},employees)?.employee.id).toBe('emp');
 });
 it('preserva identificador bancário exclusivo como evidência própria',()=>{
  const source=data();source.notasFiscais[0].fitid='bank-id';
  const result=candidate({...movement,fitid:'bank-id',chave:'fit:bank-id'},source);
  expect(result.evidenciaAutomatica.referenciaExata).toBe(true);
  expect(result.bloqueios).not.toContain('Chave PIX incompatível com o fato financeiro');
 });
});
