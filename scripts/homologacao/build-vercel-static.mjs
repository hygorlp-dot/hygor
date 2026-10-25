// Prepara o build Vite e a ponte SNTP na Vercel, sem segredos ou cron.
// A API de gestão continua no Supabase isolado, por rewrites explícitos.
import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = path.join(root, "dist");
const outdir = path.resolve(root, process.argv[2] || ".tools/homologacao-vercel");
const target = path.join(outdir, "static");
await readFile(path.join(source, "index.html"));
const viteManifest = JSON.parse(await readFile(path.join(source, ".vite/manifest.json"), "utf8"));
await mkdir(target, { recursive: true });
const names = [];
async function collect(directory, prefix = "") {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = path.posix.join(prefix, item.name);
    if (item.isSymbolicLink()) throw new Error("Link simbólico recusado no artefato.");
    if (item.name.startsWith(".")) continue;
    if (item.isDirectory()) await collect(path.join(directory, item.name), name);
    else if (item.isFile() && !name.endsWith(".map")) names.push(name);
  }
}
// Publica somente os arquivos deste build. Diretórios reaproveitados podem
// conservar chunks de compilações antigas, que não pertencem ao candidato.
await collect(path.join(root, "public"));
for (const entry of Object.values(viteManifest)) {
  names.push(entry.file, ...(entry.css || []), ...(entry.assets || []));
}
names.push("index.html");
const uniqueNames = [...new Set(names)];
names.splice(0, names.length, ...uniqueNames);
for (const name of names) {
  await mkdir(path.dirname(path.join(target, name)), { recursive: true });
  await copyFile(path.join(source, name), path.join(target, name));
}
const configuration = {
  framework: null, buildCommand: null, installCommand: null, outputDirectory: null,
  functions: { "api/homologacao-time.js": { maxDuration: 10 } },
  regions: ["gru1"],
  headers: [{ source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }],
  rewrites: [
    { source: "/api/data", destination: "https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao" },
    { source: "/api/upload", destination: "https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao/upload" },
    { source: "/cliente/:route*", destination: "/index.html" },
    { source: "/aceite-pedido", destination: "/index.html" },
  ],
};
await writeFile(path.join(target, "vercel.json"), JSON.stringify(configuration, null, 2) + "\n");
await build({
  entryPoints: [path.join(root, "scripts/homologacao/time-function.mjs")],
  outfile: path.join(target, "api/homologacao-time.js"),
  bundle: true, platform: "node", target: "node24", format: "esm", minify: true,
});
await writeFile(path.join(target, "package.json"), JSON.stringify({
  name: "ponto-homologacao", private: true, type: "module", engines: { node: "24.x" },
}, null, 2) + "\n");
names.push("vercel.json", "package.json", "api/homologacao-time.js");
const files = [];
for (const file of names.sort()) {
  const buffer = await readFile(path.join(target, file));
  files.push({ file, sha: crypto.createHash("sha1").update(buffer).digest("hex"), size: buffer.length });
}
const bytes = files.reduce((sum, file) => sum + file.size, 0);
if (bytes > 90_000_000) throw new Error("Artefato excede a margem do plano gratuito.");
const manifest = { teamId: "team_poBZ5I1rwStzhvD73ar22b7v", projectId: "prj_W7s5zALWmMuV4Wt5WePSz8ABAefp", source: target, bytes, files };
await writeFile(path.join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(path.join(outdir, "deploy-payload.json"), JSON.stringify({ teamId: manifest.teamId, requestBody: {
  name: "ponto-homologacao", project: manifest.projectId, target: "production", files,
  projectSettings: { framework: null, buildCommand: null, installCommand: null, outputDirectory: null, nodeVersion: "24.x" },
} }, null, 2) + "\n");
console.log(JSON.stringify({ outdir, files: files.length, bytes, endpoint: "https://ponto-homologacao.vercel.app/api/data" }, null, 2));
