const MAX_MESSAGE_LENGTH = 280;

type ErrorWithMessage = { message?: unknown };

export type LocalErrorDiagnostic = {
  message: string;
  reference: string;
  text: string;
};

const errorMessage = (value: unknown): unknown => (
  typeof value === "object" && value !== null && "message" in value
    ? (value as ErrorWithMessage).message
    : value
);

export const redactErrorMessage = (value: unknown): string => String(value || "Erro sem mensagem.")
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [oculto]")
  .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, "[token oculto]")
  .replace(/\b(token|access_token|senha|password|pin)\s*[:=]\s*[^\s,;]+/gi, "$1=[oculto]")
  .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF oculto]")
  .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[e-mail oculto]")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, MAX_MESSAGE_LENGTH);

const fingerprint = (value: string): string => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `ARCD-${(hash >>> 0).toString(36).toUpperCase()}`;
};

export const buildLocalErrorDiagnostic = (
  error: unknown,
  { pathname = "" }: { pathname?: string } = {},
): LocalErrorDiagnostic => {
  const message = redactErrorMessage(errorMessage(error));
  const reference = fingerprint(`${pathname.split("?")[0]}|${message}`);
  return {
    message,
    reference,
    text: `Referência ${reference}\nErro: ${message}`,
  };
};
