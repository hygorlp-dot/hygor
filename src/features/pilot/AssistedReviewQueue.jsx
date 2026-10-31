import {useMemo,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import DocumentEvidence from '../financeiro/DocumentEvidence.jsx';
import ReconciliationEvidence from '../conciliacao/ReconciliationEvidence.jsx';
import {buildAssistedQueue,assistedDocuments,identityLabels,matchesAssistedQuery} from './assisted-review.js';
import './assisted-review.css';
import '../conciliacao/reconciliation-review.css';

const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>value?.split('-').reverse().join('/')||'Não informada';
export default function AssistedReviewQueue({data,onClose}){
 const [snapshot]=useState(()=>({data,rows:buildAssistedQueue(data),at:new Date().toLocaleString('pt-BR')}));
 const [query,setQuery]=useState(''),[type,setType]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState(''),[documents,setDocuments]=useState(false);
 const rows=snapshot.rows;
 const visible=useMemo(()=>rows.filter(row=>(!type||row.matches.some(p=>p.tipo===type))&&matchesAssistedQuery(row,query)),[rows,query,type]);
 const pages=Math.max(1,Math.ceil(visible.length/25)),currentPage=Math.min(page,pages-1);
 const current=rows.find(row=>String(row.tr.id)===selected),index=visible.findIndex(row=>String(row.tr.id)===selected);
 const choose=row=>{setSelected(String(row.tr.id));setDocuments(false);};
 const attachments=useMemo(()=>current?assistedDocuments(snapshot.data,current):null,[snapshot,current]);
 return <section className="assisted-review" aria-label="Fila de revisão assistida" data-case-count={rows.length}>
  <header><div><h2>Revisão assistida · possíveis destinos</h2><p>{rows.length} casos com sugestão para comparar · retrato de {snapshot.at}.</p></div><Button variant="outline" onClick={onClose}>Voltar ao caixa</Button></header>
  <p role="status">Somente consulta. Nenhum caso desta fila está autorizado para conciliação automática. As sugestões não confirmam pagamentos nem criam vínculos.</p>
  <p>Todos os extratos ativos da empresa, sem filtro de obra ou conta. Extratos arquivados ficam fora desta fila. Nome coincidente exige conferência; ausência de CPF/CNPJ não comprova identidade.</p>
  <div className="assisted-review__filters"><label>Buscar nos casos<Input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Nome, CPF/CNPJ, descrição ou data"/></label><Select label="Tipo de cadastro encontrado" value={type} onChange={e=>{setType(e.target.value);setPage(0);}} options={[{value:'',label:'Todos os tipos'},...Object.entries(identityLabels).map(([value,label])=>({value,label}))]}/></div>
  <div className="assisted-review__pagination"><p role="status">{visible.length} casos encontrados · Página {currentPage+1} de {pages}</p><Button variant="outline" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Página anterior</Button><Button variant="outline" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Próxima página</Button></div>
  <div className="assisted-review__workspace"><div className="assisted-review__list" aria-label="Casos para conferir">
   {visible.slice(currentPage*25,(currentPage+1)*25).map(row=><article key={row.tr.id}><strong>{row.tr.descricao}</strong><p>{date(row.tr.data)} · {money(row.tr.valor)}</p><p>{row.analise.melhorCandidata.titulo}</p><p>{row.matches.length>1?'Mais de um cadastro encontrado':row.matches.length?`${identityLabels[row.matches[0].tipo]} encontrado`:'Sem CPF/CNPJ ou nome coincidente'}</p><Button variant="outline" aria-pressed={selected===String(row.tr.id)} onClick={()=>choose(row)}>Conferir caso</Button></article>)}
   {!visible.length&&<p>Nenhum caso neste recorte. Limpe a busca ou selecione outro tipo de cadastro.</p>}
  </div>{current?<section className="assisted-review__case" aria-label="Evidências do caso">
   <h3>{current.tr.descricao}</h3><p>{date(current.tr.data)} · {money(current.tr.valor)} · situação: {current.tr.status}</p><p><strong>Por que exige revisão:</strong> {current.motivo}</p>
   {index<0&&<p role="status">O caso selecionado está fora da busca atual. A consulta foi preservada.</p>}
   <div className="assisted-review__pagination"><Button variant="outline" disabled={index<=0} onClick={()=>choose(visible[index-1])}>Caso anterior</Button><Button variant="outline" disabled={index<0||index+1>=visible.length} onClick={()=>choose(visible[index+1])}>Próximo caso</Button></div>
   <h4>Cruzamento com os cadastros</h4><p>Nome no extrato: {current.tr.contraparteNome||current.tr.nomeContraparte||'Consultar descrição do movimento'}. CPF/CNPJ no extrato: {current.tr.contraparteDocumento||current.tr.cpfCnpj||'Não informado'}.</p>
   {current.matches.map(person=><div className="assisted-review__identity" key={`${person.tipo}:${person.id}`}><strong>{identityLabels[person.tipo]} · {person.nome}</strong><p>CPF/CNPJ cadastrado: {person.documentos.join(' · ')||'Não informado'}</p><p>{person.documentMatch?'CPF/CNPJ exato':'CPF/CNPJ sem coincidência comprovada'} · {person.nameMatch?'Nome normalizado coincidente':'Nome sem coincidência'}</p>{person.documentConflict&&<p role="status">CPF/CNPJ divergente apesar do nome coincidente. Conferir a pessoa correta.</p>}</div>)}
   {!current.matches.length&&<p>Não foi encontrado CPF/CNPJ completo ou nome coincidente nos cadastros consultados. A sugestão financeira não comprova a contraparte.</p>}
   <h4>Banco e possível destino financeiro</h4><ReconciliationEvidence transaction={current.tr} candidate={current.analise.melhorCandidata} identities={current.matches} data={snapshot.data} fmt={money}/>
   {['funcionario','terceiro','caixaObra'].includes(current.analise.melhorCandidata.tipo)&&<p>Esta sugestão aponta um cadastro ou movimento de caixa. Ela não comprova um título financeiro a pagar ou receber.</p>}
   <p>Evidências do motor: {current.analise.melhorCandidata.motivos?.join(' · ')||'Sem evidência adicional registrada'}.</p>
   <details><summary>Outros destinos para comparar ({current.analise.alternativas.length})</summary>{current.analise.alternativas.map((candidate,i)=><p key={`${candidate.tipo}:${candidate.entidadeId}:${i}`}>{candidate.titulo} · {candidate.contraparte} · {candidate.bloqueios?.join(' · ')||candidate.alertas?.join(' · ')||'Exige comparação manual'}</p>)}</details>
   <Button variant="outline" onClick={()=>setDocuments(v=>!v)}>{documents?'Recolher documentos':'Consultar documentos do caso'}</Button>
   {documents&&<div key={current.tr.id}><DocumentEvidence documents={attachments.bank} title="Documentos do movimento bancário" origin={current.tr.descricao}/><DocumentEvidence documents={attachments.target} title="Documentos do possível destino" origin={current.analise.melhorCandidata.titulo}/></div>}
  </section>:<p>Selecione um caso para comparar identidade, valor, data, origem e documentos. A consulta mantém os registros intactos.</p>}</div>
 </section>;
}
