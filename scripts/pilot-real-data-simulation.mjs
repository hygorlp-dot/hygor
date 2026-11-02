import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readRealFinanceData} from './finance-real-data-source.mjs';
import {criarFilaAutomatica,REGRA_AUTOMATICA} from '../src/domains/conciliacao/automation.js';
import {buildPilotCases,pilotMetrics} from '../src/features/pilot/pilot-model.js';

// Somente classificação. Nenhum comando de conciliação é criado ou executado.
// A saída com os casos reais fica fora do repositório e da raiz pública.
const output='C:/dev/marcell-local-review/piloto-real';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const originalFetch=globalThis.fetch,network={reads:0,blockedWrites:0};
globalThis.fetch=(input,options={})=>{
 const method=String(options.method||input?.method||'GET').toUpperCase();
 if(!['GET','HEAD'].includes(method)){network.blockedWrites++;throw new Error('Simulação: operação de rede não permitida.');}
 network.reads++;return originalFetch(input,options);
};

const {data,updatedAt}=await readRealFinanceData();
const before=hash(data),started=performance.now();
const rows=criarFilaAutomatica(data),cases=buildPilotCases(data,'conciliacao',{},rows);
const archived=new Set((data.extratos||[]).filter(s=>s.status==='arquivado').map(s=>String(s.id)));
const groups=items=>Object.entries(items.reduce((all,item)=>(all[item.reason]=(all[item.reason]||0)+1,all),{})).map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason));
const steps=reason=>{
 if(/parcia|taxa|valor difere/i.test(reason))return 'Conferir saldo, pagamento parcial, rateios e taxas antes de escolher o vínculo.';
 if(/mais de um|disputa|repetido|duplic/i.test(reason))return 'Comparar as alternativas e os identificadores; confirmar qual lançamento pertence ao movimento.';
 if(/rejeitada|reaberto|desfeito/i.test(reason))return 'Consultar o histórico e o motivo da rejeição ou reversão; não repetir a baixa.';
 if(/identificador bancário/i.test(reason))return 'Consultar o extrato original para confirmar o identificador; não inventar FITID ou referência.';
 if(/aprov|fechad|bloque|disponível/i.test(reason))return 'Conferir a aprovação, a competência e a situação do título na origem.';
 if(/Pessoa identificada|lançamento financeiro compatível/i.test(reason))return 'Localizar o título da pessoa identificada e verificar se o pagamento já foi registrado.';
 if(/correspondência segura|chave Pix|CPF|CNPJ|data compatível/i.test(reason))return 'Conferir comprovante e cadastro da contraparte, data, valor e título de destino.';
 return 'Conferir o lançamento de origem e as evidências antes de qualquer confirmação.';
};
const rowMap=new Map(rows.map(row=>[String(row.tr.id),row]));
const details=cases.map(item=>{
 const row=rowMap.get(String(item.sourceId)),c=item.candidate;
 return {id:item.sourceId,date:item.date,description:item.title,value:item.transaction.valor,accountId:item.transaction.contaBancariaId||'',statementId:item.transaction.extratoId||'',status:item.transaction.status,
  classification:item.prediction,reason:item.reason,identityIdentified:row?.identificada??null,
  possibleTarget:c?{type:c.tipo,id:c.entidadeId,paymentId:c.pagamentoId||'',title:c.titulo||'',counterparty:c.contraparte||'',workId:c.obraId||'',evidence:c.motivos||[],automaticEvidence:c.evidenciaAutomatica||{},blocks:c.bloqueios||[],warnings:c.alertas||[]}:null,
  alternativeCount:row?.analise?.alternativas?.length||0,
  nextStep:item.prediction==='proposed'?'Elegível pela regra atual. Confirmar na revisão acompanhada; eventual execução exigirá revalidação do servidor.':item.prediction==='executed'?'Consultar a auditoria anterior; não executar novamente.':steps(item.reason)};
});
const review=details.filter(item=>item.classification==='review');
const excludedCases=(data.transacoes||[]).filter(t=>!details.some(item=>String(item.id)===String(t.id))).map(t=>({id:t.id,date:t.data,status:t.status,statementId:t.extratoId||'',reason:archived.has(String(t.extratoId))?'Extrato arquivado; fora do piloto ativo.':'Movimento fora da fila pendente e sem auditoria de automação para avaliar.'}));
const statuses=items=>items.reduce((out,item)=>(out[item.status||'sem_status']=(out[item.status||'sem_status']||0)+1,out),{});
const live=(data.transacoes||[]).filter(t=>!archived.has(String(t.extratoId)));
const after=hash(data);if(before!==after)throw new Error('O analisador alterou a cópia em memória.');
if(network.blockedWrites)throw new Error('Houve tentativa de escrita bloqueada.');
const report={version:1,capturedAt:new Date().toISOString(),sourceUpdatedAt:updatedAt,rule:REGRA_AUTOMATICA,
 scope:'Todos os movimentos não arquivados, sem filtro de conta ou período. Pendentes e parciais classificados; automações já executadas separadas. Ignorados e conciliações manuais anteriores fora da fila.',
 counts:{totalBankMovements:(data.transacoes||[]).length,archivedMovements:(data.transacoes||[]).length-live.length,liveStatuses:statuses(live),archivedStatuses:statuses((data.transacoes||[]).filter(t=>archived.has(String(t.extratoId)))),pilot:pilotMetrics(cases,{})},
 classification:{proposed:details.filter(item=>item.classification==='proposed').length,review:review.length,executed:details.filter(item=>item.classification==='executed').length,identifiedInReview:review.filter(item=>item.identityIdentified).length,withCandidateInReview:review.filter(item=>item.possibleTarget).length},
 reviewReasons:groups(review),
 diagnostics:{dateMin:details.map(item=>item.date).filter(Boolean).sort()[0]||null,dateMax:details.map(item=>item.date).filter(Boolean).sort().at(-1)||null,withCandidate:review.filter(item=>item.possibleTarget).length,withoutCandidate:review.filter(item=>!item.possibleTarget).length,
  identifiedWithoutEligibleTarget:{noCandidate:review.filter(item=>item.reason==='Pessoa identificada; falta um lançamento financeiro compatível.'&&!item.possibleTarget).length,employee:review.filter(item=>item.reason==='Pessoa identificada; falta um lançamento financeiro compatível.'&&item.possibleTarget?.type==='funcionario').length,thirdParty:review.filter(item=>item.reason==='Pessoa identificada; falta um lançamento financeiro compatível.'&&item.possibleTarget?.type==='terceiro').length,workCash:review.filter(item=>item.reason==='Pessoa identificada; falta um lançamento financeiro compatível.'&&item.possibleTarget?.type==='caixaObra').length}},
 safeguards:{classificationOnly:true,commandsExecuted:0,financialWrites:0,networkReadRequests:network.reads,blockedWriteAttempts:network.blockedWrites,inMemoryDataUnchanged:before===after,sourceFingerprint:before,oneDriveRequests:0,serverRestarted:false},
 durationMs:Math.round(performance.now()-started),
 interpretation:'Elegibilidade é previsão da regra, não confirmação humana nem garantia de execução. Acurácia e tempo economizado não foram medidos. Os motivos são a primeira trava reportada pelo motor, não uma lista exaustiva. A simulação não preenche avaliações do operador.',cases:details,excludedCases};
await mkdir(output,{recursive:true});await writeFile(`${output}/classificacao.json`,JSON.stringify(report,null,2));
const csvCell=value=>`"${String(value??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')}"`;
const columns=['id','date','description','value','classification','reason','nextStep'];
await writeFile(`${output}/casos.csv`,'\uFEFF'+[columns,...details.map(item=>columns.map(key=>item[key]))].map(row=>row.map(csvCell).join(';')).join('\r\n'));
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const label={proposed:'Elegível para automação',review:'Exige revisão',executed:'Automação anterior'};
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Piloto real · classificação sem execução</title><style>body{font:16px system-ui;max-width:1200px;margin:32px auto;padding:16px;color:#202a31}table{border-collapse:collapse;width:100%}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}summary{padding:12px 0;cursor:pointer}small{display:block;color:#52616c}p{line-height:1.5}td{overflow-wrap:anywhere}a{color:#155e75}</style><h1>Piloto com dados reais</h1><p>Simulação sem execução · ${escape(report.capturedAt)} · base atualizada em ${escape(updatedAt)}</p><p>${escape(report.scope)}</p><p><strong>${report.classification.proposed} elegíveis · ${report.classification.review} para revisão · ${report.classification.executed} automações anteriores</strong></p><p>${escape(report.interpretation)}</p><h2>Motivos da revisão</h2><table><tr><th>Motivo inicial</th><th>Casos</th></tr>${report.reviewReasons.map(g=>`<tr><td>${escape(g.reason)}</td><td>${g.count}</td></tr>`).join('')}</table><h2>Casos para conferência</h2>${['proposed','review','executed'].map(kind=>`<h3>${label[kind]}</h3>${details.filter(item=>item.classification===kind).map(item=>`<details><summary>${escape(item.date)} · ${escape(item.description)} · ${escape(Number(item.value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))}<small>${escape(item.id)}</small></summary><p>${escape(item.reason)}</p><p>Possível destino: ${escape(item.possibleTarget?.title||'Sem candidato')} · ${escape(item.possibleTarget?.type||'')}</p><p>${escape(item.nextStep)}</p></details>`).join('')||'<p>Nenhum caso neste grupo.</p>'}`).join('')}<p>Somente leitura. Nenhum botão deste relatório executa conciliação. OneDrive e cadastro preservados.</p></html>`;
await writeFile(`${output}/revisao.html`,html);
const missing=report.diagnostics.identifiedWithoutEligibleTarget;
const summary=`# Piloto com dados reais — somente leitura\n\nCaptura: ${report.capturedAt}. Base: ${updatedAt}.\n\nDos ${report.counts.totalBankMovements} movimentos, ${report.counts.archivedMovements} estão em extratos arquivados. A fila ativa contém ${report.classification.review+report.classification.proposed} pendentes analisados e ${report.counts.liveStatuses.conciliado||0} já conciliados fora da fila.\n\n- Elegíveis para automação: ${report.classification.proposed}.\n- Exigem revisão: ${report.classification.review}.\n- Pessoas identificadas dentro da revisão: ${report.classification.identifiedInReview}.\n- Com possível destino para comparação: ${report.diagnostics.withCandidate}.\n- Sem possível destino: ${report.diagnostics.withoutCandidate}.\n\n## Primeira trava por caso\n\n${report.reviewReasons.map(g=>`- ${g.count}: ${g.reason}`).join('\n')}\n\n## Onde o operador deve começar\n\n1. Comparar os ${report.diagnostics.withCandidate} casos com candidato sugerido. A sugestão não autoriza baixa. Separar os conflitos de cadastro e os valores divergentes.\n2. Nos ${Object.values(missing).reduce((sum,n)=>sum+n,0)} casos de pessoa identificada sem título elegível: ${missing.noCandidate} estão sem candidato; ${missing.employee} apontam funcionário; ${missing.thirdParty} apontam terceiro; ${missing.workCash} apontam caixa da obra. Cadastro de pessoa ou movimento de caixa não substitui título de folha ou medição do terceiro. Conferir os registros existentes antes de criar qualquer novo lançamento.\n3. Conferir as ${review.filter(item=>item.reason==='Mais de um cadastro corresponde aos dados do extrato.').length} ambiguidades de cadastro e os casos com mais de um destino usando documentos originais e histórico.\n4. Os ${report.counts.archivedStatuses.pendente||0} pendentes em extratos arquivados exigem conferência separada do arquivo e do período; a simulação não os reativou.\n\nO período dos casos analisados é ${report.diagnostics.dateMin} a ${report.diagnostics.dateMax}; o resultado não cobre movimentações bancárias posteriores que não foram importadas.\n\n${report.interpretation}\n\n## Preservação\n\nForam feitas ${network.reads} requisições de leitura, zero comandos, zero tentativas de escrita e zero acessos ao OneDrive. A cópia em memória manteve o mesmo hash antes e depois da análise. O servidor não foi reiniciado.\n\nArquivos locais: revisao.html (casos expansíveis), casos.csv (lista de revisão), classificacao.json (classificação e registros fora do piloto). Nenhum arquivo da empresa foi anexado ou copiado.\n`;
await writeFile(`${output}/RESUMO.md`,summary);
console.log(JSON.stringify({...report,cases:undefined,excludedCases:undefined},null,2));
