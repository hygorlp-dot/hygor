import {useMemo} from 'react';
import {Alert,AlertTitle,AlertDescription} from '../../components/ui/alert.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {FilterBar} from '../../design-system/patterns/FilterBar.jsx';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import {RecordListPagination} from '../../design-system/data/RecordListPagination.jsx';
import {useRecordPage} from '../../design-system/data/useRecordPage.js';
import {useBreakpoint} from '../../hooks/useBreakpoint.js';
import {useWorkspaceState} from '../workflow/workspace-session.jsx';
import {homologationReport,homologationGroups} from './homologation-report.js';
import './document-center.css';
import './record-continuity.css';

const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const amount=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const show=(value,kind)=>value==null?'Não informado':typeof value==='number'&&Number.isFinite(value)?kind==='currency'?amount(value):value.toLocaleString('pt-BR',{maximumFractionDigits:10}):typeof value==='object'?'Consulte o diagnóstico do registro':String(value);

export default function FinancialHomologationReport({report,works=[]}){
 const {isMobile}=useBreakpoint();
 const model=useMemo(()=>homologationReport(report,works),[report,works]);
 const [group,setGroup]=useWorkspaceState('fin','homologationGroup','');
 const [search,setSearch]=useWorkspaceState('fin','homologationSearch','');
 const [severity,setSeverity]=useWorkspaceState('fin','homologationSeverity','');
 const query=fold(search).trim();
 const filtered=model.issues.filter(row=>(!group||row.group===group)&&(!severity||row.severity===severity)
  &&(!query||fold([row.label,row.work,row.competence,row.reference,row.field,JSON.stringify(row.raw)].join(' ')).includes(query)));
 const pagination=useRecordPage('fin',filtered,JSON.stringify([group,search,severity]),'homologation');
 const pendingChecks=model.checks.filter(check=>!check.ok);
 const checkSummary=model.checks.length?`Pendências (${pendingChecks.length})`:'sem verificações informadas';
 const counts=report.contagens||{};
 const filters=<FilterBar label="Filtrar diferenças da homologação" layout="grid">
  <Input label="Buscar diferença ou origem" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Obra, competência, registro ou campo"/>
  <Select label="Tipo de ocorrência" value={severity} onChange={event=>setSeverity(event.target.value)} options={[{value:'',label:'Diferenças e avisos'},{value:'error',label:'Somente diferenças'},{value:'warning',label:'Somente avisos'}]}/>
  <Select label="Grupo da conferência" value={group} onChange={event=>setGroup(event.target.value)} options={[{value:'',label:`Todos os grupos · ${model.issues.length}`},...Object.entries(homologationGroups).map(([value,label])=>({value,label:`${label} · ${model.issues.filter(row=>row.group===value).length}`}))]}/>
 </FilterBar>;
 return <section className="document-center record-recovery" aria-label="Resultado da homologação financeira">
  {isMobile&&filters}
  <Alert variant={model.complete?'default':'warning'} role="status">
   <AlertTitle>{model.engineLabel}</AlertTitle>
   <AlertDescription><p>{model.complete?'Verificações concluídas sem impedimentos no relatório consultado.':'Homologação com pendências ou verificações incompletas. Confira os grupos abaixo.'}</p><p>O estado do motor não muda ao consultar este relatório. Esta comparação não é o fechamento de uma competência.</p></AlertDescription>
  </Alert>
  <TaskDisclosure summary="Registros comparados e última carga">
   <dl className="record-recovery__comparison">{[['Fatos de origem',counts.fatosLegados],['Títulos no razão',counts.titulos],['Liquidações',counts.liquidacoes],['Movimentos bancários',counts.transacoesLegadas],['Projeções do DRE',counts.projecoesDRE],['Vínculos de conciliação',counts.vinculosConciliacao]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??'Não informado'}</dd></div>)}</dl>
   {report.ultimaCarga&&<p>Última carga: {new Date(report.ultimaCarga.created_at).toLocaleString('pt-BR')}. Referência: {report.ultimaCarga.id}.</p>}
  </TaskDisclosure>
  <TaskDisclosure enabled={isMobile} summary={`Verificações da homologação · ${checkSummary}`}>
   <section aria-label="Verificações da homologação">{!isMobile&&<h3>Verificações da homologação</h3>}
    {!model.checks.length&&<p>O relatório não informou as verificações necessárias. Atualize a consulta; ausência de diferenças não comprova homologação.</p>}
    {pendingChecks.map(check=><article key={check.code}><strong>{check.label} · Pendente</strong><p>{check.detail||'Confira a origem com o responsável financeiro.'}</p></article>)}
    {model.checks.length>0&&<TaskDisclosure summary={`Ver todas as verificações · ${model.checks.length}`}>{model.checks.map(check=><p key={check.code}><strong>{check.label}: {check.ok?'Conferido':'Pendente'}</strong> · {check.detail||'Sem detalhamento no relatório.'}</p>)}</TaskDisclosure>}
   </section>
  </TaskDisclosure>
  <section className="document-center" aria-labelledby="homologation-differences"><h3 id="homologation-differences">Diferenças e avisos · {model.issues.length}</h3>
   <p>Cada linha é uma diferença ou um aviso, não um novo custo. Não some as linhas nem lance valores para compensá-las. Confira a origem antes de qualquer correção.</p>
   {!isMobile&&filters}
   <RecordListPagination pagination={pagination} label="diferenças e avisos"/>
   {pagination.rows.map(row=><article key={row.id}><h3>{row.label} · {row.severity==='warning'?'Aviso':'Diferença'}</h3><p>{row.work||'Escopo identificado no diagnóstico'}{row.competence?` · Competência ${row.competence}`:''}{row.period?` · ${row.period}`:''}</p><p><strong>Conferir:</strong> {row.field}</p>
    <dl className="record-recovery__comparison"><div><dt>Origem esperada</dt><dd>{show(row.expected,row.kind)}</dd></div><div><dt>Razão consultado</dt><dd>{show(row.actual,row.kind)}</dd></div></dl>
    {typeof row.difference==='number'&&<p>Diferença: <strong>{show(row.difference,row.kind)}</strong></p>}
    {!isMobile&&row.reference&&<p>Referência de origem: {row.reference}</p>}
    <TaskDisclosure summary="Diagnóstico do registro">
     {isMobile&&row.reference&&<p>Referência de origem: {row.reference}</p>}
     <pre>{JSON.stringify(row.raw,null,2)}</pre>
    </TaskDisclosure>
   </article>)}
   {!filtered.length&&<p>{model.issues.length?'Nenhuma ocorrência corresponde aos filtros. Altere o tipo, o grupo ou a busca.':model.complete?'Não há diferenças nos grupos verificados.':'Nenhuma diferença detalhada foi informada. Confira as verificações da homologação.'}</p>}
  </section>
 </section>;
}
