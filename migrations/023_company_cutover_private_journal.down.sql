do $down$
begin
 if to_regclass('company_cutover_private.runs') is not null then
  if exists (select 1 from company_cutover_private.runs) then
   raise exception 'Há recibos de implantação; preservar imagens e histórico privado';
  end if;
 end if;
 if to_regclass('company_cutover_private.staged_runs') is not null then
  if exists (select 1 from company_cutover_private.staged_runs where applied_at is not null) then
   raise exception 'Há migração aplicada; não apagar a trilha de implantação';
  end if;
 end if;
end $down$;
drop table if exists company_cutover_private.staged_parts;
drop table if exists company_cutover_private.staged_runs;
drop table if exists company_cutover_private.runs;
-- Keep the schema: it can also contain recovery evidence from other rounds.
