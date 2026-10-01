-- Reversão da 017 SÓ enquanto a ARP estiver vazia. Com qualquer evento ou
-- registro fiscal gravado, a reversão se recusa: registro de ponto não se
-- apaga (Portaria 671/2021). Os dados legados da 016 nunca são tocados.
do $$ begin
  if exists (select 1 from public.ponto_eventos) or exists (select 1 from public.ponto_arp_registros) then
    raise exception 'reversão da 017 recusada: a ARP já tem registros de ponto';
  end if;
end $$;

drop function if exists public.ponto_arp_registrar(text, uuid, jsonb, jsonb);
drop function if exists public.ponto_arp_texto_fiscal(uuid, bigint, uuid, text, text, text, text, text, uuid, bigint, text, text);
drop table if exists public.ponto_arp_registros;
drop table if exists public.ponto_arp_contadores;
drop table if exists public.ponto_eventos;
drop table if exists public.ponto_tempo_verificacoes;
drop trigger if exists ponto_dispositivos_protegido on public.ponto_dispositivos;
alter table public.ponto_dispositivos drop constraint if exists ponto_dispositivos_estabelecimento_fk;
alter table public.ponto_dispositivos drop constraint if exists ponto_dispositivos_seq_local_ck;
alter table public.ponto_dispositivos drop column if exists estabelecimento_id;
alter table public.ponto_dispositivos drop column if exists ultima_sequencia_local;
alter table public.ponto_dispositivos drop column if exists ultimo_hash_local;
alter table public.ponto_marcacoes drop constraint if exists ponto_marcacoes_formato_legado_ck;
alter table public.ponto_marcacoes drop column if exists record_format_version;
drop table if exists public.ponto_estabelecimento_obras;
drop table if exists public.ponto_estabelecimentos;
drop function if exists public.ponto_dispositivo_protegido();
drop function if exists public.ponto_arp_contador_protegido();
drop function if exists public.ponto_arp_somente_pela_funcao();
drop function if exists public.ponto_arp_imutavel();
notify pgrst, 'reload schema';
