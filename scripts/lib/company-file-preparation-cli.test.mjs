// @vitest-environment node
import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const exec=promisify(execFile),sha=value=>createHash('sha256').update(value).digest('hex');
let root,temporaryBase,planFile,auditFile,targetsFile,guard,photos;
const command=output=>exec(process.execPath,['--import',pathToFileURL(guard).href,'scripts/prepare-company-file-separation.mjs','--plan',planFile,'--audit',auditFile,'--targets',targetsFile,'--output',output],{cwd:process.cwd(),timeout:30000});
beforeAll(async()=>{
  temporaryBase=await realpath(tmpdir());root=await mkdtemp(join(temporaryBase,'mrc-file-preparation-test-'));
  const work=id=>({id,name:id,oneDriveDriveId:'d',oneDriveFolderId:'shared',oneDriveFolders:{'03 - Documentos':'docs'}});
  const plan={sourceHash:'snapshot',projects:{i:'mrc',base:'arcd',photo:'arcd'},companies:Object.fromEntries(['mrc','arcd'].map(company=>[company,{tables:{company_app_data:[{company_id:company,key:'arced_ponto_v1',value:{obras:[work(company==='mrc'?'i':'base')]}}]}}]))};
  await mkdir(join(root,'storage-copy'));
  const bytes=Buffer.from([255,216,255,217]);photos=await Promise.all(['a','b'].map(async id=>{
    const path=join(root,'storage-copy',id);await writeFile(path,bytes);
    return {id,company:'arcd',projectId:'photo',bucket:'diario-obra',name:`photo/2026/${id}.jpg`,originHost:'storage.test',public:true,mime:'image/jpeg',size:bytes.length,localCopy:{path,sha256:sha(bytes),bytes:bytes.length}};
  }));
  planFile=join(root,'plan.json');auditFile=join(root,'audit.json');targetsFile=join(root,'targets.json');guard=join(root,'deny-network.mjs');
  await writeFile(planFile,JSON.stringify(plan));await writeFile(auditFile,JSON.stringify({sourceHash:'snapshot',objects:photos,references:[]}));
  await writeFile(targetsFile,JSON.stringify([{company:'mrc',projectId:'i'},{company:'arcd',projectId:'base'}]));
  await writeFile(guard,"import http from 'node:http';import https from 'node:https';import net from 'node:net';const deny=()=>{throw new Error('NETWORK_FORBIDDEN');};globalThis.fetch=deny;http.request=deny;https.request=deny;net.connect=deny;net.createConnection=deny;\n");
});
afterAll(async()=>{
  // Delete only the exact temporary test directory created above.
  const target=await realpath(root);
  if(dirname(target)!==temporaryBase||!basename(target).startsWith('mrc-file-preparation-test-'))throw new Error('Diretório temporário inesperado.');
  await rm(target,{recursive:true});
});
it('materializa dois destinos e fotos privadas mesmo com toda a rede bloqueada',async()=>{
  const output=join(root,'prepared'),before=await readFile(planFile);
  const {stdout}=await command(output),proof=JSON.parse(stdout);
  expect(proof).toMatchObject({localPrepared:true,remoteWrites:0,financialPlanUntouched:true,summary:{workspaces:2,photos:2}});
  const manifest=await readFile(join(output,'preparation.json'));expect(sha(manifest)).toBe(proof.manifestSha256);
  for(const photo of JSON.parse(manifest).photos)expect(sha(await readFile(photo.preparedLocalCopy.path))).toBe(photo.sha256);
  expect(await readFile(planFile)).toEqual(before);
  await access(join(output,'workspaces','mrc','obras','i','03 - Documentos'));
  await access(join(output,'workspaces','arcd','obras','base','03 - Documentos'));
  const saved=await readFile(join(output,'preparation.json'));
  await expect(command(output)).rejects.toThrow();expect(await readFile(join(output,'preparation.json'))).toEqual(saved);
},30000);
it('recusa bytes alterados antes de criar qualquer destino',async()=>{
  const original=await readFile(photos[0].localCopy.path),output=join(root,'tampered');
  try{await writeFile(photos[0].localCopy.path,Buffer.from('changed'));await expect(command(output)).rejects.toThrow();await expect(access(output)).rejects.toThrow();}
  finally{await writeFile(photos[0].localCopy.path,original);}
});
it('recusa preparação privada dentro do repositório',async()=>{
  const output=resolve('should-not-create-private-preparation');await expect(command(output)).rejects.toThrow();await expect(access(output)).rejects.toThrow();
});
