const display=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
export function formatProgress(value){
 const number=Number(value);
 return Number.isFinite(number)?display.format(number):'—';
}
