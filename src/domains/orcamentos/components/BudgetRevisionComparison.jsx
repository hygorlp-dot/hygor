import {useMemo,useState} from 'react';
import {DataTable} from '../../../design-system/data/DataTable.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {HelpButton} from '../../../features/help/HelpButton.jsx';
import {contar} from '../../../design-system/copy.js';
import {fmt} from '../../../legacy/format.js';
import {budgetIsImmutable} from '../calculations.js';
import {budgetCompletion} from '../budget-pending.js';
import {compareBudgetRevisions} from '../budget-revision-comparison.js';

const labels={quantity:'Quantidade',price:'Preço',bdi:'BDI',scope:'Escopo',unresolved:'Identidade a conferir'};
const signedMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',signDisplay:'exceptZero'});
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8});
const unitMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:8});
const formatDate=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'});
const versionLabel=version=>{
  const timestamp=Date.parse(version.createdAt);
  const date=Number.isFinite(timestamp)?` · ${formatDate.format(timestamp)}`:'';
  return `V${version.versionNumber||1} · ${version.nome||'Orçamento'} · ${budgetIsImmutable(version)?'Aprovada':'Rascunho'}${date}`;
};

function VersionItems({items}){
  if(!items.length)return 'Ausente na versão';
  return items.map((item,index)=><span className="budget-comparison-values" key={index}>
    <span>{[item.fonte,item.codigo,item.descricao].filter(Boolean).join(' · ')||'Serviço sem descrição'}</span>
    <span>{item.stage||'Sem etapa identificada'}</span>
    <span>{number.format(item.quantidade)} {item.unidade||'sem unidade'} × {unitMoney.format(item.custoUnitario)}</span>
    <span>BDI {number.format(item.bdiEfetivo)}%</span>
    <strong>{fmt(item.total)}</strong>
    {item.exclusion&&<span>Fora do escopo · {item.exclusion.motivo}</span>}
  </span>);
}

const columns=[
  {key:'before',header:'Na versão de referência',render:row=><VersionItems items={row.before}/>},
  {key:'after',header:'Na versão comparada',render:row=><VersionItems items={row.after}/>},
  {key:'impact',header:'Impacto por mudança',render:row=><span className="budget-comparison-values">
    <strong>Total {signedMoney.format(row.delta/100)}</strong>
    {Object.entries(row.impact).filter(([factor,value])=>value||row.changes.some(change=>change.factor===factor)).map(([factor,value])=><span key={factor}>{labels[factor]} {signedMoney.format(value/100)}</span>)}
    {row.changes.map(change=><span key={change.label}>{change.label}</span>)}
  </span>},
].map(column=>({...column,hideable:false,sortable:false}));

export default function BudgetRevisionComparison({versions,current}){
  const parent=versions.find(version=>(version.versionId||version.id)===current.revisionOf);
  const related=versions.find(version=>version.id!==current.id);
  const [baseId,setBaseId]=useState(parent?.id||current.id),[revisionId,setRevisionId]=useState(parent?current.id:related?.id||'');
  const [filter,setFilter]=useState('changed');
  const base=versions.find(version=>version.id===baseId),revision=versions.find(version=>version.id===revisionId);
  const comparison=useMemo(()=>base&&revision?compareBudgetRevisions(base,revision):null,[base,revision]);
  const rows=(comparison?.rows||[]).filter(row=>filter==='all'||(filter==='changed'?row.changes.length>0:row.changes.some(change=>change.factor===filter)));
  const status=version=>budgetCompletion(version).partial?'Total parcial':'Total geral';
  const search={placeholder:'Buscar código, serviço ou etapa',fields:[row=>[...row.before,...row.after].map(item=>`${item.codigo||''} ${item.descricao||''} ${item.stage}`).join(' ')]};
  const options=versions.map(version=>({value:version.id,label:versionLabel(version)}));

  return <div className="budget-revision-comparison">
    <HelpButton pageId="orc_revisoes" allowedTabs={['orc']}/>
    {versions.length<2?<p>Nenhuma outra revisão desta linhagem está disponível para comparação.</p>:<>
      <div className="budget-revision-selectors">
        <Select label="Versão de referência" value={baseId} options={options} onChange={event=>setBaseId(event.target.value)}/>
        <Select label="Versão comparada" value={revisionId} options={options} onChange={event=>setRevisionId(event.target.value)}/>
      </div>
      {(!comparison||comparison.error)?<p role="status">{comparison?.error||'Escolha duas versões disponíveis.'}</p>:<>
        <dl className="budget-import-totals">
          <div><dt>Referência · {status(base)}</dt><dd>{fmt(comparison.baseTotal/100)}</dd></div>
          <div><dt>Comparada · {status(revision)}</dt><dd>{fmt(comparison.revisionTotal/100)}</dd></div>
          <div><dt>Variação total</dt><dd>{signedMoney.format(comparison.delta/100)}</dd></div>
        </dl>
        <dl className="budget-import-totals">
          {Object.entries(comparison.totals).filter(([factor])=>factor!=='unresolved'||comparison.rows.some(row=>row.kind==='unresolved')).map(([factor,value])=><div key={factor}><dt>{labels[factor]}</dt><dd>{signedMoney.format(value/100)}</dd></div>)}
        </dl>
        <p>Nos serviços correspondentes, a variação aplica quantidade, preço e BDI nessa ordem. Entradas, retiradas, exclusões e mudanças de unidade ou referência entram em escopo.</p>
        <Select label="Filtrar mudanças" value={filter} onChange={event=>setFilter(event.target.value)} options={[
          {value:'changed',label:'Com mudanças'},{value:'all',label:'Todos os serviços'},...Object.entries(labels).map(([value,label])=>({value,label})),
        ]}/>
        <p>{contar(rows.length,'linha no filtro','linhas no filtro')}</p>
        <div className="budget-import-comparison"><DataTable key={`${baseId}:${revisionId}:${filter}`} columns={columns} data={rows} search={search} pagination={{pageSize:10}} emptyMessage="Nenhum serviço corresponde ao filtro."/></div>
      </>}
    </>}
  </div>;
}
