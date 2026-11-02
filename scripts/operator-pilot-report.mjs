import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {operatorPilotTemplate,analyzeOperatorPilot} from './lib/operator-pilot.mjs';
const [action,path]=process.argv.slice(2);
if(action==='--template'&&path){
 try{await access(path);throw new Error('O arquivo já existe. Escolha outro destino para preservar observações.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const {dirname}=await import('node:path');await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(operatorPilotTemplate(),null,2)+'\n');console.log('Modelo criado sem observações ou notas preenchidas.');
}else if(action==='--report'&&path){console.log(JSON.stringify(analyzeOperatorPilot(JSON.parse(await readFile(path,'utf8'))),null,2));}
else throw new Error('Uso local: node scripts/operator-pilot-report.mjs --template destino.json | --report observacoes.json');
