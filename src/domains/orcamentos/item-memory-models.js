// Modelos geométricos de medição. Não são dimensionamento estrutural nem
// coeficientes de consumo: a quantidade mede o serviço descrito na composição.
const field = (key, label, unit, help, fallback) => ({key,label,unit,help,...(fallback !== undefined ? {fallback} : {})});
const length = field('length','Comprimento','m','Meça de uma ponta à outra.');
const width = field('width','Largura','m','Medida perpendicular ao comprimento.');
const height = field('height','Altura','m','Do início ao fim da superfície executada.');
const count = field('count','Repetições iguais','vezes','Use 1 para uma única ocorrência.',1);
const faces = field('faces','Faces revestidas','faces','1 = um lado; 2 = os dois lados.',1);
const thickness = field('thickness','Espessura','cm','Informe em centímetros; o sistema converte para metros.');

export const ITEM_MEMORY_MODELS = {
  wall:{name:'Parede / alvenaria',unit:'M2',fields:[length,height,count],formula:'Comprimento × altura × repetições − vãos',help:'Uma linha por parede ou por grupo de paredes iguais. Desconte portas e janelas em linhas de vãos. Não multiplique alvenaria por duas faces.',example:'Parede de 4 × 2,80 m menos porta de 0,80 × 2,10 m = 9,52 m².'},
  surface:{name:'Revestimento de parede / fachada',unit:'M2',fields:[length,height,faces,count],formula:'Comprimento × altura × faces × repetições − descontos',help:'Meça só as faces que recebem este serviço. Adicione linhas de desconto conforme o critério da composição. Demãos e camadas já descritas no serviço não multiplicam a área.',example:'Parede 4 × 2,80 m, duas faces = 22,40 m² antes dos descontos.'},
  area:{name:'Piso / teto / área plana',unit:'M2',fields:[length,width,count],formula:'Comprimento × largura × repetições − descontos',help:'Uma linha por ambiente ou retângulo. Divida áreas irregulares em partes. Não aplique perdas de compra à área executada.',example:'Quarto de 3 × 4 m = 12 m².'},
  strip:{name:'Faixa / sanca / rodapé em área',unit:'M2',fields:[length,field('width','Largura desenvolvida','m','Some as larguras das faces da faixa que recebem o serviço.'),count],formula:'Comprimento × largura desenvolvida × repetições',help:'Para serviço medido em área, informe o comprimento e a largura efetiva da faixa. Não confunda m com m².',example:'Sanca de 10 m com largura desenvolvida de 0,40 m = 4 m².'},
  layer:{name:'Camada / lastro em volume',unit:'M3',fields:[length,width,thickness,count],formula:'Comprimento × largura × (espessura ÷ 100) × repetições',help:'Use para lastros e camadas medidos em m³. Se a composição for em m² com espessura especificada, utilize o modelo de área.',example:'10 × 2 m com 5 cm de espessura = 1 m³.'},
  volume:{name:'Escavação / volume',unit:'M3',fields:[length,width,field('height','Profundidade / altura','m','Dimensão vertical do volume.'),count],formula:'Comprimento × largura × profundidade × repetições − descontos',help:'Divida trechos com seções diferentes. Volumes já ocupados podem ser descontados em linhas separadas. Não estime empolamento automaticamente.',example:'Vala de 10 × 0,40 × 0,60 m = 2,40 m³.'},
  linear:{name:'Comprimento por trecho',unit:'M',fields:[length,count],formula:'Comprimento × repetições − descontos',help:'Some os trechos executados. Para rodapés, desconte larguras de portas e trechos sem rodapé. Para gabarito, meça o contorno efetivamente executado.',example:'12 m de rodapé menos uma porta de 0,80 m = 11,20 m.'},
  lintel:{name:'Verga / contraverga',unit:'M',fields:[field('length','Largura do vão','m','Largura da porta ou janela.'),field('bearing','Apoio de cada lado','m','Valor indicado no projeto; não é definido automaticamente.'),count],formula:'(Largura do vão + 2 × apoio lateral) × repetições',help:'Separe os vãos por dimensão. Informe o apoio conforme o projeto, sem presumir um valor padrão.',example:'Vão de 1,20 m e apoio de 0,20 m em cada lado = 1,60 m.'},
  perimeter:{name:'Contorno retangular / contramarco',unit:'M',fields:[width,height,count],formula:'2 × (largura + altura) × repetições',help:'Use apenas para contorno fechado de quatro lados. Para três lados ou outra forma, use comprimento por trecho.',example:'Janela de 1,20 × 1 m: contorno de 4,40 m.'},
  count:{name:'Contagem de unidades',unit:'UN',fields:[field('quantity','Quantidade de peças','un','Conte as unidades deste tipo no local.')],formula:'Soma das unidades por local',help:'Uma linha por ambiente ou tipo. Não misture dimensões ou especificações diferentes da composição.',example:'2 portas no térreo + 3 portas iguais no pavimento = 5 un.'},
  direct:{name:'Quantidade medida / documento',unit:null,fields:[field('quantity','Quantidade medida','','Na mesma unidade do item do orçamento.')],formula:'Soma das quantidades informadas − descontos',help:'Use quando já tiver o levantamento na unidade do item. Registre a origem e o critério; não transforme área em unidades sem justificar.',example:'Informe o valor levantado e identifique a prancha, relatório ou medição.'},
};

export const measurementUnit = value => String(value || '').trim().toUpperCase().replace('²','2').replace('³','3').replace(/^UND?\.?$|^UNIDADE[S]?$/,'UN');
export const measureNumber = value => {
  if(value == null || String(value).trim()==='') return null;
  const text=String(value).trim();
  if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) return NaN;
  return Number(text.replace(',','.'));
};
export const newMeasurementRow = (model,id) => ({id,local:'',operation:'add',values:Object.fromEntries((ITEM_MEMORY_MODELS[model] || ITEM_MEMORY_MODELS.direct).fields.map(f=>[f.key,f.fallback ?? '']))});
export function blankItemMemory(memory) {
  if(!memory) return undefined;
  return {version:1,model:memory.model,unit:memory.unit,signature:memory.signature,rows:[],source:'',note:'',origin:'copied-template'};
}

export function calculateItemMemory(memory,unit){
  const model=ITEM_MEMORY_MODELS[memory?.model], errors=[];
  if(!model)return {valid:false,total:null,errors:['Escolha um modelo de cálculo.'],rows:[]};
  const expected=measurementUnit(unit);
  if(!expected || measurementUnit(memory.unit)!==expected || (model.unit && model.unit!==expected))errors.push('A unidade do memorial não corresponde à unidade do orçamento.');
  if(!memory.rows?.length)errors.push('Adicione pelo menos um local ou trecho.');
  if(memory.model==='direct' && !String(memory.source || '').trim())errors.push('Informe a origem da quantidade medida.');
  const rows=(memory.rows || []).map((row,index)=>{
    const values={}, rowErrors=[];
    if(!String(row.local || '').trim())rowErrors.push('Identifique o local ou trecho.');
    for(const f of model.fields){
      const value=measureNumber(row.values?.[f.key]);
      if(value===null)rowErrors.push(`Preencha ${f.label.toLowerCase()}.`);
      else if(!Number.isFinite(value) || value<0)rowErrors.push(`${f.label}: use um número maior ou igual a zero.`);
      else if(['count','faces'].includes(f.key) && (!Number.isInteger(value) || value<1))rowErrors.push(`${f.label}: use um inteiro a partir de 1.`);
      else if(memory.model==='count' && !Number.isInteger(value))rowErrors.push('Quantidade de peças deve ser inteira.');
      values[f.key]=value;
    }
    if(!['add','subtract'].includes(row.operation))rowErrors.push('Operação inválida.');
    const {length:l,width:w,height:h,count:c,faces:f,thickness:t,bearing:b,quantity:q}=values;
    const formulas={wall:()=>l*h*c,surface:()=>l*h*f*c,area:()=>l*w*c,strip:()=>l*w*c,layer:()=>l*w*t/100*c,volume:()=>l*w*h*c,linear:()=>l*c,lintel:()=>(l+2*b)*c,perimeter:()=>2*(w+h)*c,count:()=>q,direct:()=>q};
    const total=rowErrors.length?null:formulas[memory.model]();
    if(total!==null && !Number.isFinite(total))rowErrors.push('Resultado fora do limite numérico.');
    errors.push(...rowErrors.map(e=>`Linha ${index+1}: ${e}`));
    return {id:row.id,total:rowErrors.length?null:total,operation:row.operation,errors:rowErrors};
  });
  const raw=rows.reduce((sum,row)=>sum+(row.total || 0)*(row.operation==='subtract'?-1:1),0);
  if(raw<0)errors.push('Os descontos ultrapassam o total medido.');
  if(!Number.isFinite(raw))errors.push('Total fora do limite numérico.');
  return {valid:errors.length===0,total:errors.length?null:Math.round(raw*1e6)/1e6,errors,rows};
}
