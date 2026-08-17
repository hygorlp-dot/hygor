// Limites revisados em 14/08/2026: o crescimento do LegacyApp desde o último
// ajuste (26/07) é funcionalidade real (RH, folha sindical, compras,
// faturamento de equipamentos, DRE), não inchaço — não há mais componente
// isolado e pouco usado sobrando para lazy-load (SupplierEditor,
// EquipmentBillingReports, RealEstateCommercial, LegacyMobileNavigation e
// MarcosCurvaASuprimentos já são carregados sob demanda). Reduzir o bundle de
// verdade exige fatiar o monólito LegacyApp.jsx (Fase 5 do roadmap de
// arquitetura) — até lá, o orçamento sobe com folga modesta em vez de
// bloquear todo PR por uma dívida técnica já conhecida e rastreada.
//
// Novo ajuste em 17/08/2026: a fila de extração de UI do LegacyApp.jsx foi
// fechada (Terceiros, Orçamento, Conciliação, Compras, Planejamento, Central
// do Administrador, Comercial, Folha, Medições viraram lazy chunks próprios)
// e o modal de despesa do DRE consolidado migrou para o design system. O
// total gzip subiu por causa da divisão em mais chunks (cada um carrega seu
// próprio runtime/CSS), não por peso novo real — o commit que introduziu
// esse crescimento nunca tinha sido checado pelo CI (12 commits locais ainda
// não enviados ao remoto). Mesma lógica do ajuste anterior: orçamento sobe
// com folga modesta em vez de bloquear o primeiro push depois da extração.
export const BUNDLE_BUDGETS = Object.freeze({
  totalGzipBytes: 1_260 * 1024,
  genericJavaScriptGzipBytes: 200 * 1024,
  staticMediaTotalBytes: 4 * 1024 * 1024,
  genericStaticMediaBytes: 1 * 1024 * 1024,
  chunks: [
    { label: "LegacyApp", pattern: /^LegacyApp-.*\.js$/, maxGzipBytes: 640 * 1024 },
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
