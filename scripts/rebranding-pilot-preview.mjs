import { createServer } from "vite";
import { profile, data as initialData } from "./fixtures/workflow-priorities-data.mjs";
import { applyOperationalCommand } from "../src/domains/sync/operational-commands.js";

// Local-only review server. All /api requests terminate in this process.
let data = structuredClone(initialData);
const server = await createServer({
  server:{ host:"127.0.0.1", port:Number(process.env.MARCELL_PREVIEW_PORT||4196), strictPort:true, watch:{ignored:["**/artifacts/**"]} },
  plugins:[{ name:"marcell-pilot-isolated-data", configureServer(vite) {
    vite.middlewares.use("/api", async (req, res) => {
      try {
        let raw = ""; for await (const chunk of req) raw += chunk;
        const body = raw ? JSON.parse(raw) : {};
        let result = req.url.startsWith("/microsoft/") ? { ok:false, connected:false } : { ok:true, items:[], bases:[], presencas:[] };
        if (body.action === "profiles") result = { usuarios:[profile], precisaSetup:false };
        else if (body.action === "ponto-equipe-obras") result = { ok:true, pessoas:[], limitacoes:[], obras:data.obras, dia:"2026-10-30", fuso:"America/Bahia", servidorMs:Date.parse("2026-10-30T15:00:00Z") };
        else if (body.action === "operational-command") {
          result = applyOperationalCommand(data, body.command);
          if (result.ok) data = result.data;
        } else if (["financial-dre-report","financial-company-dre-report"].includes(body.action)) result = { ok:true, current:null, history:[] };
        else if (body.action === "save-sections") data = { ...data, ...body.sections };
        else if (body.action === "save" && body.payload) data = body.payload;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ ...result, accessToken:"local-pilot", refreshToken:"local-pilot", usuario:profile, data, updatedAt:new Date().toISOString() }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok:false, error:"A prévia local não conseguiu processar esta operação." }));
      }
    });
  } }],
});
await server.listen();
console.log(`MARCELL com dados fictícios: http://127.0.0.1:${server.config.server.port}`);
console.log(`Acesso: ${profile.email} | senha: piloto-local`);
