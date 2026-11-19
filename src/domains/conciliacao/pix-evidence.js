// `chave` identifica/deduplica a linha do extrato (FITID ou impressão digital).
// Só campos com finalidade PIX explícita podem comprovar uma chave bancária.
export function transactionPixKey(transaction = {}) {
  return [transaction?.chavePix, transaction?.pixKey]
    .map(value => String(value ?? '').trim())
    .find(value => value && !/^(?:fit|h):/i.test(value)) || '';
}

export const normalizePixKey=value=>String(value||"").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g,"");
