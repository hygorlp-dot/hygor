import fs from 'node:fs';
import postgres from 'postgres';
if(process.env.VERCEL_ENV!=='production'){
 process.stdout.write('company-cutover: infraestrutura automática ignorada fora de produção.\n');
 process.exit(0);
}
if(!process.env.POSTGRES_URL_NON_POOLING)throw Error('company-cutover: POSTGRES_URL_NON_POOLING ausente.');
const sql=postgres(process.env.POSTGRES_URL_NON_POOLING,{ssl:'require',max:1,connect_timeout:20,idle_timeout:5});
try{
 await sql.unsafe(fs.readFileSync(new URL('../migrations/023_company_cutover_private_journal.up.sql',import.meta.url),'utf8'));
 process.stdout.write('company-cutover: diário privado preparado; nenhum dado operacional foi migrado.\n');
}finally{await sql.end({timeout:2});}
