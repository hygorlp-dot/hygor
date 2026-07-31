export const BANK_TRANSACTION_COMMAND=Object.freeze({
  BANK_TRANSACTIONS_IMPORTED:"TRANSACOES_BANCARIAS_IMPORTADAS",
  BANK_TRANSACTIONS_IGNORED:"TRANSACOES_BANCARIAS_IGNORADAS",
  BANK_TRANSACTIONS_REOPENED:"TRANSACOES_BANCARIAS_REABERTAS",
});

export const BANK_TRANSACTION_COMMAND_TYPES=new Set(
  Object.values(BANK_TRANSACTION_COMMAND),
);

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const transactions=data=>Array.isArray(data?.transacoes)?data.transacoes:[];
const statements=data=>Array.isArray(data?.extratos)?data.extratos:[];
const history=data=>Array.isArray(data?.historicoConc)?data.historicoConc:[];
const actorOf=command=>({
  id:String(command?.actorId||""),
  name:String(command?.actorName||"").trim()||"Usuário autenticado",
});
const targetList=payload=>Array.isArray(payload?.targets)?payload.targets:[];
const transactionById=(data,id)=>transactions(data)
  .find(item=>String(item.id)===String(id));
const safeText=(value,max)=>String(value||"").trim().slice(0,max);

const historyEvent=({
  id,transaction=null,statement=null,action,previousStatus="",nextStatus="",
  details="",actor,now,batchId="",
})=>({
  id,
  transacaoId:transaction?.id||"",
  extratoId:transaction?.extratoId||statement?.id||"",
  acao:action,
  statusAnterior:previousStatus,
  statusNovo:nextStatus,
  descricao:transaction?.descricao||statement?.arquivo||"",
  valor:Number(transaction?.valor||0),
  detalhes:details,
  operadorId:actor.id,
  operador:actor.name,
  criadoEm:now,
  loteId:batchId,
});

const validateTargets=(data,payload,expectedStatus)=>{
  const targets=targetList(payload);
  if(!targets.length||targets.length>5000){
    return {error:"Selecione entre 1 e 5.000 transações."};
  }
  const ids=new Set();
  const resolved=[];
  for(const target of targets){
    const id=String(target?.id||"");
    if(!id||ids.has(id))return {error:"A seleção de transações contém identificadores inválidos ou repetidos."};
    ids.add(id);
    const current=transactionById(data,id);
    if(!current)return {error:"Uma das transações selecionadas não existe mais."};
    if(String(current.status||"pendente")!==expectedStatus){
      return {error:`A transação "${safeText(current.descricao,80)}" já mudou de situação. Atualize a tela.`};
    }
    if(target?.expectedVersion==null||versionOf(current)!==Number(target.expectedVersion)){
      return {error:`A transação "${safeText(current.descricao,80)}" foi alterada por outra pessoa. Atualize a tela.`};
    }
    resolved.push(current);
  }
  return {targets:resolved,ids};
};

const applyImport=(data,command,now,actor)=>{
  const payload=command.payload||{};
  const rawStatement=payload.statement||{};
  const rawTransactions=Array.isArray(payload.transactions)?payload.transactions:[];
  if(!rawStatement.id||!safeText(rawStatement.arquivo,260)){
    return fail("O extrato bancário não possui identificação ou nome de arquivo.");
  }
  if(!rawTransactions.length||rawTransactions.length>5000){
    return fail("O extrato precisa conter entre 1 e 5.000 transações válidas.");
  }
  const statementId=String(rawStatement.id);
  const existingStatement=statements(data)
    .find(item=>String(item.id)===statementId);
  if(existingStatement){
    if(String(existingStatement.hashArquivo||"")===String(rawStatement.hashArquivo||"")){
      return {
        ok:true,data,entityId:statementId,
        summary:{imported:0,duplicates:rawTransactions.length},
      };
    }
    return fail("Já existe outro extrato com esta identificação.");
  }

  const existingIds=new Map(transactions(data).map(item=>[String(item.id),item]));
  const knownKeys=new Set(transactions(data).map(item=>String(item.chave||"")).filter(Boolean));
  const incomingIds=new Set(),incomingKeys=new Set();
  const imported=[];
  let duplicates=0;

  for(const raw of rawTransactions){
    const id=String(raw?.id||"");
    const key=safeText(raw?.chave,500);
    const value=Number(raw?.valor);
    const date=String(raw?.data||"");
    const description=safeText(raw?.descricao,1000);
    if(!id||incomingIds.has(id))return fail("O arquivo contém transações sem identificação única.");
    incomingIds.add(id);
    if(existingIds.has(id)){
      const existing=existingIds.get(id);
      if(key&&String(existing.chave||"")===key){duplicates+=1;continue;}
      return fail("Uma transação do arquivo conflita com um identificador já cadastrado.");
    }
    if(!key)return fail("Uma transação do arquivo não possui chave de deduplicação.");
    if(knownKeys.has(key)||incomingKeys.has(key)){duplicates+=1;continue;}
    if(!validDate(date)||!Number.isFinite(value)||value===0||!description){
      return fail("O arquivo contém data, descrição ou valor bancário inválido.");
    }
    incomingKeys.add(key);
    imported.push({
      ...raw,id,extratoId:statementId,data:date,descricao:description,
      descricaoOriginal:safeText(raw.descricaoOriginal||description,1000),
      valor:value,chave:key,status:"pendente",rateios:[],gerados:[],
      vinculo:null,obs:"",ignoradoMotivo:"",
      direcao:value>0?"entrada":"saida",
      version:1,createdAt:now,createdById:actor.id,createdBy:actor.name,
      updatedAt:now,updatedById:actor.id,updatedBy:actor.name,
    });
  }

  if(!imported.length){
    return {
      ok:true,data,entityId:statementId,
      summary:{imported:0,duplicates},
    };
  }

  const dates=imported.map(item=>item.data).sort();
  const statement={
    ...rawStatement,id:statementId,
    arquivo:safeText(rawStatement.arquivo,260),
    banco:safeText(rawStatement.banco,160),
    conta:safeText(rawStatement.conta,160),
    hashArquivo:safeText(rawStatement.hashArquivo,500),
    dataInicio:dates[0],dataFim:dates.at(-1),
    qtd:imported.length,qtdDuplicadas:duplicates,status:"ativo",
    importadoEm:now,importadoPorId:actor.id,importadoPor:actor.name,
    version:1,updatedAt:now,updatedById:actor.id,updatedBy:actor.name,
  };
  const total=imported.reduce((sum,item)=>sum+Math.abs(item.valor),0);
  const event=historyEvent({
    id:`hist_${command.idempotencyKey}`,
    statement,action:"extrato_importado",nextStatus:"pendente",actor,now,
    details:`${imported.length} nova(s) transação(ões); ${duplicates} repetida(s) descartada(s).`,
  });
  event.valor=total;
  return {
    ok:true,entityId:statementId,summary:{imported:imported.length,duplicates},
    data:{
      ...data,
      extratos:[...statements(data),statement],
      transacoes:[...transactions(data),...imported],
      historicoConc:[...history(data),event],
    },
  };
};

const applyStatusChange=(data,command,now,actor,{from,to,action})=>{
  const payload=command.payload||{};
  const reason=to==="ignorado"?safeText(payload.reason,500):"";
  if(to==="ignorado"&&reason.length<3)return fail("Informe o motivo para ignorar as transações.");
  const selection=validateTargets(data,payload,from);
  if(selection.error)return fail(selection.error);
  const batchId=`lote_${command.idempotencyKey}`;
  const changed=new Map();
  const events=[];
  for(const current of selection.targets){
    const previousReason=safeText(current.ignoradoMotivo,500);
    const updated={
      ...current,status:to,ignoradoMotivo:to==="ignorado"?reason:"",
      statusAtualizadoEm:now,statusAtualizadoPorId:actor.id,
      statusAtualizadoPor:actor.name,updatedAt:now,updatedById:actor.id,
      updatedBy:actor.name,version:versionOf(current)+1,
    };
    changed.set(String(current.id),updated);
    events.push(historyEvent({
      id:`hist_${command.idempotencyKey}_${current.id}`,
      transaction:current,action,previousStatus:from,nextStatus:to,
      details:to==="ignorado"?reason:(previousReason?`Motivo anterior: ${previousReason}`:""),
      actor,now,batchId,
    }));
  }
  return {
    ok:true,entityId:batchId,summary:{changed:changed.size},
    data:{
      ...data,
      transacoes:transactions(data).map(item=>changed.get(String(item.id))||item),
      historicoConc:[...history(data),...events],
    },
  };
};

export const applyBankTransactionCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!BANK_TRANSACTION_COMMAND_TYPES.has(command.type))return null;
  const actor=actorOf(command);
  if(!actor.id)return fail("Sessão do usuário indisponível para alterar transações bancárias.");
  if(command.type===BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED){
    return applyImport(data,command,now,actor);
  }
  if(command.type===BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IGNORED){
    return applyStatusChange(data,command,now,actor,{
      from:"pendente",to:"ignorado",
      action:targetList(command.payload).length>1?"ignorada_em_lote":"ignorada",
    });
  }
  return applyStatusChange(data,command,now,actor,{
    from:"ignorado",to:"pendente",
    action:targetList(command.payload).length>1?"reaberta_em_lote":"reaberta",
  });
};
