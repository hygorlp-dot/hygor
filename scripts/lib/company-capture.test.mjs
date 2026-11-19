import {expect,it} from 'vitest';
import {captureFingerprint,captureTable} from './company-capture.mjs';
const fixture=()=>['arcd','mrc'].flatMap(company=>Array.from({length:123},(_,id)=>({company_id:company,id,payload:'snapshot'})));
const reader=rows=>async({company,start,end,count})=>({data:rows.filter(row=>row.company_id===company).slice(start,end+1),...(count?{count:rows.filter(row=>row.company_id===company).length}:{})});
it('captura todas as páginas por empresa e chave composta sem repetir a primeira página',async()=>{
  const source=fixture(),calls=[];
  const rows=await captureTable({table:'audit_events',primaryKey:['company_id','id'],pageSize:20,readPage:async args=>{calls.push(args);return reader(source)(args);}});
  expect(rows).toEqual(source);expect(calls.every(call=>call.end-call.start<20)).toBe(true);
  expect(calls.filter(call=>call.count)).toHaveLength(2);
});
it('recusa página truncada, identidade repetida, empresa divergente e erro de rede',async()=>{
  const source=fixture();
  await expect(captureTable({table:'x',primaryKey:['id'],readPage:async()=>({data:[],count:123})})).rejects.toThrow('Página incompleta');
  source[1].id=0;
  await expect(captureTable({table:'x',primaryKey:['company_id','id'],readPage:reader(source)})).rejects.toThrow('duplicadas');
  await expect(captureTable({table:'x',primaryKey:['id'],readPage:async()=>({data:[{company_id:'outra',id:1}],count:1})})).rejects.toThrow('divergente');
  await expect(captureTable({table:'x',primaryKey:['id'],readPage:async()=>({error:{code:'57014'}})})).rejects.toThrow('57014');
});
it('conferência de conteúdo tolera reordenação e detecta alteração de valores',()=>{
  const rows=fixture();expect(captureFingerprint([...rows].reverse())).toBe(captureFingerprint(rows));
  const changed=structuredClone(rows);changed[0].payload='alterado';expect(captureFingerprint(changed)).not.toBe(captureFingerprint(rows));
});
it('captura catálogo grande sem expandir todos os registros como argumentos de uma função',async()=>{
  const rows=Array.from({length:150000},(_,id)=>({company_id:'arcd',id}));
  expect(await captureTable({table:'budget_reference_components',primaryKey:['company_id','id'],pageSize:1000,readPage:reader(rows)})).toHaveLength(150000);
});
it('exporta histórico em lotes sem manter todos os snapshots em uma única string',async()=>{
  const source=fixture(),received=[];
  const result=await captureTable({table:'audit_events',primaryKey:['company_id','id'],readPage:reader(source),consume:async rows=>received.push(...rows)});
  expect(result.rowCount).toBe(source.length);expect(result.fingerprint).toBe(captureFingerprint(source));expect(received).toEqual(source);
});
