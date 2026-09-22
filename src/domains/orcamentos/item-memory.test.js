import { expect, it } from 'vitest';
import { calculateItemMemory, blankItemMemory } from './item-memory-models';
import { startItemMemory, saveItemMemory, syncItemMemories, suggestItemMemory, itemMemoryRows, evaluateItemMemory, reusableItemModel, compatibleItemModels, auditItemMemories } from './item-memory';
import { clonarEstruturaOrcamento } from './budget-clone';
import { addBudgetFloor } from './budget-floors';
import { budgetChangeReceipt, undoBudgetChange } from './budget-workflow';

const base = () => ({id:'b',etapas:[{id:'s',nome:'ALVENARIA (TÉRREO)'}],itens:[{id:'i',etapaId:'s',codigo:'103317',fonte:'SINAPI',descricao:'ALVENARIA DE VEDAÇÃO DE BLOCOS',unidade:'M2',quantidade:20,precoUnit:50}]});
const filled = item => ({...startItemMemory(item),rows:[{id:'r1',local:'Sala',operation:'add',values:{length:'4',height:'2,80',count:1}},{id:'r2',local:'Porta',operation:'subtract',values:{length:'.8',height:'2.1',count:1}}]});

it('calcula parede com vão em português sem duplicar faces de alvenaria',()=>{
  expect(calculateItemMemory(filled(base().itens[0]),'m²')).toMatchObject({valid:true,total:9.52});
});
it.each([
  ['surface','M2',{length:4,height:2.8,faces:2,count:1},22.4],
  ['area','M2',{length:3,width:4,count:2},24],
  ['strip','M2',{length:10,width:.4,count:1},4],
  ['layer','M3',{length:10,width:2,thickness:5,count:1},1],
  ['volume','M3',{length:10,width:.4,height:.6,count:1},2.4],
  ['lintel','M',{length:1.2,bearing:.2,count:1},1.6],
  ['perimeter','M',{width:1.2,height:1,count:1},4.4],
  ['linear','M',{length:12,count:1},12],
  ['count','UN',{quantity:5},5],
])('mede %s na unidade correta', (model,unit,values,total)=>{
  expect(calculateItemMemory({model,unit,rows:[{id:'r',local:'Local',operation:'add',values}]},unit)).toMatchObject({valid:true,total});
});
it('distingue zero de ausência e bloqueia negativos, infinitos e descontos excessivos',()=>{
  const item=base().itens[0],record=filled(item);
  for(const value of ['',null,undefined,-1,'Infinity','1.000,00','1+2']){
    const invalid=structuredClone(record);invalid.rows[0].values.length=value;
    expect(calculateItemMemory(invalid,'M2').valid).toBe(false);
  }
  record.rows=[{...record.rows[0],values:{length:0,height:2,count:1}}];
  expect(calculateItemMemory(record,'M2')).toMatchObject({valid:true,total:0});
  record.rows[0].values.length=3;record.rows[0].operation='subtract';
  expect(calculateItemMemory(record,'M2').errors).toContain('Os descontos ultrapassam o total medido.');
  expect(calculateItemMemory(record,'M3').valid).toBe(false);
});
it('não confunde portas para pintura com pintura em UN nem porcelanato com emboço citado como exclusão',()=>{
  expect(suggestItemMemory({descricao:'KIT DE PORTA DE MADEIRA PARA PINTURA',unidade:'UN'})).toEqual({model:'count',warning:''});
  expect(suggestItemMemory({descricao:'REVESTIMENTO PORCELANATO, EXCLUSIVE REGULARIZAÇÃO OU EMBOÇO',unidade:'M2',stagePath:'PISO INTERNO'}).model).toBe('area');
  expect(suggestItemMemory({descricao:'IMPERMEABILIZAÇÃO COM 3 DEMÃOS',unidade:'M2',stagePath:'PISO INTERNO'}).model).toBe('area');
  expect(suggestItemMemory({descricao:'EMASSAMENTO DE SUPERFÍCIE',unidade:'UN'}).warning).not.toBe('');
});
it('salva no item estável, preserva preço e outros itens, desfaz e reaplica sem somar',()=>{
  const b=base();b.itens.push({...b.itens[0],id:'other',quantidade:40});
  const saved=saveItemMemory(b,'i',filled(b.itens[0]));
  expect(saved.itens.map(i=>i.quantidade)).toEqual([9.52,40]);
  expect(saved.itens[0].precoUnit).toBe(50);
  expect(syncItemMemories(saved).changes).toEqual([]);
  expect(undoBudgetChange(saved,budgetChangeReceipt(b,saved))).toEqual(b);
  const moved={...saved,itens:[saved.itens[1],saved.itens[0]]};
  expect(syncItemMemories(moved).budget.itens[1].quantidade).toBe(9.52);
  expect(b.itens[0].quantidade).toBe(20);
});
it('rascunho mantém quantidade; composição alterada suspende reaplicação; aprovado é imutável',()=>{
  const b=base(),record=startItemMemory(b.itens[0]);
  expect(saveItemMemory(b,'i',record,{draft:true}).itens[0].quantidade).toBe(20);
  expect(()=>saveItemMemory(b,'i',record)).toThrow('Linha');
  const saved=saveItemMemory(b,'i',filled(b.itens[0]));
  saved.itens[0].descricao='Outro serviço';saved.itens[0].quantidade=30;
  expect(syncItemMemories(saved).budget.itens[0].quantidade).toBe(30);
  expect(evaluateItemMemory(saved.itens[0],saved).errors[0]).toContain('composição');
  expect(auditItemMemories(saved)[0].destination).toBe('item-memory');
  expect(()=>saveItemMemory({...b,versionStatus:'aprovado'},'i',filled(b.itens[0]))).toThrow('revisão');
});
it('protege vínculos existentes e disciplinas sem confundir ar condicionado ou impermeabilização',()=>{
  const b=base();b.memoriaCalculo={vinculosEstruturais:{'terreo-alvenaria.area':'i'}};
  expect(()=>saveItemMemory(b,'i',filled(b.itens[0]))).toThrow('existente');
  b.itens=[['a','ESCORAMENTO DE FÔRMAS DE LAJE','M3'],['e','CABO DE COBRE FLEXÍVEL','M'],['h','TUBO PVC ESGOTO','M'],['ac','TUBO EM COBRE FLEXÍVEL PARA AR CONDICIONADO','M'],['im','TRATAMENTO DE RALO COM ARGAMASSA POLIMÉRICA','UN']].map(([id,descricao,unidade])=>({id,descricao,unidade,etapaId:'s'}));
  expect(itemMemoryRows(b).map(i=>!!i.owner)).toEqual([true,true,true,false,false]);
});
it('biblioteca só transfere modelo para mesma composição; cópias zeradas não herdam medidas',()=>{
  const b=base(),record=filled(b.itens[0]);record.source='Projeto privado';record.note='Sala do cliente';
  const model=reusableItemModel(b.itens[0],record,'Parede','template');
  expect(model).not.toHaveProperty('rows');expect(model).not.toHaveProperty('source');expect(model).not.toHaveProperty('note');
  expect(compatibleItemModels(b.itens[0],[model])).toHaveLength(1);
  expect(compatibleItemModels({...b.itens[0],codigo:'different'},[model])).toHaveLength(0);
  b.itens[0].memorialMedicao=record;let n=0;
  const cloned=clonarEstruturaOrcamento(b,()=>`id${n++}`,{zerarQuantidades:true});
  expect(cloned.itens[0].memorialMedicao.rows).toEqual([]);
  expect(cloned.itens[0].quantidade).toBe(0);
  const floor=addBudgetFloor(b,{nome:'Novo',nivel:'3',origem:'terreo',etapaId:'s'},()=>`id${n++}`);
  expect(floor.itens[1].memorialMedicao).toEqual(blankItemMemory(record));
});
