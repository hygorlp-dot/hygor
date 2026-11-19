import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {planCompanyPartition} from '../server/company-partition.js';
import {verifyExternalCaptures} from './lib/company-capture-files.mjs';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--input')||!args.includes('--manifest')||!args.includes('--output')){
  console.error('Uso local: node scripts/plan-company-partition.mjs --input snapshot.json --manifest distribuicao.json --output plano.json');
  process.exitCode=1;
}else{
  const input=resolve(option('--input')),manifest=resolve(option('--manifest')),output=resolve(option('--output'));
  if(output===input||output===manifest)throw new Error('O resultado não pode substituir a origem.');
  const snapshot=JSON.parse(await readFile(input,'utf8'));
  await verifyExternalCaptures(snapshot);
  const plan=planCompanyPartition(snapshot,JSON.parse(await readFile(manifest,'utf8')));
  await writeFile(output,JSON.stringify(plan,null,2),{flag:'wx'});
  console.log(JSON.stringify({ready:plan.ready,pending:plan.issues.length,sourceHash:plan.sourceHash}));
  if(!plan.ready)process.exitCode=2;
}
