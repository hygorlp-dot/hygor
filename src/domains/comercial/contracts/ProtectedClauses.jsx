import {useEffect,useState} from 'react';
import {consultarModeloContrato} from '../../../api.js';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {LoadingState} from '../../../design-system/patterns/LoadingState.jsx';

// Consulta literal do modelo; não interpola variáveis nem emite documentos.
export default function ProtectedClauses(){
  const [nodes,setNodes]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;setError('');consultarModeloContrato().then(result=>{
    if(!active)return;if(!result.ok||!Array.isArray(result.model?.nodes)){setError(result.error||'Não foi possível consultar o modelo. Tente novamente.');return;}setNodes(result.model.nodes);
  }).catch(()=>{if(active)setError('Não foi possível consultar o modelo. Tente novamente.');});return()=>{active=false;};},[attempt]);
  if(error)return <div role="alert"><p>{error}</p><Button variant="secondary" onClick={()=>setAttempt(value=>value+1)}>Tentar consultar modelo novamente</Button></div>;
  if(!nodes)return <LoadingState label="texto protegido"/>;
  return <div className="contract-record-clauses">{nodes.map((node,index)=>node.rows?<div className="contract-record-table" key={index}><table className="arcd-data-table__table"><tbody>{node.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>:node.kind==='heading'?<h3 key={index}>{node.text}</h3>:<p key={index}>{node.text}</p>)}</div>;
}
