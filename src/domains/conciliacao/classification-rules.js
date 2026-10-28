import { incomeCategoryEffect, normalizeCategorySearch } from "./categories.js";

const ruleDirection = rule => ["entrada", "saida"].includes(rule.direction)
  ? rule.direction
  : (rule.categoria === "receita" || incomeCategoryEffect(rule.categoria) !== "unallocated" ? "entrada" : "saida");

export const suggestClassificationRule = (transaction, rules = [], learned = []) => {
  const direction = Number(transaction?.valor) > 0 ? "entrada" : "saida";
  const description = normalizeCategorySearch(transaction?.descricao);
  const compatible = rule => ruleDirection(rule) === direction && rule.ativa !== false && rule.padrao;
  const rule = (rules || []).filter(compatible)
    .sort((a, b) => Number(b.prioridade || 0) - Number(a.prioridade || 0))
    .find(item => description.includes(normalizeCategorySearch(item.padrao)));
  if (rule) return { destino:rule.destino, obraId:rule.obraId, categoria:rule.categoria, direction, origem:"regra" };
  const match = (learned || []).filter(item => compatible(item) && Number(item.confirmacoes || 0) >= 2
    && normalizeCategorySearch(item.padrao).split(/\s+/).every(word => description.includes(word)))
    .sort((a, b) => Number(b.confirmacoes || 0) - Number(a.confirmacoes || 0))[0];
  return match ? { destino:match.destino, obraId:match.obraId, categoria:match.categoria, direction, origem:"aprendizado", confirmacoes:match.confirmacoes } : null;
};
