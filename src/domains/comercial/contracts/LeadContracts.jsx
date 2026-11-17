import {contractsForLead} from './lead-contract-links.js';
import {EmptyState} from '../../../design-system/patterns/FeedbackState.jsx';
import {ScopeNote} from '../../../design-system/patterns/ScopeNote.jsx';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {RECORD_STATES} from './record-fields.js';

export function LeadContracts({data,lead,user,onOpen}){
 const {records,legacy}=contractsForLead(data,lead.id,user);
 if(!lead.id)return <EmptyState title="Salve o lead para consultar seus contratos" description="Depois de salvar, esta aba reúne contratos vinculados às propostas deste lead e registros anteriores com vínculo direto."/>;
 return <>
  <ScopeNote title="Vínculo com o lead">A central usa a proposta vinculada ao lead. Contratos anteriores usam o vínculo direto ao lead; nomes iguais não criam uma associação.</ScopeNote>
  {!records.length&&!legacy.length&&<EmptyState title="Nenhum contrato vinculado a este lead" description="A central pode conter contratos de outros leads. Abra os contratos deste lead para conferir o recorte ou consultar toda a central."/>}
  {records.map(row=><p key={row.id}>{row.number} · {row.titulo} · {RECORD_STATES.find(([status])=>status===row.status)?.[1]||row.status}</p>)}
  {legacy.map(row=><p key={row.id}>{row.numero} · Contrato anterior · {row.status}</p>)}
  <Button variant="secondary" onClick={onOpen}>Abrir contratos deste lead</Button>
 </>;
}
