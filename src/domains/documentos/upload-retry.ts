export type UploadResult = {
  ok: boolean;
  status?: number;
  error?: string;
  message?: string;
  retryable?: boolean;
  [key: string]: unknown;
};

type Upload = (attempt: number) => UploadResult | undefined | Promise<UploadResult | undefined>;
type Delay = (milliseconds: number) => void | Promise<void>;

const RETRYABLE_STATUS = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
const wait: Delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export const isRetryableUploadFailure = (failure?: UploadResult): boolean => {
  if (failure?.retryable === true) return true;
  const status = Number(failure?.status || 0);
  if (RETRYABLE_STATUS.has(status)) return true;
  return !status && /network|fetch|conex[aã]o|temporar/i.test(String(failure?.error || failure?.message || ""));
};

export async function uploadWithRetry(
  upload: Upload,
  { maxAttempts = 3, delay = wait }: { maxAttempts?: number; delay?: Delay } = {},
): Promise<UploadResult & { uploadAttempts: number }> {
  const totalAttempts = Math.max(1, Number(maxAttempts) || 1);
  let lastFailure: UploadResult = { ok: false, error: "Não foi possível enviar a evidência." };

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const result = await upload(attempt);
      if (result?.ok) return { ...result, uploadAttempts: attempt };
      lastFailure = result || lastFailure;
    } catch (error) {
      lastFailure = { ok: false, error: error instanceof Error ? error.message : "Falha de rede ao enviar a evidência." };
    }

    if (attempt === totalAttempts || !isRetryableUploadFailure(lastFailure)) {
      return { ...lastFailure, uploadAttempts: attempt };
    }
    await delay(Math.min(1000, 250 * (2 ** (attempt - 1))));
  }

  return { ...lastFailure, uploadAttempts: totalAttempts };
}
