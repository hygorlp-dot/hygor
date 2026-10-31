import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const output=resolve('artifacts/deep-audit');
const read=async name=>JSON.parse(await readFile(resolve(output,name),'utf8'));
const unit=await read('vitest-verified.json');
const browser=new Map();
const reports=process.argv.slice(2);
for(const name of reports){
  const report=await read(name);
  function visit(suite){
    for(const spec of suite.specs||[])for(const test of spec.tests||[]){
      const key=JSON.stringify([spec.file||suite.file,test.projectName,spec.title]);
      browser.set(key,{file:spec.file||suite.file,project:test.projectName,title:spec.title,
        status:test.results?.at(-1)?.status==='skipped'?'skipped':test.status==='expected'?'passed':'failed',
        evidence:name});
    }
    for(const child of suite.suites||[])visit(child);
  }
  visit(report);
}
const rows=[...browser.values()];
const summary={generatedAt:new Date().toISOString(),localOnly:true,
  unit:{files:unit.testResults.length,passed:unit.numPassedTests,failed:unit.numFailedTests,skipped:unit.numPendingTests,
    failedFiles:unit.testResults.filter(file=>file.status==='failed').map(file=>file.name)},
  browser:{total:rows.length,passed:rows.filter(row=>row.status==='passed').length,failed:rows.filter(row=>row.status==='failed').length,
    skipped:rows.filter(row=>row.status==='skipped').length,unresolved:rows.filter(row=>row.status==='failed'),reports,results:rows},
};
await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,browser:{...summary.browser,results:undefined}},null,2));
if(summary.unit.failed||summary.unit.failedFiles.length||summary.browser.failed)process.exitCode=1;
