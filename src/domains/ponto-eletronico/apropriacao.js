// APROPRIAÇÃO da jornada por obra - tratamento do ponto, FORA da ARP. Puro.
//
// A batida guarda a obra de CAPTURA (onde o aparelho estava) e nunca muda.
// A apropriação diz a qual obra cada INTERVALO de trabalho é atribuído; um
// funcionário pode ter várias obras no mesmo dia. Corrigir a apropriação
// nunca altera a marcação fiscal original (ver migration 018).
//
// proporApropriacoes() é só uma SUGESTÃO a partir das batidas do dia; quem
// trata o ponto confirma (ponto-apropriacao-salvar) e pode corrigir depois.

// marcacoes: batidas de PONTO de UM funcionário num dia, cada uma com
// { eventId, marcadoEm, obraCapturaId }. Regra da sugestão:
//   - batida aberta + batida na MESMA obra  = entrada e saída nessa obra;
//   - batida aberta + batida em OUTRA obra  = foi para outra obra sem bater a
//     saída: o intervalo vai até a chegada e a nova batida abre outro;
//   - batida que sobra no fim do dia        = sem saída (vira aviso, não intervalo).
export function proporApropriacoes(marcacoes) {
  const ordenadas = [...(marcacoes || [])]
    .filter(m => m && m.marcadoEm && m.obraCapturaId)
    .sort((a, b) => String(a.marcadoEm).localeCompare(String(b.marcadoEm)));
  const intervalos = [];
  const avisos = [];
  let aberta = null;
  for (const m of ordenadas) {
    if (!aberta) { aberta = m; continue; }
    intervalos.push({
      inicio: aberta.marcadoEm, fim: m.marcadoEm, obraApropriadaId: aberta.obraCapturaId, origem: "proposta_capturas",
      eventos: [aberta.eventId, m.eventId],
      mudouDeObra: m.obraCapturaId !== aberta.obraCapturaId,
    });
    aberta = m.obraCapturaId === aberta.obraCapturaId ? null : m;
  }
  if (aberta) avisos.push({ tipo: "sem_saida", eventId: aberta.eventId, marcadoEm: aberta.marcadoEm, obraCapturaId: aberta.obraCapturaId });
  return { intervalos, avisos };
}

// Validação de um intervalo antes de ir ao banco (o banco confere de novo,
// incluindo a sobreposição com outros intervalos do funcionário).
export function validarApropriacao(a) {
  const erros = [];
  if (!String(a?.employeeId || "").trim()) erros.push("informe o funcionário");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a?.data || ""))) erros.push("data no formato AAAA-MM-DD");
  const ini = Date.parse(a?.inicio), fim = Date.parse(a?.fim);
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) erros.push("início e fim precisam ser data/hora válidas");
  else if (!(fim > ini)) erros.push("o fim precisa ser depois do início");
  else if (fim - ini > 24 * 3_600_000) erros.push("intervalo maior que 24 horas");
  if (!String(a?.obraApropriadaId || "").trim()) erros.push("informe a obra apropriada");
  if (!["proposta_capturas", "manual"].includes(a?.origem || "manual")) erros.push("origem inválida");
  if (a?.id && !String(a?.motivo || "").trim()) erros.push("informe o motivo da alteração");
  return { ok: erros.length === 0, erros };
}
