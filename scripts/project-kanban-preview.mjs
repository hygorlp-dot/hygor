import { preview } from "vite";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { profile, data as fixture } from "./fixtures/workflow-priorities-data.mjs";
import { applyOperationalCommand } from "../src/domains/sync/operational-commands.js";
import { ENGINEERING_COMMAND_TYPES } from "../src/domains/projetos/commands.js";
import { validateEngineeringScope } from "../server/engineering-project-policy.js";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const statePath = "artifacts/projetos/demo-state.json";
const port = Number(process.env.MARCELL_PROJECT_PREVIEW_PORT || 4202);
let data;
try { data = JSON.parse(await readFile(statePath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; data = structuredClone(fixture); }
if (!data.usuarios?.some(user => user.id === profile.id)) throw new Error("O snapshot não pertence ao ambiente fictício de projetos.");
// Relocate only the bundled demonstration files when moving this isolated
// preview to its dedicated port. User links to external services are untouched.
for (const project of data.engineeringProjects || []) for (const entry of [...(project.links || []), ...(project.revisions || [])]) {
  if (entry.url?.startsWith("http://127.0.0.1:4201/exemplos-projetos/casa-alameda/")) entry.url = entry.url.replace("http://127.0.0.1:4201/", `http://127.0.0.1:${port}/`);
}
let tail = Promise.resolve();
const server = await preview({
  build: { outDir: "artifacts/projetos/build" },
  preview: { host: "127.0.0.1", port, strictPort: true },
  plugins: [{ name: "project-kanban-local-only", configurePreviewServer(vite) {
    vite.middlewares.use("/api", async (request, response) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      const json = (status, result) => { response.statusCode = status; response.end(JSON.stringify(result)); };
      if (request.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(request.headers.origin)) return json(403, { error: "Origem não permitida nesta prévia local." });
      try {
        let raw = "";
        for await (const chunk of request) { raw += chunk; if (raw.length > 1024 * 1024) return json(413, { error: "Requisição muito grande." }); }
        const body = raw ? JSON.parse(raw) : {};
        if (body.action === "operational-command") {
          const run = async () => {
            if (!ENGINEERING_COMMAND_TYPES.has(body.command?.type)) return json(403, { error: "Esta instância permite testar somente os comandos de projetos." });
            const command = { ...body.command, actorId: profile.id, actorRole: profile.role, actorName: profile.nome, now: new Date().toISOString() };
            const scope = validateEngineeringScope({ user: profile, data, command });
            if (!scope.ok) return json(403, { error: scope.error });
            const result = applyOperationalCommand(data, command);
            if (!result.ok) return json(409, result);
            await mkdir("artifacts/projetos", { recursive: true });
            await writeFile(`${statePath}.tmp`, JSON.stringify(result.data, null, 2));
            await rename(`${statePath}.tmp`, statePath);
            data = result.data;
            json(200, { ...result, updatedAt: new Date().toISOString() });
          };
          const pending = tail.then(run, run);
          tail = pending.catch(() => {});
          await pending;
          return;
        }
        if (["save", "save-sections"].includes(body.action)) return json(200, { ok: true, data, updatedAt: new Date().toISOString() });
        if (body.action === "profiles") return json(200, { usuarios: [profile], precisaSetup: false });
        json(200, { ok: true, items: [], bases: [], presencas: [], accessToken: "local-project-preview", refreshToken: "local-project-preview", usuario: profile, data, updatedAt: new Date().toISOString() });
      } catch (error) { console.error("Prévia de projetos:", error.message); if (!response.writableEnded) json(500, { error: "Falha no ambiente de teste local. Consulte o terminal." }); }
    });
  } }],
});
console.log(`Projetos e Kanban locais: http://127.0.0.1:${port}`);
console.log(`Dados fictícios, preservados em ${statePath}. Login: ${profile.email} / piloto-local.`);
