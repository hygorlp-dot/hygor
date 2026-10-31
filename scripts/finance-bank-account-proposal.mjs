import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {readRealFinanceData} from './finance-real-data-source.mjs';
import {prepareBankAccountProposal,fingerprint} from './bank-account-proposal.mjs';
import {buildFinancialLedger} from '../src/domains/financeiro/ledger.js';

const output='C:/dev/marcell-local-review/contas-bancarias';
const {data,updatedAt}=await readRealFinanceData(),before=fingerprint(data);
const proposal=prepareBankAccountProposal(data,{updatedAt});
const statements=new Map(proposal.links.statements.filter(link=>!link.conflict).map(link=>[String(link.id),link.proposedAccountId]));
const transactions=new Map(proposal.links.transactions.filter(link=>!link.conflict).map(link=>[String(link.id),link.proposedAccountId]));
// Only an in-memory copy is used to check the contemplated change. No API save,
// operational command, account creation or reconciliation command is available.
const hypothetical={...data,
 contasBancarias:[...(data.contasBancarias||[]),...proposal.accounts.filter(a=>a.action==='revisar_novo_cadastro').map(a=>({id:a.proposedId,...a.draft}))],
 extratos:(data.extratos||[]).map(s=>statements.has(String(s.id))?{...s,contaBancariaId:statements.get(String(s.id))}:s),
 transacoes:(data.transacoes||[]).map(t=>transactions.has(String(t.id))?{...t,contaBancariaId:transactions.get(String(t.id))}:t),
};
const economicProjection=source=>buildFinancialLedger(source).events.map(e=>({id:e.id,effect:e.effect,amountCents:e.amountCents,date:e.date,competence:e.competence,obraId:e.obraId}));
assert.deepEqual(economicProjection(hypothetical),economicProjection(data),'A hipótese não pode alterar efeitos financeiros.');
for(const collection of ['extratos','transacoes']){
 assert.equal(hypothetical[collection].length,data[collection].length);
 for(let i=0;i<data[collection].length;i++){
  const withoutAccount=record=>Object.fromEntries(Object.entries(record).filter(([key])=>key!=='contaBancariaId'));
  assert.deepEqual(withoutAccount(hypothetical[collection][i]),withoutAccount(data[collection][i]));
 }
}
assert.equal(fingerprint(data),before,'A fonte lida precisa permanecer intacta.');
proposal.validation={sourceUnchanged:true,onlyAccountReferencesChangedInMemory:true,financialEffectsPreserved:true,appliedToCompany:false,oneDriveProcessRestarted:false};
proposal.localOriginalSearch={searchedLocations:['Downloads','OneDrive local'],matchingOfxFilesFound:0,limitation:'A identificação foi preservada na importação; os arquivos OFX originais não foram localizados nas pastas locais pesquisadas.'};
const lines=['PROPOSTA LOCAL — CADASTRO E VÍNCULOS BANCÁRIOS','Estado: somente revisão. NÃO APLICADA.','',
 `Base consultada: ${updatedAt}`,`Contas cadastradas: ${proposal.counts.existingAccounts}`,`Contas identificadas para proposta: ${proposal.counts.proposedAccounts}`,''];
for(const account of proposal.accounts){
 lines.push(`Banco informado nos extratos: ${account.draft.banco}`,`Conta preservada na importação: ${account.draft.conta}`,
  `Identificador provisório: ${account.proposedId}`,'Agência: não informada nas fontes preservadas','Titular e documento: não confirmados','Tipo de conta e situação ativa/inativa: a confirmar','Saldo de abertura e data de referência: não informados; NÃO usar zero por ausência de informação','',
  'FONTES E VÍNCULOS PROPOSTOS');
 for(const evidence of account.evidence){
  const links=proposal.links.transactions.filter(link=>link.statementId===evidence.statementId);
  lines.push(`- ${evidence.filename}`,`  ID: ${evidence.statementId} | Situação preservada: ${evidence.status}`,`  Movimentos: ${links.length} | Datas dos movimentos: ${evidence.startDate} a ${evidence.endDate}`,
   `  Alteração proposta: contaBancariaId vazio -> ${account.proposedId}`);
 }
 lines.push('');
}
lines.push('RESUMO DOS MOVIMENTOS',`Vínculos propostos: ${proposal.counts.transactionLinks} movimentos e ${proposal.counts.statementLinks} extratos`,
 ...Object.entries(proposal.counts.transactionStatuses).map(([status,count])=>`${status}: ${count}`),
 `Conflitos de vínculos existentes: ${[...proposal.links.statements,...proposal.links.transactions].filter(link=>link.conflict).length}`,
 `Movimentos sem extrato identificado: ${proposal.transactionsWithoutIdentifiedStatement.length}`,'',
 'REVISÃO DE REPETIÇÕES',`Grupos com FITID repetido: ${proposal.duplicateReview.repeatedFitid.length}`,`Grupos com chave de importação repetida: ${proposal.duplicateReview.repeatedImportKey.length}`,
 `Grupos com data, valor e descrição iguais: ${proposal.duplicateReview.repeatedContent.length}`,
 `Desses, grupos entre extratos diferentes: ${proposal.duplicateReview.repeatedContent.filter(group=>group.crossStatement).length}`,
 proposal.duplicateReview.warning,'',
 'PENDÊNCIAS PARA APROVAÇÃO','Confirmar titularidade, agência, tipo e situação da conta. Informar um saldo e sua data apenas com suporte bancário. Os metadados dos extratos não comprovam esses campos.',
 'Os arquivos OFX originais não foram localizados nas pastas locais Downloads/OneDrive pesquisadas. Os nomes e identificadores usados nesta proposta são os preservados pelo MARCELL na importação.',
 'O arquivo maior tem 17/08/2026 no nome, mas as datas dos movimentos preservados terminam em 15/08/2026. Não se presumiu movimentação nos dias 16 ou 17 nem cobertura contínua do intervalo.',
 '', 'PRESERVAÇÃO',
 'Nenhum cadastro, lançamento, conciliação, arquivo ou vínculo existente foi gravado ou alterado. Os dois extratos arquivados permanecem arquivados.',
 'Uma cópia em memória verificou que mudar apenas as referências da conta preserva os efeitos financeiros do razão. Esta cópia foi descartada; não foi ativada no servidor local nem na empresa.',
 'O JSON contém IDs e hashes de guarda para uma futura revisão. É um artefato não executável, com aprovação pendente, e não um payload para importar.',
 'Não se atribuiu conta prevista aos títulos e não se usaram dados bancários de fornecedores/contrapartes para identificar a origem dos extratos.',
 'O processo do servidor local/OneDrive foi preservado. Nenhuma publicação, migração, push ou deployment foi realizado.','');
await mkdir(output,{recursive:true});
await writeFile(`${output}/PROPOSTA-CADASTRO-E-VINCULOS.json`,JSON.stringify(proposal,null,2));
await writeFile(`${output}/REVISAO-DAS-CONTAS.txt`,lines.join('\n'),'utf8');
const persisted=JSON.parse(await readFile(`${output}/PROPOSTA-CADASTRO-E-VINCULOS.json`,'utf8'));
assert.equal(persisted.links.transactions.length,proposal.counts.transactionLinks);assert.equal(persisted.approved,false);assert.equal(persisted.executable,false);
console.log(JSON.stringify({output,counts:proposal.counts,repeatedContentGroups:proposal.duplicateReview.repeatedContent.length,validation:proposal.validation}));
