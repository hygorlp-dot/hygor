import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {purchaseWorkflow} from '../workflow-advisories.js';
import './procurement-process.css';

export function WorkflowWarnings({warnings=[]}){
 if(!warnings.length)return null;
 return <Alert variant="warning" role="status"><AlertDescription>
  <p><strong>Você pode continuar. Estas pendências permanecem para conferência.</strong></p>
  <ul className="procurement-warnings">{warnings.map((item,index)=><li key={`${item.code}-${index}`}><strong>{item.message}</strong><p>Responsável: {item.owner}.</p><p>{item.resolution}</p></li>)}</ul>
 </AlertDescription></Alert>;
}

export default function ProcurementProcessStatus({data,order}){
 const model=purchaseWorkflow(data,order);
 return <section className="procurement-process" aria-label="Etapas e responsáveis da compra">
  <h4>Andamento da compra</h4>
  <p>As etapas podem ocorrer em outra ordem. Avisos não impedem o avanço e não concluem outra etapa automaticamente. O recebimento físico dá entrada no estoque, mesmo antes da nota ou do pagamento.</p>
  <div className="procurement-process__table" role="region" aria-label="Situação de cada etapa" tabIndex={0}><table><thead><tr><th>Etapa</th><th>Situação</th><th>Responsável</th></tr></thead><tbody>{model.stages.map(stage=><tr key={stage.id}><th scope="row">{stage.label}</th><td>{stage.status}</td><td>{stage.owner}</td></tr>)}</tbody></table></div>
  {model.warnings.length>0?<details open><summary>{model.warnings.length} aviso(s) para acompanhar</summary><WorkflowWarnings warnings={model.warnings}/></details>:<p>Nenhuma pendência detectada nos vínculos conferidos desta compra.</p>}
 </section>;
}
