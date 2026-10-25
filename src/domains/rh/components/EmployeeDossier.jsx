import {useEffect,useState} from 'react';
import {Btn,Inp,Sel,today} from '../../../LegacyApp';
import {employeeDocumentsRequest} from '../../../api.js';
import {EMPLOYEE_DOCUMENT_CATEGORIES} from '../document-categories.js';
import {employeeDossierStatus} from '../employee-dossier-status.js';
import '../../ponto/components/clt-payslips.css';

export function EmployeeDossier({data,currentUser,showToast,fixedEmployeeId='',onDocumentsChanged}){
  const [selectedEmployeeId,setEmployeeId]=useState(''),[documents,setDocuments]=useState([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[category,setCategory]=useState('identity'),[issuedAt,setIssuedAt]=useState(''),[expiresAt,setExpiresAt]=useState(''),[notes,setNotes]=useState(''),[archived,setArchived]=useState(false),[file,setFile]=useState(null),[archiveId,setArchiveId]=useState(''),[reason,setReason]=useState(''),[requestId,setRequestId]=useState(''),[fileRevision,setFileRevision]=useState(0);
  const employeeId=String(fixedEmployeeId||selectedEmployeeId);
  const [loaded,setLoaded]=useState(false);
  const allowed=['admin','rh'].includes(currentUser?.role);
  const employee=(data.employees||[]).find(item=>String(item.id)===employeeId),asOf=today();
  const checklist=employee?employeeDossierStatus(employee,documents,asOf):null;
  useEffect(()=>{
    let live=true;setDocuments([]);setLoaded(false);setFile(null);setRequestId('');setArchiveId('');setReason('');setStatus('');
    if(!employeeId||!allowed)return;
    setBusy(true);setStatus('Carregando documentos…');
    employeeDocumentsRequest({employeeId,documentAction:'list'}).then(r=>{if(!live)return;if(!r.ok){setStatus(r.error||'Falha ao carregar. Selecione o funcionário novamente.');return;}setDocuments(r.documents||[]);onDocumentsChanged?.(r.documents||[]);setLoaded(true);setStatus('Documentos atualizados.');}).catch(()=>{if(live)setStatus('Falha de conexão. Selecione o funcionário novamente.');}).finally(()=>{if(live)setBusy(false);});
    return()=>{live=false;};
  },[employeeId,allowed,onDocumentsChanged]);
  const upload=async()=>{
    if(!file||busy)return;
    if(file.size>3*1024*1024){showToast('O arquivo deve ter no máximo 3 MB.','error');return;}
    setBusy(true);setStatus('Enviando documento…');
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const r=await employeeDocumentsRequest({employeeId,documentAction:'upload',documentId:requestId,dataUrl,fileName:file.name,category,issuedAt,expiresAt,notes});
      if(!r.ok)throw Error(r.error||'Falha no envio.');
      const next=[r.document,...documents.filter(d=>d.id!==r.document.id)];setDocuments(next);onDocumentsChanged?.(next);setFile(null);setRequestId('');setFileRevision(v=>v+1);setNotes('');setStatus('Documento salvo no prontuário privado.');
    }catch(e){setStatus(e.message||'Falha ao enviar.');showToast(e.message||'Falha ao enviar.','error');}finally{setBusy(false);}
  };
  const open=async document=>{
    const popup=window.open('','_blank');if(!popup){showToast('Permita abrir a janela do documento.','error');return;}
    popup.opener=null;
    try{const r=await employeeDocumentsRequest({employeeId,documentAction:'open',documentId:document.id});if(!r.ok)throw Error(r.error);popup.location.replace(r.url);}catch(e){popup.close();showToast(e.message||'Não foi possível abrir.','error');}
  };
  const archive=async()=>{
    setBusy(true);
    try{const r=await employeeDocumentsRequest({employeeId,documentAction:'archive',documentId:archiveId,reason});if(!r.ok)throw Error(r.error);const next=documents.map(d=>d.id===r.document.id?r.document:d);setDocuments(next);onDocumentsChanged?.(next);setArchiveId('');setReason('');setStatus('Documento arquivado. Histórico e arquivo preservados.');}catch(e){showToast(e.message,'error');}finally{setBusy(false);}
  };
  if(!allowed)return <p>Prontuário restrito ao RH e administradores.</p>;
  return <section className="clt-payslips" aria-label="Prontuário do funcionário"><h3>Prontuário documental</h3><p>Documentos privados por funcionário. PDFs, JPEG e PNG de até 3 MB. Arquivar preserva o original e o histórico; anexar um ASO não atualiza automaticamente a validade no cadastro.</p>
    {!fixedEmployeeId&&<Sel label="Funcionário do prontuário" value={employeeId} onChange={setEmployeeId} disabled={busy} options={[{v:'',l:'Selecione'},...(data.employees||[]).map(e=>({v:String(e.id),l:e.name}))]}/>}
    <p role="status">{status}</p>
    {employee&&<section aria-label="Conferência do cadastro"><h4>Cadastro para conferência</h4>{checklist.registrationIssues.length?<p>Complete ou confira: {checklist.registrationIssues.join('; ')}.</p>:<p>Dados de cadastro preenchidos para conferência. Confira o conteúdo dos documentos e as condições do contrato.</p>}<p>Nascimento: {employee.birthDate||'Não informado'} · Telefone: {employee.phone||'Não informado'} · E-mail: {employee.email||'Não informado'}</p>{employee.address&&typeof employee.address==='object'&&<p>Endereço: {[employee.address.street,employee.address.number,employee.address.district,employee.address.city,employee.address.state,employee.address.postalCode].filter(Boolean).join(', ')}</p>}{employee.emergencyContact&&<p>Contato de emergência: {employee.emergencyContact.name||'Não informado'} · {employee.emergencyContact.phone||'Não informado'}</p>}</section>}
    {loaded&&checklist&&<section aria-label="Conferência do prontuário"><h4>{checklist.pending.length?`${checklist.pending.length} item(ns) para conferir no prontuário`:'Arquivos de admissão disponíveis para conferência'}</h4>{checklist.pending.length>0&&<ul>{checklist.pending.map(item=><li key={item.id}>{item.name}: {item.status}.</li>)}</ul>}<p>Checklist inicial de admissão e segurança da função. O RH confirma quais documentos se aplicam. Um arquivo anexado não confirma seu conteúdo nem atualiza ASO e treinamentos no cadastro.</p></section>}
    {employeeId&&<><fieldset disabled={busy}><legend>Adicionar documento</legend><div className="clt-grid"><Sel label="Categoria do documento" value={category} onChange={setCategory} options={EMPLOYEE_DOCUMENT_CATEGORIES.map(([v,l])=>({v,l}))}/><Inp label="Data de emissão" type="date" value={issuedAt} onChange={setIssuedAt}/><Inp label="Validade do documento" type="date" value={expiresAt} onChange={setExpiresAt}/><Inp label="Observações do documento" value={notes} onChange={setNotes}/><label>Arquivo do prontuário<input key={`${employeeId}-${fileRevision}`} aria-label="Arquivo do prontuário" type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>{setFile(e.target.files?.[0]||null);setRequestId(crypto.randomUUID());}}/></label></div><Btn disabled={!file||busy} onClick={upload}>Salvar documento</Btn></fieldset>
      <label className="clt-check"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Mostrar documentos arquivados</label>
      <div className="provisions-table"><table><caption>Documentos de {employee?.name}</caption><thead><tr><th>Categoria / arquivo</th><th>Emissão / validade</th><th>Registro</th><th>Ações</th></tr></thead><tbody>{documents.filter(d=>archived||!d.archivedAt).map(d=><tr key={d.id}><td>{d.name}<small>{EMPLOYEE_DOCUMENT_CATEGORIES.find(([id])=>id===d.category)?.[1]}{d.archivedAt?' · Arquivado':''}</small>{d.notes&&<small>{d.notes}</small>}{d.archiveReason&&<small>Motivo: {d.archiveReason}</small>}</td><td>{d.issuedAt||'Não informada'}<small>{d.expiresAt||'Sem validade informada'}{d.expiresAt&&d.expiresAt<asOf?' · Vencido':''}</small></td><td>{d.createdByName}<small>{d.createdAt}</small></td><td><Btn v="secondary" disabled={busy} onClick={()=>open(d)}>Abrir {d.name}</Btn>{!d.archivedAt&&<Btn v="ghost" disabled={busy} onClick={()=>{setArchiveId(d.id);setReason('');}}>Arquivar {d.name}</Btn>}</td></tr>)}</tbody></table></div>
      {loaded&&!documents.length&&!busy&&<p>Nenhum documento cadastrado para este funcionário.</p>}
      {archiveId&&<fieldset disabled={busy}><legend>Arquivar documento</legend><Inp label="Motivo do arquivamento" value={reason} onChange={setReason}/><div className="clt-actions"><Btn v="secondary" onClick={()=>setArchiveId('')}>Cancelar arquivamento</Btn><Btn disabled={reason.trim().length<10} onClick={archive}>Confirmar arquivamento</Btn></div></fieldset>}
      {loaded&&<details><summary>Checklist de documentação</summary><p>Adapte a exigência à contratação e à função. Férias, afastamentos e desligamento dependem de cada evento.</p>{checklist.categories.map(item=><p key={item.id}>{item.name}: {item.activeCount} arquivo(s) ativo(s) · {item.status}.</p>)}</details>}
    </>}
  </section>;
}
