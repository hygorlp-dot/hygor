// Gera UMA fase mínima, sem executar SQL nem acessar credenciais.
// Uso: node scripts/homologacao/prepare-schema.mjs audit|finance [diretorio]
// Somente as fontes efetivamente revistas e aplicadas na homologação entram
// neste catálogo. O lote amplo e a tentativa audit com RPC não são gerados.
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const root=fileURLToPath(new URL('../../',import.meta.url));
const phases={
  audit:{name:'homologacao_audit_minimal',source:'scripts/homologacao/sql/audit-minimal.sql'},
  finance:{name:'homologacao_finance_minimal',source:'scripts/homologacao/sql/finance-minimal.sql'},
};
const phase=phases[process.argv[2]];
if(!phase)throw new Error('Informe uma fase: audit ou finance. Nenhum SQL foi executado.');
const outdir=path.resolve(root,process.argv[3]||'.tools/homologacao-schema');
const sql=await readFile(path.join(root,phase.source),'utf8');
if(!sql.includes("ambiente='homologacao'")||!sql.includes('arcd_ambiente'))throw new Error('Marcador obrigatório ausente na fase.');
await mkdir(outdir,{recursive:true});
// São apenas artefatos locais do gerador antigo, nunca dados do banco.
for(const old of ['bootstrap.sql','manifest.json','homologacao_append_only_audit.sql','homologacao_append_only_audit.json']){
  await rm(path.join(outdir,old),{force:true});
}
await writeFile(path.join(outdir,`${phase.name}.sql`),sql);
const manifest={projectId:'ukkzpttnbyylkyujzwnv',name:phase.name,phase:process.argv[2],source:phase.source,
  sha256:crypto.createHash('sha256').update(sql).digest('hex'),bytes:Buffer.byteLength(sql),
  appliesAutomatically:false,applicationMustBeConfirmedRemotely:true};
await writeFile(path.join(outdir,`${phase.name}.json`),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({...manifest,outdir}));
