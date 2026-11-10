import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { SelectControl } from '../../../design-system/primitives/Select.jsx';
import { WorkspaceCommandBar } from '../../../design-system/patterns/WorkspaceCommandBar.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../../design-system/patterns/FeedbackState.jsx';
import { useHelpTopic } from '../../../features/help/HelpContext.jsx';
import { usePontoRecurso } from '../usePontoEletronico.js';
import { validarPeriodoBancoHoras } from '../banco-horas.js';
import { construirRelatorioObras, tabelasRelatorioObras } from '../relatorio-obras.js';
import { exportarExcelPontoObras, exportarPdfPontoObras } from '../../../reports/ponto-obras.js';
import { periodoDoMes } from './BancoHorasView.jsx';
import './banco-horas.css';

const selecionar = r => {
 if(!Array.isArray(r?.marcacoes)||!Array.isArray(r?.apropriacoes)||typeof r?.cobertura?.completa!=='boolean')throw Error('A consulta não confirmou a cobertura. Tente novamente.');
 return r;
};
export default function RelatoriosObraView({data,obraId,currentUser,dia}){
 useHelpTopic('ponto_app','ponto_relatorios_obras');
 const [periodo,setPeriodo]=useState(()=>periodoDoMes(dia)),[rascunho,setRascunho]=useState(periodo);
 const [obra,setObra]=useState(obraId||''),[pessoa,setPessoa]=useState(''),[visao,setVisao]=useState('batidas');
 const [erro,setErro]=useState(''),[exportando,setExportando]=useState(false),[pagina,setPagina]=useState(0);
 const recurso=usePontoRecurso({action:'ponto-banco-horas',payload:periodo,select:selecionar,
  queryKey:`${periodo.de}:${periodo.ate}`,scopeKey:`${currentUser?.id||''}:${currentUser?.role||''}`});
 const relatorio=useMemo(()=>recurso.success?construirRelatorioObras({data,resposta:recurso.data,periodo,obraId:obra,employeeId:pessoa,consultadoEm:recurso.lastUpdated}):null,
  [data,recurso.data,recurso.success,recurso.lastUpdated,periodo,obra,pessoa]);
 const tabela=relatorio?tabelasRelatorioObras(relatorio)[visao==='batidas'?1:2]:null;
 const alterado=periodo.de!==rascunho.de||periodo.ate!==rascunho.ate;
 const ocupado=recurso.loading||recurso.refreshing;
 const podeExportar=!!relatorio?.coberturaCompleta&&!ocupado&&!recurso.error&&!alterado&&!exportando;
 const consultar=e=>{e.preventDefault();const v=validarPeriodoBancoHoras(rascunho.de,rascunho.ate);if(!v.ok){setErro(v.erro);return;}
  setErro('');setPagina(0);if(alterado)setPeriodo({de:v.de,ate:v.ate});else recurso.refresh();};
 const exportar=async tipo=>{if(!podeExportar)return;setErro('');setExportando(true);
  try{if(tipo==='pdf')exportarPdfPontoObras(relatorio);else await exportarExcelPontoObras(relatorio);}
  catch(e){setErro(e.message||'Não foi possível exportar. Tente novamente.');}finally{setExportando(false);}};
 const mudar=(set,v)=>{set(v);setPagina(0);};
 const total=tabela?.linhas.length||0,paginas=Math.max(1,Math.ceil(total/100)),atual=Math.min(pagina,paginas-1);
 return <section className="bh-page" aria-labelledby="ro-titulo">
  <div className="bh-section-heading"><div><h2 id="ro-titulo">Relatórios por obra</h2><p>Consulte batidas recebidas e a composição diária do banco de horas.</p></div></div>
  <form onSubmit={consultar}>
   <WorkspaceCommandBar label="Filtros e exportação do relatório" scope={<label className="bh-campo"><span>Obra do relatório</span><SelectControl value={obra} onChange={e=>mudar(setObra,e.target.value)}><option value="">Todas as obras autorizadas</option>{(data?.obras||[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</SelectControl></label>}
    actions={<><Button type="submit" disabled={ocupado}>{ocupado?'Consultando…':'Gerar relatório'}</Button><Button type="button" variant="outline" disabled={!podeExportar} onClick={()=>exportar('excel')}>Exportar Excel</Button><Button type="button" variant="outline" disabled={!podeExportar} onClick={()=>exportar('pdf')}>Exportar PDF</Button></>}>
    <label className="bh-campo"><span>Início do período</span><Input type="date" required value={rascunho.de} onChange={e=>setRascunho(p=>({...p,de:e.target.value}))}/></label>
    <label className="bh-campo"><span>Fim do período</span><Input type="date" required value={rascunho.ate} onChange={e=>setRascunho(p=>({...p,ate:e.target.value}))}/></label>
   </WorkspaceCommandBar>
  </form>
  <div className="bh-filtros">
   <label className="bh-campo"><span>Funcionário do relatório</span><SelectControl value={pessoa} onChange={e=>mudar(setPessoa,e.target.value)}><option value="">Todos os funcionários</option>{(data?.employees||[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</SelectControl></label>
   <label className="bh-campo"><span>Visualização do relatório</span><SelectControl value={visao} onChange={e=>mudar(setVisao,e.target.value)}><option value="batidas">Batidas</option><option value="banco">Banco de horas</option></SelectControl></label>
  </div>
  {erro&&<p role="alert">{erro}</p>}
  {recurso.error&&<ErrorState headingLevel={3} title="Não foi possível atualizar o relatório" description={recurso.error} action={<Button type="button" onClick={()=>recurso.refresh()}>Tentar novamente</Button>}/>}
  {!recurso.success&&!recurso.error&&<LoadingState label="Consultando o período"/>}
  {relatorio&&<>
   <p role="status">Período consultado: {periodo.de.split('-').reverse().join('/')} a {periodo.ate.split('-').reverse().join('/')} · {total} {total===1?'registro':'registros'} nesta visão.{alterado?' Datas alteradas: use Gerar relatório antes de exportar.':''}{exportando?' Preparando exportação…':''}</p>
   {!relatorio.coberturaCompleta&&<p role="alert">Consulta incompleta. Valores não confirmados e exportações indisponíveis; tente gerar o relatório novamente.</p>}
   {relatorio.avisos.map(a=><p key={a.codigo}>{a.mensagem}</p>)}
   <details className="bh-calculo"><summary>Critérios de apuração e limites do relatório</summary><div><p>{relatorio.nota}</p><p>Este relatório não substitui o comprovante oficial, o AFD ou o AEJ.</p></div></details>
   {total?<><div className="bh-table-scroll" role="region" aria-label="Tabela do relatório por obra" tabIndex={0}><table role="table" className="bh-table bh-table-equipe"><caption>{tabela.nome} · {relatorio.obra} · {relatorio.funcionario}</caption><thead role="rowgroup"><tr role="row">{tabela.colunas.map(c=><th role="columnheader" scope="col" key={c.titulo}>{c.titulo}</th>)}</tr></thead><tbody role="rowgroup">{tabela.linhas.slice(atual*100,(atual+1)*100).map((linha,i)=><tr role="row" key={`${atual}:${i}`}>{linha.map((v,j)=><td role="cell" key={j} data-label={tabela.colunas[j].titulo}>{v??'—'}</td>)}</tr>)}</tbody></table></div>
    <div className="bh-section-heading"><p>Página {atual+1} de {paginas}. A exportação inclui todos os registros do filtro nas duas visões.</p><div className="bh-atalhos"><Button type="button" variant="outline" disabled={atual===0} onClick={()=>setPagina(atual-1)}>Anterior</Button><Button type="button" variant="outline" disabled={atual+1>=paginas} onClick={()=>setPagina(atual+1)}>Próxima</Button></div></div></>
    :<EmptyState headingLevel={3} title="Nenhum registro neste filtro" description="Escolha outra obra, funcionário ou período e consulte novamente."/>}
  </>}
 </section>;
}
