import {readdir, readFile, stat, writeFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import path from "node:path";
import { evaluateBundleBudgets } from "./bundle-budgets.mjs";

const root = path.resolve("dist");
const assets = path.join(root, "assets");
const files = await readdir(assets);
const mediaDirectory = path.join(root, "media");
const mediaFiles = await readdir(mediaDirectory).catch(() => []);
const rows = [];
const mediaRows = [];
for (const name of files.filter(file => /\.(js|css)$/.test(file))) {
  const file = path.join(assets, name);
  const bytes = (await stat(file)).size;
  const gzipBytes = gzipSync(await readFile(file)).length;
  rows.push({name, bytes, gzipBytes});
}
for (const name of files.filter(file => /\.(avif|gif|jpe?g|mp4|png|svg|webm|webp)$/i.test(file))) {
  const bytes = (await stat(path.join(assets, name))).size;
  mediaRows.push({name, bytes});
}
for (const name of mediaFiles.filter(file => /\.(avif|gif|jpe?g|mp4|png|svg|webm|webp)$/i.test(file))) {
  const bytes = (await stat(path.join(mediaDirectory, name))).size;
  mediaRows.push({name: `media/${name}`, bytes});
}
rows.sort((a, b) => b.gzipBytes - a.gzipBytes);
mediaRows.sort((a, b) => b.bytes - a.bytes);
const totals = rows.reduce((sum, item) => ({
  bytes: sum.bytes + item.bytes,
  gzipBytes: sum.gzipBytes + item.gzipBytes,
}), {bytes: 0, gzipBytes: 0});
const mediaTotals = mediaRows.reduce((sum, item) => ({bytes: sum.bytes + item.bytes}), {bytes: 0});
const budget = evaluateBundleBudgets({ totals, assets: rows, media: mediaRows });
const report = {generatedAt: new Date().toISOString(), totals, assets: rows, media: {totals: mediaTotals, assets: mediaRows}, budget};
await writeFile("bundle-metrics.json", `${JSON.stringify(report, null, 2)}\n`);
console.table(rows.map(item => ({
  arquivo: item.name,
  "kB gzip": (item.gzipBytes / 1024).toFixed(2),
})));
console.log(`Total JS/CSS gzip: ${(totals.gzipBytes / 1024).toFixed(2)} kB`);
console.table(mediaRows.map(item => ({arquivo: item.name, "kB mídia": (item.bytes / 1024).toFixed(2)})));
console.log(`Total mídia estática: ${(mediaTotals.bytes / 1024).toFixed(2)} kB`);
if (budget.violations.length) {
  console.error(`Orçamento de bundle reprovado:\n- ${budget.violations.join("\n- ")}`);
  process.exitCode = 1;
}
