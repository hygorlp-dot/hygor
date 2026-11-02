import fs from 'node:fs';
import {auditImportGraph} from './lib/import-graph.mjs';
const projected=process.argv.includes('--projected');
const sourceOverrides=projected?new Map(JSON.parse(fs.readFileSync('artifacts/import-audit/projected-sources.json','utf8'))):new Map();
const report=auditImportGraph({sourceOverrides});
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,graph:undefined},null,2));
if(report.allCycles.length)process.exitCode=1;
