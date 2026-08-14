const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const object=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);

// Aplica apenas a intenção representada por `incoming` em relação a `base`
// sobre o estado autoritativo `current`. Isso é obrigatório mesmo quando não
// houve concorrência: `base` e `incoming` podem ser projeções por papel/obra,
// enquanto `current` contém registros que o cliente nunca recebeu.
export const mergeThreeWay=(base,incoming,current)=>{
  if(same(incoming,base))return current;
  if(same(current,base))return incoming;
  if(Array.isArray(incoming)&&Array.isArray(current)&&Array.isArray(base)){
    const identifiable=[...base,...incoming,...current]
      .every(item=>object(item)&&item.id!=null);
    if(!identifiable)return incoming;
    const baseById=new Map(base.map(item=>[String(item.id),item]));
    const incomingById=new Map(incoming.map(item=>[String(item.id),item]));
    const currentById=new Map(current.map(item=>[String(item.id),item]));
    const order=[...current.map(item=>String(item.id)),...incoming.map(item=>String(item.id))]
      .filter((id,index,ids)=>ids.indexOf(id)===index);
    return order.flatMap(id=>{
      const original=baseById.get(id);
      const requested=incomingById.get(id);
      const stored=currentById.get(id);
      if(original&&!requested)return same(stored,original)?[]:(stored?[stored]:[]);
      if(!requested)return stored?[stored]:[];
      // `original` existente e `stored` ausente significa que outro cliente
      // já excluiu este registro no estado autoritativo. Não ressuscitar o
      // registro excluído só porque `incoming` ainda carrega uma cópia
      // desatualizada (ex.: pedido cancelado por outro usuário).
      if(!stored)return original?[]:[requested];
      return [mergeThreeWay(original,requested,stored)];
    });
  }
  if(object(incoming)&&object(current)){
    const output={};
    const keys=new Set([
      ...Object.keys(base||{}),...Object.keys(current),...Object.keys(incoming),
    ]);
    keys.forEach(key=>{
      output[key]=mergeThreeWay(base?.[key],incoming[key],current[key]);
    });
    return output;
  }
  // Mesma lógica de exclusão autoritativa para valores não-array/objeto
  // (ex.: entrada de ponto de um dia específico removida por outro cliente).
  if(current===undefined&&base!==undefined)return undefined;
  return incoming;
};
