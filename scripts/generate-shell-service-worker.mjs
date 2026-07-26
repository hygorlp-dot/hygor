import { generateSW } from "workbox-build";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const SHELL_CACHE_CONFIG = Object.freeze({
  globDirectory: "dist",
  globPatterns: [
    "index.html",
    "manifest.webmanifest",
    "logo-arcd.png",
    "assets/index-*.js",
    "assets/index-*.css",
    "assets/rolldown-runtime-*.js",
    "assets/vendor-*.js",
  ],
  globIgnores: ["**/*.map", "sw.js", "workbox-*.js"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  swDest: "dist/sw-shell-poc.js",
  clientsClaim: false,
  skipWaiting: false,
  runtimeCaching: [],
});

export async function generateShellServiceWorker({ cwd = process.cwd() } = {}) {
  const distDirectory = resolve(cwd, SHELL_CACHE_CONFIG.globDirectory);
  if (!existsSync(distDirectory)) {
    throw new Error("Build ausente. Execute npm run build antes de gerar a POC PWA.");
  }

  return generateSW({
    ...SHELL_CACHE_CONFIG,
    globDirectory: distDirectory,
    swDest: resolve(cwd, SHELL_CACHE_CONFIG.swDest),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { count, size, warnings } = await generateShellServiceWorker();
  if (warnings.length) console.warn(warnings.join("\n"));
  console.log(`POC PWA gerada: ${count} ativos públicos, ${size} bytes precacheados.`);
}
