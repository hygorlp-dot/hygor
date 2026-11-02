import {createHash} from 'node:crypto';

export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=value=>String(value??'').trim();
const normalize=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
const countBy=(items,key)=>Object.fromEntries([...new Set(items.map(key))].sort().map(value=>[value,items.filter(item=>key(item)===value).length]));
const duplicateGroups=(rows,key)=>{
 const groups=new Map();for(const row of rows){const value=key(row);if(value)groups.set(value,[...(groups.get(value)||[]),row]);}
 return [...groups.entries()].filter(([,members])=>members.length>1).map(([signature,members])=>({signature,members:members.map(({transaction:t})=>({id:t.id,statementId:t.extratoId,date:t.data,amount:t.valor,status:t.status,fitid:t.fitid||null,importKey:t.chave||null,description:t.descricaoOriginal||t.descricao||''})),crossStatement:new Set(members.map(row=>row.transaction.extratoId)).size>1}));
};

// A review artifact, never an application command or an import payload.
// Counterparty banking fields cannot identify the account that owns a statement.
export function prepareBankAccountProposal(data,{updatedAt=null}={}){
 const statements=data.extratos||[],transactions=data.transacoes||[],accounts=data.contasBancarias||[];
 const candidates=new Map(),unidentified=[];
 for(const statement of statements){
  const bank=text(statement.banco),account=text(statement.conta);
  if(!bank||!account){unidentified.push({statementId:statement.id,reason:'Banco ou conta de origem não preservados na importação.'});continue;}
  const key=JSON.stringify([normalize(bank),account]);
  if(!candidates.has(key))candidates.set(key,{key,bank,account,statements:[]});
  candidates.get(key).statements.push(statement);
 }
 const accountProposals=[...candidates.values()].map(candidate=>{
  const branches=[...new Set(candidate.statements.map(s=>text(s.agencia)).filter(Boolean))];
  const matches=accounts.filter(a=>normalize(a.banco)===normalize(candidate.bank)&&text(a.conta)===candidate.account&&(!a.agencia||!branches.length||branches.includes(text(a.agencia))));
  const ambiguity=branches.length>1||matches.length>1;
  const proposedId=matches.length===1&&!ambiguity?String(matches[0].id):`proposta_conta_${fingerprint(candidate.key).slice(0,12)}`;
  return {proposedId,action:matches.length===1&&!ambiguity?'revisar_vinculo_ao_cadastro_existente':'revisar_novo_cadastro',approval:'pendente',ambiguous:ambiguity,
   draft:{nome:`${candidate.bank} · final ${candidate.account.slice(-4)}`,banco:candidate.bank,conta:candidate.account,agencia:branches.length===1?branches[0]:null,tipo:null,titular:null,documentoTitular:null,pixKey:null,saldoInicial:null,dataReferenciaSaldo:null,ativa:null},
   evidence:candidate.statements.map(s=>({statementId:s.id,filename:s.arquivo,status:s.status,bank:s.banco,account:s.conta,branch:s.agencia||null,startDate:s.dataInicio,endDate:s.dataFim,recordHash:fingerprint(s),source:'Metadados preservados na importação; original OFX não reinspecionado'})),
   requiresReview:['titularidade da conta','agência','tipo da conta','situação ativa/inativa','saldo de abertura e respectiva data',...(ambiguity?['identificação ambígua entre agências ou cadastros']:[])]};
 });
 const statementTargets=new Map(accountProposals.flatMap(account=>account.evidence.map(e=>[String(e.statementId),account])));
 const statementLinks=statements.filter(s=>statementTargets.has(String(s.id))).map(s=>{
  const target=statementTargets.get(String(s.id)),current=text(s.contaBancariaId);
  return {id:s.id,proposedAccountId:target.proposedId,currentAccountId:current,approval:'pendente',statementStatus:s.status,expectedRecordHash:fingerprint(s),conflict:target.ambiguous||Boolean(current&&current!==target.proposedId)};
 });
 const transactionLinks=transactions.filter(t=>statementTargets.has(String(t.extratoId))).map(t=>{
  const target=statementTargets.get(String(t.extratoId)),current=text(t.contaBancariaId);
  return {id:t.id,statementId:t.extratoId,proposedAccountId:target.proposedId,currentAccountId:current,date:t.data,status:t.status,approval:'pendente',expectedRecordHash:fingerprint(t),conflict:target.ambiguous||Boolean(current&&current!==target.proposedId)};
 });
 const identified=transactions.filter(t=>statementTargets.has(String(t.extratoId))).map(transaction=>({transaction,accountId:statementTargets.get(String(transaction.extratoId)).proposedId}));
 const repeatedFitid=duplicateGroups(identified,({transaction:t,accountId})=>t.fitid?JSON.stringify([accountId,t.fitid]):'');
 const repeatedImportKey=duplicateGroups(identified,({transaction:t,accountId})=>t.chave?JSON.stringify([accountId,t.chave]):'');
 const repeatedContent=duplicateGroups(identified,({transaction:t,accountId})=>JSON.stringify([accountId,t.data,Math.round(Number(t.valor)*100),normalize(t.descricaoOriginal||t.descricao)]));
 const dates=transactions.map(t=>t.data).filter(Boolean).sort();
 return {format:'marcell-bank-account-proposal/v1',mode:'review-only',approved:false,executable:false,
  base:{updatedAt,bankSectionsHash:fingerprint({contasBancarias:accounts,extratos:statements,transacoes:transactions})},
  counts:{existingAccounts:accounts.length,proposedAccounts:accountProposals.length,statements:statements.length,transactions:transactions.length,statementLinks:statementLinks.length,transactionLinks:transactionLinks.length,transactionStatuses:countBy(transactions,t=>t.status||'pendente'),firstMovement:dates[0]||null,lastMovement:dates.at(-1)||null},
  accounts:accountProposals,links:{statements:statementLinks,transactions:transactionLinks},
  unidentifiedStatements:unidentified,transactionsWithoutIdentifiedStatement:transactions.filter(t=>!statementTargets.has(String(t.extratoId))).map(t=>t.id),
  duplicateReview:{repeatedFitid,repeatedImportKey,repeatedContent,warning:'Data, valor e descrição iguais são apenas alerta; FITIDs diferentes podem identificar operações legítimas distintas. Não excluir nem conciliar automaticamente.'},
  safeguards:['Não executar este arquivo como comando de gravação.','Revalidar hashes dos registros e vínculos atuais antes de qualquer futura aplicação.','Alterar somente contaBancariaId nos vínculos aprovados; preservar valores, datas, situações, conciliações, rateios e anexos.','Manter extratos arquivados arquivados e ignorados ignorados.','Não inferir conta de origem a partir de dados bancários da contraparte.','Não preencher abertura com zero por ausência de informação.','Não preencher conta prevista de títulos com base em pagamentos históricos.']};
}
