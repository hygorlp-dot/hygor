import {active} from './facts.js';
import {documentEvidenceInfo} from './document-evidence.js';

export const requiresBankReconciliation=payment=>
 !['cliente_direto','caixa_obra'].includes(payment?.origem);

export const awaitingBankReconciliation=payment=>
 active(payment)&&requiresBankReconciliation(payment)&&!payment.conciliado;

export function paymentEvidence(payment){
 const proofs=(Array.isArray(payment.comprovantes)?payment.comprovantes:[])
  .filter(document=>document&&typeof document==='object')
  .map(document=>({document,...documentEvidenceInfo(document)}));
 return {
  proofs,
  bankReference:requiresBankReconciliation(payment)?String(payment.transacaoId||''):'',
  hasProof:proofs.some(proof=>proof.resolvable),
 };
}
