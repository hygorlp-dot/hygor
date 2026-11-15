import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {auditHistoricalFinance,applyHistoricalSanitation,planHistoricalSanitation,historicalFingerprint} from './lib/historical-finance-audit.mjs';

// File-only input: there is no connection string, database client or remote
// apply option. Detailed output can contain personal data: use a private dir.
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const input=arg('input'),snapshotPath=arg('snapshot'),output=arg('output'),years=(arg('years')||'').split(',').map(Number);
if(!input||!snapshotPath||!output||!arg('years'))throw new Error('Use --input=arquivo-local --snapshot=arquivo-local --output=pasta-privada --years=2025,2026,2027.');
const data=JSON.parse(await readFile(input,'utf8')),snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
const options={years,tables:snapshot.tables,accountingPeriods:snapshot.accountingPeriods||[]};
const before=auditHistoricalFinance(data,options),plan=planHistoricalSanitation(data);
const afterData=applyHistoricalSanitation(data,plan),after=auditHistoricalFinance(afterData,options);
assert.deepEqual(after.monthly,before.monthly,'O saneamento alterou o DRE ou a prévia.');
assert.deepEqual(after.closings,before.closings,'O saneamento alterou um fechamento congelado.');
assert.deepEqual(after.orphanWorks,before.orphanWorks,'O saneamento alterou vínculos de obra.');
assert.equal(planHistoricalSanitation(afterData).patches.length,0,'Saneamento não é idempotente.');
const ignoreIds=value=>({...value,changeLog:(value.changeLog||[]).map(({id,...fields})=>fields)});
assert.deepEqual(ignoreIds(afterData),ignoreIds(data),'O saneamento alterou outro campo.');
await mkdir(output,{recursive:true});
for(const [name,value] of Object.entries({'audit-before.json':before,'sanitation-plan.json':plan,'data-after.json':afterData,'audit-after.json':after}))await writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n');
const countBy=(items,key)=>Object.fromEntries([...new Set(items.map(i=>i[key]))].map(value=>[value,items.filter(i=>i[key]===value).length]));
const summary={generatedAt:new Date().toISOString(),capturedAt:snapshot.capturedAt,localOnly:true,remoteWrites:0,published:false,years,sourceFingerprint:before.sourceFingerprint,afterFingerprint:historicalFingerprint(afterData),sanitation:{changedIds:plan.patches.length,pending:plan.pending.length,remainingDuplicateIds:after.duplicateIds.length,recordCountBefore:data.changeLog?.length||0,recordCountAfter:afterData.changeLog?.length||0},orphans:countBy(after.orphanWorks,'collection'),plans:{checked:after.plans.length,ambiguous:after.plans.filter(p=>p.issue).length,orphanWork:after.plans.filter(p=>p.orphanWork).length},ledgerIssues:countBy(after.ledgerIssues,'code'),canonicalIssueCount:after.canonicalIssues.length,closings:{snapshots:after.closings.length,accountingPeriods:after.accountingPeriods.length},months:after.monthly.map(m=>({ym:m.ym,canonical:m.canonical,company:m.company,memorialOk:m.memorial.ok,memorialDeltas:m.memorial.deltas,bridge:m.bridge,previewOk:m.preview.ok,previewFailedChecks:m.preview.checks.filter(c=>!c.ok)})),dreUnchangedBySanitation:true,closedSnapshotsUnchanged:true};
summary.historicalWorkReferences=after.historicalWorkReferences;
summary.unresolvedWorkReferences=after.unresolvedWorkReferences;
await writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({months:summary.months.length,sanitation:summary.sanitation,orphans:summary.orphans,plans:summary.plans,ledgerIssues:summary.ledgerIssues,canonicalIssueCount:summary.canonicalIssueCount,closings:summary.closings,memorialFailures:summary.months.filter(m=>!m.memorialOk).map(m=>({ym:m.ym,deltas:m.memorialDeltas})),bridgeFailures:summary.months.filter(m=>m.bridge.differenceCents),previewOk:summary.months.filter(m=>m.previewOk).length,dreUnchangedBySanitation:true},null,2));
