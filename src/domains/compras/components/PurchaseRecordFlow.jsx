import {Button} from '../../../design-system/primitives/Button';
import {purchaseRecordFlow} from '../record-flow';
import './record-flow.css';

export default function PurchaseRecordFlow({data,type,record,onOpen}){
 const flow=purchaseRecordFlow(data,type,record);
 return <section className="purchase-record-flow" aria-label={`Andamento de ${record.numero||record.id}`}>
  <p className="purchase-record-flow__next">{flow.next}</p>
  <p>{flow.detail}</p>
  {flow.links.length>0&&<nav aria-label={`Vínculos de ${record.numero||record.id}`}>{flow.links.map(link=><Button key={`${link.type}-${link.id}`} variant="secondary" size="sm" onClick={()=>onOpen(link,{type,id:record.id,obraId:record.obraId,label:record.numero||record.id})}>Abrir {{request:'solicitação',quote:'cotação',order:'pedido'}[link.type]} {link.label.split(' ').slice(1).join(' ')}</Button>)}</nav>}
 </section>;
}
