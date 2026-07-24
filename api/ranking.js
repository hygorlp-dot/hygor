// Ajustes manuais do ranking de engenheiros de campo. A pontuação
// automática (assiduidade no ponto, diário de obra e conferências) é
// calculada no cliente a partir dos dados já existentes - aqui só guardamos
// os pontos extras que o administrador concede ou desconta, com
// justificativa, sem sobrescrever o histórico automático.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { authenticateAppUser } from "./auth.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const ADJ_PREFIX = "arced_rank_adj__";

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!URL || !SERVICE) return res.status(503).json({ error: "Banco nao configurado." });

  const { action, userId, pin, accessToken, targetUserId, pontos, motivo, adjustmentId } = req.body || {};
  const user = await authenticateAppUser({ userId, pin, accessToken }, { scope: "ranking" });
  if (!user) return res.status(401).json({ error: "Sessao invalida." });

  try {
    if (action === "list") {
      const { data: rows, error } = await db.from("company_app_data")
        .select("key,value").eq("company_id", COMPANY).like("key", `${ADJ_PREFIX}%`);
      if (error) throw error;
      const ajustes = (rows || [])
        .map(r => ({ id: r.key.slice(ADJ_PREFIX.length), ...(typeof r.value === "string" ? JSON.parse(r.value) : r.value) }))
        .sort((a,b) => String(b.criadoEm||"").localeCompare(String(a.criadoEm||"")));
      return res.status(200).json({ ok: true, ajustes });
    }

    if (action === "add") {
      if (user.role !== "admin") return res.status(403).json({ error: "Apenas o administrador pode ajustar o ranking." });
      if (!targetUserId) return res.status(400).json({ error: "Usuário nao informado." });
      const pts = Number(pontos);
      if (!Number.isFinite(pts) || pts === 0) return res.status(400).json({ error: "Informe os pontos (positivo ou negativo)." });
      const justificativa = String(motivo || "").trim().slice(0, 500);
      if (!justificativa) return res.status(400).json({ error: "Justifique o ajuste." });

      const id = crypto.randomUUID();
      const agora = new Date().toISOString();
      const value = {
        userId: targetUserId, pontos: pts, motivo: justificativa,
        criadoPorId: user.id, criadoPor: user.nome, criadoEm: agora,
      };
      const { error } = await db.from("company_app_data").insert({
        company_id: COMPANY, key: `${ADJ_PREFIX}${id}`, value, updated_at: agora,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true, ajuste: { id, ...value } });
    }

    if (action === "remove") {
      if (user.role !== "admin") return res.status(403).json({ error: "Apenas o administrador pode remover um ajuste." });
      if (!adjustmentId) return res.status(400).json({ error: "Ajuste nao informado." });
      const { error } = await db.from("company_app_data").delete()
        .eq("company_id", COMPANY).eq("key", `${ADJ_PREFIX}${adjustmentId}`);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acao invalida." });
  } catch (error) {
    console.error("Falha em /api/ranking:", error);
    return res.status(500).json({ error: "Falha ao processar o ranking." });
  }
}
