-- Reversão da 018 SÓ sem apropriações gravadas (são tratamento do ponto com
-- auditoria - não se apagam). Não toca na ARP (017) nem no legado (016).
do $$ begin
  if exists (select 1 from public.ponto_apropriacoes) then
    raise exception 'reversão da 018 recusada: já existem apropriações gravadas';
  end if;
end $$;
drop function if exists public.ponto_apropriacao_cancelar(text, uuid, text, text, integer);
drop function if exists public.ponto_apropriacao_salvar(text, uuid, text, date, timestamptz, timestamptz, text, text, text, text, integer);
drop table if exists public.ponto_apropriacoes_auditoria;
drop table if exists public.ponto_apropriacoes;
drop function if exists public.ponto_apropriacao_somente_pela_funcao();
comment on column public.ponto_eventos.obra_id is null;
comment on column public.ponto_marcacoes.obra_id is null;
notify pgrst, 'reload schema';
