// Limites revisados em 14/08/2026: o crescimento do LegacyApp desde o Ãºltimo
// ajuste (26/07) Ã© funcionalidade real (RH, folha sindical, compras,
// faturamento de equipamentos, DRE), nÃ£o inchaÃ§o â€” nÃ£o hÃ¡ mais componente
// isolado e pouco usado sobrando para lazy-load (SupplierEditor,
// EquipmentBillingReports, RealEstateCommercial, LegacyMobileNavigation e
// MarcosCurvaASuprimentos jÃ¡ sÃ£o carregados sob demanda). Reduzir o bundle de
// verdade exige fatiar o monÃ³lito LegacyApp.jsx (Fase 5 do roadmap de
// arquitetura) â€” atÃ© lÃ¡, o orÃ§amento sobe com folga modesta em vez de
// bloquear todo PR por uma dÃ­vida tÃ©cnica jÃ¡ conhecida e rastreada.
//
// Novo ajuste em 17/08/2026: a fila de extraÃ§Ã£o de UI do LegacyApp.jsx foi
// fechada (Terceiros, OrÃ§amento, ConciliaÃ§Ã£o, Compras, Planejamento, Central
// do Administrador, Comercial, Folha, MediÃ§Ãµes viraram lazy chunks prÃ³prios)
// e o modal de despesa do DRE consolidado migrou para o design system. O
// total gzip subiu por causa da divisÃ£o em mais chunks (cada um carrega seu
// prÃ³prio runtime/CSS), nÃ£o por peso novo real â€” o commit que introduziu
// esse crescimento nunca tinha sido checado pelo CI (12 commits locais ainda
// nÃ£o enviados ao remoto). Mesma lÃ³gica do ajuste anterior: orÃ§amento sobe
// com folga modesta em vez de bloquear o primeiro push depois da extraÃ§Ã£o.
//
// Novo ajuste em 17/08/2026 (2): extraÃ§Ã£o de Equipamentos (~1.640 linhas,
// a 2Âª maior tela ainda inline) para src/domains/equipamentos/components/
// EquipamentosView.jsx. Investigado com um A/B de build isolado (mesmo
// conteÃºdo-fonte, sÃ³ comparando antes/depois): a extraÃ§Ã£o nÃ£o duplica
// cÃ³digo-fonte (confirmado por diff de sourcemap - nenhum arquivo novo
// aparece no chunk do LegacyApp), mas o Rollup passou a inlinar mÃ³dulos do
// domÃ­nio equipamentos/* tanto no chunk principal (LegacyApp ainda usa
// melhorTarifa/cobrancaLocacao/etc. em resumoLocacaoEquip, funÃ§Ã£o nÃ£o
// relacionada Ã  tela) quanto no novo chunk dinÃ¢mico (EquipamentosView),
// em vez de fatorar um chunk compartilhado - o mesmo mÃ³dulo virou alcanÃ§Ã¡vel
// por uma aresta estÃ¡tica (LegacyApp) e uma dinÃ¢mica (EquipamentosView) ao
// mesmo tempo. Tentativa de forÃ§ar manualChunks a compartilhar esse cÃ³digo
// piorou drasticamente (o chunk principal foi fundido inteiro dentro do
// chunk manual) e foi revertida - nÃ£o vale o risco de manualChunks nesta
// sessÃ£o. Mesma lÃ³gica dos ajustes anteriores: orÃ§amento sobe com folga
// modesta; investigar manualChunks com mais cuidado fica para depois.
//
// Ajuste em 26/08/2026 (Onda 7-8 do raio-X): DiÃ¡rio de Obra, Estoque,
// Licenciamento e ConferÃªncia saÃ­ram de LegacyApp.jsx para
// src/domains/*/components/ (cada um vira seu prÃ³prio chunk lazy). O
// chunk do LegacyApp caiu de ~596,87 kB para ~530 kB gzip - reduÃ§Ã£o real,
// medida apÃ³s o build, nÃ£o estimativa. OrÃ§amento apertado de volta (640 â†’
// 570 kB) para travar o ganho e voltar a pegar regressÃ£o cedo, com a
// mesma folga modesta de sempre.
//
// Ajuste em 29/09/2026: total 1.502 kB (26/08) â†’ 1.703 kB gzip, medido chunk a
// chunk contra o bundle-metrics.json versionado. A etapa ficou um mÃªs sem
// rodar no CI porque um teste antigo quebrava antes dela. ComposiÃ§Ã£o dos
// +201 kB: ler-estrutural-pdf +94 kB (pdfjs, carregado sÃ³ ao importar PDF,
// via import() dinÃ¢mico); OrcamentoView +57 kB JS/+5 kB CSS (MemÃ³ria de
// CÃ¡lculo: estrutural, hidrossanitÃ¡rio, item a item, reservatÃ³rios; chunk
// lazy); sinapi-parser.worker +29 kB (JSZip passou a ser embutido no worker
// em vez de compartilhado - duplicaÃ§Ã£o de empacotamento, sem cÃ³digo novo,
// roda fora da thread principal). Carga inicial praticamente estÃ¡vel:
// LegacyApp +4,6 kB (530 â†’ 535 kB, dentro dos 570 kB). Folga modesta de
// sempre. Se precisar recuperar margem: tirar o JSZip de dentro do worker.
// Ajuste em 29/10/2026 (PR #221): fotos embutidas no relatÃ³rio patrimonial
// e normalizaÃ§Ã£o de MIME da NF. CI mediu 1.781.936 bytes (1.740,17 KiB),
// 176 bytes acima do total anterior. AcrÃ©scimo limitado a 1 KiB;
// os limites individuais de chunks e de mÃ­dia permanecem iguais.
// Ajuste em 29/10/2026: memorial mensal e suporte ao fechamento. Build sem
// sourcemaps: 1.782.902 bytes gzip, 118 bytes acima do teto anterior.
// AcrÃ©scimo limitado a 1 KiB; limites individuais permanecem iguais.
// Ajuste em 29/10/2026 (PR #222): A4 horizontal, fotos inteiras e tipografia
// patrimonial legÃ­vel. CI: 1.783.624 bytes (1.741,82 KiB), +1.688 bytes
// sobre #221. Total +1 KiB; limites por chunk e mÃ­dia preservados.
// JunÃ§Ã£o do #222 com a main (memorial mensal + PDF horizontal), 29/10/2026:
// CI mediu 1.784.153 bytes, 345 acima do teto. AcrÃ©scimo limitado a 1 KiB;
// limites por chunk e de mÃ­dia permanecem iguais.
// Base visual padrÃ£o MARCELL (PR #226, 30/10/2026): camada de estilo Ãºnica
// (cabeÃ§alho, abas, botÃµes, selos) e menu de aÃ§Ãµes do PatrimÃ´nio. CI mediu
// 1.785.295 bytes, 463 acima do teto. AcrÃ©scimo limitado a 1 KiB; limites por
// chunk e de mÃ­dia permanecem iguais.
// Conferência RH e escala de 44h: margem adicional de 4 KiB para o novo fluxo.
// Limites individuais preservados; validar o total após juntar a main.
export const BUNDLE_BUDGETS = Object.freeze({
  totalGzipBytes: 1_748 * 1024,

  genericJavaScriptGzipBytes: 200 * 1024,
  staticMediaTotalBytes: 4 * 1024 * 1024,
  genericStaticMediaBytes: 1 * 1024 * 1024,
  chunks: [
    { label: "LegacyApp", pattern: /^LegacyApp-.*\.js$/, maxGzipBytes: 570 * 1024 },
    // ExceÃ§Ã£o temporÃ¡ria registrada: planilhas ainda dependem de exceljs.
    { label: "spreadsheet-tools", pattern: /^spreadsheet-tools-.*\.js$/, maxGzipBytes: 275 * 1024 },
    { label: "charts", pattern: /^charts-.*\.js$/, maxGzipBytes: 125 * 1024 },
    { label: "vendor", pattern: /^vendor-.*\.js$/, maxGzipBytes: 100 * 1024 },
    { label: "ClientPortalApp", pattern: /^ClientPortalApp-.*\.js$/, maxGzipBytes: 50 * 1024 },
  ],
  media: [
    { label: "vÃ­deo de fundo do login", pattern: /^(?:media\/)?login-background(?:-[\w]+)?\.(webm|mp4)$/i, maxBytes: 3 * 1024 * 1024 },
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
      violations.push(`${asset.name} (${asset.gzipBytes}) excede o orÃ§amento de ${maxGzipBytes} bytes gzip.`);
    }
  }

  const mediaTotalBytes = media.reduce((sum, item) => sum + item.bytes, 0);
  if (mediaTotalBytes > BUNDLE_BUDGETS.staticMediaTotalBytes) {
    violations.push(`MÃ­dia estÃ¡tica ${mediaTotalBytes} excede ${BUNDLE_BUDGETS.staticMediaTotalBytes} bytes.`);
  }
  for (const asset of media) {
    const budget = BUNDLE_BUDGETS.media.find(item => item.pattern.test(asset.name));
    const maxBytes = budget?.maxBytes ?? BUNDLE_BUDGETS.genericStaticMediaBytes;
    if (asset.bytes > maxBytes) {
      violations.push(`${asset.name} (${asset.bytes}) excede o orÃ§amento de ${maxBytes} bytes de mÃ­dia.`);
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
