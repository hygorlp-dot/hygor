import { Fragment, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { ChoiceControl } from '../../../design-system/primitives/ChoiceControl.jsx';
import { SelectControl } from '../../../design-system/primitives/Select.jsx';
import { WorkspaceCommandBar } from '../../../design-system/patterns/WorkspaceCommandBar.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../../design-system/patterns/FeedbackState.jsx';
import { useHelpTopic } from '../../../features/help/HelpContext.jsx';
import { BRAND } from '../../../brand/identity.js';
import { usePontoRecurso } from '../usePontoEletronico.js';
import { validarPeriodoBancoHoras } from '../banco-horas.js';
import { apresentacaoJornada, COLUNAS_JORNADA, COLUNAS_RESUMO, construirRelatorioObras, dataRelatorio, horarioRelatorio, linhaResumo } from '../relatorio-obras.js';
import { exportarExcelPontoObras, exportarPdfPontoObras } from '../../../reports/ponto-obras.js';
import { periodoDoMes } from './BancoHorasView.jsx';
import './banco-horas.css';
const selecionar=r=>{
 if(!Array.isArray(r?.marcacoes)||!Array.isArray(r?.apropriacoes)||typeof r?.cobertura?.completa!=='boolean')throw Error('A consulta não confirmou a cobertura. Tente novamente.');
 return r;
};
const tom=n=>n>0?'credito':n<0?'debito':'neutro';
function Tabela({titulo,colunas,linhas,sublinhas=[]}){
 return <div className="bh-table-scroll" role="region" aria-label={titulo} tabIndex={0}><table role="table" className="bh-table bh-table-equipe"><caption>{titulo}</caption><thead role="rowgroup"><tr role="row">{colunas.map(c=><th role="columnheader" scope="col" key={c}>{c}</th>)}</tr></thead><tbody role="rowgroup">{linhas.map((linha,i)=><Fragment key={i}><tr role="row">{linha.map((v,j)=><td role="cell" key={j} data-label={colunas[j]}>{v??'—'}</td>)}</tr>{sublinhas[i]&&<tr role="row"><td role="cell" colSpan={colunas.length} data-label="Detalhes da jornada">{sublinhas[i]}</td></tr>}</Fragment>)}</tbody></table></div>;
}
export default function RelatoriosObraView({data,obraId,currentUser,dia}){
 useHelpTopic('ponto_app','ponto_relatorios_obras');
 const [periodo,setPeriodo]=useState(()=>periodoDoMes(dia)),[rascunho,setRascunho]=useState(periodo);
 const [obra,setObra]=useState(obraId||''),[pessoa,setPessoa]=useState(''),[incluirAuditoria,setIncluirAuditoria]=useState(false);
 const [erro,setErro]=useState(''),[exportando,setExportando]=useState(false),[pagina,setPagina]=useState(0);
 const recurso=usePontoRecurso({action:'ponto-banco-horas',payload:{...periodo,contextoJornadas:true},select:selecionar,
  queryKey:`${periodo.de}:${periodo.ate}`,scopeKey:`${currentUser?.id||''}:${currentUser?.role||''}`});
 const r=useMemo(()=>recurso.success?construirRelatorioObras({data,resposta:recurso.data,periodo,obraId:obra,employeeId:pessoa,consultadoEm:recurso.lastUpdated}):null,
  [data,recurso.data,recurso.success,recurso.lastUpdated,periodo,obra,pessoa]);
 const alterado=periodo.de!==rascunho.de||periodo.ate!==rascunho.ate,ocupado=recurso.loading||recurso.refreshing;
 const podeExportar=!!r?.coberturaCompleta&&!ocupado&&!recurso.error&&!alterado&&!exportando;
 const consultar=e=>{e.preventDefault();const v=validarPeriodoBancoHoras(rascunho.de,rascunho.ate);if(!v.ok){setErro(v.erro);return;}
  setErro('');setPagina(0);if(alterado)setPeriodo({de:v.de,ate:v.ate});else recurso.refresh();};
 const exportar=async tipo=>{if(!podeExportar)return;setErro('');setExportando(true);
  try{const emissao={...r,emitidoEm:new Date().toISOString()};if(tipo==='pdf')exportarPdfPontoObras(emissao,{incluirAuditoria});else await exportarExcelPontoObras(emissao,{incluirAuditoria});}
  catch(e){setErro(e.message||'Não foi possível exportar. Tente novamente.');}finally{setExportando(false);}};
 const mudar=(set,v)=>{set(v);setPagina(0);};
 const paginas=Math.max(1,Math.ceil((r?.grupos.length||0)/10)),atual=Math.min(pagina,paginas-1);
 return <section className="bh-page" aria-labelledby="ro-titulo">
  <div className="bh-section-heading"><img src={BRAND.monogram} alt="MRC" width="80"/><div className="bh-funcionario"><h2 id="ro-titulo">Relatório de ponto e banco de horas</h2><p>Resumo por funcionário e jornadas diárias para conferência.</p></div></div>
  <form onSubmit={consultar}><WorkspaceCommandBar label="Filtros e exportação do relatório" scope={<label className="bh-campo"><span>Obra do relatório</span><SelectControl value={obra} onChange={e=>mudar(setObra,e.target.value)}><option value="">Todas as obras autorizadas</option>{(data?.obras||[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</SelectControl></label>}
   actions={<><Button type="submit" disabled={ocupado}>{ocupado?'Consultando…':'Gerar relatório'}</Button><Button type="button" variant="outline" disabled={!podeExportar} onClick={()=>exportar('excel')}>Exportar Excel</Button><Button type="button" variant="outline" disabled={!podeExportar} onClick={()=>exportar('pdf')}>Exportar PDF</Button></>}>
   <label className="bh-campo"><span>Início do período</span><Input type="date" required value={rascunho.de} onChange={e=>setRascunho(p=>({...p,de:e.target.value}))}/></label>
   <label className="bh-campo"><span>Fim do período</span><Input type="date" required value={rascunho.ate} onChange={e=>setRascunho(p=>({...p,ate:e.target.value}))}/></label>
  </WorkspaceCommandBar></form>
  <div className="bh-filtros"><label className="bh-campo"><span>Funcionário do relatório</span><SelectControl value={pessoa} onChange={e=>mudar(setPessoa,e.target.value)}><option value="">Todos os funcionários</option>{(data?.employees||[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</SelectControl></label>
   <label><ChoiceControl checked={incluirAuditoria} onChange={e=>setIncluirAuditoria(e.target.checked)}/> Incluir anexo de auditoria na exportação</label></div>
  {erro&&<p role="alert">{erro}</p>}
  {recurso.error&&<ErrorState headingLevel={3} title="Não foi possível atualizar o relatório" description={recurso.error} action={<Button type="button" onClick={()=>recurso.refresh()}>Tentar novamente</Button>}/>}
  {!recurso.success&&!recurso.error&&<LoadingState label="Consultando o período"/>}
  {r&&<>
   <div className="bh-section-heading"><p><strong>{r.obra}</strong> · {dataRelatorio(periodo.de)} a {dataRelatorio(periodo.ate)} · {r.funcionario}</p><p>Emissão: {horarioRelatorio(r.consultadoEm,r.fuso,true)} · {r.fuso}</p></div>
   <p role="status">{r.grupos.length} {r.grupos.length===1?'funcionário':'funcionários'} no recorte.{alterado?' Datas alteradas: use Gerar relatório antes de exportar.':''}{exportando?' Preparando exportação…':''}</p>
   {!r.coberturaCompleta&&<p role="alert">Consulta incompleta. Valores não confirmados e exportações indisponíveis; tente gerar o relatório novamente.</p>}
   {r.grupos.length?<>
    <h3>Resumo do período</h3><p className="bh-nota">Saldo estimado do período, sem saldo anterior e compensações disponíveis. Totais parciais usam valores verificáveis; saldos somam jornadas válidas e não representam saldo final consolidado.</p>
    <Tabela titulo="Resumo por funcionário" colunas={COLUNAS_RESUMO} linhas={r.grupos.map(g=>linhaResumo(g).map((v,i)=>i===0?`${v}${g.resumo.parcial?' · parcial':''}`:[3,4,5].includes(i)?<span data-tone={i===3?tom(g.resumo.creditosMinutos):i===4?tom(-g.resumo.debitosMinutos):tom(g.resumo.saldoMinutos)}>{v}</span>:v))}/>
    {r.grupos.slice(atual*10,(atual+1)*10).map(g=><section className="bh-extrato" key={g.employeeId} aria-label={`Jornadas de ${g.nome}`}><div><h3>{g.nome}</h3><p>{[g.matricula?`Matrícula ${g.matricula}`:'',g.funcao].filter(Boolean).join(' · ')}</p></div>
     <Tabela titulo={`Detalhamento diário de ${g.nome}`} colunas={COLUNAS_JORNADA} sublinhas={g.dias.map(d=>apresentacaoJornada(d,r.fuso).sublinha)} linhas={g.dias.map(d=>{const a=apresentacaoJornada(d,r.fuso);return a.celulas.map((v,i)=>i===9?<span data-tone={tom(d.saldoMinutos)}>{v}</span>:v);})}/>
    </section>)}
    {paginas>1&&<div className="bh-section-heading"><p>Página {atual+1} de {paginas}. A exportação inclui todos os funcionários do filtro.</p><div className="bh-atalhos"><Button type="button" variant="outline" disabled={atual===0} onClick={()=>setPagina(atual-1)}>Anterior</Button><Button type="button" variant="outline" disabled={atual+1>=paginas} onClick={()=>setPagina(atual+1)}>Próxima</Button></div></div>}
   </>:<EmptyState headingLevel={3} title="Nenhum registro neste filtro" description="Escolha outra obra, funcionário ou período e consulte novamente."/>}
   {!!r.pendencias.length&&<Tabela titulo="Pendências e observações" colunas={['Funcionário','Data','Pendência','Observação']} linhas={r.pendencias.map(p=>[p.nome,p.data?dataRelatorio(p.data):'—',p.pendencia,p.observacao])}/>}
   {!!r.auditoria.length&&<details className="bh-calculo"><summary>Auditoria das marcações e dos ajustes</summary><Tabela titulo="Auditoria dos registros originais" colunas={['Funcionário','Registro original com segundos','Classificação','Obra','Método','Identificador','Observação']} linhas={r.auditoria.map(a=>[a.nome,horarioRelatorio(a.instante,r.fuso,true,true),a.tipo,a.obra,a.metodo,a.id,a.observacao])}/></details>}
   <details className="bh-calculo"><summary>Critérios de apuração</summary><div><p>Somente períodos classificados ou tratados pelo RH entram na apuração. Sem tipo não é entrada ou saída presumida. Intervalo padrão, tolerância e jornada seguem as configurações existentes; dias incompletos não geram débitos.</p><p>Nos dias com várias obras, a jornada e o saldo não são rateados sem regra disponível. Saldo anterior e compensações ausentes não são zero.</p></div></details>
   <p className="bh-nota">{r.nota}</p>
  </>}
 </section>;
}
