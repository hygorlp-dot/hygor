import { BANK_TRANSACTION_COMMAND } from "../src/domains/conciliacao/transaction-commands.js";
import { criarFilaAutomatica } from "../src/domains/conciliacao/automation.js";
import { applyReconciliationCommand } from "./reconciliation-command.js";
import { authorizeReconciliationCommand } from "./reconciliation-policy.js";

// Runs before the import is committed, under its company lock (or CAS retry).
// Freeze eligible IDs first: resolving one row must not disambiguate another.
export async function reconcileImportedStatement(result, command, actor, validate = async () => ({ok:true})) {
  if (!result.ok || result.idempotent || Number(result.summary?.imported || 0) === 0 || command.type !== BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED) return result;
  const previous = result.data;
  const statementId = String(command.payload?.statement?.id || "");
  const rows = criarFilaAutomatica(previous).filter(row => String(row.tr.extratoId) === statementId && row.automatica);
  let data = previous;
  let matched = 0;
  for (const row of rows) {
    const automatic = {type:"AUTO_MATCH", payload:{transactionId:row.tr.id}};
    if (!authorizeReconciliationCommand(data, automatic, actor).ok) continue;
    const applied = applyReconciliationCommand(data, automatic, actor);
    if (!applied.resumo.ok) continue;
    const guard = await validate(data, applied.data, automatic);
    if (!guard.ok) continue;
    data = {...applied.data, reconciliationCommandLog:[...(applied.data.reconciliationCommandLog || []), {
      id:`import-auto-${row.tr.id}`, idempotencyKey:`import-auto-${statementId}-${row.tr.id}`,
      type:"AUTO_MATCH", transactionId:String(row.tr.id), actorId:actor.id,
      createdAt:new Date().toISOString(), resumo:applied.resumo,
    }].slice(-1000)};
    matched++;
  }
  const review = (data.transacoes || []).filter(tr => String(tr.extratoId) === statementId && ["pendente","parcial"].includes(tr.status)).length;
  return {...result, data, summary:{...result.summary, automaticallyReconciled:matched, pendingReview:review}};
}
