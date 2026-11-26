import { minify } from "terser";

const selectedChunks = new Set(["charts", "spreadsheet-tools", "LegacyApp"]);

export function minifyVendorChunks() {
  return {
    name: "minify-vendor-chunks",
    apply: "build",
    renderChunk: {
      order: "post",
      async handler(code, chunk, output) {
        // O leitor ESM do PDF.js pode herdar o nome do arquivo do worker no chunk.
        // Selecione pelo módulo para manter o worker separado e intacto.
        const pdfReader = chunk.moduleIds.some(id =>
          id.replaceAll("\\", "/").endsWith("/node_modules/pdfjs-dist/build/pdf.mjs"));
        if (!selectedChunks.has(chunk.name) && !pdfReader) return;

        // A compressão adicional reduz estes chunks no gzip do CI.
        // O restante do build continua com a minificação padrão do Vite.
        const result = await minify(code, {
          compress: { passes: 2 },
          module: output.format === "es",
          safari10: true,
          sourceMap: Boolean(output.sourcemap),
        });
        return { code: result.code, map: result.map ?? null };
      },
    },
  };
}
