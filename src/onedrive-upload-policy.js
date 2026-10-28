export const LICENSING_UPLOAD_MAX_MB=20;
export const LICENSING_UPLOAD_MAX_BYTES=LICENSING_UPLOAD_MAX_MB*1024*1024;

// 8 × 320 KiB = 2.5 MiB. O Microsoft Graph exige que fragmentos
// intermediários sejam múltiplos de 320 KiB e a Vercel limita o corpo de
// cada Function a 4.5 MB; em base64 este fragmento fica abaixo desse teto.
export const ONEDRIVE_UPLOAD_GRANULARITY_BYTES=320*1024;
export const ONEDRIVE_UPLOAD_CHUNK_BYTES=8*ONEDRIVE_UPLOAD_GRANULARITY_BYTES;

// Uploads pequenos continuam no fluxo simples para reduzir round-trips.
export const ONEDRIVE_DIRECT_UPLOAD_MAX_BYTES=2*1024*1024;
