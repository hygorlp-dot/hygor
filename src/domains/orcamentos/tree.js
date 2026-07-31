import { bdiEfetivo, calculateBudget } from "./calculations";

export const buildBudgetTree = (stages = [], items = []) => {
  const childrenByParent = new Map();
  stages.forEach(stage => {
    const parent = stage.parentId || "";
    childrenByParent.set(parent, [...(childrenByParent.get(parent) || []), stage]);
  });
  const itemsByStage = new Map();
  items.forEach(item => itemsByStage.set(item.etapaId, [...(itemsByStage.get(item.etapaId) || []), item]));
  const walk = (parentId, prefix, level) => (childrenByParent.get(parentId) || []).map((stage, index) => {
    const code = prefix ? `${prefix}.${index + 1}` : String(index + 1);
    const sub = walk(stage.id, code, level + 1);
    const ownItems = (itemsByStage.get(stage.id) || []).map((item, itemIndex) => ({
      ...item,
      codigoItem:`${code}.${sub.length + itemIndex + 1}`,
    }));
    return { ...stage, codigo:code, nivel:level, sub, itens:ownItems };
  });
  return walk("", "", 1);
};

const calculateNode = (node, globalBdi) => {
  const sub = node.sub.map(child => calculateNode(child, globalBdi));
  const items = node.itens.filter(item => item.tipo !== "titulo").map(item => {
    const cost = Number(item.quantidade || 0) * Number(item.precoUnit || 0);
    return { cost, total:cost * (1 + bdiEfetivo(item, globalBdi) / 100) };
  });
  return {
    ...node,
    sub,
    custoDireto:items.reduce((sum, item) => sum + item.cost, 0) + sub.reduce((sum, child) => sum + child.custoDireto, 0),
    total:items.reduce((sum, item) => sum + item.total, 0) + sub.reduce((sum, child) => sum + child.total, 0),
  };
};

export const flattenBudgetTree = (nodes, output = []) => {
  nodes.forEach(node => {
    output.push({ tipo:"etapa", ...node });
    flattenBudgetTree(node.sub, output);
    node.itens.forEach(item => output.push({ tipo:"item", ...item }));
  });
  return output;
};

export const budgetSubtreeIds = (stages = [], rootId) => {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    stages.forEach(stage => {
      if (stage.parentId === ids[index] && !ids.includes(stage.id)) ids.push(stage.id);
    });
  }
  return ids;
};

export const budgetStageLevel = (stages = [], id) => {
  let level = 1;
  let current = stages.find(stage => stage.id === id);
  const visited = new Set([id]);
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    level += 1;
    current = stages.find(stage => stage.id === current.parentId);
  }
  return level;
};

export const calculateBudgetTree = budget => {
  const calculation = calculateBudget(budget);
  const withPercentage = node => ({
    ...node,
    pct:calculation.total > 0 ? node.total / calculation.total * 100 : 0,
    sub:node.sub.map(withPercentage),
  });
  const arvore = buildBudgetTree(budget?.etapas, budget?.itens)
    .map(node => withPercentage(calculateNode(node, Number(budget?.bdi || 0))));
  return { ...calculation, arvore };
};

