import {describe,it,expect} from 'vitest';
import {criarRegistroIdentidades,identificarContraparte} from './identity.js';
import {analisarMovimentoConciliacao} from './engine.js';
import {classificarAutomacao} from './automation.js';

const fixture=()=>({obras:[{id:'a'},{id:'b'},{id:'c'}],terceirizados:[
 {id:'provider',prestadorId:'provider',name:'Marcos Exemplo',obraId:'a',active:true},
 {id:'contract-b',prestadorId:'provider',name:'MARCOS EXEMPLO',obraId:'b',active:true},
 {id:'contract-c',prestadorId:'provider',name:'Marcos Exemplo',obraId:'c',active:true},
]});
const transaction={id:'bank',data:'2026-07-21',valor:-2000,fitid:'unique-bank',descricao:'Pix enviado: "Cp :18236120-Marcos Exemplo"'};

describe('identidade do prestador compartilhada entre contratos',()=>{
 it('reaproveita prestadorId, preserva os três contratos e não autoriza pagamento por nome',()=>{
  const data=fixture(),before=structuredClone(data),registry=criarRegistroIdentidades(data);
  const identity=identificarContraparte(transaction,registry);
  expect(identity.conflito).toBe(false);
  expect(identity.registro).toMatchObject({id:'provider',tipo:'terceirizado'});
  expect(identity.registro.contratos).toEqual(expect.arrayContaining(['provider','contract-b','contract-c']));
  expect(identity.registro.obras).toEqual(expect.arrayContaining(['a','b','c']));
  const analysis=analisarMovimentoConciliacao(transaction,data);
  const candidates=[analysis.melhorCandidata,...analysis.alternativas].filter(c=>c?.tipo==='terceiro');
  expect(new Set(candidates.map(c=>c.entidadeId))).toEqual(new Set(['provider','contract-b','contract-c']));
  expect(classificarAutomacao(transaction,analysis,data).automatica).toBe(false);
  expect(data).toEqual(before);
 });
 it('mantém homônimos com prestadorId diferente em conflito',()=>{
  const data=fixture();data.terceirizados[1].prestadorId='another-provider';
  expect(identificarContraparte(transaction,criarRegistroIdentidades(data)).conflito).toBe(true);
 });
 it.each([
  ['documento','11111111111','22222222222'],
  ['pixKey','first@example.test','second@example.test'],
  ['name','Marcos Exemplo','Outra Pessoa'],
  ['tipoPessoa','PF','PJ'],
 ])('preserva conflito quando %s diverge sob o mesmo prestadorId',(field,first,second)=>{
  const data=fixture();data.terceirizados[0][field]=first;data.terceirizados[1][field]=second;
  expect(identificarContraparte(transaction,criarRegistroIdentidades(data)).conflito).toBe(true);
 });
 it('não reúne contratos somente pelo nome quando não há prestadorId',()=>{
  const data=fixture();data.terceirizados.forEach(c=>delete c.prestadorId);
  expect(identificarContraparte(transaction,criarRegistroIdentidades(data)).conflito).toBe(true);
 });
 it('preserva documento e Pix de origem quando outros contratos não os repetem',()=>{
  const data=fixture();Object.assign(data.terceirizados[0],{documento:'11111111111',pixKey:'owner@example.test'});
  const identity=identificarContraparte({contraparteDocumento:'11111111111',pixKey:'owner@example.test'},criarRegistroIdentidades(data));
  expect(identity.conflito).toBe(false);expect(identity.registro.id).toBe('provider');
  expect(identity.registro.contratos).toHaveLength(3);
 });
});
