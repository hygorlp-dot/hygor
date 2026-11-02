const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const rows=v=>Array.isArray(v)&&v.every(r=>object(r)&&r.id!=null);
const bookkeeping=new Set(['updatedAt','atualizadoEm','updatedBy','updatedById','atualizadoPor','atualizadoPorId']);
export function reviewSnapshot(base,intended,current,choices={}){
 const changes=[];
 const merge=(before,mine,stored,path)=>{
  if(same(before,mine)||same(mine,stored))return stored;
  if(rows(before)&&rows(mine)&&rows(stored)){
   const maps=[before,mine,stored].map(list=>new Map(list.map(r=>[String(r.id),r])));
   return [...new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()])].map(id=>merge(...maps.map(m=>m.get(id)),[...path,id])).filter(v=>v!==undefined);
  }
  if(object(before)&&object(mine)&&object(stored)){
   return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(mine),...Object.keys(stored)])].map(key=>[key,bookkeeping.has(key)?stored[key]:merge(before[key],mine[key],stored[key],[...path,key])]).filter(([,v])=>v!==undefined));
  }
  const key=JSON.stringify(path),conflict=!same(before,stored),choice=choices[key]||(conflict?'':'local');
  changes.push({key,path,local:mine,current:stored,choice,conflict});
  return choice==='local'?mine:stored;
 };
 const merged={...current};
 for(const section of Object.keys(intended))merged[section]=merge(base[section],intended[section],current[section],[section]);
 const conflicts=changes.filter(c=>c.conflict);
 return {merged,changes,conflicts,ready:conflicts.every(c=>['local','current'].includes(c.choice))};
}
