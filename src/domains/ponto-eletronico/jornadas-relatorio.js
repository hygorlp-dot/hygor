// Projeção estrita de consulta: nenhum par é inferido de batidas sem tipo.
import { scheduleOnDate } from '../rh/work-schedule.js';
import { ALMOCO_PADRAO_MINUTOS } from './banco-horas.js';
import { avaliarToleranciaBancoHoras } from './tolerancia-banco-horas.js';
import { dataLocal } from './painel.js';
const tipos=new Set(['entrada','intervalo','retorno','saida']);
const ms=x=>Date.parse(x),id=x=>String(x?.eventId||x?.id||'');
const obra=x=>String(x?.obraCapturaId||x?.obraId||'');
const minutos=pares=>Math.round(pares.reduce((s,p)=>s+(ms(p.fim)-ms(p.inicio))/60000,0));
const somaConhecida=(dias,campo)=>{const n=dias.map(d=>d[campo]).filter(n=>n!=null);return n.length?n.reduce((s,v)=>s+v,0):null;};

export function jornadasDoRelatorio({data,resposta,modelo,periodo,obraId,employeeId}){
 const cadastros=new Map((data?.employees||[]).map(e=>[String(e.id),e]));
 const pessoas=new Map(),avisos=[];
 const grupos=new Map(),chave=(e,d)=>`${e}:${d}`;
 const grupo=(e,d)=>{
  const k=chave(e,d);if(!grupos.has(k))grupos.set(k,{employeeId:e,data:d,batidas:[],pares:[],pendencias:[],intervalosExplicitos:[],origem:'batidas'});
  return grupos.get(k);
 };
 const unicas=new Set(),porId=new Map(),conflitos=new Set();
 for(const b of resposta?.marcacoes||[]){
  if((b.tipoRegistro||'ponto')!=='ponto'||!b.employeeId||!Number.isFinite(ms(b.marcadoEm)))continue;
  const assinatura=JSON.stringify([String(b.employeeId),id(b),b.marcadoEm,obra(b),b.tipoEvento]);
  if(id(b)&&unicas.has(assinatura))continue;unicas.add(assinatura);
  if(id(b)&&porId.has(id(b))&&porId.get(id(b))!==assinatura)conflitos.add(id(b));porId.set(id(b),assinatura);
  const e=String(b.employeeId);if(!pessoas.has(e))pessoas.set(e,[]);pessoas.get(e).push({...b});
 }
 for(const [e,registros] of pessoas){
  let aberta=null,estado='fechada',inicio=null,pausa=null;
  const erro=(g,texto)=>{if(!g.pendencias.includes(texto))g.pendencias.push(texto);};
  for(const b of registros.sort((a,b)=>ms(a.marcadoEm)-ms(b.marcadoEm))){
   if(aberta&&ms(b.marcadoEm)-ms(aberta.batidas[0].marcadoEm)>86400000){erro(aberta,'Jornada aberta por mais de 24 horas.');aberta=null;estado='fechada';}
   const g=aberta||grupo(e,dataLocal(b.marcadoEm));g.batidas.push(b);
   if(!tipos.has(b.tipoEvento)){g.semClassificacao=true;continue;}
   if(b.tipoEvento==='entrada'){
    if(aberta){erro(g,'Entrada repetida ou período anterior ainda aberto.');continue;}
    aberta=g;inicio=b;estado='trabalho';
   }else if(b.tipoEvento==='intervalo'){
    if(!aberta||estado!=='trabalho'){erro(g,'Saída para intervalo sem entrada válida.');continue;}
    if(ms(b.marcadoEm)<=ms(inicio.marcadoEm))erro(g,'Período sem duração positiva.');
    else g.pares.push({inicio:inicio.marcadoEm,fim:b.marcadoEm,obraId:obra(inicio),obraFimId:obra(b),eventos:[id(inicio),id(b)]});
    estado='intervalo';pausa=b;
   }else if(b.tipoEvento==='retorno'){
    if(!aberta||estado!=='intervalo'){erro(g,'Retorno sem saída para intervalo.');continue;}
    g.intervalosExplicitos.push({inicio:pausa.marcadoEm,fim:b.marcadoEm});inicio=b;estado='trabalho';
   }else{
    if(!aberta||estado!=='trabalho'){erro(g,'Saída sem entrada ou retorno válido.');continue;}
    if(ms(b.marcadoEm)<=ms(inicio.marcadoEm))erro(g,'Período sem duração positiva.');
    else g.pares.push({inicio:inicio.marcadoEm,fim:b.marcadoEm,obraId:obra(inicio),obraFimId:obra(b),eventos:[id(inicio),id(b)]});
    aberta=null;estado='fechada';inicio=null;
   }
  }
  if(aberta)erro(aberta,'Falta saída ou retorno para concluir a jornada.');
 }
 // O tratamento já confirmado pelo RH é a fonte autorizada, sem reclassificar originais.
 for(const pessoa of modelo.linhas){
  for(const d of pessoa.dias.filter(d=>d.origem==='apropriacao')){
   const g=grupo(pessoa.employeeId,d.data);g.origem='apropriacao';g.base=d;
   g.pares=d.intervalos.map(i=>({...i}));g.pendencias=d.pendencias.map(p=>p.mensagem);g.semClassificacao=false;
  }
 }
 const tratados=[...grupos.values()].filter(g=>g.base).flatMap(g=>g.pares.map(p=>({...p,grupo:g})));
 const resultado=[];
 for(const g of grupos.values()){
  if(g.data<periodo.de||g.data>periodo.ate||employeeId&&g.employeeId!==employeeId)continue;
  const ids=[...new Set((g.base?g.pares.map(p=>p.obraId):[...g.batidas.map(obra),...g.pares.map(p=>p.obraId)]).filter(Boolean))];
  if(obraId&&!ids.includes(obraId))continue;
  if(g.batidas.some(b=>conflitos.has(id(b))))g.pendencias.push('Identificador repetido com conteúdo diferente.');
  if(g.origem==='batidas'&&g.pares.some(p=>tratados.some(t=>t.grupo!==g&&ms(t.inicio)<ms(p.fim)&&ms(t.fim)>ms(p.inicio))))g.pendencias.push('Período abrangido por tratamento do RH em outra jornada.');
  if(g.batidas.some(b=>b.horaConfiavel!==true||b.relogioAlterado))avisos.push({employeeId:g.employeeId,data:g.data,mensagem:'Confira os avisos de hora das marcações originais.'});
  const employee=cadastros.get(g.employeeId),escala=scheduleOnDate(employee,g.data);
  const horas=employee?.workdayHours??data?.config?.payrollWorkdayHours;
  const jornada=escala?escala.minutes:horas!==''&&typeof horas!=='boolean'&&Number.isFinite(Number(horas))&&Number(horas)>=1&&Number(horas)<=24?Math.round(Number(horas)*60):null;
  if(g.semClassificacao)g.pendencias.push('Há marcações sem tipo; classifique no tratamento do ponto.');
  if(g.pares.some(p=>!p.obraId))g.pendencias.push('Obra do período não identificada.');
  if(!g.pares.length&&!g.semClassificacao)g.pendencias.push('Não há períodos válidos de trabalho.');
  if(!modelo.cobertura.completa)g.pendencias.push('Consulta incompleta; valores não totalizados.');
  const periodosValidos=!g.semClassificacao&&!!g.pares.length&&!g.pendencias.filter(p=>!g.base?.pendencias.some(a=>a.codigo==='jornada_ausente'&&a.mensagem===p)).length;
  if(jornada==null&&!g.base?.pendencias.some(a=>a.codigo==='jornada_ausente'))g.pendencias.push('Jornada prevista não cadastrada.');
  const valido=periodosValidos&&jornada!=null;
  const bruto=g.pares.length?minutos(g.pares):null;
  const pausas=g.pares.slice(1).reduce((s,p,i)=>s+Math.max(0,ms(p.inicio)-ms(g.pares[i].fim))/60000,0);
  const presumido=periodosValidos&&g.origem==='batidas'&&bruto>360&&pausas===0?ALMOCO_PADRAO_MINUTOS:0;
  const trabalhado=periodosValidos?(g.base?g.base.trabalhadosMinutos:bruto-presumido):null;
  const tolerancia=valido?g.base?.tolerancia||avaliarToleranciaBancoHoras({origem:'batidas',data:g.data,batidas:g.batidas,
   intervalos:g.pares,alertas:g.batidas.some(b=>b.horaConfiavel!==true||b.relogioAlterado||b.metodo==='encarregado')?[{}]:[]},escala):{status:'nao_apurada'};
  const saldo=valido?(tolerancia.status==='aplicada'?0:trabalhado-jornada):null;
  const multi=ids.length>1,restrito=multi&&!!obraId;
  const nota=restrito?'Jornada e saldo são diários e não foram rateados entre obras.':'';
  const distribuicaoConhecida=g.pares.every(p=>!p.obraFimId||p.obraFimId===p.obraId);
  const liquido=restrito?(periodosValidos&&!presumido&&distribuicaoConhecida?minutos(g.pares.filter(p=>p.obraId===obraId)):null):trabalhado;
  const d={...g,obrasIds:ids,multi,pares:g.pares,liquidoMinutos:liquido,jornadaMinutos:!restrito?jornada:null,
   brutoMinutos:bruto,intervaloMinutos:periodosValidos?Math.round(pausas)+presumido:null,almocoMinutos:presumido,
   saldoMinutos:restrito?null:saldo,saldoGlobalMinutos:saldo,tolerancia,nota,
   situacao:g.semClassificacao?'Pendente de classificação':!valido?'Incompleto':g.origem==='apropriacao'?'Ajustado':'Completo'};
  resultado.push(d);
 }
 const agrupados=[];
 for(const e of new Set(resultado.map(g=>g.employeeId))){
  const employee=cadastros.get(e),dias=resultado.filter(g=>g.employeeId===e).sort((a,b)=>a.data.localeCompare(b.data));
  const validos=dias.filter(g=>g.saldoMinutos!=null);
  agrupados.push({employeeId:e,nome:employee?.name||'Funcionário fora do cadastro',funcao:employee?.role||'',matricula:employee?.cltPayroll?.profile?.registration||'',dias,
   resumo:{jornadaMinutos:somaConhecida(validos,'jornadaMinutos'),liquidoMinutos:somaConhecida(dias,'liquidoMinutos'),
    creditosMinutos:validos.length?validos.reduce((s,d)=>s+Math.max(0,d.saldoMinutos),0):null,
    debitosMinutos:validos.length?validos.reduce((s,d)=>s+Math.max(0,-d.saldoMinutos),0):null,
    saldoMinutos:somaConhecida(dias,'saldoMinutos'),saldoAnterior:null,ajustes:null,saldoFinal:null,
    parcial:dias.some(d=>d.saldoMinutos==null),diasValidos:validos.length,diasTotal:dias.length}});
 }
 return {grupos:agrupados.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),avisos};
}
