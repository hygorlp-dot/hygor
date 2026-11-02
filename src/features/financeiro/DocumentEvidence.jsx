import {useState} from 'react';
import {Select} from '../../design-system/primitives/Select.jsx';
import {obterLinkArquivoOneDrive} from '../../api.js';
import {documentEvidenceInfo} from '../../domains/financeiro/document-evidence.js';
import {documentPreviewType} from './document-preview.js';
import {OriginalDocument} from './InvoiceConference.jsx';
import './document-evidence.css';

const formats={pdf:'PDF',image:'Imagem',xml:'XML',unsupported:'Formato externo'};
export default function DocumentEvidence({documents=[],origin,title='Evidências do registro',driveId,resolveFile=obterLinkArquivoOneDrive}){
 const [selected,setSelected]=useState(0);
 const files=documents.filter(document=>document&&typeof document==='object');
 const current=files[selected]||files[0];
 const info=current&&documentEvidenceInfo(current,driveId);
 return <section className="document-evidence" aria-label={title}>
  <header><h3>{title}</h3>{origin&&<p>Origem: {origin}</p>}</header>
  {!current?<p role="status">Sem anexo cadastrado neste registro. Consulte o módulo de origem para incluir uma evidência.</p>:<>
   {files.length>1&&<Select label="Arquivo para conferência" value={files[selected]?selected:0} onChange={event=>setSelected(Number(event.target.value))} options={files.map((document,index)=>({value:index,label:document.legenda||document.nome||document.name||`Documento ${index+1}`}))}/>}
   <dl className="document-evidence__metadata"><div><dt>Formato</dt><dd>{formats[documentPreviewType(current)]}</dd></div><div><dt>Vínculo</dt><dd>{info.resolvable?'Referência cadastrada':'Endereço indisponível'}</dd></div></dl>
   {info.resolvable?<OriginalDocument key={JSON.stringify([selected,current.id,current.url,current.webUrl,info.reference])} document={current} driveId={driveId} resolveFile={resolveFile}/>:<p role="status">O anexo está cadastrado, mas não possui endereço ou referência disponível para consulta. Confira o vínculo na origem.</p>}
  </>}
 </section>;
}
