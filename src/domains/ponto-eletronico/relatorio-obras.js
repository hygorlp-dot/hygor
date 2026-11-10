import { construirBancoHoras, formatarSaldoMinutos } from './banco-horas.js';
import { formatMinutes } from '../ponto/timekeeping.js';
import { horaLocal, FUSO_OBRA } from './painel.js';

export const minutosRelatorio = n => n == null ? 'Não apurado' : formatMinutes(n);
export const dataRelatorio = d => String(d).split('-').reverse().join('/');
export const NOTA_RELATORIO = 'Consulta estimada, sem saldo anterior ou compensações. Não altera ponto, folha ou pagamentos. Dias incompletos não geram débito. O almoço padrão e a tolerância seguem o banco de horas. Em dias com várias obras, a jornada e o saldo diário não são rateados; o almoço sem horário também não é distribuído entre obras.';

// Apurar o dia completo antes de filtrar a obra evita duplicar jornada e tolerância.
export function construirRelatorioObras({ data, resposta, periodo, obraId = '', employeeId = '', consultadoEm }) {
 const modelo = construirBancoHoras({ employees:data?.employees,config:data?.config,marcacoes:resposta?.marcacoes,
  apropriacoes:resposta?.apropriacoes,cobertura:resposta?.cobertura,...periodo });
 const obras = new Map((data?.obras || []).map(o=>[String(o.id),o.name]));
 const nomeObra = id => obras.get(id) || 'Obra não identificada';
 const batidas=[],banco=[];
 for(const pessoa of modelo.linhas){
  if(employeeId && pessoa.employeeId!==employeeId)continue;
  for(const dia of pessoa.dias){
   if(!dia.temRegistro)continue;
   for(const b of dia.batidas){
    const obra=String(b.obraCapturaId||'');
    if(obraId&&obra!==obraId)continue;
    batidas.push({id:b.eventId||b.id,employeeId:pessoa.employeeId,nome:pessoa.nome,obraId:obra,obra:nomeObra(obra),
     data:dia.data,hora:horaLocal(b.marcadoEm),instante:b.marcadoEm,tipo:b.tipoEvento||'Sem tipo',
     metodo:b.metodo||'Não informado',situacao:dia.situacao==='considerado'?'Apurado':'A conferir'});
   }
   const ids=[...new Set([...dia.obras.map(o=>o.obraId),...dia.batidas.map(b=>b.obraCapturaId)].filter(Boolean))];
   if(!ids.length)ids.push('');
   const compartilhado=ids.length>1,apurado=dia.situacao==='considerado';
   for(const id of ids){
    if(obraId&&id!==obraId)continue;
    const bruto=dia.obras.find(o=>o.obraId===id)?.minutos??null;
    const liquido=apurado?compartilhado?(dia.intervaloPadraoMinutos>0?null:bruto):dia.trabalhadosMinutos:null;
    const motivo=[...dia.pendencias.map(p=>p.mensagem),...dia.alertas.map(a=>a.mensagem),
     compartilhado?`Jornada e saldo do dia compartilhados entre obras; sem rateio automático.${apurado?` Saldo diário de todas as obras: ${formatarSaldoMinutos(dia.saldoMinutos)}.`:''}`:'',
     compartilhado&&dia.intervaloPadraoMinutos>0?'Almoço padrão sem horário: horas líquidas por obra não apuradas.':'',
     dia.tolerancia?.status==='aplicada'?'Tolerância aplicada ao dia.':''].filter(Boolean).join(' ');
    banco.push({id:`${pessoa.employeeId}:${dia.data}:${id}`,employeeId:pessoa.employeeId,nome:pessoa.nome,obraId:id,obra:nomeObra(id),data:dia.data,
     brutoMinutos:bruto,liquidoMinutos:liquido,almocoMinutos:apurado&&!compartilhado?dia.intervaloPadraoMinutos:null,
     jornadaMinutos:apurado&&!compartilhado?dia.previstosMinutos:null,saldoMinutos:apurado&&!compartilhado?dia.saldoMinutos:null,
     compartilhado,situacao:!apurado?'A conferir':compartilhado?'Saldo não rateado':'Apurado',motivo});
   }
  }
 }
 batidas.sort((a,b)=>a.obra.localeCompare(b.obra,'pt-BR')||a.nome.localeCompare(b.nome,'pt-BR')||a.instante.localeCompare(b.instante));
 banco.sort((a,b)=>a.obra.localeCompare(b.obra,'pt-BR')||a.nome.localeCompare(b.nome,'pt-BR')||a.data.localeCompare(b.data));
 return {periodo,consultadoEm,obra:obraId?nomeObra(obraId):'Todas as obras autorizadas',funcionario:employeeId?(data?.employees||[]).find(e=>String(e.id)===employeeId)?.name||'Funcionário não identificado':'Todos os funcionários',
  coberturaCompleta:modelo.ok&&modelo.cobertura.completa,avisos:modelo.avisos,batidas,banco,nota:NOTA_RELATORIO};
}

export function tabelasRelatorioObras(r){
 const coluna=titulo=>({titulo,largura:titulo==='Observações'?80:26});
 return [
  {nome:'Consulta',colunas:['Informação','Valor'].map(coluna),linhas:[['Período',`${dataRelatorio(r.periodo.de)} a ${dataRelatorio(r.periodo.ate)}`],['Obra',r.obra],['Funcionário',r.funcionario],['Consulta',r.consultadoEm],['Fuso dos horários',FUSO_OBRA],['Critérios',r.nota],...r.avisos.map(a=>['Aviso da apuração',a.mensagem])]},
  {nome:'Batidas',colunas:['Obra','Funcionário','Data','Hora','Tipo','Método','Situação','Identificador'].map(coluna),linhas:r.batidas.map(b=>[b.obra,b.nome,dataRelatorio(b.data),b.hora,b.tipo,b.metodo,b.situacao,b.id])},
  {nome:'Banco de horas',colunas:['Obra','Funcionário','Data','Tempo entre registros','Almoço padrão','Horas líquidas','Jornada','Saldo estimado','Situação','Observações'].map(coluna),
   linhas:r.banco.map(b=>[b.obra,b.nome,dataRelatorio(b.data),minutosRelatorio(b.brutoMinutos),minutosRelatorio(b.almocoMinutos),minutosRelatorio(b.liquidoMinutos),minutosRelatorio(b.jornadaMinutos),formatarSaldoMinutos(b.saldoMinutos),b.situacao,b.motivo])},
 ];
}
