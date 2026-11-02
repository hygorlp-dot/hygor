import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {Button} from '../../components/ui/button.jsx';
import {UI_TEXT} from '../../design-system/copy.js';
import {SAVE_QUEUE_STATE} from './save-queue.js';

export function SaveRecovery({queue,state}){
 if(state!==SAVE_QUEUE_STATE.FAILED||!queue?.hasPending())return null;
 return <Alert variant="warning" data-testid="save-recovery" className="mb-3"><AlertDescription>
  {queue.getFailure()?.reason||'Alterações ainda não salvas.'} Mantenha a aba aberta: recarregar perde as edições da fila geral.
  {queue.canRetry()?<Button variant="outline" className="mt-2" onClick={()=>queue.resume()}>{UI_TEXT.actions.retrySave}</Button>:<p>Confira a sessão e o acesso. Copie as edições antes de sair.</p>}
 </AlertDescription></Alert>;
}
