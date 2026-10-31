import {intervaloDoDia} from './painel.js';

// CLT art.58 §1º: ambos os limites são cumulativos. Nunca usa apenas o saldo
// líquido nem concede uma franquia parcial ao ultrapassar qualquer limite.
export function avaliarToleranciaBancoHoras(dia,escala) {
  if(dia.origem==='apropriacao')return {status:'tratado_rh'};
  if(!escala?.working)return {status:'sem_escala'};
  const {batidas,intervalos}=dia;
  if(![2,4].includes(batidas.length)||intervalos.some(i=>i.mudouDeObra))return {status:'sequencia_especial'};
  if(dia.alertas.length)return {status:'conferir_fonte'};
  const horarios=batidas.length===2?[escala.entrada,escala.saida]:[escala.entrada,escala.intervaloSaida,escala.intervaloRetorno,escala.saida];
  if(horarios.some(h=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(h||'')))return {status:'sem_escala'};
  const inicioDia=Date.parse(intervaloDoDia(dia.data).de);
  const variacoes=horarios.map((horario,i)=>{
    const [h,m]=horario.split(':').map(Number);
    const previsto=inicioDia+(h*60+m)*60000;
    return {previsto:horario,registrado:batidas[i].marcadoEm,desvioMs:Date.parse(batidas[i].marcadoEm)-previsto};
  });
  const totalMs=variacoes.reduce((s,v)=>s+Math.abs(v.desvioMs),0);
  const dentroDosLimites=variacoes.every(v=>Math.abs(v.desvioMs)<=5*60000)&&totalMs<=10*60000;
  return {status:dentroDosLimites?(totalMs?'aplicada':'sem_variacao'):'excedida',variacaoTotalMinutos:totalMs/60000,variacoes};
}
