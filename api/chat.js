// Chat interno da empresa - mensagens ficam em linhas separadas do JSON
// principal (mesmo padrão de /api/presence), para não inflar o documento
// que todo save() reenvia por inteiro. Cada mensagem é uma linha própria em
// company_app_data; listar é uma consulta por prefixo, não um objeto único
// que cresce sem limite.
//
// Anexos de mídia (imagem/áudio/vídeo) e a integração com o OneDrive ainda
// não estão implementados aqui - este endpoint cobre texto, silenciamento e
// apagar mensagem pelo administrador.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { authenticateAppUser } from "./auth.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const MSG_PREFIX = "arced_chat_msg__";
const MUTE_PREFIX = "arced_chat_mute__";
const MAX_MSG_LEN = 2000;
const LIST_LIMIT = 300;

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const uid = () => crypto.randomUUID();
const textoSeguro = (value, max = MAX_MSG_LEN) => String(value || "").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!URL || !SERVICE) return res.status(503).json({ error: "Banco nao configurado." });

  const { action, userId, pin, accessToken, text, messageId, targetUserId } = req.body || {};
  const user = await authenticateAppUser({ userId, pin, accessToken }, { scope: "chat" });
  if (!user) return res.status(401).json({ error: "Sessao invalida." });

  try {
    if (action === "send") {
      const { data: muteRow } = await db.from("company_app_data")
        .select("value").eq("company_id", COMPANY).eq("key", `${MUTE_PREFIX}${user.id}`).maybeSingle();
      if (muteRow) return res.status(403).json({ error: "Você foi silenciado pelo administrador e não pode enviar mensagens." });

      const conteudo = textoSeguro(text);
      if (!conteudo) return res.status(400).json({ error: "Mensagem vazia." });

      const agora = new Date().toISOString();
      const id = uid();
      const value = {
        id, userId: user.id, userName: user.nome, role: user.role,
        text: conteudo, createdAt: agora, deletedAt: null, deletedBy: null,
      };
      const { error } = await db.from("company_app_data").insert({
        company_id: COMPANY, key: `${MSG_PREFIX}${id}`, value, updated_at: agora,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true, message: value });
    }

    if (action === "list") {
      const [{ data: msgRows, error: msgErr }, { data: muteRows, error: muteErr }] = await Promise.all([
        db.from("company_app_data").select("value")
          .eq("company_id", COMPANY).like("key", `${MSG_PREFIX}%`)
          .order("updated_at", { ascending: false }).limit(LIST_LIMIT),
        db.from("company_app_data").select("key,value")
          .eq("company_id", COMPANY).like("key", `${MUTE_PREFIX}%`),
      ]);
      if (msgErr) throw msgErr;
      if (muteErr) throw muteErr;
      const mensagens = (msgRows || [])
        .map(r => typeof r.value === "string" ? JSON.parse(r.value) : r.value)
        .sort((a, b) => String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
      const mutados = (muteRows || []).map(r => {
        const v = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
        return { userId: r.key.slice(MUTE_PREFIX.length), ...v };
      });
      return res.status(200).json({ ok: true, mensagens, mutados, serverTime: new Date().toISOString() });
    }

    if (action === "delete") {
      if (user.role !== "admin") return res.status(403).json({ error: "Apenas o administrador pode apagar mensagens." });
      if (!messageId) return res.status(400).json({ error: "Mensagem nao informada." });
      const key = `${MSG_PREFIX}${messageId}`;
      const { data: atual } = await db.from("company_app_data")
        .select("value").eq("company_id", COMPANY).eq("key", key).maybeSingle();
      if (!atual) return res.status(404).json({ error: "Mensagem nao encontrada." });
      const v = typeof atual.value === "string" ? JSON.parse(atual.value) : atual.value;
      const agora = new Date().toISOString();
      const value = { ...v, text: "", deletedAt: agora, deletedBy: user.nome };
      const { error } = await db.from("company_app_data").update({ value, updated_at: agora })
        .eq("company_id", COMPANY).eq("key", key);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "mute" || action === "unmute") {
      if (user.role !== "admin") return res.status(403).json({ error: "Apenas o administrador pode gerenciar o grupo." });
      if (!targetUserId) return res.status(400).json({ error: "Usuário nao informado." });
      const key = `${MUTE_PREFIX}${targetUserId}`;
      if (action === "unmute") {
        const { error } = await db.from("company_app_data").delete()
          .eq("company_id", COMPANY).eq("key", key);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      const agora = new Date().toISOString();
      const { error } = await db.from("company_app_data").upsert({
        company_id: COMPANY, key, value: { mutedBy: user.nome, mutedAt: agora }, updated_at: agora,
      }, { onConflict: "company_id,key" });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acao invalida." });
  } catch (error) {
    console.error("Falha em /api/chat:", error);
    return res.status(500).json({ error: "Falha ao processar o chat." });
  }
}
