import { minify } from "terser";

export function minifyLegacyApp() {
  return {
    name: "minify-legacy-app",
    apply: "build",
    renderChunk: {
      order: "post",
      async handler(code, chunk, output) {
        if (chunk.name !== "LegacyApp") return;

        // A compressão adicional reduz o módulo principal no gzip do CI.
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
