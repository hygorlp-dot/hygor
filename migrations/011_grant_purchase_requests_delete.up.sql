-- Concede DELETE em purchase_requests (migration 010) só para
-- service_role - necessário para limpar um registro de teste criado ao
-- verificar a escrita ao vivo em produção (24/08/2026, ver
-- docs/BLUEPRINT_CONCORRENCIA_TRAVA.md). A tabela continua sem DELETE para
-- qualquer outro papel (revoke all já cobria isso desde a 010); esta
-- migration só adiciona o privilégio ao papel que já tinha select/insert/
-- update.
--
-- Nota de escopo: isto NÃO cria um comando de exclusão de solicitação de
-- compra no aplicativo - nenhuma ação em api/data.js expõe DELETE nesta
-- tabela hoje. É só o grant no banco, usado uma vez, manualmente, para a
-- limpeza descrita acima.
grant delete on table public.purchase_requests to service_role;

notify pgrst,'reload schema';
