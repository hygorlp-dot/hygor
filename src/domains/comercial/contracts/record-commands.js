import model from './administration-record-meta.json' with {type:'json'};
import {applyWorkSuggestionsToDraft} from './work-links.js';
import {validateBrazilianDocument} from '../../data/brazilian-documents.js';
import {WORK_FIELDS,TERM_FIELDS,PARTY_FIELDS,COMPANY_FIELDS} from './record-fields.js';
import {folderAccess} from '../../arquivos/access.js';

export const RECORD_COMMANDS={SAVE:'COMERCIAL_INSTRUMENTO_SALVO',REVIEW:'COMERCIAL_INSTRUMENTO_REVISAO',DECIDE:'COMERCIAL_INSTRUMENTO_DECIDIDO',REVISE:'COMERCIAL_INSTRUMENTO_NOVA_REVISAO',LINK_WORK:'COMERCIAL_INSTRUMENTO_OBRA',STATE:'COMERCIAL_INSTRUMENTO_SITUACAO',COMPANY:'COMERCIAL_CONTRATADA_SALVA'};
export const RECORD_COMMAND_TYPES=new Set(Object.values(RECORD_COMMANDS));
export const RECORD_SECTIONS=['commercialContractRecords','commercialContractCompany'];
const fail=reason=>({ok:false,reason});
const deep=value=>JSON.parse(JSON.stringify(value));
const str=value=>String(value??'').trim().slice(0,12000);
const picked=(raw={},fields=[])=>Object.fromEntries(fields.map(([key])=>[key,str(raw[key])]));
const writable=record=>!record||['rascunho','em_revisao'].includes(record.status);
export const mayReadContract=(record,user)=>Boolean(user?.id&&user.active!==false&&['admin','comercial'].includes(user.role)&&(!user.obraId||String(record.obraId||'')===String(user.obraId)));
export function mayReadContractDocuments(record,data,user){
  if(!mayReadContract(record,user))return false;
  if(user.role==='admin')return true;
  return [record,...(record.revisions||[])].every(snapshot=>(snapshot.anexos||[]).every(ref=>{
    const cabinet=(data.workFileCabinets||[]).find(c=>c.obraId===record.obraId&&(c.documents||[]).some(d=>d.id===ref.documentId&&(d.revisions||[]).some(r=>r.id===ref.revisionId)));
    const doc=cabinet?.documents.find(d=>d.id===ref.documentId);
    return cabinet&&folderAccess(cabinet,doc.folderId,user);
  }));
}
export function contractCommandScope(data,command,user){
  if(!user?.id||user.active===false||!['admin','comercial'].includes(user.role))return fail('Seu perfil não pode operar os contratos comerciais.');
  if(command.type===RECORD_COMMANDS.COMPANY)return user.role==='admin'&&!user.obraId?{ok:true}:fail('Somente administrador sem restrição de obra pode administrar a contratada.');
  const current=(data.commercialContractRecords||[]).find(row=>row.id===command.payload?.id);
  if(current&&!mayReadContractDocuments(current,data,user))return fail('O contrato ou um documento preservado está fora do seu acesso.');
  const target=command.type===RECORD_COMMANDS.SAVE?command.payload?.record?.obraId:current?.obraId;
  if(user.obraId&&String(user.obraId)!==String(target||''))return fail('Selecione uma obra autorizada para seu perfil.');
  if(target&&!(data.obras||[]).some(row=>String(row.id)===String(target)))return fail('Obra não encontrada.');
  return {ok:true,obraId:target||'',scope:target?'work':'company'};
}
export function contractReviewIssues(record){
  const issues=[];
  const required=(value,label)=>{if(!str(value))issues.push(label);};
  required(record.titulo,'Informe o título.');required(record.responsavelId,'Selecione o responsável comercial.');
  required(record.clienteId,'Vincule o cliente cadastrado.');
  if(!record.partes?.length)issues.push('Informe ao menos um contratante.');
  for(const party of record.partes||[]){
    required(party.nome,'Informe o nome do contratante.');required(party.endereco,'Informe o endereço do contratante.');
    if(!validateBrazilianDocument(party.documento,party.tipoPessoa))issues.push('Confira o CPF ou CNPJ do contratante.');
    if(party.tipoPessoa!=='PF')issues.push('Pessoa jurídica exige variante contratual aprovada, ainda indisponível.');
    if(!party.confirmado)issues.push('Confirme os dados e declarações de cada contratante.');
  }
  if(record.partes?.length>1)issues.push('Múltiplos contratantes exigem variante aprovada, ainda indisponível.');
  for(const [key,label] of COMPANY_FIELDS)required(record.contratada?.[key],`Confira a contratada: ${label}.`);
  if(!validateBrazilianDocument(record.contratada?.cnpj,'PJ'))issues.push('Confira o CNPJ da contratada.');
  const w=record.dados?.obra||{},c=record.dados?.comercial||{};
  for(const key of ['descricao','finalidade','endereco','loteamento','lote','quadra','matricula','cartorio','crea','art'])required(w[key],`Confira imóvel e obra: ${key.replaceAll('_',' ')}.`);
  if(!w.loteamento)issues.push('Obra sem loteamento exige variante aprovada, ainda indisponível.');
  if(!record.confirmacoes?.declaracoes)issues.push('Confirme especificamente a aplicabilidade das declarações pessoais e de uso próprio.');
  if(!record.confirmacoes?.obra||!record.confirmacoes?.comercial)issues.push('Confirme obra e condições comerciais.');
  for(const [group,values] of Object.entries(record.dados||{}))for(const [key,value] of Object.entries(values)){
    if(typeof model.suggestions[`${group}.${key}`]==='number'&&(!Number.isFinite(Number(value))||Number(value)<0))issues.push(`Valor inválido: ${key.replaceAll('_',' ')}.`);
  }
  if(!(Number(w.area_construida)>0))issues.push('Informe área construída positiva.');
  if(!(Number(c.cgr)>0)||!(Number(c.teto)>0)||!(Number(c.taxa_administracao)>0&&Number(c.taxa_administracao)<=100))issues.push('Confira CGR, teto e percentual da taxa.');
  for(const key of ['retencao','alerta_cgr','recomposicao_percentual'])if(c[key]!==undefined&&Number(c[key])>100)issues.push(`Percentual inválido: ${key}.`);
  const calculated=Math.round(Number(w.area_construida)*Number(c.valor_m2)*100)/100;
  if(record.cgrManual){required(record.dados?.prazos?.motivo_cgr_manual,'Justifique o CGR informado manualmente.');}
  else if(Math.abs(Number(c.cgr)-calculated)>0.01)issues.push('O CGR difere de área × valor por metro quadrado. Corrija ou justifique o valor manual.');
  const terms=record.dados?.prazos||{};
  if(terms.inicio_efetivo&&!record.confirmacoes?.inicio)issues.push('O início efetivo exige confirmação de todos os requisitos contratuais.');
  if(!(Number(terms.meses_execucao)>0)||Number(terms.meses_tolerancia)<0)issues.push('Confira o prazo-base e a tolerância.');
  if(!(record.anexos||[]).some(a=>a.tipo==='para_assinatura'&&a.confirmado))issues.push('Vincule e confirme o documento externo para assinatura.');
  for(const index of [0,1,2,3,4])if(!(record.anexos||[]).some(a=>a.tipo===`anexo_${index+1}`&&a.confirmado))issues.push(`Vincule e confirme o Anexo ${index+1}.`);
  if(!record.confirmacoes?.documentoExterno)issues.push('O administrador precisa conferir externamente cláusulas, valores por extenso e anexos do documento para assinatura.');
  if(!record.externalReviewedById)issues.push('A conferência externa precisa ser registrada pelo administrador.');
  return [...new Set(issues)];
}
function normalizeInput(raw={}){
  const dados={obra:picked(raw.dados?.obra,WORK_FIELDS),prazos:picked(raw.dados?.prazos,TERM_FIELDS),comercial:{}};
  for(const [key,def] of Object.entries(model.suggestions)){
    const [group,field]=key.split('.');
    if(!dados[group])continue;
    const value=raw.dados?.[group]?.[field];
    dados[group][field]=typeof def==='number'?(value===''||value==null?'':Number(value)):str(value);
  }
  return {titulo:str(raw.titulo),obraId:str(raw.obraId),clienteId:str(raw.clienteId),propostaId:str(raw.propostaId),responsavelId:str(raw.responsavelId),dados,cgrManual:raw.cgrManual===true,
    partes:(Array.isArray(raw.partes)?raw.partes:[]).slice(0,10).map(p=>({...picked(p,PARTY_FIELDS),tipoPessoa:p.tipoPessoa==='PJ'?'PJ':'PF',confirmado:p.confirmado===true})),
    testemunhas:(Array.isArray(raw.testemunhas)?raw.testemunhas:[]).slice(0,2).map(p=>({nome:str(p.nome),documento:str(p.documento)})),
    localAssinatura:str(raw.localAssinatura),dataAssinatura:str(raw.dataAssinatura),
    confirmacoes:Object.fromEntries(['obra','comercial','declaracoes','inicio','documentoExterno'].map(key=>[key,raw.confirmacoes?.[key]===true]))};
}
function availableFiles(data,workId){
  return (data.workFileCabinets||[]).filter(c=>c.obraId===workId).flatMap(c=>(c.documents||[]).filter(d=>!d.deletedAt&&!d.trash).flatMap(d=>(d.revisions||[]).map(r=>({cabinet:c,document:d,revision:r}))));
}
export function applyContractRecordCommand(data,command,now){
  if(!RECORD_COMMAND_TYPES.has(command.type))return null;
  const p=command.payload||{},user={id:command.actorId,role:command.actorRole,active:true,obraId:command.actorObraId||''};
  const scope=contractCommandScope(data,command,user);if(!scope.ok)return scope;
  const records=data.commercialContractRecords||[];
  const current=records.find(row=>row.id===p.id);
  if(command.type===RECORD_COMMANDS.COMPANY){
    const old=data.commercialContractCompany||{version:0,history:[]};
    if(Number(command.expectedVersion)!==Number(old.version))return fail('O cadastro da contratada mudou. Atualize antes de salvar.');
    const company=picked(p.company,COMPANY_FIELDS);
    if(!company.razaoSocial||!validateBrazilianDocument(company.cnpj,'PJ'))return fail('Informe razão social e CNPJ válido da contratada.');
    return {ok:true,entityId:'contract-company',data:{...data,commercialContractCompany:{...company,version:old.version+1,history:[...(old.history||[]),{at:now,actorId:user.id,actorName:command.actorName,previous:old.version?picked(old,COMPANY_FIELDS):null}]}}};
  }
  if(!str(p.id)||Number(command.expectedVersion)!==Number(current?.version||0))return fail('O contrato mudou desde a abertura. Atualize e confira antes de salvar.');
  let next=current?deep(current):null;
  if(command.type===RECORD_COMMANDS.SAVE){
    if(!writable(current))return fail('Abra uma nova revisão antes de alterar um contrato aprovado ou assinado.');
    const input=normalizeInput(p.record);
    input.confirmacoes.documentoExterno=user.role==='admin'&&input.confirmacoes.documentoExterno;
    if(!input.titulo)return fail('Informe o título do contrato.');
    if(input.clienteId&&!(data.comercial?.clientes||[]).some(c=>c.id===input.clienteId))return fail('Cliente não encontrado no cadastro.');
    const work=(data.obras||[]).find(w=>w.id===input.obraId);
    if(user.obraId&&input.clienteId&&input.clienteId!==work?.clienteId)return fail('O cliente está fora do vínculo autorizado desta obra.');
    if(work?.clienteId&&input.clienteId&&work.clienteId!==input.clienteId)return fail('O cliente difere do cliente vinculado à obra.');
    if(input.propostaId){const proposal=(data.comercial?.propostas||[]).find(v=>v.id===input.propostaId);const client=(data.comercial?.clientes||[]).find(c=>c.id===input.clienteId);if(!proposal||!client||proposal.leadId!==client.leadId)return fail('A proposta não pertence ao cliente selecionado.');}
    if(!['',...((data.usuarios||[]).filter(u=>u.active!==false).map(u=>u.id))].includes(input.responsavelId))return fail('Responsável comercial não encontrado.');
    for(const [group,values] of Object.entries(input.dados))for(const [key,value] of Object.entries(values)){
      if(typeof value==='number'&&(!Number.isFinite(value)||value<0))return fail(`Valor inválido em ${group}: ${key}.`);
      if(group==='prazos'&&key.startsWith('inicio_')&&value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))))return fail('Data de início inválida.');
    }
    for(const [key,,type] of WORK_FIELDS)if(type==='number'&&input.dados.obra[key]!==''&&(!Number.isFinite(Number(input.dados.obra[key]))||Number(input.dados.obra[key])<0))return fail('Confira as áreas do imóvel e da obra.');
    const immutableLinkChanged=current&&(current.obraId!==input.obraId||current.clienteId!==input.clienteId);
    if(immutableLinkChanged&&(current.revisions?.length||current.anexos?.length))return fail('O vínculo de obra ou cliente possui documentos ou revisões preservadas. Duplique o contrato para outro vínculo.');
    const oldStatus=current?.status||'rascunho';
    next={...(current||{}),...input,id:p.id,status:'rascunho',number:current?.number||`CONT-${String(records.reduce((m,r)=>Math.max(m,Number(r.sequence||0)),0)+1).padStart(5,'0')}`,sequence:current?.sequence||records.reduce((m,r)=>Math.max(m,Number(r.sequence||0)),0)+1,
      revision:current?.revision||1,createdAt:current?.createdAt||now,createdById:current?.createdById||user.id,
      modelo:current?.modelo||{id:model.id,name:model.name,version:model.version,sourceSha256:model.sourceSha256},
      contratada:current?.contratada||picked(data.commercialContractCompany||{},COMPANY_FIELDS),companyVersion:current?.companyVersion||data.commercialContractCompany?.version||0,
      anexos:current?.anexos||[],revisions:current?.revisions||[],history:current?.history||[]};
    if(input.confirmacoes.documentoExterno)next.externalReviewedById=user.id;else delete next.externalReviewedById;
    if(oldStatus==='em_revisao')next.history.push({at:now,actorId:user.id,actorName:command.actorName,action:'Revisão devolvida a rascunho por alteração dos dados'});
    if(p.files){
      const available=availableFiles(data,next.obraId);
      next.anexos=[];
      for(const f of p.files){
        const found=available.find(a=>a.document.id===f.documentId&&a.revision.id===f.revisionId);
        if(!found||!['para_assinatura','via_assinada','anexo_1','anexo_2','anexo_3','anexo_4','anexo_5'].includes(f.tipo))return fail('Documento não encontrado nos Arquivos desta obra.');
        // A política de pasta é conferida também no servidor, antes do comando.
        next.anexos.push({tipo:f.tipo,documentId:f.documentId,revisionId:f.revisionId,name:found.document.name,label:found.revision.label,url:found.revision.url,createdAt:found.revision.createdAt,confirmado:f.confirmado===true});
      }
    }
  }else{
    if(!current)return fail('Contrato não encontrado.');
    if(command.type===RECORD_COMMANDS.LINK_WORK){
      const work=(data.obras||[]).find(w=>w.id===current.obraId);
      const applied=applyWorkSuggestionsToDraft({contract:current,work,user,selectedFields:p.fields,expectedWorkVersion:p.workVersion});
      if(!applied.ok)return fail(applied.error);next=applied.contract;next.status='rascunho';
    }else if(command.type===RECORD_COMMANDS.REVIEW){
      if(current.status!=='rascunho')return fail('Somente rascunhos podem ser enviados para revisão.');next.status='em_revisao';
    }else if(command.type===RECORD_COMMANDS.DECIDE){
      if(user.role!=='admin'||current.status!=='em_revisao')return fail('Somente o administrador pode decidir uma revisão pendente.');
      if(!p.approve){if(!str(p.reason))return fail('Informe o motivo da devolução.');next.status='rascunho';}
      else{const issues=contractReviewIssues(current);if(issues.length)return fail(issues.join(' '));next.status='aprovado';next.approvedAt=now;next.approvedById=user.id;}
    }else if(command.type===RECORD_COMMANDS.REVISE){
      if(writable(current)||['cancelado','encerrado'].includes(current.status))return fail('A nova revisão exige contrato aprovado ou assinado vigente.');
      if(!str(p.reason))return fail('Informe o motivo da nova revisão.');
      const {revisions,history,...snapshot}=current;
      next.revisions=[...(revisions||[]),deep(snapshot)];next.revision=current.revision+1;next.status='rascunho';next.confirmacoes={};delete next.approvedAt;delete next.approvedById;delete next.externalReviewedById;
      next.partes=next.partes.map(party=>({...party,confirmado:false}));next.dataAssinatura='';next.localAssinatura='';next.testemunhas=[{},{}];
      next.anexos=[];
    }else if(command.type===RECORD_COMMANDS.STATE){
      if(user.role!=='admin')return fail('Somente o administrador pode registrar esta situação.');
      const allowed={aprovado:['aguardando_assinatura','cancelado'],aguardando_assinatura:['assinado','cancelado'],assinado:['encerrado'],rascunho:['cancelado'],em_revisao:['cancelado']};
      if(!(allowed[current.status]||[]).includes(p.status))return fail('Transição de situação não permitida.');
      if(!str(p.reason))return fail('Informe o motivo ou evidência da mudança.');
      if(p.status==='assinado'){
        const found=availableFiles(data,current.obraId).find(a=>a.document.id===p.signed?.documentId&&a.revision.id===p.signed?.revisionId);
        if(!found||!p.confirmSigned)return fail('Selecione a via assinada nos Arquivos da obra e confirme sua conferência.');
        next.anexos=[...next.anexos,{tipo:'via_assinada',documentId:found.document.id,revisionId:found.revision.id,name:found.document.name,label:found.revision.label,url:found.revision.url,confirmado:true,at:now}];
      }
      next.status=p.status;
    }
  }
  next.version=Number(current?.version||0)+1;next.updatedAt=now;
  next.history=[...(next.history||[]),{at:now,actorId:user.id,actorName:command.actorName,action:command.type,from:current?.status||'',to:next.status,reason:str(p.reason),revision:next.revision}];
  return {ok:true,entityId:p.id,data:{...data,commercialContractRecords:current?records.map(r=>r.id===p.id?next:r):[...records,next]}};
}
