const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value.trim() : "";
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cappedPercent = value => Math.max(0, Math.min(100, number(value)));
const active = item => !["cancelado", "cancelled", "estornado", "reversed"].includes(text(item?.status).toLowerCase());
const byNewest = (a, b) => String(b?.data || b?.date || "").localeCompare(String(a?.data || a?.date || ""));

function receivedAmount(measurement = {}) {
  const receipts = list(measurement.recebimentos).filter(active);
  if (receipts.length) return receipts.reduce((sum, receipt) => sum + number(receipt.valor), 0);
  return number(measurement.valorRecebido);
}

function measurementPayments(measurements) {
  return measurements.flatMap(measurement => {
    const receipts = list(measurement.recebimentos).filter(active);
    if (receipts.length) {
      return receipts.map((receipt, index) => ({
        domain: "payment",
        payload: {
          id: text(receipt.id) || `recebimento-${measurement.id}-${index}`,
          description: text(measurement.descricao) || text(measurement.competencia) || "Recebimento de medição",
          amount: number(receipt.valor),
          dueDate: text(receipt.data) || text(measurement.dataPagamento) || text(measurement.dataVencimento),
          clientStatus: "Recebido",
        },
      }));
    }
    const amount = receivedAmount(measurement);
    return amount > 0 ? [{
      domain: "payment",
      payload: {
        id: `recebimento-${measurement.id}`,
        description: text(measurement.descricao) || text(measurement.competencia) || "Recebimento de medição",
        amount,
        dueDate: text(measurement.dataPagamento) || text(measurement.dataVencimento),
        clientStatus: "Recebido",
      },
    }] : [];
  }).slice(0, 40);
}

/**
 * Monta somente o contrato editorial do Portal do Cliente. Nenhum array
 * financeiro operacional, custo, colaborador, conciliação ou dado bancário
 * atravessa esta fronteira.
 */
export function buildClientPortalPublicationRows({ data = {}, projectId, publishedAt = new Date().toISOString() } = {}) {
  const obraId = String(projectId || "");
  const obra = list(data.obras).find(item => String(item?.id) === obraId);
  if (!obra) throw new Error("Obra não encontrada para publicação.");

  const portal = obra.portalCliente || {};
  const plano = list(data.planos).find(item => String(item?.obraId) === obraId);
  const tasks = list(plano?.tarefas).filter(item => !item?.titulo).slice(0, 50);
  const progress = tasks.length
    ? Math.round(tasks.reduce((sum, item) => sum + cappedPercent(item?.progresso), 0) / tasks.length)
    : 0;
  const reports = list(data.rdos)
    .filter(item => String(item?.obraId) === obraId && ["concluido", "concluído"].includes(text(item?.status).toLowerCase()))
    .sort(byNewest)
    .slice(0, 12);
  const measurements = list(data.medicoes)
    .filter(item => String(item?.obraId) === obraId && active(item))
    .sort((a, b) => String(a?.competencia || "").localeCompare(String(b?.competencia || "")))
    .slice(0, 30);
  const measured = measurements.reduce((sum, item) => sum + number(item?.valorPrevisto), 0);
  const paid = measurements.reduce((sum, item) => sum + receivedAmount(item), 0);
  const contractOriginal = number(obra.contractValue);

  const rows = [{
    domain: "project_summary",
    payload: {
      name: text(obra.name) || "Obra",
      coverImage: text(obra.capaUrl),
      currentPhase: text(obra.status),
      progress,
      estimatedCompletion: text(obra.contractEnd),
      lastUpdate: publishedAt,
    },
  }];

  if (portal.publicarCronograma !== false) {
    for (const item of tasks) {
      rows.push({
        domain: "timeline",
        payload: {
          id: text(item.id),
          phase: text(item.nome) || text(item.descricao) || "Etapa",
          clientStatus: cappedPercent(item.progresso) >= 100 ? "Concluído" : "Em andamento",
          plannedStart: text(item.inicio),
          plannedEnd: text(item.fim),
          progress: cappedPercent(item.progresso),
          lastUpdate: publishedAt,
        },
      });
    }
  }

  for (const report of reports) {
    rows.push({
      domain: "weekly_update",
      payload: {
        id: text(report.id),
        period: text(report.data),
        summary: text(report.descricao) || `Diário ${text(report.codigo) || "da obra"} publicado`,
        progress,
        publishedAt,
        authorName: "Equipe ARCD",
      },
    });
  }

  if (portal.publicarFotos !== false) {
    const photos = reports.flatMap(report => list(report.fotos)
      .filter(photo => photo?.publicarCliente !== false && text(photo?.clientUrl || photo?.url))
      .map((photo, index) => ({
        domain: "media",
        payload: {
          id: text(photo.id) || `foto-${report.id}-${index}`,
          type: "image",
          clientUrl: text(photo.clientUrl || photo.url),
          clientThumbnailUrl: text(photo.clientThumbnailUrl || photo.thumbnailUrl),
          caption: text(photo.legenda) || text(report.descricao) || "Registro da obra",
          date: text(report.data),
          phase: text(photo.etapa),
          environment: text(photo.ambiente),
          category: text(photo.categoria) || "obra",
          authorName: "Equipe ARCD",
        },
      }))).slice(0, 24);
    rows.push(...photos);
  }

  if (portal.publicarFinanceiro) {
    rows.push({
      domain: "financial_summary",
      payload: {
        id: `resumo-${obraId}`,
        contractOriginal,
        approvedChanges: 0,
        contractCurrent: contractOriginal,
        measured,
        approved: measured,
        paid,
        openAmount: Math.max(0, measured - paid),
        balanceToMeasure: Math.max(0, contractOriginal - measured),
        asOf: publishedAt.slice(0, 10),
      },
    });
    for (const item of measurements) {
      const received = receivedAmount(item);
      rows.push({
        domain: "measurement",
        payload: {
          id: text(item.id),
          number: text(item.numeroParcela) || text(item.descricao) || text(item.competencia) || "Medição",
          period: text(item.competencia),
          description: text(item.descricao),
          clientStatus: received >= number(item.valorPrevisto) && number(item.valorPrevisto) > 0 ? "Recebida" : received > 0 ? "Recebida parcialmente" : "Em aberto",
          percentage: cappedPercent(item.percentualAcumulado || item.percentualPeriodo),
          clientAmount: number(item.valorPrevisto),
          dueDate: text(item.dataVencimento),
          publishedAt,
        },
      });
    }
    rows.push(...measurementPayments(measurements));
  }

  if (portal.publicarDocumentos !== false) {
    rows.push(...list(obra.documentosOneDrive)
      .filter(document => document?.publicarCliente === true && text(document?.clientUrl || document?.url))
      .slice(0, 30)
      .map((document, index) => ({
        domain: "document",
        payload: {
          id: text(document.id) || `documento-${index}`,
          title: text(document.nome) || "Documento",
          category: text(document.categoria) || "Documento da obra",
          version: text(document.versao),
          clientStatus: "Publicado",
          publishedAt,
          clientUrl: text(document.clientUrl || document.url),
        },
      })));
  }

  return rows;
}
