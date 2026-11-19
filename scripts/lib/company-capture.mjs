import {createHash} from 'node:crypto';

export function captureFingerprint(rows){
  return createHash('sha256').update(rows.map(row=>createHash('sha256').update(JSON.stringify(row)).digest('hex')).sort().join('')).digest('hex');
}

// Small, ordered pages keep large audit snapshots below the gateway limit.
// Exact counts and unique identities prevent silently accepting capped pages.
export async function captureTable({table,primaryKey,readPage,pageSize=50,concurrency=4,onProgress=()=>{},consume=null}){
  if(!primaryKey?.length)throw new Error(`Tabela ${table} sem chave primária conferida.`);
  const all=[],hashes=[],identityHashes=[],companyCounts={};
  let rowCount=0;
  for(const company of ['arcd','mrc']){
    const ids=new Set();let companyCount=0;
    const accept=async rows=>{
      for(const row of rows){
        if(row.company_id!==company)throw new Error(`Empresa divergente em ${table}.`);
        if(primaryKey.some(key=>row[key]===undefined||row[key]===null))throw new Error(`Identidades ausentes ou duplicadas em ${table}.`);
        const id=JSON.stringify(primaryKey.map(key=>row[key]));
        if(ids.has(id))throw new Error(`Identidades ausentes ou duplicadas em ${table}.`);
        ids.add(id);companyCount++;rowCount++;
        if(consume){hashes.push(createHash('sha256').update(JSON.stringify(row)).digest('hex'));identityHashes.push(String(row.id));}
        else all.push(row);
      }
      if(consume)await consume(rows);
    };
    const first=await readPage({table,company,primaryKey,start:0,end:pageSize-1,count:true});
    if(first.error)throw new Error(`Falha na leitura de ${table}: ${first.error.code||first.status}.`);
    if(!Number.isInteger(first.count)||first.count<0)throw new Error(`Contagem indisponível em ${table}.`);
    companyCounts[company]=first.count;
    if(first.data?.length!==Math.min(pageSize,first.count))throw new Error(`Página incompleta em ${table}.`);
    await accept(first.data);
    for(let start=pageSize;start<first.count;start+=pageSize*concurrency){
      const starts=Array.from({length:concurrency},(_,index)=>start+index*pageSize).filter(offset=>offset<first.count);
      const pages=await Promise.all(starts.map(offset=>readPage({table,company,primaryKey,start:offset,end:Math.min(offset+pageSize-1,first.count-1)})));
      for(let index=0;index<pages.length;index++){
        const result=pages[index],expected=Math.min(pageSize,first.count-starts[index]);
        if(result.error)throw new Error(`Falha na leitura de ${table}: ${result.error.code||result.status}.`);
        if(result.data?.length!==expected)throw new Error(`Página incompleta ou origem alterada em ${table}.`);
        await accept(result.data);
      }
      onProgress({table,company,rows:companyCount,total:first.count});
    }
  }
  return consume?{rowCount,companyCounts,fingerprint:createHash('sha256').update(hashes.sort().join('')).digest('hex'),identityDigest:createHash('md5').update(identityHashes.sort().join('')).digest('hex')}:all;
}
