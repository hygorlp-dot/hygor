// ARP - Armazenamento de Registro de Ponto (REP-P, Portaria 671/2021).
//
// FRONTEIRA (docs/REP-P-ARQUITETURA.md, seção "ARP"):
//   entra:  eventos formato 2 de UM aparelho autenticado (handler.js);
//   aqui:   1. ingresso    - forma (evento.js) e aparelho certo
//           2. validação   - hash local recalculado de cada evento
//           3. idempotência, cadeia local, NSR por estabelecimento, hash
//              fiscal e gravação imutável - TUDO dentro de uma transação do
//              banco (função ponto_arp_registrar, migration 017). O NSR não é
//              calculado em JavaScript.
//   sai:    resultado POR EVENTO: { eventId, status, nsr, fiscalHash, ... }.
//   também: consulta de registros e leitura ordenada por NSR (base da
//           exportação AFD da Fase 2 - ainda não implementada).
// A ARP não conhece tela nem app: só banco, fonte de hora e regras puras.
import { calcularHashLocal, ehEventoV2, validarEvento } from "../../../src/domains/ponto-eletronico/evento.js";

// Status em que o evento está definitivamente gravado (o aparelho pode marcar
// como sincronizado). Qualquer outro mantém o evento pendente no aparelho.
export const STATUS_ACEITOS = Object.freeze(["registrado", "ja_registrado", "acesso_registrado", "acesso_ja_registrado"]);
export const MAX_EVENTOS_POR_LOTE = 500;

const texto = v => String(v ?? "").trim();

export function criarArp({ db, company, fonteHora, hashFn }) {
  // 1 + 2: ingresso e validação. Para no primeiro evento inválido (os
  // seguintes dependem dele na cadeia local).
  async function prepararLote(dispositivo, eventos) {
    const ordenados = [...eventos].sort((a, b) => Number(a?.localSequence) - Number(b?.localSequence));
    const validos = [], recusados = [];
    let parou = false;
    for (const e of ordenados) {
      const base = { eventId: texto(e?.eventId) || null, localSequence: Number(e?.localSequence) || null };
      if (parou) { recusados.push({ ...base, status: "nao_processado", motivo: "um evento anterior do lote não foi aceito" }); continue; }
      const v = ehEventoV2(e) ? validarEvento(e) : { ok: false, erros: ["formatVersion deve ser 2"] };
      let motivo = v.ok ? null : v.erros.join("; ");
      if (!motivo && texto(e.deviceId).toLowerCase() !== String(dispositivo.id).toLowerCase()) motivo = "evento de outro aparelho";
      if (!motivo && (await calcularHashLocal(e, hashFn)) !== texto(e.localHash).toLowerCase()) motivo = "hash local não confere (evento alterado depois de criado)";
      if (motivo) { parou = true; recusados.push({ ...base, status: "invalido", motivo }); continue; }
      validos.push(e);
    }
    return { validos, recusados };
  }

  return {
    async registrarEventos({ dispositivo, eventos }) {
      const lote = (Array.isArray(eventos) ? eventos : []).slice(0, MAX_EVENTOS_POR_LOTE);
      const { validos, recusados } = await prepararLote(dispositivo, lote);
      const hora = await fonteHora.evidencia();
      let resultados = [];
      if (validos.length) {
        const { data, error } = await db.rpc("ponto_arp_registrar", {
          p_company_id: company, p_dispositivo_id: dispositivo.id, p_eventos: validos, p_hora: hora,
        });
        if (error) throw error;
        resultados = (data || []).map(r => ({
          eventId: r.event_id, localSequence: r.local_sequence === null ? null : Number(r.local_sequence), status: r.status,
          nsr: r.nsr === null || r.nsr === undefined ? null : Number(r.nsr), fiscalHash: r.fiscal_hash || null,
          estabelecimentoId: r.estabelecimento_id || null, gravadoEm: r.gravado_em || null, motivo: r.motivo || null,
        }));
      }
      return { resultados: [...resultados, ...recusados], hora };
    },

    // Evento já gravado (para a foto chegar depois e ser conferida).
    async localizarEvento(eventId) {
      const { data, error } = await db.from("ponto_eventos").select("event_id,dispositivo_id,obra_id,marcado_em,foto_sha256")
        .eq("company_id", company).eq("event_id", texto(eventId)).maybeSingle();
      if (error) throw error;
      return data;
    },

    // Consulta (tela do ARCD): eventos do período com NSR fiscal quando houver.
    async consultar({ obraId, de, ate, employeeId }) {
      let q = db.from("ponto_eventos").select("*").eq("company_id", company).gte("marcado_em", de).lte("marcado_em", ate);
      if (texto(obraId)) q = q.eq("obra_id", texto(obraId));
      if (texto(employeeId)) q = q.eq("employee_id", texto(employeeId));
      const { data: eventos, error } = await q.order("marcado_em", { ascending: false }).limit(2000);
      if (error) throw error;
      const ids = (eventos || []).map(e => e.event_id);
      const fiscais = new Map();
      if (ids.length) {
        const { data: regs, error: e2 } = await db.from("ponto_arp_registros").select("event_id,nsr,fiscal_hash,estabelecimento_id,gravado_em")
          .eq("company_id", company).in("event_id", ids);
        if (e2) throw e2;
        (regs || []).forEach(r => fiscais.set(r.event_id, r));
      }
      return (eventos || []).map(e => ({ evento: e, fiscal: fiscais.get(e.event_id) || null }));
    },

    // Leitura em ordem de NSR de um estabelecimento - o que a exportação AFD
    // (Fase 2) vai percorrer. Não gera AFD.
    async registrosEmOrdemDeNsr({ estabelecimentoId, deNsr = 1, ateNsr = Number.MAX_SAFE_INTEGER }) {
      const { data, error } = await db.from("ponto_arp_registros").select("*")
        .eq("company_id", company).eq("estabelecimento_id", texto(estabelecimentoId)).gte("nsr", deNsr).lte("nsr", ateNsr)
        .order("nsr", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  };
}
