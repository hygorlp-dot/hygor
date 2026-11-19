import {afterEach,expect,it} from 'vitest';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {captureFingerprint} from './company-capture.mjs';
import {verifyExternalCaptures} from './company-capture-files.mjs';
const paths=[];
afterEach(async()=>{for(const {path,directory} of paths.splice(0)){await unlink(path);await rmdir(directory);}});
async function fixture(){
  const directory=await mkdtemp(join(tmpdir(),'mrc-company-capture-')),path=join(directory,'audit.ndjson');paths.push({directory,path});
  const rows=[{id:'a',company_id:'arcd',payload:{original:'preservado'}}],text=rows.map(row=>JSON.stringify(row)+'\n').join('');await writeFile(path,text);
  const proof={rows:1,identityDigest:createHash('md5').update('a').digest('hex'),contentDigest:'native-before-after'};
  return {externalTables:{audit_events:{path,primaryKey:['id'],rowCount:1,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),fingerprint:captureFingerprint(rows),identityDigest:proof.identityDigest,nativeProofBefore:proof,nativeProofAfter:{...proof}}}};
}
it('confere arquivo completo, identidades e prova imutável sem carregar um JSON gigante',async()=>{
  const source=await fixture();expect(await verifyExternalCaptures(source)).toEqual([expect.objectContaining({table:'audit_events',rowCount:1,sha256:source.externalTables.audit_events.sha256})]);
});
it('recusa arquivo alterado e não aceita auditoria sem a prova posterior da origem',async()=>{
  const source=await fixture();source.externalTables.audit_events.nativeProofAfter=null;
  await expect(verifyExternalCaptures(source)).rejects.toThrow('aguarda conferência');
  await writeFile(source.externalTables.audit_events.path,'{}\n');
  await expect(verifyExternalCaptures(source)).rejects.toThrow('Identidade inválida');
});
