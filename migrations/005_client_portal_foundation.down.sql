-- Rollback da fundação do Portal do Cliente. Execute somente se nenhuma
-- sessão ou publicação do portal tiver sido colocada em produção.
drop table if exists public.client_portal_publications;
drop table if exists public.client_portal_audit_events;
drop table if exists public.client_portal_sessions;
drop table if exists public.client_portal_project_memberships;
drop table if exists public.client_portal_users;
