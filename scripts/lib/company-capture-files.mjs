import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';

export async function verifyExternalCaptures(snapshot){
  const verified=[];
  for(const [table,metadata] of Object.entries(snapshot.externalTables||{})){
    const input=createReadStream(metadata.path),checksum=createHash('sha256'),hashes=[],ids=new Set();
    let count=0,bytes=0;
    input.on('data',chunk=>{checksum.update(chunk);bytes+=chunk.length;});
    const lines=createInterface({input,crlfDelay:Infinity});
    try{
      for await(const line of lines){
        if(!line)throw new Error(`Linha vazia na captura ${table}.`);
        const row=JSON.parse(line),id=JSON.stringify(metadata.primaryKey.map(key=>row[key]));
        if(!['arcd','mrc'].includes(row.company_id)||metadata.primaryKey.some(key=>row[key]===undefined||row[key]===null)||ids.has(id))throw new Error(`Identidade inválida ou repetida no arquivo ${table}.`);
        ids.add(id);count++;hashes.push(createHash('sha256').update(JSON.stringify(row)).digest('hex'));
      }
    }finally{lines.close();input.destroy();}
    const sha256=checksum.digest('hex'),fingerprint=createHash('sha256').update(hashes.sort().join('')).digest('hex');
    if(count!==metadata.rowCount||bytes!==metadata.bytes||sha256!==metadata.sha256||fingerprint!==metadata.fingerprint)throw new Error(`O arquivo externo ${table} não confere com a captura.`);
    if(table==='audit_events'){
      const before=metadata.nativeProofBefore,after=metadata.nativeProofAfter;
      if(!before||!after||before.rows!==count||before.rows!==after.rows||before.identityDigest!==after.identityDigest||before.contentDigest!==after.contentDigest||metadata.identityDigest!==before.identityDigest)throw new Error('Auditoria aguarda conferência do conteúdo imutável na origem.');
    }
    verified.push({table,rowCount:count,sha256,fingerprint});
  }
  return verified;
}
