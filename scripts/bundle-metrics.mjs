import {readdir, readFile, stat, writeFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import path from "node:path";

const root = path.resolve("dist");
const assets = path.join(root, "assets");
const files = await readdir(assets);
const rows = [];
for (const name of files.filter(file => /\.(js|css)$/.test(file))) {
  const file = path.join(assets, name);
  const bytes = (await stat(file)).size;
  const gzipBytes = gzipSync(await readFile(file)).length;
  rows.push({name, bytes, gzipBytes});
}
rows.sort((a, b) => b.gzipBytes - a.gzipBytes);
const totals = rows.reduce((sum, item) => ({
  bytes: sum.bytes + item.bytes,
  gzipBytes: sum.gzipBytes + item.gzipBytes,
}), {bytes: 0, gzipBytes: 0});
const report = {generatedAt: new Date().toISOString(), totals, assets: rows};
await writeFile("bundle-metrics.json", `${JSON.stringify(report, null, 2)}\n`);
console.table(rows.map(item => ({
  arquivo: item.name,
  "kB gzip": (item.gzipBytes / 1024).toFixed(2),
})));
console.log(`Total JS/CSS gzip: ${(totals.gzipBytes / 1024).toFixed(2)} kB`);
if (rows.some(item => item.name.endsWith(".js") && item.gzipBytes > 600 * 1024)) {
  console.error("Um chunk JavaScript ultrapassou o limite de 600 kB gzip.");
  process.exitCode = 1;
}
