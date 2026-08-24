-- Achado do agente de auditoria (24/08/2026, ver
-- docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): a migration 011 concedeu DELETE
-- em purchase_requests a service_role "só para limpar um registro de
-- teste" (comentário original), mas scripts/apply-purchase-requests-
-- live.mjs reaplicava a migration 011 em TODO deploy de produção - o
-- privilégio nunca foi revogado, ficando permanente por omissão, apesar
-- de documentado como uso único.
--
-- Revogar aqui e remover a migration 011 da cadeia recorrente do script
-- (mesma rodada). `revoke` de um privilégio que já não está concedido não
-- é erro em Postgres - idempotente, seguro rodar mais de uma vez, mesmo
-- padrão de todas as outras migrations desta sessão.
--
-- A ação purchase-requests-delete-test-row (api/data.js), cuja única
-- razão de existir era este grant, é removida na mesma rodada - sem
-- DELETE concedido, ela só falharia com erro de permissão se chamada de
-- novo.
revoke delete on table public.purchase_requests from service_role;

notify pgrst,'reload schema';
