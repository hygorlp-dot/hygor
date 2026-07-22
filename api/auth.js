import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { decodeAppData } from "../server/data-codec.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const DATA_KEY = "arced_ponto_v1";

const sha256 = value => crypto.createHash("sha256").update(String(value || "")).digest("hex");

// Autenticação comum às rotas auxiliares. Assim, consultas externas e IA
// ficam disponíveis para todo operador autenticado, sem transformar a função
// serverless em um endpoint público que possa consumir a cota da empresa.
export const authenticateAppUser = async ({ userId, pin, accessToken } = {}) => {
  if (!URL || !SERVICE) return null;
  const db = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.from("company_app_data")
    .select("value")
    .eq("company_id", COMPANY)
    .eq("key", DATA_KEY)
    .maybeSingle();
  if (error || !data) return null;

  const payload = decodeAppData(data.value);
  if (accessToken) {
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (!authError && auth?.user) {
      const email = String(auth.user.email || "").toLowerCase();
      const linked = (payload?.usuarios || []).find(u =>
        u.active !== false &&
        (u.authUserId === auth.user.id || String(u.email || "").toLowerCase() === email));
      if (linked) return linked;
    }
  }

  const user = (payload?.usuarios || []).find(u => u.id === userId && u.active !== false);
  if (!user || !pin) return null;
  const received = Buffer.from(sha256(pin));
  const expected = Buffer.from(String(user.pin || ""));
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  return user;
};
