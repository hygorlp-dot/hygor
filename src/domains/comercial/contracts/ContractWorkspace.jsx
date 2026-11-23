import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import template from './administration-record-meta.json';
const ProtectedClauses=lazy(()=>import('./ProtectedClauses.jsx'));
import {RECORD_COMMANDS,contractReviewIssues,mayReadContract} from './record-commands.js';
import {CONTRACT_STEPS,RECORD_STATES,WORK_FIELDS,TERM_FIELDS,PARTY_FIELDS,COMPANY_FIELDS,suggestionLabel} from './record-fields.js';
import {reviewContractWorkLink} from './work-links.js';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {Textarea} from '../../../design-system/primitives/Textarea.jsx';
import {Checkbox} from '../../../design-system/primitives/Checkbox.jsx';
import {Badge} from '../../../design-system/primitives/Badge.jsx';
import {RecordAction} from '../../../design-system/primitives/RecordAction.jsx';
import {PageHeader} from '../../../design-system/patterns/PageHeader.jsx';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {WorkspaceNavigation,WorkspaceFilters} from '../../../design-system/patterns/WorkspaceNavigation.jsx';
import {EmptyState} from '../../../design-system/patterns/FeedbackState.jsx';
import {LoadingState} from '../../../design-system/patterns/LoadingState.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {Modal} from '../../../legacy/ui.jsx';
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import {useUnsavedChanges} from '../../../features/workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../../../features/workflow/UnsavedChangesPrompt.jsx';
import './records.css';
import {contractsForLead} from './lead-contract-links.js';
import {ScopeNote} from '../../../design-system/patterns/ScopeNote.jsx';
import {TaskDisclosure} from '../../../design-system/patterns/TaskDisclosure.jsx';
import {useBreakpoint} from '../../../hooks/useBreakpoint.js';

const id=()=>crypto.randomUUID();
const options=rows=>rows.map(([value,label])=>({value,label}));
const copied=value=>JSON.parse(JSON.stringify(value));
const stateName=value=>RECORD_STATES.find(([key])=>key===value)?.[1]||value;
const historyName=value=>({[RECORD_COMMANDS.SAVE]:'Cadastro salvo',[RECORD_COMMANDS.REVIEW]:'Enviado para revisão',[RECORD_COMMANDS.DECIDE]:'Revisão decidida',[RECORD_COMMANDS.REVISE]:'Nova revisão aberta',[RECORD_COMMANDS.LINK_WORK]:'Dados da obra aproveitados',[RECORD_COMMANDS.STATE]:'Situação alterada'}[value]||value);
const documentName=value=>value==='para_assinatura'?'Documento para assinatura':value==='via_assinada'?'Via assinada':`Anexo ${String(value||'').replace('anexo_','')}`;
const editable=row=>['rascunho','em_revisao'].includes(row.status);
const emissionNotice='Emissão de PDF/DOCX indisponível. Este módulo cadastra e acompanha contratos; não gera documentos. Para aprovação, vincule um documento preparado e conferido fora do ERP.';
function initialRecord(user,data){
  const dados={obra:{},comercial:{},prazos:{}};
  for(const [key,value] of Object.entries(template.suggestions)){const [group,field]=key.split('.');if(dados[group])dados[group][field]=value;}
  return {id:id(),titulo:'Contrato de administração de obra',status:'rascunho',version:0,revision:1,obraId:user.obraId||'',clienteId:'',propostaId:'',responsavelId:user.id,dados,partes:[{tipoPessoa:'PF'}],testemunhas:[{},{}],confirmacoes:{},contratada:copied(data.commercialContractCompany||{}),anexos:[],history:[],revisions:[],modelo:{id:template.id,name:template.name,version:template.version}};
}
function ValuesFields({rows,value={},onChange,readOnly=false}){
  return <div className="contract-record-grid">{rows.map(([key,label,type='text'])=><Input key={key} label={label} type={type} min={type==='number'?0:undefined} step={type==='number'?'any':undefined} readOnly={readOnly} value={value[key]??''} onChange={e=>onChange(key,e.target.value)}/>)}</div>;
}
function RevisionSummary({row,data}){
 const facts=(rows,values={})=><dl className="contract-record-facts">{rows.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{String(values[key]??'').trim()||'Não informado'}</dd></div>)}</dl>;
 return <div className="contract-record-stack">
  <FormSection title="Identificação preservada"><p>{row.titulo} · {stateName(row.status)}</p><p>Modelo {row.modelo.name} · versão {row.modelo.version}. Contratada · versão {row.companyVersion||0}.</p><p>Obra: {(data.obras||[]).find(w=>w.id===row.obraId)?.name||row.obraReferencia?.name||'Não vinculada'}.</p></FormSection>
  <FormSection title="Contratantes preservados">{(row.partes||[]).map((party,i)=><section key={i}><h3>Contratante {i+1} · {party.tipoPessoa==='PJ'?'Pessoa jurídica':'Pessoa física'}</h3>{facts(PARTY_FIELDS,party)}</section>)}</FormSection>
  <FormSection title="Contratada preservada">{facts(COMPANY_FIELDS,row.contratada)}</FormSection>
  <FormSection title="Imóvel e obra preservados">{facts(WORK_FIELDS,row.dados?.obra)}</FormSection>
  <FormSection title="Condições comerciais preservadas">{facts(Object.keys(row.dados?.comercial||{}).map(key=>[key,suggestionLabel(key)]),row.dados?.comercial)}</FormSection>
  <FormSection title="Prazos e assinatura preservados">{facts([...TERM_FIELDS,...Object.keys(template.suggestions).filter(key=>key.startsWith('prazos.')).map(key=>[key.split('.')[1],suggestionLabel(key.split('.')[1])])],row.dados?.prazos)}<p>Local: {row.localAssinatura||'Não informado'} · Data: {row.dataAssinatura||'Não informada'}</p>{(row.testemunhas||[]).map((party,i)=><p key={i}>Testemunha {i+1}: {party.nome||'Não informada'} · CPF: {party.documento||'Não informado'}</p>)}</FormSection>
  <FormSection title="Documentos preservados"><ul>{(row.anexos||[]).map((a,i)=><li key={i}>{documentName(a.tipo)} · {a.name} · {a.label}</li>)}</ul></FormSection>
 </div>;
}


export default function ContractWorkspace({data,currentUser,dispatchCommand,showToast,pageId='com_contratos',legacyContracts=[],onLegacyOpen,onFiles,leadContext=null,onClearLead,onReturnLead}){
  const {isMobile}=useBreakpoint();
  const [area,setArea]=useState('records'),[selected,setSelected]=useState(null),[filters,setFilters]=useState({search:'',status:'',work:'',owner:'',from:'',to:''}),[companyOpen,setCompanyOpen]=useState(false);
  useHelpTopic(pageId,area==='models'?'com_contratos_modelos':'com_contratos');
  if(!currentUser||!['admin','comercial'].includes(currentUser.role))return <EmptyState title="Acesso indisponível" description="Contratos exige perfil Comercial ou Administrador."/>;
  const linked=leadContext?contractsForLead(data,leadContext.id,currentUser):null;
  const records=linked?.records||(data.commercialContractRecords||[]).filter(row=>mayReadContract(row,currentUser));
  const previousContracts=linked?.legacy||legacyContracts;
  const proposalsById=new Map((data.comercial?.propostas||[]).map(proposal=>[proposal.id,proposal]));
  const workNames=new Map((data.obras||[]).map(work=>[work.id,work.name]));
  const clientNames=new Map((data.comercial?.clientes||[]).map(client=>[client.id,client.nome||client.razaoSocial]));
  const search=filters.search.trim().toLocaleLowerCase('pt-BR');
  const rows=records.filter(row=>{
    if(filters.status&&row.status!==filters.status)return false;
    if(filters.work&&row.obraId!==filters.work)return false;
    if(filters.owner&&row.responsavelId!==filters.owner)return false;
    if(filters.from&&!(row.createdAt?.slice(0,10)>=filters.from))return false;
    if(filters.to&&!(row.createdAt?.slice(0,10)<=filters.to))return false;
    const proposal=proposalsById.get(row.propostaId);
    return !search||[row.number,row.titulo,row.modelo?.name,clientNames.get(row.clienteId),workNames.get(row.obraId),proposal?.numero,proposal?.objeto]
      .join(' ').toLocaleLowerCase('pt-BR').includes(search);
  });
  const filter=(key,value)=>setFilters(old=>({...old,[key]:value}));
  const mainFilters=<FilterBar layout="grid" align="start" label="Filtros dos contratos" className="contract-record-filters">
    <Input label="Pesquisar contrato" value={filters.search} onChange={e=>filter('search',e.target.value)} description="Número, título, cliente, obra, proposta ou modelo"/>
    <Select label="Situação" value={filters.status} onChange={e=>filter('status',e.target.value)} options={[{value:'',label:'Todas'},...options(RECORD_STATES)]}/>
    <Select label="Obra" value={filters.work} onChange={e=>filter('work',e.target.value)} options={[{value:'',label:'Todas'},...(data.obras||[]).map(w=>({value:w.id,label:w.name}))]}/>
  </FilterBar>;
  return <div className="contract-record-workspace">
    <PageHeader title="Contratos" description={leadContext?undefined:'Cadastro, conferência e acompanhamento por cliente e obra.'} primaryAction={area==='records'?<Button onClick={()=>setSelected(initialRecord(currentUser,data))}>Novo contrato</Button>:undefined}/>
    {area==='records'&&<ScopeNote title="Obra na lista">{workNames.get(filters.work)||'Todas as obras disponíveis'}</ScopeNote>}
    {onReturnLead&&<Button variant="secondary" onClick={onReturnLead}>Voltar à ficha do lead</Button>}
    {leadContext&&<ScopeNote title="Contratos do lead">{leadContext.nome}. <Button variant="ghost" onClick={onClearLead}>Consultar toda a central</Button></ScopeNote>}
    {currentUser.role==='admin'&&!leadContext&&<WorkspaceNavigation label="Áreas dos contratos" active={area} onChange={setArea} items={[{id:'records',label:'Contratos'},{id:'models',label:'Modelos de contrato'}]}/>}
    <TaskDisclosure enabled={Boolean(leadContext)||isMobile} summary="Emissão de documentos indisponível">
      <Alert variant="warning"><AlertDescription>{emissionNotice}</AlertDescription></Alert>
    </TaskDisclosure>
    {area==='models'?<>
      <FormSection title={template.name} description={`Versão ${template.version} · Texto protegido, importado para revisão. Não há edição de cláusulas nem publicação de variantes nesta entrega.`}>
        <p>Pessoa jurídica, múltiplos contratantes e obra sem loteamento exigem variante aprovada. A aprovação cadastral não publica um modelo.</p>
        <p>Cadastro central da contratada: versão {data.commercialContractCompany?.version||0}. Alterações não atualizam contratos existentes.</p>
        <Button variant="secondary" onClick={()=>setCompanyOpen(true)}>Editar cadastro da contratada</Button>
        <details><summary>Consultar cláusulas e variáveis do modelo</summary><Suspense fallback={<LoadingState label="texto protegido"/>}><ProtectedClauses/></Suspense></details>
      </FormSection>
    </>:<>
      {!leadContext&&mainFilters}
      <WorkspaceFilters activeCount={[filters.owner,filters.from,filters.to,...(leadContext?[filters.search,filters.status,filters.work]:[])].filter(Boolean).length}>
       {leadContext&&mainFilters}
       <FilterBar layout="grid" label="Filtros adicionais dos contratos">
        <Select label="Responsável" value={filters.owner} onChange={e=>filter('owner',e.target.value)} options={[{value:'',label:'Todos'},...(data.usuarios||[]).map(u=>({value:u.id,label:u.nome}))]}/>
        <Input label="Criado desde" type="date" value={filters.from} onChange={e=>filter('from',e.target.value)}/><Input label="Criado até" type="date" value={filters.to} onChange={e=>filter('to',e.target.value)}/>
       </FilterBar>
      </WorkspaceFilters>
      <p role="status">{rows.length} {rows.length===1?'contrato':'contratos'} no recorte</p>
      {rows.map(row=>{
        const proposal=proposalsById.get(row.propostaId);
        return <section className="contract-record-row" key={row.id}>
          <div><RecordAction onClick={()=>setSelected(copied(row))}>{row.number} · {row.titulo}</RecordAction>
            <p>{clientNames.get(row.clienteId)||'Cliente ainda não vinculado'} · {workNames.get(row.obraId)||'Obra ainda não vinculada'}</p>
            {row.propostaId&&<p>Proposta · {proposal?.numero||proposal?.objeto||'Indisponível neste acesso'}</p>}
            <p>Revisão {row.revision} · {row.modelo.name} · versão {row.modelo.version}</p>
          </div>
          <div><Badge tone={row.status==='assinado'?'success':'neutral'}>{stateName(row.status)}</Badge><Button variant="secondary" onClick={()=>setSelected(copied(row))}>Abrir contrato</Button></div>
        </section>;
      })}
      {!rows.length&&<EmptyState title={records.length?'Nenhum contrato neste recorte':leadContext?'Nenhum contrato atual vinculado a este lead':'Nenhum contrato cadastrado'} description={leadContext?'O vínculo dos contratos atuais usa a proposta deste lead. Consulte toda a central para ver os demais registros; nomes iguais não vinculam contratos.':'Use Novo contrato para iniciar. É possível salvar antes de cadastrar a obra.'}/>}
      {previousContracts.length>0&&<details><summary>Contratos anteriores ({previousContracts.length})</summary><p>Os registros anteriores conservam o fluxo existente. Não são convertidos em instrumentos deste modelo.</p>{previousContracts.map(row=><p key={row.id}><RecordAction onClick={()=>onLegacyOpen(row)}>{row.numero} · {row.contratante||row.objeto||'Contrato anterior'}</RecordAction></p>)}</details>}
    </>}
    {selected&&<ContractEditor key={selected.id} initial={selected} data={data} user={currentUser} dispatchCommand={dispatchCommand} onClose={()=>setSelected(null)} onFiles={onFiles} onDuplicate={value=>setSelected(value)} pageId={pageId}/>}
    {companyOpen&&<CompanyEditor initial={data.commercialContractCompany||{version:0}} dispatchCommand={dispatchCommand} onClose={()=>setCompanyOpen(false)} showToast={showToast}/>}
  </div>;
}

function CompanyEditor({initial,dispatchCommand,onClose,showToast}){
  const [form,setForm]=useState(copied(initial)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const guard=useUnsavedChanges(form,onClose,{busy});
  const save=async()=>{setBusy(true);try{const result=await dispatchCommand(()=>({type:RECORD_COMMANDS.COMPANY,idempotencyKey:`contract-company-${id()}`,expectedVersion:initial.version,payload:{company:form}}));if(!result.ok){setError(result.reason);return;}showToast?.('Cadastro da contratada salvo. Contratos anteriores foram preservados.');onClose();}finally{setBusy(false);}};
  return <><Modal title="Cadastro central da contratada" onClose={guard.requestClose}><fieldset disabled={busy} className="contract-record-fieldset"><ValuesFields rows={COMPANY_FIELDS} value={form} onChange={(key,value)=>setForm(old=>({...old,[key]:value}))}/></fieldset>{error&&<p role="alert">{error}</p>}<Button disabled={busy} onClick={save}>Salvar cadastro da contratada</Button></Modal><UnsavedChangesPrompt guard={guard}/></>;
}

function ContractEditor({initial,data,user,dispatchCommand,onClose,onDuplicate,pageId,onFiles}){
  const [form,setForm]=useState(copied(initial)),[files,setFiles]=useState((initial.anexos||[]).filter(a=>a.tipo!=='via_assinada').map(a=>({tipo:a.tipo,documentId:a.documentId,revisionId:a.revisionId,confirmado:a.confirmado}))),[step,setStep]=useState('0'),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[selectedWorkFields,setSelectedWorkFields]=useState([]),[signed,setSigned]=useState(''),[confirmSigned,setConfirmSigned]=useState(false),[reuse,setReuse]=useState(null);
  const version=useRef(initial.version||0),pending=useRef(null),latest=useRef(null);
  latest.current={form,files};
  useHelpTopic(pageId,'com_contratos_editor',2);
  const guard=useUnsavedChanges({form,files},onClose,{busy,identity:`${form.id}:${form.version}`});
  const change=fn=>{setForm(old=>fn(old));setDirty(true);setError('');};
  const field=(group,key,value)=>change(old=>({...old,dados:{...old.dados,[group]:{...old.dados[group],[key]:value}},confirmacoes:{...old.confirmacoes,[group==='obra'?'obra':'comercial']:false,documentoExterno:false}}));
  const canEdit=editable(form),admin=user.role==='admin';
  const save=async()=>{
    if(busy)return false;
    setBusy(true);setError('');
    const serialized=JSON.stringify(latest.current);
    if(pending.current?.serialized!==serialized)pending.current={serialized,key:`contract-save-${id()}`};
    try{
      const result=await dispatchCommand(()=>({type:RECORD_COMMANDS.SAVE,idempotencyKey:pending.current.key,expectedVersion:version.current,payload:{id:form.id,record:latest.current.form,files:latest.current.files}}));
      if(!result?.ok){setError(result?.reason||'O servidor não confirmou o contrato. Mantenha a edição aberta e tente salvar novamente.');return false;}
      const saved=result.data.commercialContractRecords.find(r=>r.id===form.id);version.current=saved.version;setForm(copied(saved));setDirty(false);pending.current=null;return true;
    }catch(e){setError(e.message||'Falha ao salvar. Tente novamente.');return false;}finally{setBusy(false);}
  };
  useEffect(()=>{if(!dirty||busy||error||!canEdit)return;const timer=setTimeout(()=>{void save();},900);return()=>clearTimeout(timer);},[dirty,busy,error,form,files]); // The opened entity version is never lifted by background updates.
  const act=async(type,payload={})=>{
    if(dirty&&!(await save()))return;
    setBusy(true);setError('');
    try{
      const result=await dispatchCommand(()=>({type,idempotencyKey:`contract-action-${id()}`,expectedVersion:version.current,payload:{id:form.id,reason,...payload}}));
      if(!result?.ok){setError(result?.reason||'A ação não foi confirmada.');return;}
      const saved=result.data.commercialContractRecords.find(r=>r.id===form.id);version.current=saved.version;setForm(copied(saved));setFiles((saved.anexos||[]).filter(a=>a.tipo!=='via_assinada').map(a=>({tipo:a.tipo,documentId:a.documentId,revisionId:a.revisionId,confirmado:a.confirmado})));setDirty(false);setReason('');setSelectedWorkFields([]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const work=(data.obras||[]).find(w=>w.id===form.obraId);
  const comparison=work?reviewContractWorkLink({contract:form,work,user}):null;
  const docs=(data.workFileCabinets||[]).filter(c=>c.obraId===form.obraId).flatMap(c=>(c.documents||[]).flatMap(d=>(d.revisions||[]).map(r=>({value:`${d.id}|${r.id}`,label:`${d.name} · ${r.label}`,documentId:d.id,revisionId:r.id}))));
  const issues=contractReviewIssues({...form,anexos:files});
  const formChange=(key,value)=>change(old=>({...old,[key]:value,confirmacoes:{...old.confirmacoes,documentoExterno:false}}));
  const confirm=(key,value)=>change(old=>({...old,confirmacoes:{...old.confirmacoes,[key]:value}}));
  const setFile=(type,value)=>{const doc=docs.find(d=>d.value===value);setFiles(old=>[...old.filter(a=>a.tipo!==type),...(doc?[{tipo:type,documentId:doc.documentId,revisionId:doc.revisionId,confirmado:false}]:[])]);setDirty(true);setError('');confirm('documentoExterno',false);};
  const duplicate=()=>{
    const fresh=initialRecord(user,data);fresh.dados.comercial={};fresh.dados.prazos={};
    for(const key of reuse){const [group,field]=key.split('.');fresh.dados[group][field]=form.dados[group]?.[field];}
    onDuplicate(fresh);
  };
  return <><Modal wide title={`${form.number||'Novo contrato'} · revisão ${form.revision}`} onClose={guard.requestClose} panelClass="contract-record-editor">
    <div className="contract-record-stack">
      <Alert variant="warning"><AlertDescription>{emissionNotice}</AlertDescription></Alert>
      <div className="contract-record-actions"><Badge>{stateName(form.status)}</Badge><span role="status">{busy?'Salvando ou processando…':dirty?'Alterações ainda não confirmadas':form.version?'Dados confirmados':'Rascunho ainda não salvo'}</span><Button disabled={!canEdit||busy||(!dirty&&form.version>0)} onClick={save}>Salvar rascunho</Button><Button disabled aria-describedby="contract-emission-disabled">Gerar PDF</Button><Button disabled aria-describedby="contract-emission-disabled">Exportar DOCX</Button></div>
      <p id="contract-emission-disabled">A emissão está desativada nesta entrega.</p>
      {error&&<Alert variant="destructive"><AlertDescription>{error} {dirty?'Se houver conflito, copie os dados editados antes de fechar e reabra a versão atual.':''}</AlertDescription></Alert>}
      <WorkspaceNavigation label="Etapas do contrato" active={step} onChange={setStep} items={CONTRACT_STEPS.map((label,i)=>({id:String(i),label:`${String.fromCharCode(65+i)}. ${label}`}))}/>
      <fieldset disabled={busy||!canEdit} className="contract-record-fieldset">
        {step==='0'&&<FormSection title="Identificação" description="A numeração é reservada pelo servidor ao salvar. Você pode começar sem obra cadastrada.">
          <Input label="Título do contrato" value={form.titulo} onChange={e=>formChange('titulo',e.target.value)}/>
          <div className="contract-record-grid"><Select label="Cliente cadastrado" value={form.clienteId||''} onChange={e=>{
            const client=(data.comercial?.clientes||[]).find(c=>c.id===e.target.value);
            change(old=>({...old,clienteId:e.target.value,propostaId:'',partes:client?[{tipoPessoa:client.tipoPessoa||'PF',nome:client.razaoSocial||client.nome,documento:client.documento,endereco:client.endereco,email:client.email,telefone:client.telefone,confirmado:false}]:[{tipoPessoa:'PF'}],confirmacoes:{}}));
          }} options={[{value:'',label:'Vincular depois'},...(data.comercial?.clientes||[]).map(c=>({value:c.id,label:c.razaoSocial||c.nome}))]}/>
          <Select label="Obra vinculada" value={form.obraId||''} onChange={e=>change(old=>({...old,obraId:e.target.value,confirmacoes:{}}))} options={[{value:'',label:'Obra ainda não cadastrada'},...(data.obras||[]).map(w=>({value:w.id,label:w.name}))]}/>
          <Select label="Proposta vinculada" value={form.propostaId||''} onChange={e=>formChange('propostaId',e.target.value)} options={[{value:'',label:'Sem proposta'},...(data.comercial?.propostas||[]).filter(p=>p.leadId&&(data.comercial?.clientes||[]).find(c=>c.id===form.clienteId)?.leadId===p.leadId).map(p=>({value:p.id,label:p.numero||p.objeto}))]}/>
          <Select label="Responsável comercial" value={form.responsavelId||''} onChange={e=>formChange('responsavelId',e.target.value)} options={[{value:'',label:'Selecione'},...(data.usuarios||[]).filter(u=>u.active!==false).map(u=>({value:u.id,label:u.nome}))]}/></div>
          <p>Modelo: {form.modelo.name}, versão {form.modelo.version}. Texto protegido.</p>
        </FormSection>}
        {step==='1'&&<FormSection title="Contratantes e signatários" description="O cadastro fornece uma cópia. Confira as declarações individualmente; nenhuma é presumida.">
          {form.partes.map((party,index)=><section key={index} className="contract-record-stack"><h3>Contratante {index+1}</h3><Select label={`Tipo de pessoa do contratante ${index+1}`} value={party.tipoPessoa} onChange={e=>change(old=>({...old,partes:old.partes.map((p,i)=>i===index?{...p,tipoPessoa:e.target.value,confirmado:false}:p),confirmacoes:{}}))} options={options([['PF','Pessoa física'],['PJ','Pessoa jurídica — exige variante aprovada']])}/>
            <ValuesFields rows={PARTY_FIELDS} value={party} onChange={(key,value)=>change(old=>({...old,partes:old.partes.map((p,i)=>i===index?{...p,[key]:value,confirmado:false}:p),confirmacoes:{...old.confirmacoes,declaracoes:false,documentoExterno:false}}))}/>
            <Checkbox label={`Conferi os dados e as declarações do contratante ${index+1}`} checked={!!party.confirmado} onChange={e=>change(old=>({...old,partes:old.partes.map((p,i)=>i===index?{...p,confirmado:e.target.checked}:p)}))}/>
            {index>0&&<Button variant="secondary" onClick={()=>change(old=>({...old,partes:old.partes.filter((_,i)=>i!==index),confirmacoes:{}}))}>Remover contratante {index+1}</Button>}
          </section>)}
          <Button variant="secondary" onClick={()=>change(old=>({...old,partes:[...old.partes,{tipoPessoa:'PF'}],confirmacoes:{}}))}>Adicionar contratante</Button>
          <Checkbox label="Confirmei especificamente as declarações pessoais, de uso próprio e de não exploração de atividade de construção civil aplicáveis ao documento externo" checked={!!form.confirmacoes.declaracoes} onChange={e=>confirm('declaracoes',e.target.checked)}/>
          <p>Pessoa jurídica ou mais de um contratante permanece em revisão até existir variante aprovada. Não reaproveite a declaração de ausência de união estável sem confirmação específica no documento externo.</p>
        </FormSection>}
        {step==='2'&&<FormSection title="Cópia da contratada" description={`Versão central preservada: ${form.companyVersion||data.commercialContractCompany?.version||0}. Para mudar uma cópia antiga, duplique o cadastro do contrato.`}><ValuesFields rows={COMPANY_FIELDS} value={form.contratada} readOnly onChange={()=>{}}/><p>O administrador mantém os dados em Modelos de contrato → Editar cadastro da contratada.</p></FormSection>}
        {step==='3'&&<FormSection title="Imóvel e obra" description="Use A emitir somente quando o documento externo e a revisão admitirem essa situação. Não declare aprovações inexistentes.">
          <ValuesFields rows={WORK_FIELDS} value={form.dados.obra} onChange={(key,value)=>field('obra',key,value)}/>
          <Checkbox label="Conferi os dados do imóvel e da obra" checked={!!form.confirmacoes.obra} onChange={e=>confirm('obra',e.target.checked)}/>
          {comparison?.ok?<><h3>Cruzamento com a obra cadastrada</h3><p>Valor cadastrado na obra: {comparison.reference.registeredContractValue??'Não informado'}. Esse valor não define o CGR nem o teto.</p>
            {comparison.comparisons.map(row=><div key={row.key}><Checkbox label={`${row.label}: contrato ${row.contractValue??'não informado'} · obra ${row.workValue??'não informado'} · ${row.status.replaceAll('_',' ')}`} disabled={['invalido','ausente_na_obra'].includes(row.status)} checked={selectedWorkFields.includes(row.key)} onChange={e=>setSelectedWorkFields(old=>e.target.checked?[...old,row.key]:old.filter(k=>k!==row.key))}/></div>)}
            <Button variant="secondary" disabled={!form.version||!selectedWorkFields.length||dirty} onClick={()=>act(RECORD_COMMANDS.LINK_WORK,{fields:selectedWorkFields,workVersion:comparison.workVersion})}>Aproveitar dados selecionados da obra</Button><p>Salve o rascunho antes de aplicar. O comando confere a versão da obra novamente e exige nova confirmação.</p>
          </>:<p>{comparison?.error||'Vincule uma obra em Identificação para comparar os dados.'}</p>}
        </FormSection>}
        {step==='4'&&<FormSection title="Condições comerciais" description="Sugestões da minuta, sujeitas à confirmação. CGR, taxa e teto são independentes.">
          <div className="contract-record-grid">{Object.entries(template.suggestions).filter(([key])=>key.startsWith('comercial.')).map(([key,value])=>{const fieldKey=key.split('.')[1];return <Input key={key} label={suggestionLabel(fieldKey)} description={`Sugestão da minuta: ${value}`} type={typeof value==='number'?'number':'text'} min={typeof value==='number'?0:undefined} step={typeof value==='number'?'any':undefined} value={form.dados.comercial[fieldKey]??''} onChange={e=>field('comercial',fieldKey,e.target.value)}/>;})}</div>
          <Checkbox label="O CGR foi negociado manualmente" checked={!!form.cgrManual} onChange={e=>formChange('cgrManual',e.target.checked)}/>
          {form.cgrManual&&<Textarea label="Justificativa do CGR manual" value={form.dados.prazos.motivo_cgr_manual||''} onChange={e=>field('prazos','motivo_cgr_manual',e.target.value)}/>}
          <p>Conferência área × valor por m²: {Number(form.dados.obra.area_construida||0)*Number(form.dados.comercial.valor_m2||0)}. A conferência não altera o valor negociado.</p>
          <Checkbox label="Confirmei todos os parâmetros comerciais e as exclusões da base no documento externo" checked={!!form.confirmacoes.comercial} onChange={e=>confirm('comercial',e.target.checked)}/>
        </FormSection>}
        {step==='5'&&<FormSection title="Prazos e condições" description="Início previsto é referência. O início efetivo depende dos requisitos contratuais; nenhuma conclusão definitiva é calculada aqui.">
          <ValuesFields rows={TERM_FIELDS.filter(([key])=>key!=='motivo_cgr_manual')} value={form.dados.prazos} onChange={(key,value)=>field('prazos',key,value)}/>
          <div className="contract-record-grid">{Object.entries(template.suggestions).filter(([key])=>key.startsWith('prazos.')).map(([key,value])=>{const fieldKey=key.split('.')[1];return <Input key={key} label={suggestionLabel(fieldKey)} description={`Sugestão da minuta: ${value}`} type={typeof value==='number'?'number':'text'} min={typeof value==='number'?0:undefined} step="any" value={form.dados.prazos[fieldKey]??''} onChange={e=>field('prazos',fieldKey,e.target.value)}/>;})}</div>
          <Checkbox label="Conferi assinatura, liberação do terreno, aprovações, alvará, fundo de reserva e mobilização para reconhecer o início efetivo" checked={!!form.confirmacoes.inicio} onChange={e=>confirm('inicio',e.target.checked)}/>
        </FormSection>}
        {step==='6'&&<FormSection title="Anexos e revisão" description="Os arquivos precisam estar vinculados pelos Arquivos da mesma obra. Selecionar não confirma recebimento ou conferência.">
          <div className="contract-record-grid">{[['para_assinatura','Documento externo para assinatura'],...['Projetos de Arquitetura (Executivo)','Projeto de Estrutura','Projetos de Instalações','Cronograma Físico-Financeiro','Prazos e Garantias'].map((label,i)=>[`anexo_${i+1}`,`Anexo ${i+1} — ${label}`])].map(([type,label])=>{const file=files.find(a=>a.tipo===type);return <div key={type}><Select label={label} value={file?`${file.documentId}|${file.revisionId}`:''} onChange={e=>setFile(type,e.target.value)} options={[{value:'',label:'Não vinculado'},...docs]}/><Checkbox label={`Conferi o arquivo: ${label}`} checked={!!file?.confirmado} disabled={!file} onChange={e=>{setFiles(old=>old.map(a=>a.tipo===type?{...a,confirmado:e.target.checked}:a));setDirty(true);setError('');}}/></div>;})}</div>
          <Button variant="secondary" disabled={!form.obraId} onClick={async()=>{if(dirty&&!(await save()))return;onClose();onFiles?.(form.obraId);}}>Abrir Arquivos da obra</Button>
          <ValuesFields rows={[["localAssinatura","Local de assinatura"],["dataAssinatura","Data de assinatura","date"]]} value={form} onChange={formChange}/>
          {(form.testemunhas?.length?form.testemunhas:[{},{}]).map((w,i)=><section key={i}><h3>Testemunha {i+1}</h3><ValuesFields rows={[["nome",`Nome da testemunha ${i+1}`],["documento",`CPF da testemunha ${i+1}`]]} value={w} onChange={(key,value)=>change(old=>({...old,testemunhas:(old.testemunhas?.length?old.testemunhas:[{},{}]).map((p,j)=>j===i?{...p,[key]:value}:p)}))}/></section>)}
          {admin&&<Checkbox label="Conferi externamente o documento para assinatura: cláusulas integrais, dados repetidos, números por extenso, referências e anexos; não há dados de outro cliente" checked={!!form.confirmacoes.documentoExterno} onChange={e=>confirm('documentoExterno',e.target.checked)}/>}
          <Textarea label="Observações para revisão" value={form.dados.prazos.observacoes_revisao||''} onChange={e=>field('prazos','observacoes_revisao',e.target.value)}/>
        </FormSection>}
      </fieldset>
      <div className="contract-record-actions"><Button variant="secondary" disabled={Number(step)===0} onClick={()=>setStep(String(Number(step)-1))}>Etapa anterior</Button><Button variant="secondary" disabled={Number(step)===6} onClick={()=>setStep(String(Number(step)+1))}>Próxima etapa</Button></div>
      <details><summary>Pendências para aprovação ({issues.length})</summary>{issues.length?<ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p>Conferências cadastrais atendidas. A emissão continua indisponível.</p>}</details>
      <div className="contract-record-actions">
        {form.status==='rascunho'&&<Button disabled={busy||!form.version} onClick={()=>act(RECORD_COMMANDS.REVIEW)}>Enviar para revisão</Button>}
        {form.status==='em_revisao'&&admin&&<><Button disabled={busy||dirty||issues.length>0} onClick={()=>act(RECORD_COMMANDS.DECIDE,{approve:true})}>Aprovar revisão externa para assinatura</Button><Button variant="secondary" disabled={busy||!reason.trim()} onClick={()=>act(RECORD_COMMANDS.DECIDE,{approve:false})}>Devolver para ajuste</Button></>}
        {!canEdit&&!['cancelado','encerrado'].includes(form.status)&&<Button disabled={busy||!reason.trim()} onClick={()=>act(RECORD_COMMANDS.REVISE)}>Abrir nova revisão</Button>}
        {admin&&form.status==='aprovado'&&<Button disabled={busy||!reason.trim()} onClick={()=>act(RECORD_COMMANDS.STATE,{status:'aguardando_assinatura'})}>Registrar aguardando assinatura</Button>}
        {admin&&form.status==='assinado'&&<Button disabled={busy||!reason.trim()} onClick={()=>act(RECORD_COMMANDS.STATE,{status:'encerrado'})}>Encerrar contrato</Button>}
        {admin&&['rascunho','em_revisao','aprovado','aguardando_assinatura'].includes(form.status)&&<Button variant="destructive" disabled={busy||!reason.trim()} onClick={()=>act(RECORD_COMMANDS.STATE,{status:'cancelado'})}>Cancelar contrato</Button>}
        <Button variant="secondary" disabled={busy||dirty} onClick={()=>setReuse([])}>Duplicar contrato</Button>
      </div>
      <Textarea label="Motivo da decisão, mudança de situação ou nova revisão" value={reason} onChange={e=>setReason(e.target.value)}/>
      {admin&&form.status==='aguardando_assinatura'&&<FormSection title="Registrar assinatura externa" description="A seleção deve apontar para uma revisão da via assinada nos Arquivos desta obra."><Select label="Via assinada" value={signed} onChange={e=>{setSigned(e.target.value);setConfirmSigned(false);}} options={[{value:'',label:'Selecione'},...docs]}/><Checkbox label="Conferi as assinaturas na via vinculada" checked={confirmSigned} onChange={e=>setConfirmSigned(e.target.checked)}/><Button disabled={busy||!signed||!confirmSigned||!reason.trim()} onClick={()=>{const doc=docs.find(d=>d.value===signed);void act(RECORD_COMMANDS.STATE,{status:'assinado',signed:{documentId:doc.documentId,revisionId:doc.revisionId},confirmSigned});}}>Registrar contrato assinado</Button></FormSection>}
      <details><summary>Consultar histórico e revisões preservadas</summary><ul>{(form.history||[]).map((entry,i)=><li key={i}>{new Date(entry.at).toLocaleString('pt-BR')} · {entry.actorName||'Usuário registrado'} · {historyName(entry.action)} · {entry.reason||stateName(entry.to)}</li>)}</ul>{(form.revisions||[]).map(row=><details key={row.revision}><summary>Revisão {row.revision} · {stateName(row.status)}</summary><RevisionSummary row={row} data={data}/></details>)}</details>
      {!canEdit&&<details><summary>Documentos preservados nesta revisão</summary><ul>{(form.anexos||[]).map((a,i)=><li key={i}>{documentName(a.tipo)} · {a.name} · {a.label}</li>)}</ul></details>}
    </div>
  </Modal><UnsavedChangesPrompt guard={guard}/>
  {reuse&&<Modal title="Condições para reaproveitar na duplicação" onClose={()=>setReuse(null)}><p>Cliente, obra, partes, documentos, anexos, datas, assinaturas e confirmações serão limpos.</p>{Object.keys(template.suggestions).map(key=><Checkbox key={key} label={`${key.startsWith('prazos.')?'Prazo':'Comercial'} · ${suggestionLabel(key.split('.')[1])}`} checked={reuse.includes(key)} onChange={e=>setReuse(old=>e.target.checked?[...old,key]:old.filter(k=>k!==key))}/>)}<Button onClick={duplicate}>Criar novo rascunho</Button></Modal>}
  </>;
}
