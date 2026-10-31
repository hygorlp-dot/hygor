import { criarFilaAutomatica } from "../../domains/conciliacao/automation.js";

export function buildPilotCases(data, mode, scope = {}, automationRows) {
  if (mode === "compras") return (data.pedidos || []).filter(p => !p.deletedAt && p.status !== "cancelado" && (!scope.workId || String(p.obraId) === String(scope.workId))).map(p => ({
    id: `purchase:${p.id}`, sourceId: p.id, title: p.numero || "Pedido sem número", date: p.data || "", prediction: "review", reason: "Conferir condições, recebimentos, notas e pagamentos existentes.",
    fingerprint: JSON.stringify([p,(data.notasFiscais||[]).filter(note=>String(note.pedidoId)===String(p.id)),(data.cotacoes||[]).find(quote=>String(quote.id)===String(p.cotacaoId||""))]),
  }));
  const rows = new Map((automationRows || criarFilaAutomatica(data)).map(row => [String(row.tr.id), row]));
  const archived = new Set((data.extratos || []).filter(item => item.status === "arquivado").map(item => String(item.id)));
  return (data.transacoes || []).filter(tr => !archived.has(String(tr.extratoId)) && (!scope.accountId || String(tr.contaBancariaId || "unassigned") === scope.accountId)
    && (["pendente", "parcial"].includes(tr.status) || (tr.status === "conciliado" && tr.automacaoConciliacao))).map(tr => {
      const row = rows.get(String(tr.id));
      const executed = tr.status === "conciliado" && Boolean(tr.automacaoConciliacao);
      const prediction = executed ? "executed" : row?.automatica ? "proposed" : "review";
      const candidate = executed ? { tipo: tr.vinculo?.tipo, entidadeId: tr.vinculo?.id, pagamentoId: tr.vinculo?.pagamentoId, titulo: "Vínculo automático registrado", contraparte: tr.automacaoConciliacao.contraparte?.nome || "", motivos: tr.automacaoConciliacao.evidencias || [] } : row?.analise?.melhorCandidata;
      return { id: `bank:${tr.id}`, sourceId: tr.id, title: tr.descricao, date: tr.data || "", transaction: tr, candidate,
        prediction, reason: executed ? "Conferência posterior da automação registrada; não executa novamente." : row?.motivo || "Movimento parcial ou sem correspondência segura.",
        fingerprint: JSON.stringify([tr, candidate,prediction,row?.motivo]),
      };
    });
}

export function pilotReview(item, { decision, reason, elapsedMs }, now = new Date().toISOString()) {
  if (!["agree", "correct", "unknown"].includes(decision)) throw new Error("Escolha o resultado da conferência.");
  if (decision !== "agree" && !String(reason || "").trim()) throw new Error("Registre o motivo do ajuste ou da dúvida.");
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("Tempo de conferência inválido.");
  return { fingerprint: item.fingerprint, decision, reason: String(reason || "").trim().slice(0, 1000), elapsedMs: Math.round(elapsedMs), reviewedAt: now };
}

export function pilotMetrics(cases, notes) {
  const reviewed = cases.flatMap(item => notes[item.id]?.fingerprint === item.fingerprint ? [{ ...item, assessment: notes[item.id] }] : []);
  const conclusive = reviewed.filter(item => item.assessment.decision !== "unknown");
  const accuracy = prediction => {
    const sample = conclusive.filter(item => item.prediction === prediction);
    return { sample: sample.length, rate: sample.length ? sample.filter(item => item.assessment.decision === "agree").length / sample.length : null };
  };
  return { total: cases.length, reviewed: reviewed.length, conclusive: conclusive.length,
    corrections: reviewed.filter(item => item.assessment.decision === "correct").length,
    inconclusive: reviewed.length - conclusive.length, automaticProposed: cases.filter(item => item.prediction === "proposed").length,
    automaticExecuted: cases.filter(item => item.prediction === "executed").length,
    proposedAgreement: accuracy("proposed"), executedAccuracy: accuracy("executed"),
    averageMs: reviewed.length ? Math.round(reviewed.reduce((sum, item) => sum + item.assessment.elapsedMs, 0) / reviewed.length) : null,
  };
}
