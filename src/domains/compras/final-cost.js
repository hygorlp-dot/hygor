export const CAMPOS_CUSTO_FINAL = {frete:"Frete",desconto:"Desconto",impostos:"Impostos adicionais",despesas:"Outras despesas"};
const cents=value=>Math.round((Number(value)+Number.EPSILON)*100);

// Valores adicionais ao preço dos itens. Ausência nunca significa isenção.
export function custoFinalDaProposta(quote,proposal){
  const items=quote.itens?.length?quote.itens:[{id:"__item",qtd:quote.qtd}];
  const lines=items.map(item=>({id:item.id,qtd:Number(item.qtd),
    cents:cents(Number(quote.itens?.length?proposal.precos?.[item.id]:proposal.precoUnit||0)*Number(item.qtd||0))}));
  const subtotal=lines.reduce((sum,line)=>sum+(Number.isFinite(line.cents)?line.cents:0),0);
  const missing=Object.keys(CAMPOS_CUSTO_FINAL).filter(key=>proposal.custoFinal?.[key]==null||proposal.custoFinal[key]==="");
  const invalid=Object.keys(CAMPOS_CUSTO_FINAL).filter(key=>!missing.includes(key)&&(!Number.isFinite(Number(proposal.custoFinal[key]))||Number(proposal.custoFinal[key])<0));
  const costs=Object.fromEntries(Object.keys(CAMPOS_CUSTO_FINAL).map(key=>[key,cents(proposal.custoFinal?.[key]||0)]));
  const total=subtotal+costs.frete+costs.impostos+costs.despesas-costs.desconto;
  const complete=!missing.length&&!invalid.length&&subtotal>0&&total>0;
  // Maiores restos preserva centavos sem produzir última linha negativa.
  const priced=lines.filter(line=>line.cents>0),allocated={};
  if(complete){
    const shares=priced.map(line=>({...line,value:Math.floor(total*line.cents/subtotal),remainder:total*line.cents/subtotal%1}));
    let remaining=total-shares.reduce((sum,line)=>sum+line.value,0);
    for(const line of [...shares].sort((a,b)=>b.remainder-a.remainder)){if(remaining-->0)line.value++;}
    for(const line of shares)allocated[line.id]=line.value/100/line.qtd;
  }
  return {subtotal:subtotal/100,total:complete?total/100:null,complete,missing,invalid,
    coberturaCompleta:priced.length===items.length,precosFinais:allocated,
    acrescimo:complete?(total-subtotal)/100:null};
}

export function validarCustoFinal(quote,proposal){
  if(!proposal.custoFinal)return ""; // Compatibilidade com propostas anteriores.
  const result=custoFinalDaProposta(quote,proposal);
  if(result.invalid.length)return "Custos adicionais e desconto devem ser valores positivos ou zero.";
  if(!result.missing.length&&!result.complete)return "O custo final da proposta precisa ser maior que zero.";
  return "";
}
