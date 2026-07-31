import { WBS_TYPES } from "./constants.js";

const text = value => String(value || "").trim();
const activeNodes = nodes => (nodes || []).filter(node => node?.active !== false);

export function validateWbsTree(nodes = []) {
  const errors = [];
  const byId = new Map();
  activeNodes(nodes).forEach(node => {
    const id = text(node.id);
    if (!id || byId.has(id)) errors.push("A EAP possui identificador ausente ou duplicado.");
    else byId.set(id, node);
    if (!WBS_TYPES.includes(node.type || "work_package")) errors.push(`Tipo de EAP inválido: ${node.type}.`);
  });
  byId.forEach((node, id) => { if (node.parentId && !byId.has(String(node.parentId))) errors.push(`A EAP ${id} aponta para pai inexistente.`); });
  const visiting = new Set(); const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) { errors.push("A EAP não pode conter ciclos."); return; }
    if (visited.has(id)) return;
    visiting.add(id); const parent = byId.get(id)?.parentId; if (parent && byId.has(String(parent))) visit(String(parent)); visiting.delete(id); visited.add(id);
  };
  byId.forEach((_, id) => visit(id));
  return { ok: !errors.length, errors, byId };
}

export function normalizeWbsTree(nodes = []) {
  const validation = validateWbsTree(nodes);
  if (!validation.ok) return { ok:false, errors:validation.errors, nodes:[] };
  const byParent = new Map();
  activeNodes(nodes).forEach(node => { const parent=String(node.parentId || ""); byParent.set(parent, [...(byParent.get(parent) || []), node]); });
  const normalized = [];
  const walk = (parentId, parentCode = "", level = 0) => (byParent.get(parentId) || []).slice().sort((a,b) => Number(a.order || 0) - Number(b.order || 0) || text(a.name || a.descricao).localeCompare(text(b.name || b.descricao), "pt-BR")).forEach((node, index) => {
    const code = parentCode ? `${parentCode}.${index + 1}` : String(index + 1);
    const current = { ...node, code: text(node.code) || code, level, order:index + 1, active:node.active !== false };
    normalized.push(current); walk(String(node.id), current.code, level + 1);
  });
  walk("");
  return { ok:true, errors:[], nodes:normalized };
}

export function moveWbsNode(nodes = [], nodeId, parentId, order) {
  const id = String(nodeId || ""); const targetParent = String(parentId || "");
  const candidate = nodes.map(node => String(node.id) === id ? { ...node, parentId:targetParent || null, order:Number(order || 1) } : { ...node });
  const normalized = normalizeWbsTree(candidate);
  return normalized.ok ? { ok:true, nodes:normalized.nodes } : { ok:false, error:normalized.errors.join(" ") };
}

export function canArchiveWbsNode(nodes = [], nodeId) {
  const id = String(nodeId || "");
  if (nodes.some(node => String(node.parentId || "") === id && node.active !== false)) return { ok:false, error:"Mova ou arquive os filhos antes de arquivar este item da EAP." };
  return { ok:true };
}
