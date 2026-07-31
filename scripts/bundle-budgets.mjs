export const BUNDLE_BUDGETS = Object.freeze({
  totalGzipBytes: 1_200 * 1024,
  genericJavaScriptGzipBytes: 200 * 1024,
  staticMediaTotalBytes: 4 * 1024 * 1024,
  genericStaticMediaBytes: 1 * 1024 * 1024,
  chunks: [
    { label: "LegacyApp", pattern: /^LegacyApp-.*\.js$/, maxGzipBytes: 600 * 1024 },
    // Exceção temporária registrada: planilhas ainda dependem de exceljs.
    { label: "spreadsheet-tools", pattern: /^spreadsheet-tools-.*\.js$/, maxGzipBytes: 275 * 1024 },
    { label: "charts", pattern: /^charts-.*\.js$/, maxGzipBytes: 125 * 1024 },
    { label: "vendor", pattern: /^vendor-.*\.js$/, maxGzipBytes: 100 * 1024 },
    { label: "ClientPortalApp", pattern: /^ClientPortalApp-.*\.js$/, maxGzipBytes: 50 * 1024 },
  ],
  media: [
    { label: "vídeo de fundo do login", pattern: /^(?:media\/)?login-background(?:-[\w]+)?\.(webm|mp4)$/i, maxBytes: 3 * 1024 * 1024 },
  ],
});

export function evaluateBundleBudgets({ totals, assets, media = [] }) {
  const violations = [];
  if (totals.gzipBytes > BUNDLE_BUDGETS.totalGzipBytes) {
    violations.push(`Total JS/CSS gzip ${totals.gzipBytes} excede ${BUNDLE_BUDGETS.totalGzipBytes}.`);
  }

  for (const asset of assets.filter(item => item.name.endsWith(".js"))) {
    const budget = BUNDLE_BUDGETS.chunks.find(item => item.pattern.test(asset.name));
    const maxGzipBytes = budget?.maxGzipBytes ?? BUNDLE_BUDGETS.genericJavaScriptGzipBytes;
    if (asset.gzipBytes > maxGzipBytes) {
      violations.push(`${asset.name} (${asset.gzipBytes}) excede o orçamento de ${maxGzipBytes} bytes gzip.`);
    }
  }

  const mediaTotalBytes = media.reduce((sum, item) => sum + item.bytes, 0);
  if (mediaTotalBytes > BUNDLE_BUDGETS.staticMediaTotalBytes) {
    violations.push(`Mídia estática ${mediaTotalBytes} excede ${BUNDLE_BUDGETS.staticMediaTotalBytes} bytes.`);
  }
  for (const asset of media) {
    const budget = BUNDLE_BUDGETS.media.find(item => item.pattern.test(asset.name));
    const maxBytes = budget?.maxBytes ?? BUNDLE_BUDGETS.genericStaticMediaBytes;
    if (asset.bytes > maxBytes) {
      violations.push(`${asset.name} (${asset.bytes}) excede o orçamento de ${maxBytes} bytes de mídia.`);
    }
  }

  return {
    limits: {
      totalGzipBytes: BUNDLE_BUDGETS.totalGzipBytes,
      genericJavaScriptGzipBytes: BUNDLE_BUDGETS.genericJavaScriptGzipBytes,
      staticMediaTotalBytes: BUNDLE_BUDGETS.staticMediaTotalBytes,
      genericStaticMediaBytes: BUNDLE_BUDGETS.genericStaticMediaBytes,
      chunks: BUNDLE_BUDGETS.chunks.map(({ label, maxGzipBytes }) => ({ label, maxGzipBytes })),
      media: BUNDLE_BUDGETS.media.map(({ label, maxBytes }) => ({ label, maxBytes })),
    },
    violations,
  };
}
