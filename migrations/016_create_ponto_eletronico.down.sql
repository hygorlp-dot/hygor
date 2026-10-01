-- Reversão de PONTO-001. ATENÇÃO: apaga as marcações de ponto registradas
-- pelo app - só rodar antes de o app entrar em uso real. Depois disso, as
-- marcações são registro legal (Portaria 671/2021) e não podem ser apagadas.
drop function if exists public.ponto_registrar_marcacoes(text, uuid, jsonb);
drop table if exists public.ponto_marcacoes;
drop function if exists public.ponto_marcacao_imutavel();
drop table if exists public.ponto_biometrias;
drop table if exists public.ponto_responsaveis;
drop table if exists public.ponto_pareamentos;
drop table if exists public.ponto_dispositivos;
