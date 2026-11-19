import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createCompanySimulation} from './lib/company-local-simulation.mjs';
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
for(const key of ['--plan','--proof','--prepared','--output'])if(!args.includes(key)||!get(key))throw new Error(`Informe ${key}.`);
const preparedDirectory=resolve(get('--prepared'));
const manifest=await createCompanySimulation({plan:JSON.parse(await readFile(get('--plan'),'utf8')),proof:JSON.parse(await readFile(get('--proof'),'utf8')),preparation:JSON.parse(await readFile(join(preparedDirectory,'preparation.json'),'utf8')),preparedDirectory,output:get('--output')});
console.log(JSON.stringify(manifest));
