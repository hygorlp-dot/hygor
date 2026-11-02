import {useEffect,useRef,useState} from 'react';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Textarea} from '../../../design-system/primitives/Textarea.jsx';
import {FilePicker} from '../../../design-system/patterns/FilePicker.jsx';
import {chamarIA} from '../../../api.js';
import {arquivoComoDataUrl} from '../../../legacy/files.js';
import {uid} from '../../../legacy/format.js';
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import {MESSAGE_MAX_TEXT,messageAnalysisPayload,messageDraftItems,messageImageError,readMessageSuggestion} from '../message-request.js';

export function MessageRequestSource({source}){
 if(!source)return null;
 return <details className="purchase-reference-search"><summary>Pedido original da conversa</summary>
  {source.texto&&<p className="purchase-request-hint" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{source.texto}</p>}
  {!source.imagem?.url&&source.imagem?.dataUrl&&<img src={source.imagem.dataUrl} alt="Print original do pedido" style={{maxWidth:'100%'}}/>}
  {source.imagem?.url&&<a href={source.imagem.url} target="_blank" rel="noreferrer">Abrir print original · {source.imagem.nome}</a>}
 </details>;
}

export default function MessageRequestImport({form,setForm,obras,materiais,disabled}){
 const [open,setOpen]=useState(false),[suggestion,setSuggestion]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const revision=useRef(0);
 useEffect(()=>()=>{revision.current++;},[]);
 useHelpTopic('cmp_solicitacoes',open?'cmp_mensagem':'cmp_solicitacoes');
 const source=form.origemMensagem||{texto:'',imagem:null};
 const changeSource=patch=>{revision.current++;setSuggestion(null);setError('');setForm(f=>({...f,origemMensagem:{...f.origemMensagem,...patch}}));};
 const selectImage=async file=>{
  if(!file||busy||disabled)return;
  const problem=messageImageError(file);if(problem){setError(problem);return;}
  const attempt=++revision.current;setBusy(true);setError('');
  try{const dataUrl=await arquivoComoDataUrl(file);if(attempt!==revision.current)return;
   changeSource({imagem:{nome:file.name||'print-conversa.png',dataUrl,uploadKey:uid()}});
  }catch{setError('Não foi possível abrir o print. Selecione novamente a imagem.');}finally{setBusy(false);}
 };
 const paste=event=>{
  const image=Array.from(event.clipboardData?.items||[]).find(item=>item.kind==='file'&&item.type.startsWith('image/'));
  if(image){event.preventDefault();selectImage(image.getAsFile());}
 };
 const analyze=async()=>{
  if(busy||disabled)return;
  const attempt=++revision.current;setBusy(true);setError('');setSuggestion(null);
  try{const response=await chamarIA(messageAnalysisPayload(source.texto,source.imagem,obras));
   if(attempt!==revision.current)return;
   if(!response.ok)throw new Error(response.error||'Não foi possível analisar. Tente novamente ou preencha a solicitação manualmente.');
   setSuggestion(readMessageSuggestion(response.reply||response.answer));
  }catch(e){if(attempt===revision.current)setError(e.message);}finally{if(attempt===revision.current)setBusy(false);}
 };
 const apply=()=>{
  if(!suggestion)return;
  setForm(f=>({...f,obraId:f.obraId||(obras.some(o=>o.id===suggestion.obraId)?suggestion.obraId:''),necessidade:f.necessidade||suggestion.necessidade,
   observacao:[f.observacao,suggestion.observacao].filter(Boolean).join('\n'),
   itens:[...f.itens,...messageDraftItems(suggestion,materiais,uid)],
   origemMensagem:{...f.origemMensagem,analisadoEm:new Date().toISOString(),revisao:'rascunho conferido pelo operador'}}));
  setSuggestion(null);setOpen(false);
 };
 if(form.id||source.analisadoEm)return <MessageRequestSource source={form.origemMensagem}/>;
 return <section className="purchase-request-section" aria-label="Preencher a partir de conversa" onPaste={paste}>
  <Button variant="secondary" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} disabled={busy||disabled}>Colar pedido do WhatsApp</Button>
  {open&&<div className="purchase-request-search">
   <p className="purchase-request-hint">Cole o texto ou um print com Ctrl+V no campo abaixo. Você também pode selecionar a imagem. A análise usa a IA configurada no ERP; confira os dados antes de formalizar.</p>
   <Textarea label="Texto do pedido ou print colado" value={source.texto||''} onChange={e=>changeSource({texto:e.target.value})} rows={5} maxLength={MESSAGE_MAX_TEXT} disabled={busy||disabled} description="Até 6.000 caracteres. PNG, JPG ou WEBP de até 2 MB. Envie somente a parte necessária da conversa."/>
   <FilePicker buttonLabel="Selecionar print" accept="image/png,image/jpeg,image/webp" disabled={busy||disabled} inputProps={{'aria-label':'Arquivo do print',onClick:e=>{e.target.value='';}}} onChange={e=>selectImage(e.target.files?.[0])}/>
   {source.imagem&&<div><p className="purchase-request-hint">Print: {source.imagem.nome}</p>{source.imagem.dataUrl&&<img src={source.imagem.dataUrl} alt="Print original do pedido" style={{maxWidth:'100%'}}/>}<Button variant="ghost" type="button" disabled={busy||disabled} onClick={()=>changeSource({imagem:null})}>Remover print</Button></div>}
   <Button type="button" onClick={analyze} disabled={busy||disabled||(!source.texto?.trim()&&!source.imagem?.dataUrl)}>{busy?'Analisando pedido…':'Analisar pedido'}</Button>
   {busy&&<p role="status">Aguarde a leitura. Nenhuma solicitação está sendo enviada para Compras.</p>}
   {error&&<p className="purchase-request-error" role="alert">{error}</p>}
   {suggestion&&<div role="region" aria-label="Conferir leitura do pedido">
    <h4>Conferir leitura do pedido</h4>
    <p className="purchase-request-hint">{suggestion.itens.length} material(is). Serão acrescentados aos itens atuais. Obra e data já preenchidas serão preservadas.</p>
    {suggestion.alertas.map((a,i)=><p className="purchase-request-error" key={i}>{a}</p>)}
    <p>Obra lida: {obras.find(o=>o.id===suggestion.obraId)?.name||'Não identificada'}. Data necessária: {suggestion.necessidade? suggestion.necessidade.split('-').reverse().join('/'):'Conferir no formulário'}.</p>
    {suggestion.observacao&&<p>{suggestion.observacao}</p>}
    <ul>{suggestion.itens.map((item,i)=><li key={i}>{item.descricao} · {item.quantidade||'Quantidade a conferir'} · {item.unidade||'Unidade a conferir'}{item.observacao?` · ${item.observacao}`:''}</li>)}</ul>
    <p className="purchase-request-hint">Revise descrição, unidade, quantidade e etapa no formulário. O original será guardado com a solicitação; o print será enviado ao Drive ao formalizar.</p>
    <Button type="button" onClick={apply}>Usar itens no rascunho</Button>
   </div>}
  </div>}
 </section>;
}
