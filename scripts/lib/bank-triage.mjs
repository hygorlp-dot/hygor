import {createHash} from 'node:crypto';
import {buildFinancialLedger,toCents} from '../../src/domains/financeiro/ledger.js';
import {canonicalDreEvents} from '../../server/financial-dre-integration.js';
import {criarFilaAutomatica,REGRA_AUTOMATICA} from '../../src/domains/conciliacao/automation.js';
import {reconciliationHold} from '../../src/domains/conciliacao/cash-allocations.js';
import {reviewDocumentContext} from '../../src/features/conciliacao/review-documents.js';

export const triageFingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const countBy=(rows,key)=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,rows.filter(row=>key(row)===k).length]));
// Financial records that can be inspected manually are broader than the
// existing automatic-payment whitelist. Cash entries remain hypotheses.
const financialTypes=new Set(['nota','pedido','medicaoTerc','tituloFolha','medicao','entradaContrato','pagamentoNota','pagamentoPedido','caixaObra','outrasDesp','despesasEmpresa','payments']);
const nextAction=code=>({
 archived:'Conferir o extrato arquivado e seu motivo; não reabrir, ignorar ou reimportar automaticamente.',
 hold:'Manter a trava documental; comprovar a composição antes de qualquer vínculo.',
 identity_conflict:'Conferir CPF/CNPJ ou chave Pix e separar os cadastros; nome não decide o vínculo.',
 no_safe_target:'Obter comprovante e identificar natureza, contraparte e documento de origem.',
 person_without_title:'Identificar o título/folha/medição existente e seu saldo; pessoa conhecida não prova a obrigação.',
 candidate_review:'Comparar documentos e alternativas, inclusive valores parciais, datas e pagamentos já registrados.',
 eligible_review:'Revalidar a evidência exata e a situação na origem; esta ferramenta não executa conciliação.',
 inconsistent_status:'Conferir a situação conciliada sem efeito de caixa e sua auditoria, sem criar outro pagamento.',
})[code];

// A complete inventory, not a reconciliation command generator. Ranking,
// names and amounts help order review; they never establish a new link.
export function triageBankTransactions(data,{tables={},previousReviewIds=[]}={}){
 const fingerprint=triageFingerprint(data);
 const canonical=canonicalDreEvents({titles:tables.financial_titles||[],settlements:tables.settlements||[],banks:tables.bank_transactions||[]});
 const ledger=buildFinancialLedger(data,{supplementalEvents:canonical.events});
 const issues=ledger.issues.filter(issue=>issue.code==='UNCLASSIFIED_BANK_TRANSACTION');
 const ids=new Set(issues.map(issue=>String(issue.sourceId)));
 const transactions=data.transacoes||[],statements=data.extratos||[];
 if(new Set(transactions.map(t=>String(t.id))).size!==transactions.length)throw new Error('Identificação de movimento repetida; conferir origem antes da triagem.');
 const analyses=criarFilaAutomatica(data),byId=new Map(analyses.map(row=>[String(row.tr.id),row]));
 const previous=new Set(previousReviewIds.map(String)),cases=[];
 const fitids=new Map();
 const scopeOf=t=>{
  const statementsForId=statements.filter(s=>String(s.id)===String(t.extratoId));
  const s=statementsForId.length===1?statementsForId[0]:null;
  const signature=t.contaBancariaId?['registered',String(t.contaBancariaId)]:s?.banco&&s?.conta?['import_metadata',s.banco,s.conta,s.agencia||'']:null;
  return {statement:s,scope:signature?triageFingerprint(signature):null,kind:signature?.[0]||'unknown'};
 };
 for(const t of transactions){
  const {scope}=scopeOf(t);if(!scope||!t.fitid)continue;
  const key=JSON.stringify([scope,t.fitid]);if(!fitids.has(key))fitids.set(key,[]);fitids.get(key).push(t);
 }
 for(const t of transactions.filter(t=>ids.has(String(t.id)))){
  const amountCents=toCents(t.valor);if(!Number.isSafeInteger(amountCents))throw new Error('Valor bancário inválido; conferir a origem.');
  const {statement,scope,kind}=scopeOf(t),row=byId.get(String(t.id)),analysis=row?.analise,candidate=analysis?.melhorCandidata;
  const archived=statement?.status==='arquivado',hold=reconciliationHold(t);
  const code=archived?'archived':hold?'hold':t.status==='conciliado'?'inconsistent_status':analysis?.identidadeProvavel?.conflito?'identity_conflict':!candidate||!financialTypes.has(candidate.tipo)?row?.identificada?'person_without_title':'no_safe_target':row?.automatica?'eligible_review':'candidate_review';
  const evidence=candidate?.evidenciaAutomatica||{};
  const native=(tables.bank_transactions||[]).filter(bank=>String(bank.metadata?.legacyId||'')===String(t.id));
  const docs=candidate?reviewDocumentContext(data,t,{candidate}).documents:[];
  const sameFitid=scope&&t.fitid?fitids.get(JSON.stringify([scope,t.fitid]))||[]:[];
  const document=String(t.contraparteDocumento||t.cpfCnpj||'').replace(/\D/g,'');
  const genericReference=Boolean(t.txid&&t.metadadosImportacao?.refnum&&String(t.txid)===String(t.metadadosImportacao.refnum));
  cases.push({id:String(t.id),statementId:String(t.extratoId||''),statementStatus:statement?.status||'missing',transactionStatus:t.status||'',date:t.data||'',amountCents,direction:amountCents>0?'in':'out',description:t.descricaoOriginal||t.descricao||'',sourceFingerprint:triageFingerprint(t),classification:code,priority:hold?'P0':archived||sameFitid.length>1?'P1':candidate&&financialTypes.has(candidate.tipo)?'P1':'P2',reason:archived?'Movimento pendente em extrato arquivado.':row?.motivo||'Conferir situação e origem.',hold,
   account:{registeredId:t.contaBancariaId||'',scopeFingerprint:scope,scopeSource:kind},
   provenance:{fitid:t.fitid||'',endToEndId:t.endToEndId||'',txid:t.txid||'',refnum:t.metadadosImportacao?.refnum||'',genericRefnumInTxid:genericReference,originalOfxAvailable:Boolean(statement?.originalFile)},
   identity:{nameHint:Boolean(row?.identificada),conflict:Boolean(analysis?.identidadeProvavel?.conflito),bankDocumentPresent:[11,14].includes(document.length),pixKeyPresent:Boolean(t.chavePix||t.pixKey),confirmedByExactDocumentOrPix:Boolean(analysis?.identidadeProvavel?.evidencias?.some(e=>['CPF/CNPJ cadastrado','chave PIX cadastrada'].includes(e)))},
   hypothesis:candidate?{type:candidate.tipo,id:String(candidate.entidadeId),paymentId:candidate.pagamentoId||'',workId:candidate.obraId||'',financialTarget:financialTypes.has(candidate.tipo),exactAmount:evidence.valorExato===true,exactIdentity:evidence.identidadeExata===true,exactReference:evidence.referenciaExata===true,blocks:candidate.bloqueios||[],warnings:candidate.alertas||[],alternatives:analysis.alternativas?.length||0,confirmed:false}:null,
   documents:{bank:(t.documentos||[]).length+(t.comprovantes||[]).length,target:docs.length},
   duplicates:{sameFitidIds:sameFitid.filter(other=>String(other.id)!==String(t.id)).map(other=>String(other.id)),proofOfBusinessDuplicate:false},
   nativeBank:{count:native.length,amountMatches:native.length===1?Math.abs(toCents(native[0].amount))===Math.abs(amountCents):null,directionMatches:native.length===1&&['in','out'].includes(native[0].direction)?native[0].direction===(amountCents>0?'in':'out'):null},previouslyReviewed:previous.has(String(t.id)),automationEligible:row?.automatica===true,executable:false,nextAction:hold?nextAction('hold'):nextAction(code)});
 }
 if(cases.length!==ids.size)throw new Error('Há aviso bancário sem registro de origem recuperável.');
 if(triageFingerprint(data)!==fingerprint)throw new Error('A triagem alterou os dados.');
 const totals=rows=>({count:rows.length,inCents:rows.filter(r=>r.direction==='in').reduce((s,r)=>s+r.amountCents,0),outCents:rows.filter(r=>r.direction==='out').reduce((s,r)=>s-r.amountCents,0)});
 const summary={rule:REGRA_AUTOMATICA,totalTransactions:transactions.length,unclassified:cases.length,scope:countBy(cases,c=>c.statementStatus),classifications:countBy(cases,c=>c.classification),priorities:countBy(cases,c=>c.priority),totals:totals(cases),byStatement:Object.entries(countBy(cases,c=>c.statementId)).map(([id])=>({id,...totals(cases.filter(c=>c.statementId===id))})),automationEligible:cases.filter(c=>c.automationEligible).length,withCandidate:cases.filter(c=>c.hypothesis).length,withFinancialCandidate:cases.filter(c=>c.hypothesis?.financialTarget).length,nameHints:cases.filter(c=>c.identity.nameHint).length,exactIdentity:cases.filter(c=>c.identity.confirmedByExactDocumentOrPix).length,identityConflicts:cases.filter(c=>c.identity.conflict).length,withBankDocuments:cases.filter(c=>c.documents.bank).length,withTargetDocuments:cases.filter(c=>c.documents.target).length,genericRefnumInTxid:cases.filter(c=>c.provenance.genericRefnumInTxid).length,missingAccountRegistration:cases.filter(c=>!c.account.registeredId).length,sourceAccountIdentified:cases.filter(c=>c.account.scopeFingerprint).length,sameFitidWarnings:cases.filter(c=>c.duplicates.sameFitidIds.length).length,previouslyReviewed:cases.filter(c=>c.previouslyReviewed).length,held:cases.filter(c=>c.hold).length,nativeBankMismatches:cases.filter(c=>c.nativeBank.amountMatches===false).length,executedCommands:0,sourceFingerprint:fingerprint};
 summary.nativeBankMismatches=cases.filter(c=>c.nativeBank.amountMatches===false||c.nativeBank.directionMatches===false).length;
 summary.nativeBankDirectionsNotRead=cases.filter(c=>c.nativeBank.directionMatches===null).length;
 return {summary,cases};
}

export function triageCsv(cases){
 const columns=['priority','classification','id','statementId','date','direction','amountCents','reason','nextAction'];
 const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return '\ufeff'+[columns.join(';'),...cases.map(row=>columns.map(key=>cell(row[key])).join(';'))].join('\n')+'\n';
}
