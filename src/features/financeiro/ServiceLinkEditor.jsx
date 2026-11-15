import {useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {Checkbox} from '../../design-system/primitives/Checkbox.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {Modal} from '../../legacy/ui.jsx';
import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';
import {SERVICE_LINK_COMMAND,serviceLinkSources} from '../../domains/financeiro/service-forecast.js';
import {posicaoDoPedido} from '../../domains/compras/purchase-position.js';
import {selectCommitments} from '../../domains/financeiro/ledger.js';
import {contar} from '../../design-system/copy.js';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {HelpButton} from '../help/HelpButton.jsx';

const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function ServiceLinkEditor({data,ledger,work,budget,contract,user,dispatchCommand,onClose}){
 useHelpTopic('fin','fin_vinculos');
 const [initial]=useState(()=>({data,positions:selectCommitments(ledger,{obraId:work.id}).items,version:Number(work.costPlanning?.version||0),link:work.costPlanning?.serviceLinks?.[contract.id]}));
 const [form,setForm]=useState(()=>({stageId:initial.link?.budgetId===budget?.id?initial.link.stageId:'',orderIds:initial.link?.orderIds||[],confirmOverlap:false,note:''}));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(20),retry=useRef(null);
 const guard=useUnsavedChanges(form,onClose,{busy,identity:contract.id});
 const orders=(initial.data.pedidos||[]).filter(o=>String(o.obraId)===String(work.id)&&posicaoDoPedido(o,[]).viva&&initial.positions.some(p=>p.sourceType==='pedido'&&String(p.sourceId)===String(o.id)));
 const filtered=orders.filter(o=>`${o.numero||o.id} ${o.fornecedorNome||''}`.toLowerCase().includes(query.toLowerCase()));
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 const save=async remove=>{
  if(busy)return;setBusy(true);setError('');
  const payload={obraId:work.id,contractId:contract.id,budgetId:budget?.id,stageId:form.stageId,orderIds:form.orderIds,confirmOverlap:form.confirmOverlap,note:form.note,remove,sources:serviceLinkSources(initial.data,contract.id,form.orderIds)};
  const signature=JSON.stringify(payload);
  if(retry.current?.signature!==signature)retry.current={signature,key:`service-link-${crypto.randomUUID()}`};
  try{
   const result=await dispatchCommand(()=>({type:SERVICE_LINK_COMMAND,actorId:user.id,actorName:user.nome,actorRole:user.role,expectedVersion:initial.version,idempotencyKey:retry.current.key,payload}));
   if(!result?.ok)throw Error(result?.reason||result?.error||'Não foi possível salvar. Mantenha o formulário e tente novamente.');
   onClose();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <><Modal title={`Vínculo da previsão · ${contract.name||'Terceirizado'}`} onClose={guard.requestClose}>
  <HelpButton pageId="fin_vinculos" allowedTabs={['fin']} label="Ajuda do vínculo"/>
  <form onSubmit={e=>{e.preventDefault();void save(false);}}>
   <fieldset disabled={busy}><legend>Contrato e orçamento</legend>
    <p>{work.name} · {budget?.nome||budget?.id||'Sem orçamento de controle'}</p>
    <Select label="Etapa de custo do contrato" required value={form.stageId} onChange={e=>set('stageId',e.target.value)} options={[{value:'',label:'Escolha uma etapa'},...(budget?.etapas||[]).filter(s=>!s.parentId).map(s=>({value:s.id,label:s.nome}))]}/>
    <p>O vínculo reúne o contrato inteiro em uma etapa de primeiro nível. Confira a apropriação das medições e notas; etapas divergentes precisam ser corrigidas antes.</p>
    <FormSection title="Pedidos do mesmo escopo" description="Selecione somente pedidos que representam o serviço já incluído neste contrato. Materiais ou serviços adicionais devem permanecer separados.">
     <Input label="Pesquisar pedido sobreposto" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}}/>
     <p>{contar(form.orderIds.length,'pedido selecionado','pedidos selecionados')}. Contrato e pedidos selecionados usam o maior valor contratado, menos os custos já reconhecidos, uma única vez.</p>
     {filtered.slice(0,limit).map(order=><Checkbox key={order.id} label={`Pedido ${order.numero||order.id} · ${money(initial.positions.find(p=>p.sourceType==='pedido'&&String(p.sourceId)===String(order.id)).increaseCents/100)}`} checked={form.orderIds.includes(String(order.id))} onChange={e=>set('orderIds',e.target.checked?[...form.orderIds,String(order.id)]:form.orderIds.filter(id=>id!==String(order.id)))}/>)}
     {filtered.length>limit&&<Button type="button" variant="outline" onClick={()=>setLimit(limit+20)}>Mostrar mais pedidos</Button>}
     {!filtered.length&&<p>Nenhum pedido ativo neste recorte.</p>}
     {form.orderIds.length>0&&<Checkbox label="Conferi que os pedidos selecionados representam o mesmo escopo do contrato" checked={form.confirmOverlap} onChange={e=>set('confirmOverlap',e.target.checked)}/>}
    </FormSection>
    <Input label="Justificativa do vínculo" required minLength={5} maxLength={2000} value={form.note} onChange={e=>set('note',e.target.value)}/>
    <p>Salvar atualiza os compromissos da previsão. Revisões manuais permanecem salvas e exigem reconferência; não serão somadas novamente aos compromissos.</p>
    <Button type="submit" disabled={!form.stageId||form.note.trim().length<5||form.orderIds.length>0&&!form.confirmOverlap}>{busy?'Salvando vínculo…':'Salvar vínculo da previsão'}</Button>
    {initial.link&&<Button type="button" variant="outline" disabled={form.note.trim().length<5} onClick={()=>void save(true)}>Remover vínculo da previsão</Button>}
   </fieldset>
   {error&&<p role="alert">{error}</p>}
  </form>
 </Modal><UnsavedChangesPrompt guard={guard}/></>;
}
