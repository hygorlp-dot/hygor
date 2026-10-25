// @vitest-environment node
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';

const migration=await readFile(new URL('../scripts/homologacao/sql/finance-minimal.sql',import.meta.url),'utf8');
const rollback=await readFile(new URL('../scripts/homologacao/sql/finance-minimal.down.sql',import.meta.url),'utf8');
const ids={title:'00000000-0000-4000-8000-000000000001',bank:'00000000-0000-4000-8000-000000000002',settlement:'00000000-0000-4000-8000-000000000003'};
let pg;

describe('fase financeira mínima e isolada de homologação',()=>{
  beforeAll(async()=>{
    pg=new PGlite();
    await pg.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.arcd_ambiente(id boolean primary key,ambiente text); insert into public.arcd_ambiente values(true,'producao');");
  });
  afterAll(async()=>{await pg?.close();});

  it('recusa outro ambiente antes de criar tabelas e aceita repetição no destino isolado',async()=>{
    await expect(pg.exec(migration)).rejects.toThrow('Banco de homologação não confirmado');
    await pg.exec('rollback;');
    expect((await pg.query("select to_regclass('public.financial_titles') as table_name")).rows[0].table_name).toBeNull();
    await pg.exec("update public.arcd_ambiente set ambiente='homologacao';");
    await pg.exec(migration);
    await pg.exec(migration);
    const rows=(await pg.query("select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'arcd_ambiente'")).rows;
    expect(rows).toHaveLength(9);
    expect(rows.every(row=>row.relrowsecurity&&!row.anon_access&&!row.authenticated_access)).toBe(true);
    const [guard]=(await pg.query("select p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute from pg_proc p where p.proname='financial_guard_source_reconciliation'")).rows;
    expect(guard).toEqual({prosecdef:false,anon_execute:false,server_execute:true});
    expect((await pg.query("select to_regprocedure('public.financial_execute_command(text,text,jsonb)') as command_rpc")).rows[0].command_rpc).toBeNull();
  });

  it('preserva a guarda de conflito real e permite somente o snapshot esperado do DRE',async()=>{
    await pg.query("insert into financial_titles(id,company_id,origin_type,origin_id,direction,original_amount,created_by) values($1,'qa','teste','title','payable',100,'qa')",[ids.title]);
    await pg.query("insert into bank_transactions(id,company_id,booking_date,direction,amount,metadata) values($1,'qa','2026-10-20','out',100,'{\"legacyId\":\"qa-bank\"}')",[ids.bank]);
    await pg.query("insert into settlements(id,company_id,title_id,bank_transaction_id,amount,settlement_date,created_by) values($1,'qa',$2,$3,100,'2026-10-20','qa')",[ids.settlement,ids.title,ids.bank]);
    await pg.query("insert into reconciliation_links(company_id,bank_transaction_id,title_id,settlement_id,amount,confirmed_by) values('qa',$1,$2,$3,100,'qa')",[ids.bank,ids.title,ids.settlement]);
    await pg.exec('set role service_role;');
    await expect(pg.query("select financial_guard_source_reconciliation('qa','[{\"id\":\"qa-bank\",\"status\":\"conciliado\"}]',false)")).rejects.toThrow('Movimento já gerido pelo DRE ou pela API financeira');
    await expect(pg.query("select financial_guard_source_reconciliation('qa','[{\"id\":\"mt7l9lt5xrta\",\"status\":\"conciliado\"}]',true)")).rejects.toThrow('Composição do aporte');
    await pg.query("select financial_guard_source_reconciliation('qa','[{\"id\":\"new-json-bank\",\"status\":\"conciliado\"}]',false)");
    const snapshot="insert into financial_events(company_id,event_type,source_type,source_id,effective_date,payload,created_by) values('qa','dre_snapshot','dre_projection','2026-10:mes:qa','2026-10-01','{\"active\":true}','qa') on conflict(company_id,event_type,source_type,source_id) do update set payload=excluded.payload";
    await pg.query(snapshot);await pg.query(snapshot);
    expect((await pg.query("select count(*)::integer as total from financial_events")).rows[0].total).toBe(1);
    await expect(pg.query('delete from financial_events')).rejects.toThrow('permission denied');
    await pg.exec('reset role;');
  });

  it('não reverte tabelas usadas e reverte sem cascade apenas o banco vazio',async()=>{
    await expect(pg.exec(rollback)).rejects.toThrow('contém registros');
    await pg.exec('rollback;');
    expect((await pg.query("select count(*)::integer as total from financial_events")).rows[0].total).toBe(1);
    const empty=new PGlite();
    try{
      await empty.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.arcd_ambiente(id boolean primary key,ambiente text); insert into public.arcd_ambiente values(true,'homologacao');");
      await empty.exec(migration);await empty.exec(rollback);await empty.exec(rollback);
      expect((await empty.query("select to_regclass('public.financial_events') as table_name")).rows[0].table_name).toBeNull();
    }finally{await empty.close();}
  });
});
