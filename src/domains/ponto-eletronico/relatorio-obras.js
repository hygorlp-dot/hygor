import { construirBancoHoras, formatarSaldoMinutos } from './banco-horas.js';
import { formatMinutes } from '../ponto/timekeeping.js';
import { FUSO_OBRA } from './painel.js';
import { TIPOS_EVENTO_JORNADA } from './evento.js';
import { jornadasDoRelatorio } from './jornadas-relatorio.js';
export const minutosRelatorio=n=>n==null?'—':formatMinutes(n);
export const dataRelatorio=d=>String(d).split('-').reverse().join('/');
export const NOTA_RELATORIO='Relatório gerencial de consulta. Não substitui os documentos oficiais de registro de ponto.';
export const horarioRelatorio=(iso,fuso=FUSO_OBRA,comData=false,segundos=false)=>{
 if(!iso||!Number.isFinite(Date.parse(iso)))return '—';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:fuso,...(comData?{day:'2-digit',month:'2-digit',year:'numeric'}:{}),hour:'2-digit',minute:'2-digit',...(segundos?{second:'2-digit'}:{}),hourCycle:'h23'}).format(new Date(iso));
};
const diaSemana=(dia,fuso)=>new Intl.DateTimeFormat('pt-BR',{timeZone:fuso,weekday:'short'}).format(new Date(`${dia}T12:00:00Z`));
const instanteDia=(iso,fuso)=>new Intl.DateTimeFormat('en-CA',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
export function construirRelatorioObras({data,resposta,periodo,obraId='',employeeId='',consultadoEm}){
 const modelo=construirBancoHoras({employees:data?.employees,config:data?.config,marcacoes:resposta?.marcacoes,apropriacoes:resposta?.apropriacoes,cobertura:resposta?.cobertura,...periodo});
 const nomes=new Map((data?.obras||[]).map(o=>[String(o.id),o.name]));
 const nomeObra=id=>nomes.get(id)||'Obra não identificada';
 const {grupos,avisos}=jornadasDoRelatorio({data,resposta,modelo,periodo,obraId,employeeId});
 const pendencias=[],auditoria=[];
 for(const g of grupos)for(const d of g.dias){
  for(const p of d.pendencias)pendencias.push({nome:g.nome,data:d.data,pendencia:d.situacao,observacao:p});
  if(d.nota)pendencias.push({nome:g.nome,data:d.data,pendencia:d.almocoMinutos?'Intervalo presumido':'Distribuição por obra',observacao:d.nota});
  if(d.tolerancia.status==='aplicada')pendencias.push({nome:g.nome,data:d.data,pendencia:'Tolerância aplicada',observacao:'Variações dentro dos limites configurados não geraram crédito ou débito.'});
  for(const b of d.batidas)auditoria.push({nome:g.nome,data:d.data,id:b.eventId||b.id||'—',instante:b.marcadoEm,obra:nomeObra(String(b.obraCapturaId||b.obraId||'')),
   tipo:TIPOS_EVENTO_JORNADA[b.tipoEvento]||'Sem tipo',metodo:b.metodo||'—',observacao:b.relogioAlterado?'Aviso de relógio alterado':b.horaConfiavel!==true?'Hora a conferir':'Hora confirmada'});
  if(d.base)for(const i of d.base.intervalos){
   const origem=(resposta.apropriacoes||[]).find(a=>a.id===i.apropriacaoId);
   auditoria.push({nome:g.nome,data:d.data,id:i.apropriacaoId||'—',instante:i.inicio,fim:i.fim,obra:nomeObra(i.obraId),tipo:'Intervalo tratado pelo RH',metodo:'Tratamento',observacao:`Apropriação ativa${origem?.version!=null?` · versão ${origem.version}`:''}${origem?.origem?` · origem ${origem.origem}`:''}. Fim: ${horarioRelatorio(i.fim,FUSO_OBRA,true,true)}. Marcações originais preservadas.`});
  }
 }
 for(const a of avisos)pendencias.push({nome:grupos.find(g=>g.employeeId===a.employeeId)?.nome||'—',data:a.data,pendencia:'Hora a conferir',observacao:a.mensagem});
 for(const a of modelo.avisos)pendencias.push({nome:'Consulta',data:null,pendencia:'Cobertura',observacao:a.mensagem});
 const banco=grupos.flatMap(g=>g.dias.map(d=>({...d,nome:g.nome})));
 return {versao:2,periodo,consultadoEm,fuso:FUSO_OBRA,obra:obraId?nomeObra(obraId):'Todas as obras autorizadas',
  funcionario:employeeId?(data?.employees||[]).find(e=>String(e.id)===employeeId)?.name||'Funcionário não identificado':'Todos os funcionários',
  coberturaCompleta:modelo.ok&&modelo.cobertura.completa,avisos:modelo.avisos,grupos,pendencias,auditoria,batidas:auditoria.filter(a=>a.metodo!=='Tratamento'),banco,nota:NOTA_RELATORIO};
}
export const COLUNAS_RESUMO=['Funcionário','Jornada prevista','Horas trabalhadas','Créditos','Débitos','Saldo estimado do período','Saldo anterior','Compensações e ajustes','Saldo final'];
export const COLUNAS_JORNADA=['Data','Dia','Entrada','Saída para intervalo','Retorno do intervalo','Saída','Intervalo','Horas trabalhadas','Jornada prevista','Saldo diário','Situação'];
export const linhaResumo=g=>{const r=g.resumo;return [g.nome,minutosRelatorio(r.jornadaMinutos),minutosRelatorio(r.liquidoMinutos),r.creditosMinutos==null?'—':`${r.creditosMinutos?'+':''}${formatMinutes(r.creditosMinutos)}`,r.debitosMinutos==null?'—':`${r.debitosMinutos?'−':''}${formatMinutes(r.debitosMinutos)}`,formatarSaldoMinutos(r.saldoMinutos),'Não disponível','Não disponível','Não disponível'];};
export function apresentacaoJornada(d,fuso=FUSO_OBRA){
 const entrada=d.pares[0]?.inicio||d.batidas.find(b=>b.tipoEvento==='entrada')?.marcadoEm;
 const tratado=d.origem==='apropriacao',pausa=d.intervalosExplicitos[0];
 const intervalo=pausa?.inicio||(tratado&&d.pares.length>1?d.pares[0].fim:null);
 const retorno=pausa?.fim||(tratado&&d.pares.length>1?d.pares[1].inicio:null);
 const parPrincipal=d.pares[retorno?1:0];
 const saida=parPrincipal?.fim||d.batidas.find(b=>b.tipoEvento==='saida')?.marcadoEm;
 const noturna=entrada&&d.pares.some(p=>instanteDia(p.inicio,fuso)!==instanteDia(p.fim,fuso));
 const h=iso=>horarioRelatorio(iso,fuso,!!noturna);
 const registrados=d.semClassificacao?`Horários registrados, sem classificação: ${d.batidas.map(b=>h(b.marcadoEm)).join(' · ')}.`:'';
 const adicionais=d.pares.slice(retorno?2:1).map(p=>`${h(p.inicio)} → ${h(p.fim)}`).join(' · ');
 return {celulas:[dataRelatorio(d.data),diaSemana(d.data,fuso),h(entrada),h(intervalo),h(retorno),h(saida),
  `${minutosRelatorio(d.intervaloMinutos)}${d.almocoMinutos?' · presumido':''}`,minutosRelatorio(d.liquidoMinutos),minutosRelatorio(d.jornadaMinutos),formatarSaldoMinutos(d.saldoMinutos),d.situacao],
  sublinha:[registrados,adicionais?`Períodos adicionais: ${adicionais}.`:'',d.origem==='apropriacao'?'Horários tratados pelo RH.':'',d.nota].filter(Boolean).join(' ')};
}
export function tabelasRelatorioObras(r,{incluirAuditoria=false}={}){
 const tabela=(nome,titulos,linhas)=>({nome,colunas:titulos.map(titulo=>({titulo,largura:titulo==='Observação'?70:25})),linhas});
 const tables=[tabela('Resumo',COLUNAS_RESUMO,r.grupos.map(linhaResumo)),
  tabela('Jornadas',['Funcionário',...COLUNAS_JORNADA,'Observação'],r.grupos.flatMap(g=>g.dias.map(d=>{const a=apresentacaoJornada(d,r.fuso);return[g.nome,...a.celulas,a.sublinha];})))];
 if(r.pendencias.length)tables.push(tabela('Pendências',['Funcionário','Data','Pendência','Observação'],r.pendencias.map(p=>[p.nome,p.data?dataRelatorio(p.data):'—',p.pendencia,p.observacao])));
 tables.push(tabela('Contexto',['Obra','Período','Funcionário','Emissão','Consulta da fonte','Fuso'],[[r.obra,`${dataRelatorio(r.periodo.de)} a ${dataRelatorio(r.periodo.ate)}`,r.funcionario,horarioRelatorio(r.emitidoEm||r.consultadoEm,r.fuso,true),horarioRelatorio(r.consultadoEm,r.fuso,true),r.fuso]]));
 if(incluirAuditoria)tables.push(tabela('Auditoria',['Funcionário','Data da jornada','Identificador','Registro original','Fim tratado','Classificação','Obra','Método','Observação'],r.auditoria.map(a=>[a.nome,dataRelatorio(a.data),a.id,horarioRelatorio(a.instante,r.fuso,true,true),a.fim?horarioRelatorio(a.fim,r.fuso,true,true):'—',a.tipo,a.obra,a.metodo,a.observacao])));
 return tables;
}
