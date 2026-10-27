// Contrato de migração para motor facial MIT. Não altera o motor ativo.
// A decisão biométrica só é aceita quando identificação e prova de vida
// retornam explicitamente sucesso. Vetores de motores diferentes nunca se misturam.
export const MOTORES_FACIAIS = Object.freeze({
  LEGADO: "mobilefacenet-192-v1",
  MIT: "facenet-512-mit-v1",
});
export const DIMENSOES = Object.freeze({
  [MOTORES_FACIAIS.LEGADO]: 192,
  [MOTORES_FACIAIS.MIT]: 512,
});
export function validarTemplateFacial(template, motor) {
  if (!template || template.motor !== motor || !Array.isArray(template.vetor)) return false;
  const n = DIMENSOES[motor];
  return !!n && template.vetor.length === n &&
    template.vetor.every(Number.isFinite) &&
    Math.hypot(...template.vetor) > 0;
}
export function avaliarResultadoMotorMit(resultado, templates = []) {
  if (!resultado || resultado.ok !== true || resultado.livenessOk !== true ||
      resultado.spoofOk !== true || !resultado.personnelId) {
    return { ok: false, motivo: "reconhecimento_ou_prova_de_vida_reprovados" };
  }
  const correspondentes = templates.filter(t =>
    t.employeeId === resultado.personnelId && validarTemplateFacial(t, MOTORES_FACIAIS.MIT));
  if (correspondentes.length !== 1) return { ok: false, motivo: "template_incompativel_ou_ausente" };
  if (!Number.isFinite(resultado.matchScore)) return { ok: false, motivo: "score_invalido" };
  // O SDK aplica seus limiares calibrados; nunca reutilizar o 0,60 do modelo antigo.
  return { ok: true, employeeId: resultado.personnelId, motor: MOTORES_FACIAIS.MIT,
    matchScore: resultado.matchScore };
}
