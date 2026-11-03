export const forecastMoney=value=>value===null||value===undefined||!Number.isFinite(value)?'Não disponível':(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const forecastDate=value=>value?.split('-').reverse().join('/')||'Não informada';

export const forecastMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'')?new Date(`${value}-01T12:00:00Z`).toLocaleDateString('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}):'Não informada';
