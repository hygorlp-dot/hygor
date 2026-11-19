import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {verifyCutoverBundle,cutoverHash,requireCutover} from '../server/company-cutover.js';
import {companyCutoverSql} from '../server/company-cutover-sql.js';
import {newCutoverRehearsal,executeCutoverRehearsal,readCutoverRehearsal,verifyRehearsalDre} from './lib/company-cutover-rehearsal.mjs';
import {verifyExternalCaptures} from './lib/company-capture-files.mjs';
import {createHash} from 'node:crypto';
// SQL errors may carry the entire private statement in .query. Never dump it.
process.on('uncaughtException',error=>{console.error(JSON.stringify({error:error.message,code:error.code||null}));process.exit(1);});
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
for(const key of ['--package','--output'])if(!args.includes(key)||!option(key))throw new Error(`Informe ${key}.`);
const root=resolve(option('--package')),output=resolve(option('--output')),bundle=verifyCutoverBundle(JSON.parse(await readFile(join(root,'bundle.json'),'utf8')));
await mkdir(output);
const artifactManifest=JSON.parse(await readFile(join(root,'package-files.json'),'utf8'));
requireCutover(artifactManifest.id===bundle.id,'Manifesto de artefatos de outro pacote.');
for(const file of artifactManifest.artifacts)requireCutover(createHash('sha256').update(await readFile(join(root,file.file))).digest('hex')===file.sha256,'Artefato SQL/JSON alterado.');
for(const [file,recovery]of [['apply.blocked.sql',false],['recover-clean.blocked.sql',true]])requireCutover((await readFile(join(root,file),'utf8'))===companyCutoverSql(bundle,{recovery}),'Rascunho SQL não corresponde ao pacote e ao código conferidos.');
await verifyExternalCaptures({externalTables:bundle.external});
for(const file of [...bundle.evidence.inputs,...bundle.evidence.copies])requireCutover(createHash('sha256').update(await readFile(join(root,file.file))).digest('hex')===file.sha256,'Cópia de recuperação alterada.');
for(const file of bundle.evidence.sources||[]){
 requireCutover(createHash('sha256').update(await readFile(join(root,file.file))).digest('hex')===file.sha256,'Código de recuperação alterado.');
 requireCutover(createHash('sha256').update(await readFile(file.source)).digest('hex')===file.sha256,'O código local mudou; refaça a preparação.');
}
const checks=[],check=(name,ok)=>{checks.push({name,passed:!!ok});requireCutover(ok,name);};
const ordered=tables=>Object.fromEntries(Object.entries(tables).map(([table,rows])=>[table,rows.map(cutoverHash).sort()]));
let db,restored;
try{
 db=await newCutoverRehearsal(bundle);const initial=ordered(await readCutoverRehearsal(db,bundle));console.log(JSON.stringify({phase:'loaded-captured-rows'}));
 try{await db.exec(companyCutoverSql(bundle));check('production-draft-blocked',false);}catch(error){await db.exec('rollback');check('production-draft-blocked',error.message.includes('somente local'));}
 check('blocked-draft-unchanged',cutoverHash(initial)===cutoverHash(ordered(await readCutoverRehearsal(db,bundle))));
 // Fail after earlier table writes have begun; transaction must restore all.
 await db.exec("create function cutover_test_fail() returns trigger language plpgsql as $$ begin raise exception 'injected-cutover-failure'; end $$; create trigger cutover_test_fail before insert on core_projects for each row execute function cutover_test_fail();");
 try{await executeCutoverRehearsal(db,bundle);check('atomic-failure',false);}catch(error){check('atomic-failure',error.message.includes('injected-cutover-failure'));}
 check('failure-full-rollback',cutoverHash(initial)===cutoverHash(ordered(await readCutoverRehearsal(db,bundle))));
 await db.exec('drop trigger cutover_test_fail on core_projects; drop function cutover_test_fail();');
 console.log(JSON.stringify({phase:'injected-failure-rolled-back'}));
 const after=await executeCutoverRehearsal(db,bundle);check('applied-dre-preserved',verifyRehearsalDre(after,bundle));
 console.log(JSON.stringify({phase:'applied-and-dre-verified'}));
 const afterHash=cutoverHash(ordered(after)),again=await executeCutoverRehearsal(db,bundle);check('idempotency',afterHash===cutoverHash(ordered(again)));
 check('one-receipt',(await db.query('select count(*)::int as count from company_cutover_private.runs')).rows[0].count===1);
 // Grants exist in this mirror to ensure it is RLS, not missing table grants,
 // that prevents browser roles from seeing either company's data.
 await db.exec('set role authenticated;');check('rls-authenticated',(await db.query('select * from company_app_data')).rows.length===0);await db.exec('reset role;');
 await db.exec('set role anon;');check('rls-anonymous',(await db.query('select * from company_app_data')).rows.length===0);await db.exec('reset role;');
 await db.exec('set role authenticated;');
 try{await db.query('select * from company_cutover_private.runs');check('private-recovery-denied',false);}catch(error){check('private-recovery-denied',error.code==='42501');}finally{await db.exec('reset role;');}
 // New writes invalidate retry and recovery; nothing may overwrite them.
 await db.exec("update core_projects set payload=coalesce(payload,'{}'::jsonb)||'{\"cutoverDrift\":true}'::jsonb where company_id='mrc';");
 const driftHash=cutoverHash(ordered(await readCutoverRehearsal(db,bundle)));
 try{await executeCutoverRehearsal(db,bundle);check('new-write-refused',false);}catch(error){check('new-write-refused',error.message.includes('divergente'));}
 check('new-write-preserved',driftHash===cutoverHash(ordered(await readCutoverRehearsal(db,bundle))));
 restored=await newCutoverRehearsal(bundle,{empty:true});const clean=await executeCutoverRehearsal(restored,bundle,{recovery:true});
 check('isolated-clean-restore',afterHash===cutoverHash(ordered(clean)));check('restored-dre-preserved',verifyRehearsalDre(clean,bundle));
 const repeat=await executeCutoverRehearsal(restored,bundle,{recovery:true});check('restore-idempotent',afterHash===cutoverHash(ordered(repeat)));
 // Recovery onto a populated database must not silently overwrite any row.
 try{await executeCutoverRehearsal(db,bundle,{recovery:true});check('restore-over-new-data-refused',false);}catch(error){check('restore-over-new-data-refused',error.message.includes('divergente'));}
 const proof={version:1,packageId:bundle.id,localOnly:true,remoteWrites:0,activationReady:false,passed:checks.every(row=>row.passed),checks,validationModel:'PGlite relational mirror with captured PK/FK and deny-by-default RLS; not production schema certification',dre:bundle.validation,externalFilesVerified:Object.keys(bundle.external).length,copiedFilesVerified:bundle.evidence.copies.length};
 await writeFile(join(output,'validation.json'),JSON.stringify(proof,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({passed:proof.passed,checks:checks.length,activationReady:false}));
}finally{await db?.close();await restored?.close();}
