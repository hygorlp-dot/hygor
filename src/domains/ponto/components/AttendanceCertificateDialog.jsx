import {useRef,useState} from 'react';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Dialog} from '../../../design-system/primitives/Dialog.jsx';
import {FilePicker} from '../../../design-system/patterns/FilePicker.jsx';
import {uploadAttendanceCertificate} from '../../../api.js';
import {fmtDateFull} from '../../../legacy/format.js';

function imageDataUrl(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('Não foi possível ler a imagem. Selecione o arquivo novamente.'));
    reader.readAsDataURL(file);
  });
}

export function AttendanceCertificateDialog({employee,date,obraId,alreadyMarked,onSave,onSkip,onClose}){
  const [selection,setSelection]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [uploaded,setUploaded]=useState(false);
  const sending=useRef(false);

  function selectImage(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!['image/jpeg','image/png'].includes(file.type)||!file.size||file.size>3*1024*1024){
      setSelection(null);
      setError('Selecione uma imagem JPEG ou PNG de até 3 MB.');
      return;
    }
    setError('');
    setSelection({file,documentId:crypto.randomUUID()});
  }

  async function confirm(){
    if(sending.current||!selection)return;
    sending.current=true;
    setBusy(true);
    setError('');
    try{
      if(!uploaded){
        const result=await uploadAttendanceCertificate({
          employeeId:employee.id,date,obraId,documentId:selection.documentId,dataUrl:await imageDataUrl(selection.file),
        });
        if(!result?.ok)throw new Error(result?.error||'Não foi possível anexar o atestado.');
        setUploaded(true);
      }
      if(!alreadyMarked&&!await onSave())throw new Error('A imagem foi anexada. Confira o aviso do ponto e tente confirmar novamente.');
      onClose();
    }catch(failure){
      setError(failure.message||'Não foi possível concluir. Tente novamente.');
    }finally{
      sending.current=false;
      setBusy(false);
    }
  }

  return <Dialog open title={alreadyMarked?'Anexar atestado':'Confirmar atestado'} onOpenChange={open=>{if(!open&&!sending.current)onClose();}}>
    <div className="flex flex-col gap-[var(--arcd-space-3)]">
      <p><strong>{employee.name}</strong> · {fmtDateFull(date)}</p>
      <p>Selecione uma imagem legível do atestado em JPEG ou PNG, de até 3 MB. A consulta ao arquivo é restrita ao RH e a administradores.</p>
      <FilePicker accept="image/jpeg,image/png" buttonLabel={selection?'Trocar imagem':'Selecionar imagem do atestado'}
        disabled={busy||uploaded} onChange={selectImage} inputProps={{'aria-label':'Imagem do atestado'}}>
        {selection&&<p role="status" className="break-all">{uploaded?'Imagem anexada.':selection.file.name}</p>}
      </FilePicker>
      {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="arcd-page-header__actions">
        {onSkip&&!alreadyMarked&&!uploaded&&<Button variant="ghost" disabled={busy} onClick={onSkip}>Marcar folga</Button>}
        <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button disabled={!selection||busy} onClick={confirm}>{busy?'Salvando…':uploaded?'Confirmar lançamento':alreadyMarked?'Anexar imagem':'Confirmar e anexar'}</Button>
      </div>
    </div>
  </Dialog>;
}
