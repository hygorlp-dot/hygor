-- Preparado localmente; NÃO executado na nuvem.
-- Coletar apenas durante uma futura conferência explicitamente autorizada.
-- Nenhum comando DDL/DML, credencial, linha de usuário ou conteúdo operacional.
begin isolation level repeatable read read only;

with recursive scope(oid) as (
 select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p')
 and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='company_id' and not a.attisdropped)
 union
 select fk.conrelid from pg_constraint fk join scope parent on parent.oid=fk.confrelid where fk.contype='f'
), catalog as (
 select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity,c.relforcerowsecurity,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'kind',k.contype,'deferrable',k.condeferrable,'initiallyDeferred',k.condeferred,'validated',k.convalidated,'definition',pg_get_constraintdef(k.oid)) order by k.conname),'[]') from pg_constraint k where k.conrelid=c.oid) as constraints,
  (select coalesce(jsonb_agg(jsonb_build_object('name',i.indexrelid::regclass::text,'valid',i.indisvalid,'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)) order by i.indexrelid::regclass::text),'[]') from pg_index i where i.indrelid=c.oid) as indexes,
  (select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) order by t.tgname),'[]') from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
  (select coalesce(jsonb_agg(to_jsonb(p) order by p.policyname),'[]') from pg_policies p where p.schemaname=n.nspname and p.tablename=c.relname) as policies,
  (select coalesce(jsonb_agg(jsonb_build_object('grantee',g.grantee,'privilege',g.privilege_type,'grantable',g.is_grantable) order by g.grantee,g.privilege_type),'[]') from information_schema.role_table_grants g where g.table_schema=n.nspname and g.table_name=c.relname) as grants
 from scope s join pg_class c on c.oid=s.oid join pg_namespace n on n.oid=c.relnamespace
)
select jsonb_build_object('serverVersion',current_setting('server_version'),'transactionReadOnly',current_setting('transaction_read_only'),'capturedAt',transaction_timestamp(),'catalog',jsonb_agg(to_jsonb(catalog) order by schema_name,table_name)) as cutover_catalog from catalog;

-- Identidades globais e referências de fora do conjunto: não assumir que
-- trocar company_id basta quando uma FK usa apenas um UUID global.
select ns.nspname as child_schema,child.relname as child_table,
 target_ns.nspname as parent_schema,parent.relname as parent_table,
 fk.conname,pg_get_constraintdef(fk.oid) as definition
from pg_constraint fk join pg_class child on child.oid=fk.conrelid
join pg_namespace ns on ns.oid=child.relnamespace
join pg_class parent on parent.oid=fk.confrelid
join pg_namespace target_ns on target_ns.oid=parent.relnamespace
where fk.contype='f' and (ns.nspname='public' or target_ns.nspname='public')
order by child_schema,child_table,fk.conname;

rollback;
