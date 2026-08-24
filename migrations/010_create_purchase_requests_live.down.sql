-- Rollback da primeira escrita transacional real de Fase 2. O blob legado
-- (data.solicitacoesCompra) permanece intacto e continua sendo a fonte de
-- verdade operacional - remover esta tabela não afeta nenhum comando real.
drop table if exists public.purchase_requests;
notify pgrst,'reload schema';
