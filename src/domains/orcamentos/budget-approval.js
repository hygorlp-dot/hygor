// Quando uma versão de orçamento é aprovada (imutável). Fonte única para o
// servidor (section-authorizations.js recusa qualquer alteração nela) e para
// o normalizador da tela (record-schema.js a devolve exatamente como veio):
// se os dois discordarem, todo salvamento de orçamento passa a ser recusado.
export const orcamentoAprovado = item =>
  ["aprovado", "aprovada"].includes(String(item?.versionStatus || item?.status || "").toLowerCase())
  || item?.locked === true || item?.imutavel === true;
