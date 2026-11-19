import { activeCashAllocations, reconciliationHold } from "./cash-allocations.js";
import {BANK_IMPORT_REVERSED,applyBankReversal,bankImportStamp,validBankOriginal} from './import-reversal.js';
import {isDateInClosedPeriod} from '../financeiro/workflows.js';
import {active} from '../financeiro/facts.js';

export const BANK_TRANSACTION_COMMAND=Object.freeze({
  BANK_IMPORT_REVERSED,
  BANK_STATEMENT_ACCOUNT_LINKED:"EXTRATO_BANCARIO_VINCULADO",
  BANK_TRANSACTIONS_IMPORTED:"TRANSACOES_BANCARIAS_IMPORTADAS",
  BANK_TRANSACTIONS_IGNORED:"TRANSACOES_BANCARIAS_IGNORADAS",
  BANK_TRANSACTIONS_REOPENED:"TRANSACOES_BANCARIAS_REABERTAS",
});

export const BANK_TRANSACTION_COMMAND_TYPES=new Set(
  Object.values(BANK_TRANSACTION_COMMAND),
);

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return false;
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
};
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

const accountNumber=value=>String(value||"").trim().replace(/[.\s-]/g,"");
const bankName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export const matchesStatementAccount=(statement,account,{allowInactive=false}={})=>{
  const number=accountNumber(statement?.conta);
  const bank=bankName(statement?.banco);
  return Boolean(number&&bank&&account?.tipo!=="caixa"&&(allowInactive||account?.ativa!==false)&&active(account)
    &&number===accountNumber(account?.conta)&&bank===bankName(account?.banco));
};

export function planStatementAccountLink(data,statementId,accountId){
  const statement=statements(data).find(row=>String(row.id)===String(statementId));
  const account=(data.contasBancarias||[]).find(row=>String(row.id)===String(accountId));
  if(!statement||!active(statement)||statement.status==="arquivado"||statement.importReversals?.length||
    statement.contaBancariaId||!/\.(ofx|qfx)$/i.test(statement.arquivo||""))return fail("Selecione um OFX ativo ainda sem conta.");
  if(!account||!matchesStatementAccount(statement,account))return fail("O banco e o número da conta cadastrada precisam corresponder aos dados do extrato.");
  const rows=transactions(data).filter(row=>String(row.extratoId)===String(statementId));
  const ids=new Set(rows.map(row=>String(row.id)));
  const manifest=statement.importManifest?.ids;
  if(!rows.length||rows.some(row=>!row.id||!row.chave||!validDate(row.data)||!active(row)||row.contaBancariaId||row.importReversal
    ||!Number.isFinite(Number(row.valor))||Number(row.valor)===0)
    ||ids.size!==rows.length||Number(statement.qtd)!==rows.length
    ||transactions(data).some(row=>String(row.extratoId)!==String(statementId)&&ids.has(String(row.id)))
    ||(manifest&&(!Array.isArray(manifest)||manifest.length!==ids.size||new Set(manifest.map(String)).size!==ids.size||manifest.some(id=>!ids.has(String(id)))))){
    return fail("O lote contém movimentos ausentes, já vinculados ou revertidos. Confira a importação.");
  }
  if(rows.some(row=>reconciliationHold(row)||isDateInClosedPeriod(data,row.data)||(data.fechamentosBancarios||[]).some(close=>close.status==="fechado"&&String(close.contaBancariaId)===String(accountId)&&close.dataInicio<=row.data&&row.data<=close.dataFim))){
    return fail("Há movimentos protegidos por uma revisão ou por um período fechado.");
  }
  const identities=new Set();
  for(const row of [...rows,...transactions(data).filter(item=>String(item.contaBancariaId)===String(accountId)&&active(item)&&!item.importReversal)]){
    const key=row.fitid?`fit:${row.fitid}`:row.chave;
    if(key&&identities.has(key))return fail("Identidade bancária repetida no lote ou na conta. Confira os extratos sobrepostos.");
    if(key)identities.add(key);
  }
  return {ok:true,statement,account,rows};
}

function applyStatementAccountLink(data,command,now,actor){
  const payload=command.payload||{};
  const plan=planStatementAccountLink(data,payload.statementId,payload.accountId);
  if(!plan.ok)return plan;
  const {statement,account,rows}=plan;
  if(payload.expectedVersion!==versionOf(statement)||payload.expectedCount!==rows.length){
    return fail("O extrato mudou durante a conferência. Atualize a tela e confira o lote.");
  }
  const ids=new Set(rows.map(row=>row.id));
  const fields={contaBancariaId:account.id,updatedAt:now,updatedById:actor.id,updatedBy:actor.name};
  const event=historyEvent({id:`hist_${command.idempotencyKey}`,statement,action:"extrato_vinculado_conta",
    details:`${account.nome} · ${rows.length} movimentos preservados`,actor,now});
  return {ok:true,entityId:statement.id,summary:{linked:rows.length},data:{
    ...data,
    extratos:statements(data).map(row=>row===statement?{...row,...fields,version:versionOf(row)+1}:row),
    transacoes:transactions(data).map(row=>ids.has(row.id)&&String(row.extratoId)===String(statement.id)?{...row,...fields,version:versionOf(row)+1}:row),
    historicoConc:[...history(data),event],
  }};
}

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
    if(reconciliationHold(current))return {error:reconciliationHold(current)};
    if(activeCashAllocations(data).some(link=>link.transactionId===id))return {error:"Desfaça os vínculos parciais no DRE antes de alterar a situação bancária."};
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

export const prepareBankImport=(data,payload={})=>{
  const rawStatement=payload.statement||{};
  const rawTransactions=Array.isArray(payload.transactions)?payload.transactions:[];
  if(rawStatement.originalFile&&!validBankOriginal(rawStatement.originalFile))return fail('Original bancário inválido ou maior que 2 MB.');
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
        ok:true,statementId,imported:[],duplicates:rawTransactions.length,
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
      valor:value,chave:key,
    });
  }
  return {ok:true,statementId,imported,duplicates};
};

export const applyBankImport=(data,command,now=new Date().toISOString(),actor=actorOf(command))=>{
  const prepared=prepareBankImport(data,command.payload||{});
  if(!prepared.ok)return prepared;
  const {statementId,duplicates}=prepared,rawStatement=command.payload.statement;
  const imported=prepared.imported.map(raw=>({...raw,status:'pendente',rateios:[],gerados:[],importReversal:'',vinculo:null,obs:'',ignoradoMotivo:'',direcao:raw.valor>0?'entrada':'saida',
    version:1,createdAt:now,createdById:actor.id,createdBy:actor.name,updatedAt:now,updatedById:actor.id,updatedBy:actor.name}));

  if(!imported.length){
    return {
      ok:true,data,entityId:statementId,
      summary:{imported:0,duplicates},
    };
  }

  for(const transaction of imported)transaction.importStamp=bankImportStamp(transaction);

  const dates=imported.map(item=>item.data).sort();
  const statement={
    ...rawStatement,id:statementId,
    arquivo:safeText(rawStatement.arquivo,260),
    banco:safeText(rawStatement.banco,160),
    conta:safeText(rawStatement.conta,160),
    hashArquivo:safeText(rawStatement.hashArquivo,500),
    dataInicio:dates[0],dataFim:dates.at(-1),
    qtd:imported.length,qtdDuplicadas:duplicates,status:"ativo",
    importManifest:{ids:imported.map(t=>String(t.id))},importReversals:[],
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
  if(command.type===BANK_IMPORT_REVERSED)return applyBankReversal(data,command,now);
  if(command.type===BANK_TRANSACTION_COMMAND.BANK_STATEMENT_ACCOUNT_LINKED){
    if(command.actorRole!=="admin"||command.actorObraId)return fail("Vincular extratos exige administrador sem restrição de obra.");
    return applyStatementAccountLink(data,command,now,actor);
  }
  if(command.type===BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED){
    return applyBankImport(data,command,now,actor);
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
