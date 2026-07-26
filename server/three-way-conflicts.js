const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const rows=value=>Array.isArray(value)&&value.every(item=>item&&typeof item==="object"&&item.id!=null)?value:[];

/**
 * A mesclagem de três vias ainda é útil para coleções independentes, mas dois
 * autores nunca devem ter mudanças combinadas silenciosamente no mesmo fato.
 * O contrato retorna apenas conflitos de agregados identificados por `id`.
 */
export const findAggregateConflicts=(base,incoming,current,section="")=>{
  const before=rows(base),requested=rows(incoming),stored=rows(current);
  if(!before.length&&!requested.length&&!stored.length)return [];
  const byId=value=>new Map(value.map(item=>[String(item.id),item]));
  const baseById=byId(before),requestedById=byId(requested),storedById=byId(stored);
  const ids=new Set([...baseById.keys(),...requestedById.keys(),...storedById.keys()]);
  return [...ids].flatMap(id=>{
    const original=baseById.get(id),proposed=requestedById.get(id),persisted=storedById.get(id);
    const requesterChanged=!same(proposed,original),serverChanged=!same(persisted,original);
    return requesterChanged&&serverChanged&&!same(proposed,persisted)?[{section,id}]:[];
  });
};

export const findSectionConflicts=(baseSections={},incomingSections={},currentSections={},keys=Object.keys(incomingSections||{}))=>
  (keys||[]).flatMap(section=>findAggregateConflicts(baseSections?.[section],incomingSections?.[section],currentSections?.[section],section));
