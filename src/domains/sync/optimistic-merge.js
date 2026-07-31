const same=(a,b)=>{
  if(Object.is(a,b))return true;
  try{return JSON.stringify(a)===JSON.stringify(b);}
  catch{return false;}
};

const recordId=item=>item&&typeof item==="object"&&item.id!=null?String(item.id):"";

const mergeList=(base,intended,latest)=>{
  const B=Array.isArray(base)?base:[];
  const I=Array.isArray(intended)?intended:[];
  const L=Array.isArray(latest)?latest:[];
  if(![...B,...I,...L].every(item=>recordId(item)))return intended;

  const baseById=new Map(B.map(item=>[recordId(item),item]));
  const intendedById=new Map(I.map(item=>[recordId(item),item]));
  const removed=new Set(B.map(recordId).filter(id=>!intendedById.has(id)));
  const output=[];
  const seen=new Set();

  for(const current of L){
    const id=recordId(current);
    seen.add(id);
    if(removed.has(id))continue;
    const desired=intendedById.get(id);
    if(!desired){output.push(current);continue;}
    const original=baseById.get(id);
    output.push(original&&same(desired,original)?current:mergeValue(original,desired,current));
  }
  for(const desired of I){
    const id=recordId(desired);
    if(!seen.has(id)&&!baseById.has(id))output.push(desired);
  }
  return output;
};

const plainObject=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);

const mergeObject=(base,intended,latest)=>{
  const B=plainObject(base)?base:{};
  const I=plainObject(intended)?intended:{};
  const L=plainObject(latest)?latest:{};
  const output={...L};
  for(const key of new Set([...Object.keys(B),...Object.keys(I)])){
    if(!Object.prototype.hasOwnProperty.call(I,key)){
      delete output[key];
      continue;
    }
    if(same(I[key],B[key]))continue;
    output[key]=mergeValue(B[key],I[key],L[key]);
  }
  return output;
};

const mergeValue=(base,intended,latest)=>{
  if(same(intended,base))return latest;
  if(Array.isArray(intended))return mergeList(base,intended,latest);
  if(plainObject(intended))return mergeObject(base,intended,latest);
  return intended;
};

// O chamador normalmente monta `{...data, secao: novaSecao}` a partir da
// fotografia renderizada. Se outro clique já atualizou `latest`, aplicamos
// apenas a intenção real desse render antigo sobre a fotografia mais nova.
export const reconcileOptimisticSnapshot=({latest,rendered,intended})=>{
  const L=plainObject(latest)?latest:{};
  const R=plainObject(rendered)?rendered:{};
  const I=plainObject(intended)?intended:{};
  const output={...L};
  for(const key of new Set([...Object.keys(R),...Object.keys(I)])){
    if(!Object.prototype.hasOwnProperty.call(I,key)){
      delete output[key];
      continue;
    }
    if(same(I[key],R[key]))continue;
    output[key]=mergeValue(R[key],I[key],L[key]);
  }
  return output;
};
