// @vitest-environment node
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {it,expect} from 'vitest';
const up=readFileSync(new URL('../migrations/024_private_legacy_audit_archive.up.sql',import.meta.url),'utf8'),down=readFileSync(new URL('../migrations/024_private_legacy_audit_archive.down.sql',import.meta.url),'utf8');
it('moves the same immutable relation, invalidates warm writers, isolates reads and refuses recombination',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.audit_events(id uuid primary key default gen_random_uuid(),company_id text not null,payload jsonb not null default '{}');
 create function public.prevent_audit_event_mutation() returns trigger language plpgsql as $$begin raise exception 'append-only';end$$;
 create trigger audit_events_no_update before update on audit_events for each row execute function prevent_audit_event_mutation();
 create trigger audit_events_no_delete before delete on audit_events for each row execute function prevent_audit_event_mutation();
 create function public.warm_audit_writer() returns void language plpgsql set search_path=public as $$begin insert into audit_events(company_id,payload)values('arcd','{"before":"mixed"}');end$$;
 select warm_audit_writer();grant all on audit_events to service_role;
 select set_config('marcell.audit_archive_rows',(select count(*)::text from audit_events),false),set_config('marcell.audit_archive_md5',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from audit_events t),false);`);
 const oid=(await db.query("select 'public.audit_events'::regclass::oid as oid")).rows[0].oid;
 await db.exec(up);
 expect((await db.query("select 'company_cutover_private.legacy_audit_events'::regclass::oid as oid")).rows[0].oid).toBe(oid);
 expect((await db.query('select count(*)::int as n from public.audit_events')).rows[0].n).toBe(0);
 await db.exec('select warm_audit_writer()');
 expect((await db.query('select count(*)::int as n from public.audit_events')).rows[0].n).toBe(1);
 expect((await db.query('select count(*)::int as n from company_cutover_private.legacy_audit_events')).rows[0].n).toBe(1);
 await expect(db.exec("insert into company_cutover_private.legacy_audit_events(company_id)values('arcd')")).rejects.toThrow('immutable');
 await expect(db.exec('truncate company_cutover_private.legacy_audit_events')).rejects.toThrow('immutable');
 await expect(db.exec("update company_cutover_private.legacy_audit_events set company_id='mrc'")).rejects.toThrow('append-only');
 await expect(db.exec('delete from company_cutover_private.legacy_audit_events')).rejects.toThrow('append-only');
 await db.exec(up);
 await db.exec('set role service_role');
 await expect(db.query('select * from company_cutover_private.legacy_audit_events')).rejects.toThrow('permission denied');
 expect((await db.query('select count(*)::int as n from public.audit_events')).rows[0].n).toBe(1);
 await db.exec('reset role');
 await expect(db.exec(down)).rejects.toThrow('recombination refused');
 }finally{await db.close();}
},30000);
