-- Infrastructure only. Installing this migration does not split companies,
-- clean bank movements, activate access, or execute a staged payload.
create schema if not exists company_cutover_private;
revoke all on schema company_cutover_private from public,anon,authenticated,service_role;
create table if not exists company_cutover_private.runs (
 id text primary key,
 before_image jsonb not null,
 clean_image jsonb not null,
 mode text not null,
 applied_at timestamptz not null default now()
);
create table if not exists company_cutover_private.staged_runs (
 id text primary key check (id ~ '^[a-f0-9]{64}$'),
 package_id text not null check (package_id ~ '^[a-f0-9]{64}$'),
 payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
 payload_bytes bigint not null check (payload_bytes > 0),
 part_count integer not null check (part_count between 1 and 1024),
 approval jsonb not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 applied_at timestamptz
);
create table if not exists company_cutover_private.staged_parts (
 run_id text not null references company_cutover_private.staged_runs(id),
 ordinal integer not null check (ordinal between 0 and 1023),
 payload bytea not null check (octet_length(payload) between 1 and 393216),
 primary key (run_id,ordinal)
);
alter table company_cutover_private.runs enable row level security;
alter table company_cutover_private.staged_runs enable row level security;
alter table company_cutover_private.staged_parts enable row level security;
revoke all on all tables in schema company_cutover_private from public,anon,authenticated,service_role;
-- Deliberately no public functions or service_role staging API. Only the
-- privileged, reviewed migration channel can stage and execute these files.
