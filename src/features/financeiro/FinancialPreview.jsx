import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Alert, AlertDescription} from '../../components/ui/alert.jsx';
import './financial-preview.css';

export default function FinancialPreview({description, columns, rows, children, error, onCancel, onConfirm, confirmLabel='Confirmar', pending=false, disabled=false}) {
  const [page,setPage]=useState(0);
  const lastPage=Math.max(0,Math.ceil(rows.length/50)-1), current=Math.min(page,lastPage);
  return <section className="financial-preview">
    <p>{description}</p>{children}
    {error&&<Alert variant="warning"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="scroll-x" tabIndex={0} aria-label="Itens da prévia"><table data-stack={columns.length>3}><caption>{rows.length} item(ns) para revisão</caption><thead><tr>{columns.map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.slice(current*50,(current+1)*50).map(row=><tr key={row.id}>{row.cells.map((value,index)=><td data-label={columns[index]} key={index}>{value}</td>)}</tr>)}</tbody></table></div>
    {!rows.length&&<p role="status">Nenhum item disponível nesta prévia.</p>}
    {lastPage>0&&<div className="financial-preview__actions"><Button variant="outline" disabled={pending||current===0} onClick={()=>setPage(current-1)}>Página anterior</Button><span>Página {current+1} de {lastPage+1}</span><Button variant="outline" disabled={pending||current===lastPage} onClick={()=>setPage(current+1)}>Próxima página</Button></div>}
    <div className="financial-preview__actions"><Button variant="outline" disabled={pending} onClick={onCancel}>Cancelar prévia</Button><Button disabled={pending||disabled||Boolean(error)} onClick={onConfirm}>{pending?'Confirmando…':confirmLabel}</Button></div>
  </section>;
}
