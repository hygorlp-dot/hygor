import {useState} from 'react';
import {DataTable} from '../../../design-system/data/DataTable.jsx';
import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import {contar} from '../../../design-system/copy.js';
import {fmt} from '../../../legacy/format.js';
import {importacaoComPendencia,normalizarCabecalho,resumoImportacao} from '../budget-import-mapping.js';

const numeric=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8});
const preciseMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:8});
const percent=value=>`${numeric.format(value)}%`;
const money=value=>value==null?'—':fmt(value);
const field=(original,key,format)=>original.valores[key]!=null?format(original.valores[key]):String(original.raw[key]??'').trim()||'—';

const columns=[
  {key:'item',header:'Item do Excel',render:row=><><strong>Linha {row._i}{row.ordem?` · ${row.ordem}`:''}</strong><div>{row.original.descricao||'Sem descrição'}</div><div>{[row.original.fonte,row.original.codigo,row.original.unidade].filter(Boolean).join(' · ')}</div></>},
  {key:'original',header:'Valores originais',render:({original:o})=><><div>Quantidade {field(o,'qtd',numeric.format)}</div><div>Unitário sem BDI {field(o,'preco',preciseMoney.format)}</div><div>BDI {field(o,'bdi',percent)}</div><div>Unitário com BDI {field(o,'precoComBdi',preciseMoney.format)}</div><strong>Total {field(o,'total',preciseMoney.format)}</strong></>},
  {key:'recalculo',header:'Recálculo do Excel',render:({original:o})=><><div>Sem BDI {money(o.calculado?.direto)}</div><strong>Com BDI {money(o.calculado?.total)}</strong></>},
  {key:'referencia',header:'Referência e importação',render:row=><>{row.referencia?<><div>{[row.referencia.fonte,row.referencia.baseUf,row.referencia.baseData].filter(Boolean).join(' · ')||'Referência localizada'}</div><div>Preço da base {money(row.referencia.preco)}{row.referencia.unidade?` / ${row.referencia.unidade}`:''}</div></>:<div>Referência indisponível</div>}{row.selected?<><div>Unitário a importar {money(row.precoUnit)}</div><strong>Total a importar {money(row.destino.total)}</strong></>:<strong>Fora da seleção de importação</strong>}</>},
  {key:'ocorrencias',header:'Divergências e dados faltantes',render:row=>row.original.divergences.length||row.original.missing.length?<ul>{[...row.original.divergences,...row.original.missing].map(message=><li key={message}>{message}</li>)}</ul>:'Sem ocorrência'},
].map(column=>({...column,sortable:false,hideable:false}));

export default function BudgetImportComparison({linhas,bdi,incluirPend}){
  const [filter,setFilter]=useState('all');
  const stats=resumoImportacao(linhas,bdi,incluirPend);
  const rows=linhas.filter(row=>row.kind==='item');
  const filtered=rows.filter(row=>filter==='all'||(filter==='missing'&&row.original.missing.length)||(filter==='differences'&&row.original.divergences.length)||(filter==='pending'&&importacaoComPendencia(row)));
  const search={placeholder:'Buscar linha, numeração, código ou descrição',fields:[row=>String(row._i),row=>row.ordem,row=>row.original.codigo,row=>row.original.descricao,row=>normalizarCabecalho(row.original.descricao)]};
  return <>
    <p>Os dados originais e o recálculo servem para conferência. A importação usa o valor da referência localizada e o BDI de {percent(bdi)} do orçamento.</p>
    <dl className="budget-import-totals">
      <div><dt>Totais informados no Excel</dt><dd>{money(stats.origemTotal)}</dd></div>
      <div><dt>Recálculo com BDI do Excel</dt><dd>{money(stats.origemRecalculada)}</dd></div>
      <div><dt>Custo direto da seleção</dt><dd>{money(stats.valor)}</dd></div>
      <div><dt>Total com BDI da seleção</dt><dd>{money(stats.total)}</dd></div>
    </dl>
    <p>As somas do Excel incluem apenas linhas com total informado ou calculável, conforme o caso. A seleção de importação inclui {contar(incluirPend?stats.itens:stats.ok,'serviço','serviços')}.</p>
    <SelectControl aria-label="Filtrar conferência" value={filter} onChange={event=>setFilter(event.target.value)}>
      <option value="all">Todos os serviços</option><option value="differences">Com divergências</option><option value="missing">Com dados faltantes</option><option value="pending">Com pendência de importação</option>
    </SelectControl>
    <p>{contar(filtered.length,'linha no filtro','linhas no filtro')}</p>
    <div className="budget-import-comparison"><DataTable key={filter} rowKey="_i" columns={columns} data={filtered.map(row=>({...row,destino:stats.destinoPorLinha.get(row._i),selected:incluirPend||!importacaoComPendencia(row)}))}
      search={search} pagination={{pageSize:10}} emptyMessage="Nenhuma linha corresponde à conferência."/></div>
  </>;
}
