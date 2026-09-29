import { describe, expect, it } from 'vitest';
import { boxGeometry, boxWarnings, describeBoxMeasure, evaluateBoxLink, removeBoxElement, saveBoxElement, suggestBoxMeasure } from './box-memory';
import { auditItemMemories, existingMemoryOwner, itemMemoryRows, syncItemMemories } from './item-memory';
import { clonarEstruturaOrcamento } from './budget-clone';

const ITENS = [
  ['c','97083','COMPACTAÇÃO MECÂNICA DE SOLO PARA EXECUÇÃO DE RADIER, PISO DE CONCRETO OU LAJE SOBRE SOLO','M2'],
  ['l','96619','LASTRO DE CONCRETO MAGRO, APLICADO EM BLOCOS DE COROAMENTO OU SAPATAS, ESPESSURA DE 5 CM. AF_01/2024','M2'],
  ['t','97090','ARMAÇÃO PARA EXECUÇÃO DE RADIER, PISO DE CONCRETO OU LAJE SOBRE SOLO, COM USO DE TELA Q-138. AF_07/2026','KG'],
  ['r','97101','EXECUÇÃO DE RADIER, ESPESSURA DE 10 CM, FCK = 30 MPA, COM USO DE FORMAS EM MADEIRA SERRADA. AF_07/2026','M2'],
  ['a','89455','ALVENARIA DE BLOCOS DE CONCRETO ESTRUTURAL 14X19X39 CM (ESPESSURA 14 CM), FBK = 14 MPA','M2'],
  ['ch','87879','CHAPISCO APLICADO EM ALVENARIAS E ESTRUTURAS DE CONCRETO INTERNAS, COM COLHER DE PEDREIRO','M2'],
  ['e','104207','EMBOÇO OU MASSA ÚNICA EM ARGAMASSA TRAÇO 1:2:8, PREPARO MECÂNICO COM BETONEIRA 400 L','M2'],
  ['i3','98555','IMPERMEABILIZAÇÃO DE SUPERFÍCIE COM ARGAMASSA POLIMÉRICA / MEMBRANA ACRÍLICA, 3 DEMÃOS. AF_09/2023','M2'],
  ['i4','98556','IMPERMEABILIZAÇÃO DE SUPERFÍCIE COM ARGAMASSA POLIMÉRICA / MEMBRANA ACRÍLICA, 4 DEMÃOS, REFORÇADA COM VÉU DE POLIÉSTER','M2'],
  ['lj','101963','LAJE PRÉ-MOLDADA UNIDIRECIONAL, BIAPOIADA, PARA PISO, ENCHIMENTO EM CERÂMICA, VIGOTA CONVENCIONAL','M2'],
  ['tb','94796',"TORNEIRA DE BOIA PARA CAIXA D'ÁGUA, ROSCÁVEL, 3/4\" - FORNECIMENTO E INSTALAÇÃO. AF_08/2021",'UN'],
];
const budget = () => ({
  id:'b',etapas:[{id:'res',nome:'RESERVATÓRIO'}],
  itens:ITENS.map(([id,codigo,descricao,unidade])=>({id,fonte:'SINAPI',codigo,descricao,unidade,etapaId:'res',quantidade:0,precoUnit:10})),
});
// 2,00 × 1,50 × 1,20 m internos, parede de 14 cm → 2,28 × 1,78 m externos.
const caixa = {id:'cx',nome:'Reservatório inferior',etapaId:'res',comprimento:'2',largura:'1,5',altura:'1,2',espessuraCm:'14',quantidade:'1',fonte:'Planta A-02'};
const linksSugeridos = b => b.itens.map(i=>({itemId:i.id,...suggestBoxMeasure(i)}));
const qtd = b => Object.fromEntries(b.itens.map(i=>[i.id,i.quantidade]));

describe('memória facilitada de reservatório retangular',()=>{
  it('sugere uma medida para cada um dos 11 serviços do reservatório',()=>{
    expect(Object.fromEntries(budget().itens.map(i=>[i.id,suggestBoxMeasure(i).measure]))).toEqual({
      c:'fundo_externo',l:'fundo_externo',t:'tela_fundo',r:'fundo_externo',a:'paredes_eixo',ch:'paredes_internas',
      e:'paredes_ambas',i3:'paredes_externas',i4:'interno_total',lj:'tampa',tb:'quantidade',
    });
    expect(suggestBoxMeasure(budget().itens[2]).factor).toBe('2.2');
  });

  it('calcula todos os itens a partir de uma única medida da caixa, em duas casas como a planilha',()=>{
    const next=saveBoxElement(budget(),caixa,linksSugeridos(budget()));
    expect(qtd(next)).toEqual({
      c:4.06,l:4.06,t:8.93,r:4.06,a:9.07,ch:8.4,e:18.14,i3:9.74,i4:11.4,lj:4.06,tb:1,
    });
  });

  it('a sobra estende só o fundo; tampa e paredes continuam na face da parede',()=>{
    const next=saveBoxElement(budget(),{...caixa,sobraCm:'10'},linksSugeridos(budget()));
    // (2 + 0,28 + 0,20) × (1,5 + 0,28 + 0,20) = 2,48 × 1,98
    expect(qtd(next)).toMatchObject({c:4.91,l:4.91,r:4.91,t:10.8,lj:4.06,a:9.07});
  });

  it('mostra a conta com os números reais para conferir contra a planta',()=>{
    const g=boxGeometry(caixa);
    expect(describeBoxMeasure('fundo_externo',g,'','M2')).toBe('(2,00 + 2×0,14) × (1,50 + 2×0,14) = 2,28 × 1,78 = 4,06 m²');
    expect(describeBoxMeasure('tela_fundo',g,'2.2','KG')).toBe('(2,00 + 2×0,14) × (1,50 + 2×0,14) = 2,28 × 1,78 × 2,20 = 8,93 kg');
    expect(describeBoxMeasure('quantidade',boxGeometry({...caixa,quantidade:'2'}),'','UN')).toBe('1 × 2 reservatórios = 2,00 un');
  });

  it('avisa, sem bloquear, quando a unidade parece trocada',()=>{
    expect(boxWarnings(boxGeometry(caixa))).toEqual([]);
    expect(boxWarnings(boxGeometry({...caixa,espessuraCm:'0,14'}))[0]).toContain('metros');
    expect(boxWarnings(boxGeometry({...caixa,altura:'120'}))[0]).toContain('centímetros');
  });

  it('multiplica pela quantidade de reservatórios iguais e reaplica ao mudar as medidas',()=>{
    const first=saveBoxElement(budget(),caixa,linksSugeridos(budget()));
    const changed={...first,elementosMemoria:[{...first.elementosMemoria[0],comprimento:'3',quantidade:'2'}]};
    const synced=syncItemMemories(changed).budget;
    expect(qtd(synced).tb).toBe(2);
    expect(qtd(synced).a).toBe(22.94);
  });

  it('libera radier, armação, laje e torneira que o memorial por descrição travava',()=>{
    const before=itemMemoryRows(budget());
    expect(before.filter(i=>i.owner).map(i=>i.id)).toEqual(['t','r','lj','tb']);
    const next=saveBoxElement(budget(),caixa,linksSugeridos(budget()));
    expect(itemMemoryRows(next).filter(i=>i.owner)).toEqual([]);
    expect(auditItemMemories(next)).toEqual([]);
  });

  it('nunca assume o controle de item com vínculo estrutural explícito',()=>{
    const b={...budget(),memoriaCalculo:{vinculosEstruturais:{'terreo-laje.area':'lj'}}};
    expect(()=>saveBoxElement(b,caixa,linksSugeridos(b))).toThrow('memorial estrutural');
    expect(existingMemoryOwner({id:'lj',memorialMedicao:{model:'element'}},b)?.discipline).toBe('estrutural');
  });

  it('bloqueia medidas incompletas, unidade trocada e taxa ausente sem mexer no orçamento',()=>{
    expect(boxGeometry({...caixa,altura:''}).errors[0]).toContain('altura');
    expect(boxGeometry({...caixa,quantidade:'1,5'}).valid).toBe(false);
    const item=budget().itens[4];
    expect(evaluateBoxLink({elementId:'cx',measure:'volume_util'},item,{elementosMemoria:[caixa]}).errors[0]).toContain('m³');
    expect(()=>saveBoxElement(budget(),caixa,[{itemId:'t',measure:'tela_fundo',factor:''}])).toThrow('taxa');
  });

  it('item retirado da seleção ou reservatório excluído preserva a quantidade e perde só o vínculo',()=>{
    const next=saveBoxElement(budget(),caixa,linksSugeridos(budget()));
    const partial=saveBoxElement(next,caixa,linksSugeridos(next).filter(l=>l.itemId!=='a'));
    expect(partial.itens.find(i=>i.id==='a')).toMatchObject({quantidade:9.07});
    expect(partial.itens.find(i=>i.id==='a').memorialMedicao).toBeUndefined();
    const removed=removeBoxElement(next,'cx');
    expect(removed.elementosMemoria).toEqual([]);
    expect(qtd(removed)).toEqual(qtd(next));
    expect(removed.itens.every(i=>!i.memorialMedicao)).toBe(true);
  });

  it('não leva o vínculo do reservatório ao copiar o orçamento para outra obra',()=>{
    const next=saveBoxElement(budget(),caixa,linksSugeridos(budget()));
    let n=0;
    const {itens}=clonarEstruturaOrcamento(next,()=>`id${n++}`);
    expect(itens.every(i=>!i.memorialMedicao)).toBe(true);
    expect(itens[0].quantidade).toBe(4.06);
  });
});
