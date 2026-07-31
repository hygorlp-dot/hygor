const MAX_FIELD = 4_000;

const redact = value => String(value || "")
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [oculto]")
  .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, "[token oculto]")
  .replace(/\b(token|access_token|senha|password|pin)\s*[:=]\s*[^\s,;]+/gi, "$1=[oculto]")
  .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF oculto]")
  .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[e-mail oculto]")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, MAX_FIELD);

export const sanitizeClientError = body => ({
  reference: redact(body?.reference).slice(0, 40),
  message: redact(body?.message),
  pathname: redact(body?.pathname).slice(0, 180),
  errorStack: redact(body?.errorStack),
  componentStack: redact(body?.componentStack),
  recordedAt: new Date().toISOString(),
});
