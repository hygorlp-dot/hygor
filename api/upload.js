// ===================================================================
// /api/upload - sobe foto do diario de obra para o Supabase Storage
//
// POR QUE ESTE ENDPOINT EXISTE (e nao guardamos a foto no blob)
//
// O app inteiro vive num unico JSON (company_app_data). Todo save()
// reenvia esse JSON completo. Se a foto fosse base64 dentro dele, cada
// batida de ponto arrastaria megabytes pelo 4G do celular - e em semanas
// o blob estouraria o limite e travaria tudo.
//
// A saida: a foto vai para um BUCKET do Storage. O app guarda so a URL.
// O blob continua leve; o ponto continua salvando rapido.
//
// Assim como /api/data, o navegador nunca toca no banco direto: fala com
// esta funcao, que roda no servidor e guarda a SERVICE_ROLE_KEY. E o PIN
// e conferido aqui, do mesmo jeito.
// ===================================================================

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { decodeAppData } from "./data-codec.js";

const URL     = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY     = "arced_ponto_v1";
const BUCKET  = process.env.SUPABASE_BUCKET || "diario-obra";

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

// Confere o PIN contra o hash guardado no dataset (igual ao /api/data).
const conferirPin = async (userId, pin, accessToken) => {
  const { data, error } = await db
    .from("company_app_data")
    .select("value")
    .eq("company_id", COMPANY)
    .eq("key", KEY)
    .maybeSingle();
  
  if (error || !data) return null;
  
  const payload = decodeAppData(data.value);
  if(accessToken){const {data:auth,error:authError}=await db.auth.getUser(accessToken);if(!authError&&auth?.user){const email=String(auth.user.email||"").toLowerCase();const linked=(payload?.usuarios||[]).find(u=>u.active!==false&&(u.authUserId===auth.user.id||String(u.email||"").toLowerCase()===email));if(linked)return linked;}}
  const u = (payload?.usuarios || []).find(x => x.id === userId && x.active !== false);
  
  if (!u) return null;
  
  const a = Buffer.from(sha256(pin));
  const b = Buffer.from(String(u.pin || ""));
  
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  
  return u;
};

// Aceita corpo maior (fotos ja comprimidas no cliente, ~200-800KB em base64).
export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!URL || !SERVICE) return res.status(500).json({ error: "Storage nao configurado." });

  const { userId, pin, accessToken, dataUrl, obraId, ext } = req.body || {};

  // 1. Autentica.
  const user = await conferirPin(userId, pin, accessToken);
  if (!user) return res.status(401).json({ error: "PIN invalido." });

  // 2. Valida a imagem (data URL base64).
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "Imagem invalida." });
  }
  const virgula = dataUrl.indexOf(",");
  const base64  = dataUrl.slice(virgula + 1);
  const buffer  = Buffer.from(base64, "base64");
  // Limite de seguranca: ~4MB por foto ja descomprimida.
  if (buffer.length > 4 * 1024 * 1024) {
    return res.status(413).json({ error: "Foto muito grande. Comprima antes." });
  }
  const mime = dataUrl.slice(5, virgula).split(";")[0];  // ex.: image/jpeg
  const extensao = (ext || mime.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");

  // 3. Caminho: diario-obra/{obra}/{ano}/{uuid}.jpg
  const ano   = new Date().getFullYear();
  const nome  = `${crypto.randomUUID()}.${extensao}`;
  const path  = `${(obraId || "geral").replace(/[^a-zA-Z0-9_-]/g, "")}/${ano}/${nome}`;

  try {
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (upErr) {
      // Bucket ainda nao existe? Devolve mensagem clara.
      if (String(upErr.message || "").toLowerCase().includes("bucket")) {
        return res.status(400).json({ error: "bucket_ausente", detalhe: upErr.message });
      }
      throw upErr;
    }
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ ok: true, url: pub.publicUrl, path });
  } catch (err) {
    console.error("Falha em /api/upload:", err);
    return res.status(500).json({ error: "Falha ao subir a foto." });
  }
}
