// @vitest-environment node
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {it,expect} from 'vitest';

it('reprova a medição de um build interrompido sem JavaScript',()=>{
 const directory=mkdtempSync(join(tmpdir(),'mrc-bundle-'));
 try{
  mkdirSync(join(directory,'assets'));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./bundle-metrics.mjs',import.meta.url))],{env:{...process.env,BUNDLE_DIST_DIR:directory,BUNDLE_REPORT_PATH:join(directory,'report.json')},encoding:'utf8',windowsHide:true});
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Build incompleto');
 }finally{
  const target=resolve(directory);
  if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('mrc-bundle-'))throw new Error('Diretório temporário fora do escopo do teste.');
  rmSync(target,{recursive:true,force:true});
 }
});
