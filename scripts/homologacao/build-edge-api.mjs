// Empacota o MESMO handler; somente o adaptador HTTP muda. Não acessa banco,
// conta Vercel, variáveis privadas ou API remota e não executa prebuild.
import { build } from "esbuild";
import { builtinModules } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../../", import.meta.url));
const outdir = path.resolve(root, process.argv[2] || ".tools/homologacao-edge");
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const version = name => lock.packages[`node_modules/${name}`].version;
const nodeModules = new Set(builtinModules.map(name => name.replace(/^node:/, "")));
const result = await build({
  absWorkingDir: root, entryPoints: { index: "scripts/homologacao/edge-entry.mjs" },
  outdir, bundle: true, splitting: true, format: "esm", platform: "node", target: "es2022",
  packages: "external", minify: true, sourcemap: false, metafile: true, write: false,
  define: { "process.env": "globalThis.__PONTO_HOMOLOG_ENV__" },
  outExtension: { ".js": ".mjs" }, logLevel: "silent",
  plugins: [{ name: "node-prefix", setup(b) {
    b.onResolve({ filter: /^[a-z][a-z0-9_/-]*$/ }, args => nodeModules.has(args.path) ? { path: `node:${args.path}`, external: true } : undefined);
  } }],
});
const files = result.outputFiles.map(file => ({ name: path.relative(outdir, file.path), content: file.text }));
files.push({ name: "postgres-runtime.mjs", content: `import driver from "npm:postgres@${version("postgres")}";\nexport default (connection, options = {}) => driver(connection, { ...options, prepare: false });\n` });
files.push({ name: "deno.json", content: JSON.stringify({ imports: {
  "@supabase/supabase-js": `npm:@supabase/supabase-js@${version("@supabase/supabase-js")}`,
  postgres: "./postgres-runtime.mjs",
} }, null, 2) + "\n" });
const bytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
if (bytes > 4_500_000) throw new Error("Artefato excede a margem do limite Edge. Deploy bloqueado.");
const git = args => promisify(execFile)("git", args, { cwd: root, encoding: "utf8" }).then(result => result.stdout.trim());
const commit = await git(["rev-parse", "HEAD"]);
const dirty = (await git(["status", "--porcelain"])).length > 0;
const manifest = { projectId: "ukkzpttnbyylkyujzwnv", functionName: "ponto-api-homologacao", commit, dirty, bytes,
  files: files.map(file => ({ name: file.name, sha256: crypto.createHash("sha256").update(file.content).digest("hex"), bytes: Buffer.byteLength(file.content) })),
  inputs: Object.keys(result.metafile.inputs).sort(),
};
await mkdir(outdir, { recursive: true });
for (const file of files) await writeFile(path.join(outdir, file.name), file.content);
await writeFile(path.join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(path.join(outdir, "deploy-payload.json"), JSON.stringify({ project_id: manifest.projectId, name: manifest.functionName, entrypoint_path: "index.mjs", import_map_path: "deno.json", verify_jwt: false, files }));
console.log(JSON.stringify({ outdir, commit, dirty, bytes, files: manifest.files }, null, 2));
