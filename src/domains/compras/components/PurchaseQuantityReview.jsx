import {TaskDisclosure} from '../../../design-system/patterns/TaskDisclosure.jsx';

const decimal=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:6});
const amount=(value,unit)=>value===null?'A conferir':`${decimal.format(value)} ${unit}`.trim();

export default function PurchaseQuantityReview({model,materials}){
 if(!model?.rows.length&&!model?.issues.length)return null;
 const names=new Map((materials||[]).map(item=>[String(item.id),item.descricao]));
 return <section aria-label="Quantidades e divergências da compra">
  <h4>Quantidades por item</h4>
  {model.issues.length>0&&<div role="status">
   <p><strong>Conferência pendente</strong></p>
   <p>Compras ou a obra confere a entrega. O Financeiro confere a nota e os vínculos dos itens.</p>
   <ul>{model.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>
  </div>}
  <p>Faturado vinculado soma as notas ativas deste pedido com unidade confirmada.</p>
  {model.rows.map(({item,ordered,received,billed,open,unit},index)=><TaskDisclosure
   key={item.id||index} summary={names.get(String(item.materialId))||item.descricaoRef||item.descricao||'Material não identificado'}
   defaultOpen={model.rows.length===1}>
   <dl className="grid grid-cols-2 gap-2">
    <div><dt>Pedido</dt><dd>{amount(ordered,unit)}</dd></div>
    <div><dt>Recebido</dt><dd>{amount(received,unit)}</dd></div>
    <div><dt>Faturado vinculado</dt><dd>{amount(billed,unit)}</dd></div>
    <div><dt>A receber</dt><dd>{amount(open,unit)}</dd></div>
   </dl>
  </TaskDisclosure>)}
 </section>;
}
