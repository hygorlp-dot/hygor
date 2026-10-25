import process from "node:process";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import { criarAmbiente } from "../../server/ponto-eletronico/ambiente.js";
import { criarAdaptadorHttp } from "./http-adapter.mjs";

// Credenciais já fornecidas pelo runtime do projeto isolado. Não são lidas
// no build, serializadas, exportadas nem enviadas para Vercel/Android.
const ref = "ukkzpttnbyylkyujzwnv";
const url = Deno.env.get("SUPABASE_URL");
if (url !== `https://${ref}.supabase.co`) throw new Error("Projeto de homologação não confirmado.");
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const database = Deno.env.get("SUPABASE_DB_URL");
if (!service || !database) throw new Error("Persistência de homologação não configurada.");
globalThis.process = process;
globalThis.Buffer = Buffer;
// Edge não permite alterar Deno.env/process.env. O build redireciona apenas
// as leituras de process.env do nosso código para este mapa do runtime.
// Pacotes npm continuam usando o ambiente nativo; nenhum segredo entra no build.
globalThis.__PONTO_HOMOLOG_ENV__ = Object.freeze({
  SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: service,
  POSTGRES_URL_NON_POOLING: database, PONTO_AMBIENTE: "homologacao",
  COMPANY_ID: "arcd", FINANCIAL_ENGINE_ENFORCE: "false", VERCEL_ENV: "preview",
  RH_STORAGE_SETUP: "1", PONTO_NTP_BRIDGE: "vercel", PONTO_NTP_RENOVACAO: "oportunista",
});

const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const confirmarAmbiente = criarAmbiente({ db, declarado: "homologacao", supabaseUrl: url });
// Import dinâmico: api/data lê process.env quando é carregado.
const { default: handler } = await import("../../api/data.js");
const { default: upload } = await import("../../api/upload.js");
// A preparação administrativa do bucket também exige o marcador real.
if ((await confirmarAmbiente()).ambiente !== "homologacao") throw new Error("Marcador de homologação ausente.");
await import("../ensure-rh-storage.mjs");
Deno.serve(criarAdaptadorHttp({
  handler: (req, res) => req.url.split("?")[0].endsWith("/upload") ? upload(req, res) : handler(req, res),
  confirmarAmbiente,
  origensPermitidas: [
    "https://ponto-homologacao.vercel.app",
    "https://ponto-homologacao-hygor-s-projects1.vercel.app",
  ],
}));
