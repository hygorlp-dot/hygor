// Presenca de usuarios em registros separados do JSON principal.
// Cada aba autenticada ocupa sua propria linha em company_app_data, evitando
// conflitos com os salvamentos operacionais frequentes do aplicativo.

import { createClient } from "@supabase/supabase-js";
import { authenticateAppUser } from "./auth.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const PRESENCE_PREFIX = "arced_presence__";
const ONLINE_WINDOW_MS = 90 * 1000;

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const textoSeguro = (value, max = 120) => String(value || "").replace(/[\u0000-\u001f]/g, "").slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!URL || !SERVICE) return res.status(503).json({ error: "Banco nao configurado." });

  const { action, userId, pin, accessToken, sessionId, tab, device } = req.body || {};
  const user = await authenticateAppUser({userId,pin,accessToken},{scope:"presence"});
  if (!user) return res.status(401).json({ error: "Sessao invalida." });

  try {
    if (action === "heartbeat") {
      if (!/^[a-zA-Z0-9-]{12,80}$/.test(String(sessionId || ""))) {
        return res.status(400).json({ error: "Sessao invalida." });
      }
      const agora = new Date().toISOString();
      const value = {
        userId: user.id,
        userName: user.nome,
        role: user.role,
        sessionId,
        tab: textoSeguro(tab, 60),
        device: textoSeguro(device, 120),
        lastSeen: agora,
        loggedOutAt: null,
      };
      const { error } = await db.from("company_app_data").upsert({
        company_id: COMPANY,
        key: `${PRESENCE_PREFIX}${sessionId}`,
        value,
        updated_at: agora,
      }, { onConflict: "company_id,key" });
      if (error) throw error;
      return res.status(200).json({ ok: true, lastSeen: agora });
    }

    if (action === "offline") {
      if (!/^[a-zA-Z0-9-]{12,80}$/.test(String(sessionId || ""))) {
        return res.status(200).json({ ok: true });
      }
      const key = `${PRESENCE_PREFIX}${sessionId}`;
      const { data: atual } = await db.from("company_app_data")
        .select("value").eq("company_id", COMPANY).eq("key", key).maybeSingle();
      if (atual) {
        const agora = new Date().toISOString();
        const value = typeof atual.value === "string" ? JSON.parse(atual.value) : atual.value;
        await db.from("company_app_data").update({
          value: { ...value, lastSeen: agora, loggedOutAt: agora },
          updated_at: agora,
        }).eq("company_id", COMPANY).eq("key", key);
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "list") {
      if (user.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
      const limiteHistorico = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // Evita acumular uma linha para sempre a cada aba/dispositivo utilizado.
      await db.from("company_app_data").delete()
        .eq("company_id", COMPANY)
        .like("key", `${PRESENCE_PREFIX}%`)
        .lt("updated_at", limiteHistorico);
      const { data: rows, error } = await db.from("company_app_data")
        .select("value,updated_at")
        .eq("company_id", COMPANY)
        .like("key", `${PRESENCE_PREFIX}%`)
        .gte("updated_at", limiteHistorico)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const agora = Date.now();
      const presencas = (rows || []).map(row => {
        const p = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        const lastSeen = p.lastSeen || row.updated_at;
        return {
          userId: p.userId,
          sessionId: p.sessionId,
          tab: p.tab || "",
          device: p.device || "",
          lastSeen,
          online: !p.loggedOutAt && agora - new Date(lastSeen).getTime() <= ONLINE_WINDOW_MS,
        };
      });
      return res.status(200).json({ presencas, serverTime: new Date().toISOString() });
    }

    return res.status(400).json({ error: "Acao invalida." });
  } catch (error) {
    console.error("Falha em /api/presence:", error);
    return res.status(500).json({ error: "Falha ao atualizar presenca." });
  }
}
