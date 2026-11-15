// Comparação local e pura. Não altera a obra nem o instrumento contratual.
// Valor cadastrado, CGR e teto têm significados diferentes.
const present=value=>value!==undefined&&value!==null&&value!=='';
const number=value=>present(value)&&Number.isFinite(Number(value))?Number(value):null;
const copy=value=>JSON.parse(JSON.stringify(value));
const blocked=error=>({ok:false,error});

export const CONTRACT_WORK_FIELDS=Object.freeze([
  {key:'area_construida',group:'obra',workKey:'areaM2',label:'Área construída',numeric:true},
  {key:'endereco',group:'obra',workKey:'address',label:'Endereço da obra'},
  {key:'responsavel_tecnico_id',group:'obra',workKey:'engineerId',label:'Responsável técnico'},
  {key:'taxa_administracao',group:'comercial',workKey:'adminPercentage',label:'Taxa de administração',numeric:true},
]);

export function reviewContractWorkLink({contract={},work,user={}}={}){
  if(!user.id||user.active===false||!['admin','comercial'].includes(user.role))return blocked('Seu perfil não pode consultar este vínculo contratual.');
  if(!work?.id||String(contract.obraId||'')!==String(work.id))return blocked('Selecione a obra vinculada ao contrato.');
  if(user.obraId&&String(user.obraId)!==String(work.id))return blocked('A obra está fora do acesso do usuário.');
  // A ausência de obra no contrato não é autorização para cruzar por nome.
  // O cliente é relacionado por identidade; homônimos não estabelecem vínculo.
  if(contract.clienteId&&work.clienteId&&String(contract.clienteId)!==String(work.clienteId))return blocked('O cliente do contrato difere do cliente vinculado à obra. Revise o vínculo antes de aproveitar dados.');
  const comparisons=CONTRACT_WORK_FIELDS.map(field=>{
    const original=contract.dados?.[field.group]?.[field.key];
    const source=work[field.workKey];
    const currentValue=field.numeric?number(original):(present(original)?String(original):null);
    const workValue=field.numeric?number(source):(present(source)?String(source):null);
    const invalid=field.numeric&&((present(original)&&currentValue===null)||(present(source)&&workValue===null)||currentValue<0||workValue<0||(field.key==='taxa_administracao'&&(currentValue>100||workValue>100)));
    return {...field,contractValue:currentValue,workValue,status:invalid?'invalido':workValue===null?'ausente_na_obra':currentValue===null?'disponivel':currentValue===workValue?'coincidente':'divergente'};
  });
  const clientId=work.clienteId||'';
  const contractValue=number(work.contractValue);
  return {ok:true,obraId:String(work.id),workVersion:Number(work.version||0),clientId,
    comparisons,
    reference:{name:work.name||'',clientId,clientName:work.cliente||'',contractType:work.contractType||'',registeredContractValue:contractValue,plannedStart:work.contractStart||work.startDate||'',registeredEnd:work.contractEnd||''},
    notices:[
      'O valor cadastrado na obra não define automaticamente o CGR nem o teto da remuneração.',
      'O início cadastrado é uma referência. O início efetivo depende dos requisitos contratuais.',
      'A conclusão cadastrada na obra não confirma uma data definitiva no contrato.',
      ...(comparisons.some(item=>item.status==='divergente')?['Existem divergências. Escolha explicitamente quais dados aproveitar.']:[]),
    ]};
}

export function applyWorkSuggestionsToDraft({contract={},work,user={},selectedFields=[],expectedWorkVersion}={}){
  if(!['rascunho','em_revisao'].includes(contract.status))return blocked('A cópia aprovada ou assinada não pode ser atualizada pelo cadastro da obra. Abra uma nova revisão.');
  const review=reviewContractWorkLink({contract,work,user});
  if(!review.ok)return review;
  if(!Number.isInteger(expectedWorkVersion)||expectedWorkVersion!==review.workVersion)return blocked('A obra mudou desde a conferência. Compare os dados novamente.');
  const selected=new Set(selectedFields);
  if(!selected.size)return blocked('Selecione os dados da obra que deseja aproveitar.');
  const rows=review.comparisons.filter(row=>selected.has(row.key));
  if(rows.length!==selected.size||rows.some(row=>['ausente_na_obra','invalido'].includes(row.status)))return blocked('A seleção contém um campo indisponível ou inválido.');
  const next=copy(contract);
  next.dados=next.dados||{};
  for(const row of rows){
    next.dados[row.group]=next.dados[row.group]||{};
    next.dados[row.group][row.key]=row.workValue;
  }
  next.obraReferencia={...review.reference,obraId:review.obraId,version:review.workVersion};
  // Qualquer aproveitamento exige nova conferência das condições afetadas.
  next.confirmacoes={...(next.confirmacoes||{}),obra:false,comercial:false};
  return {ok:true,contract:next,changedFields:rows.map(row=>row.key)};
}
