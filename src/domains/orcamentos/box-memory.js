import { itemMemorySignature, measureNumber, measurementUnit } from './item-memory-models';
import { normalizeStructuralText } from './structural-budget-matching';
import { budgetIsImmutable } from './calculations';

// Caixa retangular (reservatório, cisterna, caixa enterrada): as medidas são
// informadas UMA vez e cada item da etapa escolhe qual grandeza derivada usa.
// Dimensões internas (úteis); a espessura da parede gera as externas e a
// sobra estende só o fundo (radier/lastro/compactação) além da parede.

// Duas casas: é o que a planilha mostra, então o que o engenheiro confere na
// tela é exatamente o valor gravado.
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

export const BOX_DIMENSIONS = [
  {key:'comprimento',label:'Comprimento interno',unit:'m'},
  {key:'largura',label:'Largura interna',unit:'m'},
  {key:'altura',label:'Altura das paredes',unit:'m'},
  {key:'espessuraCm',label:'Espessura da parede',unit:'cm'},
  {key:'sobraCm',label:'Sobra do fundo',unit:'cm',optional:true},
  {key:'quantidade',label:'Reservatórios iguais',unit:'un'},
];

// Taxas nominais (kg/m²) das telas soldadas Q mais comuns. Ponto de partida
// editável: confira o catálogo do fabricante e inclua traspasse se o projeto pedir.
export const TELA_Q_KG_M2 = {61:0.97,75:1.21,92:1.48,113:1.8,138:2.2,159:2.52,196:3.11,246:3.91,283:4.48,335:5.37,396:6.28};

const UNIT_LABEL = {M2:'m²',M3:'m³',M:'m',KG:'kg',UN:'un'};
export const unitLabel = unit => UNIT_LABEL[measurementUnit(unit)] || String(unit || '').toLowerCase();
const n = value => Number(value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

// Fundo com sobra: a sobra só aparece na conta quando existe.
const fundo = g => g.s ? `(${n(g.C)} + 2×${n(g.e)} + 2×${n(g.s)}) × (${n(g.L)} + 2×${n(g.e)} + 2×${n(g.s)}) = ${n(g.Cf)} × ${n(g.Lf)}` : `(${n(g.C)} + 2×${n(g.e)}) × (${n(g.L)} + 2×${n(g.e)}) = ${n(g.Cf)} × ${n(g.Lf)}`;
const fundoFormula = '(C + 2e + 2s) × (L + 2e + 2s)';

export const BOX_MEASURE_GROUPS = ['Fundo','Paredes','Interior','Tampa','Perímetro','Volume','Quantidade'];

export const BOX_MEASURES = {
  fundo_externo:{group:'Fundo',label:'Fundo — externo com sobra',unit:'M2',formula:fundoFormula,calc:g=>g.Cf*g.Lf,explain:fundo},
  fundo_interno:{group:'Fundo',label:'Fundo — área interna',unit:'M2',formula:'C × L',calc:g=>g.C*g.L,explain:g=>`${n(g.C)} × ${n(g.L)}`},
  fundo_espessura:{group:'Fundo',label:'Fundo com sobra × espessura',unit:'M3',formula:`${fundoFormula} × espessura`,factor:{label:'Espessura',unit:'cm'},calc:(g,f)=>g.Cf*g.Lf*f/100,explain:(g,f)=>`${fundo(g)} × ${n(f/100)}`},
  tela_fundo:{group:'Fundo',label:'Tela no fundo com sobra × taxa',unit:'KG',formula:`${fundoFormula} × taxa`,factor:{label:'Taxa da tela',unit:'kg/m²'},calc:(g,f)=>g.Cf*g.Lf*f,explain:(g,f)=>`${fundo(g)} × ${n(f)}`},
  paredes_eixo:{group:'Paredes',label:'Paredes — área pelo eixo',unit:'M2',formula:'2 × (C + e + L + e) × H',calc:g=>2*(g.C+g.e+g.L+g.e)*g.H,explain:g=>`2 × (${n(g.C+g.e)} + ${n(g.L+g.e)}) × ${n(g.H)}`},
  paredes_internas:{group:'Paredes',label:'Paredes — face interna',unit:'M2',formula:'2 × (C + L) × H',calc:g=>2*(g.C+g.L)*g.H,explain:g=>`2 × (${n(g.C)} + ${n(g.L)}) × ${n(g.H)}`},
  paredes_externas:{group:'Paredes',label:'Paredes — face externa',unit:'M2',formula:'2 × (C + 2e + L + 2e) × H',calc:g=>2*(g.Ce+g.Le)*g.H,explain:g=>`2 × (${n(g.Ce)} + ${n(g.Le)}) × ${n(g.H)}`},
  paredes_ambas:{group:'Paredes',label:'Paredes — faces interna + externa',unit:'M2',formula:'face interna + face externa',calc:g=>2*(g.C+g.L)*g.H+2*(g.Ce+g.Le)*g.H,explain:g=>`2 × (${n(g.C)} + ${n(g.L)}) × ${n(g.H)} + 2 × (${n(g.Ce)} + ${n(g.Le)}) × ${n(g.H)}`},
  interno_total:{group:'Interior',label:'Interior — paredes + fundo (contato com água)',unit:'M2',formula:'2 × (C + L) × H + C × L',calc:g=>2*(g.C+g.L)*g.H+g.C*g.L,explain:g=>`2 × (${n(g.C)} + ${n(g.L)}) × ${n(g.H)} + ${n(g.C)} × ${n(g.L)}`},
  tampa:{group:'Tampa',label:'Tampa / laje — área externa',unit:'M2',formula:'(C + 2e) × (L + 2e)',calc:g=>g.Ce*g.Le,explain:g=>`${n(g.Ce)} × ${n(g.Le)}`},
  perimetro_eixo:{group:'Perímetro',label:'Perímetro pelo eixo',unit:'M',formula:'2 × (C + e + L + e)',calc:g=>2*(g.C+g.e+g.L+g.e),explain:g=>`2 × (${n(g.C+g.e)} + ${n(g.L+g.e)})`},
  perimetro_externo:{group:'Perímetro',label:'Perímetro externo',unit:'M',formula:'2 × (C + 2e + L + 2e)',calc:g=>2*(g.Ce+g.Le),explain:g=>`2 × (${n(g.Ce)} + ${n(g.Le)})`},
  volume_util:{group:'Volume',label:'Volume interno (C × L × H)',unit:'M3',formula:'C × L × H',calc:g=>g.C*g.L*g.H,explain:g=>`${n(g.C)} × ${n(g.L)} × ${n(g.H)}`},
  quantidade:{group:'Quantidade',label:'Um por reservatório',unit:'UN',formula:'quantidade de reservatórios',calc:()=>1,explain:()=>'1'},
};

export const measuresForUnit = unit => Object.entries(BOX_MEASURES).filter(([,m])=>m.unit===measurementUnit(unit));

export function boxGeometry(element){
  const errors=[], invalid=[], values={};
  for(const dim of BOX_DIMENSIONS){
    let value=measureNumber(element?.[dim.key]);
    if(value===null && dim.optional)value=0;
    let problem='';
    if(value===null)problem=`Preencha ${dim.label.toLowerCase()}.`;
    else if(!Number.isFinite(value) || value<0 || (!dim.optional && value===0))problem=`${dim.label}: use um número maior que zero, só com vírgula ou ponto decimal.`;
    else if(dim.key==='quantidade' && !Number.isInteger(value))problem='Reservatórios iguais: use um número inteiro.';
    if(problem){errors.push(problem);invalid.push(dim.key);}
    values[dim.key]=value;
  }
  if(errors.length)return {valid:false,errors,invalid};
  const e=values.espessuraCm/100, s=values.sobraCm/100;
  const Ce=values.comprimento+2*e, Le=values.largura+2*e;
  return {valid:true,errors:[],invalid:[],C:values.comprimento,L:values.largura,H:values.altura,e,s,n:values.quantidade,Ce,Le,Cf:Ce+2*s,Lf:Le+2*s};
}

// Avisos que não bloqueiam: pegam o erro mais comum (metro digitado no campo
// em cm e vice-versa) sem impedir uma caixa realmente fora do padrão.
export function boxWarnings(geometry){
  if(!geometry?.valid)return [];
  const out=[];
  if(geometry.e<0.05 || geometry.e>0.4)out.push(`Espessura de ${n(geometry.e*100)} cm: confira se não foi digitada em metros.`);
  if(geometry.C>20 || geometry.L>20)out.push('Comprimento ou largura acima de 20 m: confira se não foi digitado em centímetros.');
  if(geometry.H>5)out.push(`Altura de ${n(geometry.H)} m: confira se não foi digitada em centímetros.`);
  if(geometry.s>0.5)out.push(`Sobra de ${n(geometry.s*100)} cm além da parede: confira o valor.`);
  return out;
}

// Mesma forma de retorno de calculateItemMemory, para o resto do memorial
// (sync, conferência, painel item a item) tratar os dois tipos igual.
export function evaluateBoxLink(record,item,budget){
  const errors=[];
  const element=(budget?.elementosMemoria || []).find(e=>e.id===record?.elementId);
  const measure=BOX_MEASURES[record?.measure];
  if(!element)errors.push('O reservatório deste item foi removido. Vincule novamente ou meça pelo memorial item a item.');
  if(!measure)errors.push('Escolha qual medida do reservatório este item usa.');
  else if(measure.unit!==measurementUnit(item?.unidade))errors.push(`A medida escolhida é em ${unitLabel(measure.unit)}, mas o item é em ${unitLabel(item?.unidade) || '—'}.`);
  let factor=null;
  if(measure?.factor){
    factor=measureNumber(record.factor);
    if(factor===null || !Number.isFinite(factor) || factor<=0)errors.push(`Informe ${measure.factor.label.toLowerCase()} (${measure.factor.unit}).`);
  }
  const geometry=element?boxGeometry(element):null;
  if(geometry && !geometry.valid)errors.push(...geometry.errors);
  if(errors.length)return {valid:false,total:null,errors,rows:[]};
  const total=round(measure.calc(geometry,factor)*geometry.n);
  if(!Number.isFinite(total))return {valid:false,total:null,errors:['Resultado fora do limite numérico.'],rows:[]};
  return {valid:true,total,errors:[],rows:[]};
}

// Conta com os números reais, para conferir contra a planta.
export function describeBoxMeasure(key,geometry,factor,unit){
  const measure=BOX_MEASURES[key];
  if(!measure || !geometry?.valid)return '';
  const f=measure.factor?measureNumber(factor):null;
  if(measure.factor && !(f>0))return `${measure.formula}`;
  const total=round(measure.calc(geometry,f)*geometry.n);
  const each=geometry.n>1?` × ${geometry.n} reservatórios`:'';
  return `${measure.explain(geometry,f)}${each} = ${n(total)} ${unitLabel(unit || measure.unit)}`;
}

export const boxMeasureValue=(key,geometry,factor)=>{
  const measure=BOX_MEASURES[key];
  if(!measure || !geometry?.valid)return null;
  const f=measure.factor?measureNumber(factor):null;
  if(measure.factor && !(f>0))return null;
  return round(measure.calc(geometry,f)*geometry.n);
};

const telaFactor = text => {
  const q=/\bq[\s-]?(\d{2,3})\b/.exec(text)?.[1];
  return q && TELA_Q_KG_M2[q] ? String(TELA_Q_KG_M2[q]) : '';
};
export const telaNominal = description => {
  const q=/\bq[\s-]?(\d{2,3})\b/.exec(normalizeStructuralText(description))?.[1];
  return q && TELA_Q_KG_M2[q] ? {tela:`Q-${q}`,kgM2:TELA_Q_KG_M2[q]} : null;
};

// Sugestão inicial pela descrição. Sempre visível e editável na tela: é o
// operador quem confirma qual face/área cada serviço mede.
export function suggestBoxMeasure(item){
  const t=normalizeStructuralText(item?.descricao), unit=measurementUnit(item?.unidade);
  if(unit==='UN')return {measure:'quantidade',factor:''};
  if(unit==='KG')return /tela|armacao/.test(t)?{measure:'tela_fundo',factor:telaFactor(t)}:{measure:'',factor:''};
  if(unit==='M3')return /lastro|concreto|radier/.test(t)?{measure:'fundo_espessura',factor:''}:{measure:'',factor:''};
  if(unit==='M')return /verga|cinta|canaleta/.test(t)?{measure:'perimetro_eixo',factor:''}:{measure:'',factor:''};
  if(unit!=='M2')return {measure:'',factor:''};
  if(/impermeabiliza/.test(t))return {measure:/reforcad|veu|4 demaos|manta/.test(t)?'interno_total':'paredes_externas',factor:''};
  if(/^laje|tampa/.test(t))return {measure:'tampa',factor:''};
  if(/compactacao|lastro|radier|regulariza|contrapiso/.test(t))return {measure:'fundo_externo',factor:''};
  // Revestimentos antes da alvenaria: "chapisco aplicado em alvenarias" é revestimento.
  // Chapisco na face interna (SINAPI 87879 é "internas"); emboço nas duas faces.
  if(/chapisco/.test(t))return {measure:'paredes_internas',factor:''};
  if(/emboco|reboco|massa unica/.test(t))return {measure:'paredes_ambas',factor:''};
  if(/^alvenaria/.test(t))return {measure:'paredes_eixo',factor:''};
  if(/pintura/.test(t))return {measure:'paredes_externas',factor:''};
  return {measure:'',factor:''};
}

const hardStructuralOwner=(item,budget)=>Object.values(budget?.memoriaCalculo?.vinculosEstruturais || {}).includes(item.id);
export const isBoxLinkable=(item,budget)=>item?.tipo!=='titulo' && !hardStructuralOwner(item,budget);

// Grava o reservatório e os vínculos escolhidos. Itens que estavam ligados a
// este reservatório e saíram da seleção ficam sem vínculo, com a quantidade
// preservada (nunca zera nada em silêncio).
export function saveBoxElement(budget,element,links){
  if(budgetIsImmutable(budget))throw new Error('Crie uma revisão do orçamento aprovado.');
  if(!String(element?.nome || '').trim())throw new Error('Dê um nome ao reservatório.');
  const geometry=boxGeometry(element);
  if(!geometry.valid)throw new Error(geometry.errors[0]);
  const record={...element,tipo:'caixa_retangular',nome:String(element.nome).trim()};
  const elementos=[...(budget?.elementosMemoria || []).filter(e=>e.id!==record.id),record];
  const next={...budget,elementosMemoria:elementos};
  const wanted=new Map((links || []).map(l=>[l.itemId,l]));
  const itens=(budget?.itens || []).map(item=>{
    const link=wanted.get(item.id);
    if(!link){
      if(item.memorialMedicao?.model==='element' && item.memorialMedicao.elementId===record.id){
        const {memorialMedicao:_removed,...rest}=item;return rest;
      }
      return item;
    }
    if(!isBoxLinkable(item,budget))throw new Error(`O item ${item.descricao || item.id} é controlado por um vínculo do memorial estrutural.`);
    const memorial={version:1,model:'element',unit:measurementUnit(item.unidade),signature:itemMemorySignature(item),active:true,elementId:record.id,measure:link.measure,factor:String(link.factor ?? ''),origin:'element',source:String(record.fonte || ''),note:''};
    const result=evaluateBoxLink(memorial,item,next);
    if(!result.valid)throw new Error(`${item.descricao || 'Item'}: ${result.errors[0]}`);
    return {...item,memorialMedicao:memorial,quantidade:result.total};
  });
  return {...next,itens};
}

export function removeBoxElement(budget,elementId){
  if(budgetIsImmutable(budget))throw new Error('Crie uma revisão do orçamento aprovado.');
  return {
    ...budget,
    elementosMemoria:(budget?.elementosMemoria || []).filter(e=>e.id!==elementId),
    itens:(budget?.itens || []).map(item=>{
      if(item.memorialMedicao?.model!=='element' || item.memorialMedicao.elementId!==elementId)return item;
      const {memorialMedicao:_removed,...rest}=item;return rest;
    }),
  };
}
