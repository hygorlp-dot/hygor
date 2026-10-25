// Renovação oportunista exclusiva da simulação. Usa a medição NTP e a tabela
// existentes; não ajusta relógio, tolerância, NSR ou confiança da evidência.
import { avaliarVerificacao } from "./fonte-hora.js";

const URL_HOMOLOGACAO = "https://ukkzpttnbyylkyujzwnv.supabase.co";
const RENOVAR_APOS_MS = 18 * 60 * 60 * 1000;
const REPETIR_APOS_MS = 15 * 60 * 1000;
const TRAVA_HOMOLOGACAO = 210251901;

// transacao recebe uma função query(texto, parametros) da conexão PostgreSQL
// real. O lock e a leitura das tentativas ficam na MESMA transação.
export function criarRenovacaoHoraHomologacao({ ambiente, modo, supabaseUrl, transacao, verificarHoraNtp }) {
  if (ambiente !== "homologacao" || modo !== "oportunista" || supabaseUrl !== URL_HOMOLOGACAO) return undefined;
  let emCurso = null;
  const executar = async () => {
    try {
      return await transacao(async query => {
        const [marcador] = await query("select ambiente from public.arcd_ambiente where id=true");
        if (marcador?.ambiente !== "homologacao") return { status: "ambiente_nao_confirmado" };
        const [trava] = await query("select pg_try_advisory_xact_lock($1) as adquirida", [TRAVA_HOMOLOGACAO]);
        if (!trava?.adquirida) return { status: "em_curso" };
        // criado_em usa o relógio do banco. verificado_em pertence ao host
        // medido e pode estar errado; não pode controlar o limite de tentativas.
        const [idades] = await query(`select
          extract(epoch from (clock_timestamp() - (select max(criado_em) from public.ponto_tempo_verificacoes))) * 1000 as tentativa_ms,
          extract(epoch from (clock_timestamp() - (select max(criado_em) from public.ponto_tempo_verificacoes where ok))) * 1000 as boa_ms`);
        const [ultimaBoa] = await query("select servidor, verificado_em, offset_ms, incerteza_ms, ok from public.ponto_tempo_verificacoes where ok order by verificado_em desc limit 1");
        const confiavel = avaliarVerificacao(ultimaBoa ? {
          ok: ultimaBoa.ok, servidor: ultimaBoa.servidor, verificadoEm: ultimaBoa.verificado_em,
          offsetMs: ultimaBoa.offset_ms, incertezaMs: ultimaBoa.incerteza_ms,
        } : null, Date.now()).confiavel;
        if (confiavel && idades?.boa_ms != null && Number(idades.boa_ms) >= 0 && Number(idades.boa_ms) < RENOVAR_APOS_MS) return { status: "atual" };
        if (idades?.tentativa_ms != null && Number(idades.tentativa_ms) < REPETIR_APOS_MS) return { status: "aguardando" };
        let v;
        try { v = await verificarHoraNtp(); }
        catch { v = { ok: false, servidor: "ntp.br", verificadoEm: new Date().toISOString(), erro: "Verificação NTP indisponível." }; }
        await query(`insert into public.ponto_tempo_verificacoes
          (fonte, servidor, verificado_em, offset_ms, atraso_ms, incerteza_ms, estrato, ok, erro)
          values ('ntp', $1, $2, $3, $4, $5, $6, $7, $8)`, [
          String(v.servidor || "ntp.br").slice(0, 200), v.verificadoEm,
          v.ok ? v.offsetMs : null, v.ok ? v.atrasoMs : null, v.ok ? v.incertezaMs : null,
          v.ok ? v.estrato : null, !!v.ok, v.erro ? String(v.erro).slice(0, 500) : null,
        ]);
        // A falha NTP também COMMITA uma tentativa ok=false. Não usa exceção
        // para desfazer a tentativa e provocar novas consultas a cada sync.
        return { status: v.ok ? "renovada" : "falhou" };
      });
    } catch {
      // Mantém a fonte canônica anterior (ou sem confiança se vencida).
      // Não devolve detalhes da conexão nem transforma falha em medição boa.
      console.warn("Renovação NTP de homologação indisponível.");
      return { status: "indisponivel" };
    }
  };
  return () => {
    emCurso ??= executar().finally(() => { emCurso = null; });
    return emCurso;
  };
}
