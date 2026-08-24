// Primeira escrita transacional real de Fase 2 (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md). Lógica pura (sem I/O) que
// transforma um registro de `data.solicitacoesCompra` (o formato do blob,
// server/attendance-command.js-style em português) na linha que vai para
// `purchase_requests` (migration 010). api/data.js chama isto depois que
// SOLICITACAO_COMPRA_SALVA já foi processado com sucesso no caminho
// existente - a gravação em si é melhor esforço, esta função só monta o
// objeto, não escreve nada.

const text = value => String(value ?? "").trim();
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : null;
const version = value => Number.isInteger(Number(value)) && Number(value) >= 0
  ? Number(value)
  : 0;

// Não inclui `created_at` de propósito: o upsert do Supabase só atualiza as
// colunas presentes no objeto no "on conflict do update" - omitir
// created_at preserva o valor original numa edição (a coluna usa o default
// `now()` só na primeira inserção) em vez de resetar a data de criação a
// cada SOLICITACAO_COMPRA_SALVA subsequente.
export const buildPurchaseRequestLiveRow = (companyId, record) => ({
  company_id: text(companyId),
  id: text(record?.id),
  request_number: text(record?.numero),
  project_id: text(record?.obraId),
  needed_by: date(record?.necessidade),
  priority: text(record?.prioridade) || "normal",
  notes: text(record?.observacao),
  source_version: version(record?.version),
  payload: record || {},
  updated_at: new Date().toISOString(),
});
