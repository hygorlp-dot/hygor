export const portalMoney=value=>value===null||value===undefined||!Number.isFinite(Number(value))?"Não disponível":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value));
export const portalPercent=value=>value===null||value===undefined||!Number.isFinite(Number(value))?"Não disponível":`${new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(Number(value))}%`;
export function portalPeriod(value){
  const match=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value||""));
  return match?new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${match[1]}-${match[2]}-01T12:00:00Z`)):value||"Período não informado";
}
export function portalDate(value,fallback="Não informada"){
  if(!value)return fallback;
  const date=new Date(String(value).length===10?`${value}T12:00:00`:value);
  return Number.isNaN(date.getTime())?fallback:new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(date);
}
export const portalCategory=value=>({material:"Materiais",materiais:"Materiais",mao_obra:"Mão de obra",beneficios:"Benefícios da equipe",terceirizado:"Serviços de terceiros",equipamento:"Equipamentos",engenharia_campo:"Engenharia de campo",rescisao:"Rescisões",outros:"Outras categorias",caixa_obra:"Despesas do caixa"}[value]||String(value||"Sem categoria").replaceAll("_"," "));
