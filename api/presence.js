// Presenca de usuarios, chat em grupo e ajustes manuais do ranking de
// engenheiros de campo - tres recursos pequenos, pouco acessados, dividindo
// UM endpoint (dispatch por "action") em vez de gastar tres slots de
// Serverless Function do Vercel. O Hobby plan tem um teto de 12 funcoes por
// deployment; separar cada recurso em seu proprio arquivo estourou esse
// limite (erro exceeded_serverless_functions_per_deployment).
//
// Todos guardam registros em linhas separadas do JSON principal
// (company_app_data), evitando inflar o documento que todo save() reenvia
// por inteiro.
//
// Anexos de midia (imagem/audio/video) no chat e a integracao com o
// OneDrive ainda nao estao implementados aqui - o chat cobre texto,
// silenciamento e apagar mensagem pelo administrador. A pontuacao
// automatica do ranking e calculada no cliente a partir de dados ja
// existentes (ponto, diario, conferencias); aqui so guardamos os pontos
// extras que o administrador concede ou desconta, com justificativa, sem
// sobrescrever o historico automatico.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { authenticateAppUser } from "./auth.js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = process.env.COMPANY_ID || "arcd";
const PRESENCE_PREFIX = "arced_presence__";
const MSG_PREFIX = "arced_chat_msg__";
const MUTE_PREFIX = "arced_chat_mute__";
const ADJ_PREFIX = "arced_rank_adj__";
const ONLINE_WINDOW_MS = 90 * 1000;
const MAX_MSG_LEN = 2000;
const CHAT_LIST_LIMIT = 300;

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const textoSeguro = (value, max = 120) => String(value || "").replace(/[\x00-\x1f]/g, "").slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!URL || !SERVICE) return res.status(503).json({ error: "Banco nao configurado." });

  const {
    action, userId, pin, accessToken, sessionId, tab, device,
    text, messageId, targetUserId, pontos, motivo, adjustmentId,
  } = req.body || {};
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

    //  Chat interno da empresa
    if (action === "chat-send") {
      const { data: muteRow } = await db.from("company_app_data")
        .select("value").eq("company_id", COMPANY).eq("key", `${MUTE_PREFIX}${user.id}`).maybeSingle();
      if (muteRow) return res.status(403).json({ error: "Você foi silenciado pelo administrador e não pode enviar mensagens." });

      const conteudo = String(text || "").trim().slice(0, MAX_MSG_LEN);
      if (!conteudo) return res.status(400).json({ error: "Mensagem vazia." });

      const agora = new Date().toISOString();
      const id = crypto.randomUUID();
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

    if (action === "chat-list") {
      const [{ data: msgRows, error: msgErr }, { data: muteRows, error: muteErr }] = await Promise.all([
        db.from("company_app_data").select("value")
          .eq("company_id", COMPANY).like("key", `${MSG_PREFIX}%`)
          .order("updated_at", { ascending: false }).limit(CHAT_LIST_LIMIT),
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

    if (action === "chat-delete") {
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

    if (action === "chat-mute" || action === "chat-unmute") {
      if (user.role !== "admin") return res.status(403).json({ error: "Apenas o administrador pode gerenciar o grupo." });
      if (!targetUserId) return res.status(400).json({ error: "Usuário nao informado." });
      const key = `${MUTE_PREFIX}${targetUserId}`;
      if (action === "chat-unmute") {
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

    //  Ranking de engenheiros de campo (ajustes manuais)
    if (action === "ranking-list") {
      const { data: rows, error } = await db.from("company_app_data")
        .select("key,value").eq("company_id", COMPANY).like("key", `${ADJ_PREFIX}%`);
      if (error) throw error;
      const ajustes = (rows || [])
        .map(r => ({ id: r.key.slice(ADJ_PREFIX.length), ...(typeof r.value === "string" ? JSON.parse(r.value) : r.value) }))
        .sort((a,b) => String(b.criadoEm||"").localeCompare(String(a.criadoEm||"")));
      return res.status(200).json({ ok: true, ajustes });
    }

    if (action === "ranking-add") {
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

    if (action === "ranking-remove") {
      if (user.role !== "admin") return res.status(403).json({ error: "Apenas o administrador pode remover um ajuste." });
      if (!adjustmentId) return res.status(400).json({ error: "Ajuste nao informado." });
      const { error } = await db.from("company_app_data").delete()
        .eq("company_id", COMPANY).eq("key", `${ADJ_PREFIX}${adjustmentId}`);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acao invalida." });
  } catch (error) {
    console.error("Falha em /api/presence:", error);
    return res.status(500).json({ error: "Falha ao processar a solicitacao." });
  }
}
