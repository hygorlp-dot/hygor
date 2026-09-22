import { expect, it } from 'vitest';
import { addBudgetFloor, memoryFloors } from './budget-floors';
import { structuralBudgetRows, applyStructuralBudgetLinks } from './structural-budget-apply';
import { structuralOrigin } from './structural-budget-matching';
import { aplicarCriterioEstrutural } from './structural-quantity-policy';

const original = () => ({
  etapas:[{id:'root',nome:'1º pavimento'}, {id:'v',parentId:'root',nome:'Vigas'}, {id:'a',parentId:'root',nome:'Alvenaria'}, {id:'other',nome:'Outro'}],
  itens:[{id:'i',etapaId:'v',descricao:'Fôrma de vigas',unidade:'M2',quantidade:45,precoUnit:20,composicao:{itens:[{coeficiente:2}]}},
    {id:'wall',etapaId:'a',descricao:'Alvenaria de blocos de concreto',unidade:'M2',quantidade:90,precoUnit:40}, {id:'outside',etapaId:'other',quantidade:99}],
  memoriaCalculo:{pavimento1:{viga:{formaM2:45,concretoM3:10,acoPorBitola:[{bitola:'10',kg:30}]},laje:{areaVigotaM2:20}},
    resumosProjeto:{pavimento1:{viga:{formaM2:45,concretoM3:10}}},
    vinculosEstruturais:{'pavimento1-vigas.forma':'i','pavimento1-alvenaria.alvenaria':'wall'},
    aplicacoesEstruturais:{'pavimento1-vigas.forma':'i'}},
});
const create = (budget=original(), patch={}) => {
  let id=0;
  return addBudgetFloor(budget,{nome:'2º pavimento',nivel:'6,20',origem:'pavimento1',etapaId:'root',...patch},()=>`new${++id}`);
};
it('copia subetapas e composições com novos IDs, sem alterar origem ou outras etapas',()=>{
  const budget=original(), before=structuredClone(budget), next=create(budget);
  expect(budget).toEqual(before);
  expect(next.etapas).toHaveLength(7);
  expect(next.itens).toHaveLength(5);
  expect(next.itens.slice(3).map(i=>i.quantidade)).toEqual([0,0]);
  expect(next.itens[3].precoUnit).toBe(20);
  expect(next.itens[3].composicao).toEqual(budget.itens[0].composicao);
  expect(next.itens[3].composicao).not.toBe(budget.itens[0].composicao);
  expect(new Set(next.itens.map(i=>i.id)).size).toBe(5);
  const f=memoryFloors(next.memoriaCalculo).at(-1);
  expect(f).toMatchObject({nome:'2º pavimento',nivelM:6.2,temLaje:true});
  expect(next.etapas.find(s=>s.id===f.etapaId).nome).toBe(f.nome);
  expect(structuralOrigin(`${f.id}-vigas`,next.memoriaCalculo).floor).toBe(f.nome);
  expect(Object.values(structuralBudgetRows(next)).flat().filter(r=>!r.pending).every(r=>Number.isFinite(r.value))).toBe(true);
  expect(aplicarCriterioEstrutural(next.memoriaCalculo)[f.id].viga.formaM2).toBe(0);
});
it('vincula somente aos itens novos e aplica quantidades independentes',()=>{
  const next=create(), f=memoryFloors(next.memoriaCalculo).at(-1);
  next.memoriaCalculo[f.id].viga.formaM2=12;
  next.memoriaCalculo[f.id].alvenaria.areaM2=34;
  const applied=applyStructuralBudgetLinks(next,`${f.id}-vigas`);
  expect(applied.ok).toBe(true);
  expect(applied.budget.itens[0].quantidade).toBe(45);
  expect(applied.budget.itens[3].quantidade).toBe(12);
  expect(applyStructuralBudgetLinks(applied.budget,`${f.id}-alvenaria`).budget.itens[4].quantidade).toBe(34);
});
it('aceita subsolo e modelo térreo com laje disponível e quantidades zeradas',()=>{
  const next=create(original(),{origem:'terreo',nivel:'-3'}), f=memoryFloors(next.memoriaCalculo).at(-1);
  expect(f.nivelM).toBe(-3);
  expect(structuralBudgetRows(next)[`${f.id}-laje`]).toBeDefined();
  expect(structuralBudgetRows(next)[`${f.id}-vigas`].find(r=>r.key==='magro')).toBeDefined();
});
it('rejeita nome duplicado, cota inválida, etapa ausente e orçamento aprovado',()=>{
  for(const patch of [{nome:''},{nome:'Térreo'},{nivel:''},{nivel:'abc'},{etapaId:'missing'}]) expect(()=>create(original(),patch)).toThrow();
  expect(()=>create({...original(),versionStatus:'aprovado'})).toThrow();
});
