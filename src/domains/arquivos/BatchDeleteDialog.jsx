import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {folderPath} from './model.js';

export default function BatchDeleteDialog({documents,folders,workName,busy,results,onClose,onConfirm,triggerRef}) {
  const statuses=Object.values(results),finished=statuses.length===documents.length&&statuses.every(item=>item.status!=='Excluindo…');
  const success=statuses.filter(item=>item.ok).length;
  const remaining=documents.filter(item=>!results[item.id]?.ok);
  const revisions=documents.reduce((total,item)=>total+item.revisions.length,0);
  return <Dialog open title={finished?'Resultado da exclusão':'Excluir documentos selecionados?'} triggerRef={triggerRef} onOpenChange={open=>{if(!open&&!busy)onClose();}}>
    <div className="grid gap-4">
      <p><strong>{documents.length} {documents.length===1?'documento':'documentos'} · {revisions} {revisions===1?'revisão':'revisões'}</strong><br />Obra: {workName}.</p>
      {!finished&&<p>Todas as revisões dos documentos abaixo serão enviadas à lixeira do OneDrive. Links externos serão removidos apenas da central.</p>}
      <ul className="work-files-delete-list" aria-label="Documentos da exclusão">{documents.map(document=>{
        const result=results[document.id];
        return <li key={document.id}><strong className="break-words">{document.name}</strong><p>{folderPath(folders,document.folderId).map(item=>item.name).join(' / ')||'Raiz da obra'} · {document.revisions.length} {document.revisions.length===1?'revisão':'revisões'}</p>{result&&<p>{result.status}{result.error?`: ${result.error}`:''}</p>}</li>;
      })}</ul>
      <p role="status">{busy?`${success} de ${documents.length} documentos excluídos. Aguarde a conclusão.`:finished?`${success} ${success===1?'excluído':'excluídos'}. ${remaining.length} ${remaining.length===1?'não concluído':'não concluídos'}.`:'O histórico e as permissões serão preservados.'}</p>
      {finished&&remaining.length>0&&<Alert variant="destructive"><AlertDescription>Os documentos concluídos não serão repetidos. Se houve falha de conexão, confira os dados com Atualizar antes de tentar novamente. Exclusões pendentes também podem ser retomadas após recarregar.</AlertDescription></Alert>}
      {!finished&&<p>Recuperar um arquivo na lixeira não restaura seu cadastro na central. Se houver falha, parte do lote poderá já estar excluída.</p>}
      <div className="work-files-actions"><Button variant="outline" disabled={busy} onClick={onClose}>{finished?'Fechar':'Cancelar'}</Button>{(!finished||remaining.length>0)&&<Button variant="destructive" disabled={busy} loading={busy} loadingLabel="Excluindo documentos…" onClick={()=>onConfirm(remaining)}>{finished?'Tentar os não concluídos':`Excluir ${documents.length} ${documents.length===1?'documento':'documentos'}`}</Button>}</div>
    </div>
  </Dialog>;
}
