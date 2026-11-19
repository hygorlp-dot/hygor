-- Never recombine mixed legacy snapshots with a company's current audit.
-- Recover the verified integral backup in an isolated database instead.
do $hold$ begin
 if to_regclass('company_cutover_private.legacy_audit_events') is not null then
  raise exception 'Private legacy audit rollback requires isolated backup recovery; automatic recombination refused';
 end if;
end $hold$;
