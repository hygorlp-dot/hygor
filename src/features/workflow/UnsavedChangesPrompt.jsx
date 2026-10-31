import { Modal } from "../../legacy/ui.jsx";
import {Button} from '../../design-system/primitives/Button.jsx';
export default function UnsavedChangesPrompt({guard}){
 if(!guard.asked)return null;
 return <Modal title="Descartar alterações?" onClose={guard.continueEditing} panelClass="unsaved-changes-prompt"><p>Há alterações ainda não confirmadas neste formulário. Continue editando para preservá-las ou descarte para sair.</p><div className="unsaved-changes-prompt__actions"><Button variant="secondary" onClick={guard.continueEditing}>Continuar editando</Button><Button variant="danger" onClick={guard.discard}>Descartar alterações</Button></div></Modal>;
}
