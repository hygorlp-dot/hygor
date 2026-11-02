import {isFinancialDate} from './dates.js';
import {shiftDay} from './cash-forecast.js';
import {buildFinancialLedger,selectDRE} from './ledger.js';

export const ACCOUNTING_VERSION='2026-11-02.1';
export const ACCOUNTING_COMMAND=Object.freeze({ACCOUNTING_BASE_IMPORTED:'BASE_CONTABIL_IMPORTADA',ACCOUNTING_BASE_REVIEWED:'BASE_CONTABIL_CONFERIDA'});
export const ACCOUNTING_COMMAND_TYPES=new Set(Object.values(ACCOUNTING_COMMAND));
export const ACCOUNTING_GROUPS=Object.freeze([
 ['caixa','Caixa e equivalentes livres','ac'],['recebiveis_curto','Recebíveis financeiros de curto prazo','ac'],['estoques','Estoques','ac'],['outros_ac','Demais ativos circulantes','ac'],
 ['realizavel_longo','Realizável a longo prazo','anc'],['outros_anc','Demais ativos não circulantes','anc'],['passivo_curto','Passivo circulante','pc'],['passivo_longo','Passivo não circulante','pnc'],['patrimonio','Contas de patrimônio líquido','pl'],
 ['receita_bruta','Receita bruta','dre'],['deducoes','Deduções da receita','dre'],['custos','Custos dos serviços ou vendas','dre'],['despesas_operacionais','Despesas operacionais sem depreciação/amortização','dre'],['depreciacao','Depreciação e amortização','dre'],['receitas_financeiras','Receitas financeiras','dre'],['despesas_financeiras','Despesas financeiras','dre'],['outros_resultados','Outros resultados (crédito é ganho)','dre'],['tributos_lucro','Tributos sobre o lucro','dre'],
].map(([id,label,type])=>({id,label,type})));
export const ACCOUNTING_HEADERS=['codigo','conta','grupo','saldo_inicial','debitos','creditos','saldo_final'];
const groupOf=id=>ACCOUNTING_GROUPS.find(group=>group.id===id);
const sum=values=>{if(values.some(value=>!Number.isSafeInteger(value)))return null;const result=values.reduce((a,b)=>a+BigInt(b),0n);return result<=BigInt(Number.MAX_SAFE_INTEGER)&&result>=BigInt(Number.MIN_SAFE_INTEGER)?Number(result):null;};
const businessDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(now));
const fail=reason=>({ok:false,reason});
export const accountingBases=data=>(data.accountingBases||[]).filter(row=>row.schemaVersion===1);
export const canUseCompanyAccounting=user=>user?.active!==false&&['admin','financeiro'].includes(user?.role)&&!user?.obraId;
export const validAccountingPeriod=(start,end)=>isFinancialDate(start)&&isFinancialDate(end)&&start<=end&&start.endsWith('-01')&&shiftDay(end,1).endsWith('-01')&&Date.parse(end)-Date.parse(start)<366*86400000;

function cents(value){
 const text=String(value??'').trim();
 if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text))return null;
 const negative=text.startsWith('-'),[integer,fraction='']=text.replace('-','').replace(/\./g,'').split(',');
 const amount=BigInt(integer)*100n+BigInt(fraction.padEnd(2,'0'));
 return amount<=BigInt(Number.MAX_SAFE_INTEGER)?Number(negative?-amount:amount):null;
}
// UTF-8, semicolon delimiter, doubled quotes and quoted multiline fields.
function csvRecords(text){
 const rows=[];let fields=[],field='',quoted=false,line=1,startLine=1;
 for(let index=0;index<text.length;index++){
  const char=text[index];
  if(char==='"'){if(quoted&&text[index+1]==='"'){field+='"';index++;}else if(quoted||field==='')quoted=!quoted;else throw new Error(`Aspas inválidas na linha ${line}.`);}
  else if(char===';'&&!quoted){fields.push(field);field='';}
  else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[index+1]==='\n')index++;fields.push(field);if(fields.some(cell=>cell.trim()))rows.push({fields,line:startLine});fields=[];field='';line++;startLine=line;}
  else{field+=char;if(char==='\n')line++;}
 }
 if(quoted)throw new Error('Há campo entre aspas sem fechamento no CSV.');
 fields.push(field);if(fields.some(cell=>cell.trim()))rows.push({fields,line:startLine});return rows;
}
export function parseAccountingCsv(csv){
 try{
  if(typeof csv!=='string'||csv.length>512*1024||csv.includes('\uFFFD'))return fail('Use um CSV UTF-8 de até 512 KB, com separador ponto e vírgula.');
  const records=csvRecords(csv.replace(/^\uFEFF/,''));
  if(JSON.stringify(records[0]?.fields.map(cell=>cell.trim().toLowerCase()))!==JSON.stringify(ACCOUNTING_HEADERS))return fail(`Cabeçalho esperado: ${ACCOUNTING_HEADERS.join(';')}. Baixe o modelo.`);
  if(records.length<2||records.length>2001)return fail('O balancete deve conter entre 1 e 2.000 contas analíticas, sem linhas de totais.');
  const accounts=[],codes=new Set();
  for(const record of records.slice(1)){
   if(record.fields.length!==7)return fail(`Linha ${record.line}: são necessárias sete colunas.`);
   const [code,name,group,...values]=record.fields.map(cell=>cell.trim()),amounts=values.map(cents);
   if(!code||code.length>80||!name||name.length>500||codes.has(code))return fail(`Linha ${record.line}: identificação ausente, extensa ou repetida. Use apenas contas analíticas.`);
   if(!groupOf(group))return fail(`Linha ${record.line}: grupo ${group||'não informado'} não reconhecido. Confira o guia dos grupos.`);
   if(amounts.some(value=>value===null)||amounts[1]<0||amounts[2]<0)return fail(`Linha ${record.line}: confira valores em reais no padrão 1.234,56; débitos e créditos não podem ser negativos. Zero precisa estar explícito.`);
   codes.add(code);accounts.push({code,name,group,opening:amounts[0],debit:amounts[1],credit:amounts[2],closing:amounts[3],sourceLine:record.line});
  }
  return {ok:true,accounts};
 }catch(error){return fail(error.message||'Não foi possível ler o CSV.');}
}

export function accountingStatement(accounts=[]){
 if(!Array.isArray(accounts)||accounts.some(row=>!groupOf(row.group)||['opening','debit','credit','closing'].some(key=>!Number.isSafeInteger(row[key]))))return {issues:[{source:'Base',message:'Estrutura ou valores das contas inválidos.'}],totals:{},groups:[],balance:null,income:null};
 const issues=[],groups=ACCOUNTING_GROUPS.map(group=>({...group,opening:sum(accounts.filter(row=>row.group===group.id).map(row=>row.opening)),closing:sum(accounts.filter(row=>row.group===group.id).map(row=>row.closing)),movement:sum(accounts.filter(row=>row.group===group.id).flatMap(row=>[row.debit,-row.credit]))}));
 const totals=Object.fromEntries(['opening','debit','credit','closing'].map(key=>[key,sum(accounts.map(row=>row[key]))]));
 for(const row of accounts){const expected=sum([row.opening,row.debit,-row.credit]);if(expected===null||expected!==row.closing)issues.push({source:row.code,line:row.sourceLine,message:'Saldo final não corresponde a saldo inicial + débitos − créditos.'});}
 if(Object.values(totals).some(value=>value===null)||groups.some(row=>[row.opening,row.closing,row.movement].some(value=>value===null)))return {issues:[...issues,{source:'Totais',message:'Limite numérico excedido. Divida e confira a base na origem.'}],totals,groups,balance:null,income:null};
 if(totals.opening!==0)issues.push({source:'Abertura',message:'A soma dos saldos iniciais devedores e credores não fecha em zero.'});
 if(totals.debit!==totals.credit)issues.push({source:'Movimentação',message:'O total de débitos difere do total de créditos do período.'});
 if(totals.closing!==0)issues.push({source:'Fechamento',message:'A soma dos saldos finais devedores e credores não fecha em zero.'});
 const groupValue=(id,key)=>groups.find(row=>row.id===id)[key];
 const typeValue=(type,key)=>sum(groups.filter(row=>row.type===type).map(row=>row[key]));
 const openingResult=-typeValue('dre','opening'),closingResult=-typeValue('dre','closing');
 const equityOpening=sum([-typeValue('pl','opening'),openingResult]),equityClosing=sum([-typeValue('pl','closing'),closingResult]);
 const assetsOpening=sum([typeValue('ac','opening'),typeValue('anc','opening')]),assets=sum([typeValue('ac','closing'),typeValue('anc','closing')]);
 const pc=-typeValue('pc','closing'),pnc=-typeValue('pnc','closing'),debt=sum([pc,pnc]);
 const balance={assetsOpening,assets,ac:typeValue('ac','closing'),anc:typeValue('anc','closing'),cash:groupValue('caixa','closing'),receivables:groupValue('recebiveis_curto','closing'),inventories:groupValue('estoques','closing'),longReceivables:groupValue('realizavel_longo','closing'),pc,pnc,debt,equityOpening,equity:equityClosing,equityAccounts:-typeValue('pl','closing'),openingResult,closingResult};
 const revenue=-groupValue('receita_bruta','movement'),deductions=groupValue('deducoes','movement'),netRevenue=sum([revenue,-deductions]),costs=groupValue('custos','movement'),gross=sum([netRevenue,-costs]),operatingExpenses=sum([groupValue('despesas_operacionais','movement'),groupValue('depreciacao','movement')]),operating=sum([gross,-operatingExpenses]),financial=sum([-groupValue('receitas_financeiras','movement'),-groupValue('despesas_financeiras','movement')]),other=-groupValue('outros_resultados','movement'),tax=groupValue('tributos_lucro','movement'),net=sum([operating,financial,other,-tax]);
 const income={revenue,deductions,netRevenue,costs,gross,operatingExpenses,operating,financial,other,tax,net};
 if(Object.values(balance).some(value=>value===null)||Object.values(income).some(value=>value===null))issues.push({source:'Demonstrativos',message:'Um subtotal excede o limite numérico.'});
 else{
  if(sum([assets,-pc,-pnc,-equityClosing])!==0)issues.push({source:'Balanço',message:'Ativo difere de passivo exigível + patrimônio líquido com resultado em aberto.'});
  if(net!==-typeValue('dre','movement'))issues.push({source:'DRE',message:'O resultado não reconcilia com a movimentação das contas de resultado.'});
 }
 for(const group of groups.filter(row=>['ac','anc','pc','pnc'].includes(row.type))){const sign=['pc','pnc'].includes(group.type)?-1:1;if(group.closing*sign<0)issues.push({source:group.label,message:'Saldo agregado com natureza invertida. Confira a classificação e as contas redutoras.'});}
 return {issues,totals,groups,balance,income};
}

export function accountingErpComparison(data,start,end){
 const ledger=buildFinancialLedger(data),dre=selectDRE(ledger,{startDate:start.slice(0,7),endDate:end.slice(0,7)});
 const events=ledger.events.filter(event=>event.competence>=start.slice(0,7)&&event.competence<=end.slice(0,7)&&['revenue','revenue_reversal','cost','cost_reversal'].includes(event.effect));
 return {revenue:events.length?dre.revenueCents:null,cost:events.length?dre.costCents:null,result:events.length?dre.resultCents:null,eventCount:events.length,issues:ledger.issues?.length||0,fingerprint:JSON.stringify(events.map(row=>[row.id,row.competence,row.effect,row.amountCents]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))};
}

export function accountingIndicators(base){
 const statement=accountingStatement(base?.accounts||[]),ready=base?.status==='conferida'&&!statement.issues.length;
 const b=statement.balance||{},d=statement.income||{};
 const unavailable=!base?'Importe e confira um balancete.':base.status!=='conferida'?'Base ainda não conferida.':statement.issues.length?'Há pendências de consistência na base.':'';
 const metric=(id,label,family,numerator,denominator,formula,unit='percent')=>({id,label,family,numerator:ready?numerator:null,denominator:ready?denominator:null,value:ready&&Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)&&denominator>0?numerator/denominator:null,formula,unit,reason:unavailable||(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)?'Base numérica indisponível.':denominator<=0?'Denominador deve ser positivo.':'')});
 const metrics=[
  metric('gross','Margem bruta','Rentabilidade',d.gross,d.netRevenue,'Lucro bruto / receita líquida'),metric('net','Margem líquida','Rentabilidade',d.net,d.netRevenue,'Lucro líquido do período / receita líquida'),metric('roa','ROA sobre ativo final','Rentabilidade',d.net,b.assets,'Lucro líquido do período / ativo total final'),metric('roe','ROE sobre PL final','Rentabilidade',d.net,b.equity,'Lucro líquido do período / patrimônio líquido final'),
  metric('current','Liquidez corrente','Liquidez',b.ac,b.pc,'Ativo circulante / passivo circulante','ratio'),metric('quick','Liquidez seca restrita','Liquidez',b.cash==null||b.receivables==null?null:sum([b.cash,b.receivables]),b.pc,'(Caixa e equivalentes + recebíveis financeiros de curto prazo) / passivo circulante','ratio'),metric('immediate','Liquidez imediata','Liquidez',b.cash,b.pc,'Caixa e equivalentes livres / passivo circulante','ratio'),metric('general','Liquidez geral','Liquidez',b.ac==null||b.longReceivables==null?null:sum([b.ac,b.longReceivables]),b.debt,'(Ativo circulante + realizável a longo prazo) / (passivo circulante + não circulante)','ratio'),
  metric('debt_assets','Capital de terceiros / ativo','Endividamento',b.debt,b.assets,'(Passivo circulante + não circulante) / ativo total'),metric('debt_equity','Capital de terceiros / PL','Endividamento',b.debt,b.equity,'(Passivo circulante + não circulante) / patrimônio líquido'),metric('debt_profile','Composição do endividamento','Endividamento',b.pc,b.debt,'Passivo circulante / (passivo circulante + não circulante)'),
 ];
 return {version:ACCOUNTING_VERSION,ready,reason:unavailable,statement,metrics};
}

export function applyAccountingCommand(data,command,now){
 if(!ACCOUNTING_COMMAND_TYPES.has(command.type))return null;
 const p=command.payload||{};
 if(!command.actorId||!['admin','financeiro'].includes(command.actorRole))return fail('Seu perfil não pode conferir bases contábeis.');
 const records=accountingBases(data);
 if(command.type===ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED){
  if(!p.id||(data.accountingBases||[]).some(row=>row.id===p.id))return fail('Identificação da base já usada ou ausente.');
  if(command.expectedVersion!==records.length)return fail('O histórico contábil mudou. Atualize antes de importar.');
  if(!validAccountingPeriod(p.start,p.end)||p.end>=businessDay(now))return fail('Escolha até 12 meses inteiros já encerrados, com início no primeiro dia e término no último dia do mês.');
  if(p.end>businessDay(now))return fail('O período contábil não pode terminar no futuro.');
  if(String(p.entity||'').trim().length<3||String(p.document||'').trim().length<3||String(p.note||'').trim().length<10)return fail('Informe entidade, documento de origem e justificativa da importação ou revisão.');
  const parsed=parseAccountingCsv(p.csv);if(!parsed.ok)return parsed;
  const prior=records.filter(row=>row.start===p.start&&row.end===p.end).sort((a,b)=>a.revision-b.revision).at(-1);
  const row={id:p.id,schemaVersion:1,status:'rascunho',version:1,revision:(prior?.revision||0)+1,revisionOf:prior?.id||'',entity:String(p.entity).trim().slice(0,200),document:String(p.document).trim().slice(0,300),sourceFile:String(p.filename||'CSV informado').slice(0,200),start:p.start,end:p.end,note:String(p.note).trim().slice(0,2000),accounts:parsed.accounts,createdAt:now,createdById:command.actorId,createdBy:command.actorName||'',format:'balancete_pre_encerramento_v1'};
  return {ok:true,entityId:row.id,data:{...data,accountingBases:[...(data.accountingBases||[]),row]}};
 }
 const row=records.find(item=>item.id===p.id);
 if(!row||row.status!=='rascunho'||row.version!==command.expectedVersion)return fail('A base mudou ou já foi conferida. Atualize a consulta.');
 if(p.completeCoverage!==true)return fail('Confirme a cobertura integral da entidade, a classificação e o balancete antes do encerramento do resultado.');
 const statement=accountingStatement(row.accounts);
 if(statement.issues.length)return fail('Há divergências nos saldos ou na classificação. Corrija o arquivo na origem e importe uma revisão.');
 const comparison=accountingErpComparison(data,row.start,row.end);
 if(p.erpFingerprint!==comparison.fingerprint)return fail('Os fatos do ERP mudaram. Confira novamente a comparação.');
 const difference=comparison.result===null?null:sum([statement.income.net,-comparison.result]);
 if((difference!==0||comparison.issues>0)&&String(p.reconciliationNote||'').trim().length<10)return fail('Explique a diferença ou a ausência de base comparável entre contabilidade e ERP.');
 const newer=records.some(other=>other.start===row.start&&other.end===row.end&&other.status==='conferida'&&other.revision>row.revision);
 if(newer)return fail('Uma revisão posterior já foi conferida. Importe uma nova revisão.');
 const reviewed={...row,status:'conferida',version:row.version+1,reviewedAt:now,reviewedOn:businessDay(now),reviewedById:command.actorId,reviewedBy:command.actorName||'',completeCoverage:true,reconciliationNote:String(p.reconciliationNote||'').trim().slice(0,2000),erpComparison:comparison,erpDifference:difference};
 return {ok:true,entityId:row.id,data:{...data,accountingBases:data.accountingBases.map(item=>item.id===row.id?reviewed:item)}};
}

export function accountingReportSheets(base,report=accountingIndicators(base)){
 const money=value=>value==null?'Não disponível':value/100;
 return {Base:[['Relatório','Indicadores contábeis da empresa'],['Versão',report.version],['Entidade',base?.entity||'Não informada'],['Período',base?`${base.start} a ${base.end}`:'Não informado'],['Documento',base?.document||''],['Arquivo',base?.sourceFile||''],['Revisão',base?.revision||''],['Situação',base?.status||'Sem base'],['Conferência',base?.reviewedBy||'Pendente'],['Data',base?.reviewedAt||''],['Justificativa',base?.note||''],['Conciliação',base?.reconciliationNote||'Pendente'],['Limites','Empresa inteira, sem rateio por obra. Rentabilidade do período sem anualização; ROA e ROE usam saldo final. Liquidez seca usa caixa e recebíveis financeiros de curto prazo. PL inclui resultado acumulado ainda não encerrado. Não é balanço publicado nem parecer contábil.']],
  Indicadores:[['Família','Indicador','Valor (escala 0 a 1 ou índice)','Numerador R$','Denominador R$','Fórmula','Motivo'],...report.metrics.map(row=>[row.family,row.label,row.value,money(row.numerator),money(row.denominator),row.formula,row.reason])],
  Contas:[['Código','Conta','Grupo','Saldo inicial R$','Débitos R$','Créditos R$','Saldo final R$','Linha do CSV'],...(base?.accounts||[]).map(row=>[row.code,row.name,groupOf(row.group)?.label,money(row.opening),money(row.debit),money(row.credit),money(row.closing),row.sourceLine])],
  Grupos:[['Grupo','Saldo inicial R$','Saldo final R$','Movimentação devedora líquida R$'],...report.statement.groups.map(row=>[row.label,money(row.opening),money(row.closing),money(row.movement)])],
  Pendências:[['Origem','Linha','Pendência'],...report.statement.issues.map(row=>[row.source,row.line||'',row.message])],
 };
}

export const validateAccountingSnapshotPolicy=(before={},after={})=>JSON.stringify(before.accountingBases||[])===JSON.stringify(after.accountingBases||[])?'':'Bases contábeis só podem ser importadas e conferidas pelos comandos próprios; o histórico não pode ser apagado ou reescrito.';
