import {useMemo,useState} from 'react';
import {Button} from '../../../components/ui/button.jsx';
import FinancialMemorial from '../../../features/financeiro/FinancialMemorial.jsx';
import {purchaseDreEvidence} from '../purchase-dre-evidence.js';

const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const competenceLabel=value=>value?.split('-').reverse().join('/')||'Competência não informada';

export default function PurchaseDreEvidence({data,dossier,onlyWork,onOpenDre}){
 const evidence=useMemo(()=>purchaseDreEvidence(data,dossier,onlyWork),[data,dossier,onlyWork]);
 const [selected,setSelected]=useState(null);
 return <>
  <h3>Impacto da compra no DRE e no caixa</h3>
  <dl className="purchase-conference__amounts">
   <div><dt>Comprometido em pedidos</dt><dd>{money(evidence.committedCents)}</dd></div>
   <div><dt>Compromisso ainda sem nota reconhecida</dt><dd>{money(evidence.openCommitmentCents)}</dd></div>
   <div><dt>Custo reconhecido</dt><dd>{money(evidence.costCents)}</dd></div>
   <div><dt>Pago pelo caixa da empresa ou da obra</dt><dd>{money(evidence.paidCents)}</dd></div>
   {evidence.clientPaidCents>0&&<div><dt>Pago direto pelo cliente</dt><dd>{money(evidence.clientPaidCents)}</dd></div>}
  </dl>
  <p>O custo segue a competência e o rateio da nota. O pagamento entra no caixa na data da baixa.</p>
  {!evidence.costs.length&&<p>Sem custo reconhecido para as notas vinculadas a esta compra.</p>}
  {evidence.costs.map(cost=>{
   const work=(data.obras||[]).find(item=>String(item.id)===String(cost.obraId))?.name||'Obra indisponível';
   const competence=competenceLabel(cost.competence);
   return <article key={JSON.stringify([cost.obraId,cost.competence])}>
    <h4>{work} · {competence}</h4>
    <p>Custo reconhecido {money(cost.amountCents)}</p>
    <div className="flex flex-wrap gap-2">
     <Button variant="outline" onClick={()=>setSelected({...cost,work,competence})}>Consultar memorial da compra</Button>
     {onOpenDre&&cost.obraId&&/^\d{4}-(0[1-9]|1[0-2])$/.test(cost.competence)&&
      <Button variant="outline" onClick={()=>onOpenDre(cost)}>Abrir DRE desta competência</Button>}
    </div>
   </article>;
  })}
  {selected&&<FinancialMemorial detail={{title:'Memorial do custo da compra',items:selected.items,
   totalCents:selected.amountCents,context:`${selected.work} · ${selected.competence} · notas vinculadas na base carregada`}} onClose={()=>setSelected(null)}/>}
 </>;
}
