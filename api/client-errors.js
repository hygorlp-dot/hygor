const buckets = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 12;
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

const allowed = (ip, now = Date.now()) => {
  const current = buckets.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= LIMIT;
};

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0];
  if (!allowed(ip)) return res.status(429).json({ error: "Limite de diagnósticos atingido." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const diagnostic = {
    reference: redact(body.reference).slice(0, 40),
    message: redact(body.message),
    pathname: redact(body.pathname).slice(0, 180),
    errorStack: redact(body.errorStack),
    componentStack: redact(body.componentStack),
    recordedAt: new Date().toISOString(),
  };
  console.error("[ARCD_CLIENT_ERROR]", JSON.stringify(diagnostic));
  return res.status(202).json({ ok: true });
}
