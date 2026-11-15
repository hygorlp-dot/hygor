import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';

export default function DeleteDocumentDialog({document,workName,folderName,busy,error,onClose,onConfirm,triggerRef}) {
  return <Dialog open={Boolean(document)} title={document.trash?'Concluir exclusão?':'Excluir documento?'} triggerRef={triggerRef} onOpenChange={open=>{if(!open&&!busy)onClose();}}>
    <div className="grid gap-4">
    <div><p className="break-words"><strong>{document.name}</strong></p>
    <p className="break-words">Obra: {workName}. Pasta: {folderName}.</p></div>
    <p>{document.revisions.length===1?'A revisão deste documento será excluída da central.':`Todas as ${document.revisions.length} revisões deste documento serão excluídas da central.`} Os arquivos serão enviados para a lixeira do OneDrive. Links externos serão removidos apenas da central.</p>
    <p>O histórico será preservado. Recuperar um arquivo na lixeira do OneDrive não restaura seu cadastro na central.</p>
    {document.trash&&<p>A exclusão já foi iniciada e pode ter enviado parte dos arquivos à lixeira. Conclua para confirmar todas as revisões.</p>}
    {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="work-files-actions"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="destructive" loading={busy} loadingLabel="Excluindo documento…" disabled={busy} onClick={onConfirm}>{document.trash?'Concluir exclusão':'Excluir documento'}</Button></div>
    </div>
  </Dialog>;
}
