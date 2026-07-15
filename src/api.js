// ═══════════════════════════════════════════════════════════════════
// src/api.js — substitui o supabase.js no frontend
//
// Repare no que NÃO tem aqui: nenhuma URL de banco, nenhuma chave, nenhum
// import do @supabase/supabase-js. O navegador não sabe onde fica o banco,
// e é assim que tem que ser.
//
// Tudo passa por /api/data, que roda no servidor e guarda a chave forte.
// A credencial do usuário é o PIN — conferido lá, não aqui.
// ═══════════════════════════════════════════════════════════════════

const ROTA = "/api/data";

// Guardado só em memória (não em localStorage): fechou a aba, tem que
// digitar o PIN de novo. Se ficasse no disco, quem pegasse o celular
// destravado entrava sem PIN.
let sessao = { userId: null, pin: null };
let ultimoUpdatedAt = null;

export const abrirSessao = (userId, pin) => { sessao = { userId, pin }; };
export const fecharSessao = () => {
  sessao = { userId: null, pin: null };
  ultimoUpdatedAt = null;
};
export const temSessao = () => !!(sessao.userId && sessao.pin);

const chamar = async (body) => {
  const r = await fetch(ROTA, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, ...json };
};

// ── Tela de login: quem existe? ────────────────────────────────────
// Devolve só nome e papel. O hash do PIN nunca sai do servidor.
export const listarPerfis = async () => {
  const r = await chamar({ action: "profiles" });
  if (r.status !== 200) return { usuarios: [], precisaSetup: false, erro: r.error };
  return { usuarios: r.usuarios || [], precisaSetup: !!r.precisaSetup };
};

// ── Primeiro acesso ────────────────────────────────────────────────
export const criarPrimeiroAdmin = async (payload) => {
  const r = await chamar({ action: "setup", payload });
  if (r.status !== 200) return { ok: false, erro: r.error };
  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, data: r.data };
};

// ── Entrar (o PIN é conferido no servidor) ─────────────────────────
export const entrarComPin = async (userId, pin) => {
  const r = await chamar({ action: "load", userId, pin });

  if (r.status === 429) return { ok: false, erro: r.error || "Muitas tentativas." };
  if (r.status === 401) return { ok: false, erro: "PIN incorreto." };
  if (r.status !== 200)  return { ok: false, erro: r.error || "Falha ao entrar." };

  abrirSessao(userId, pin);
  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, data: r.data, usuario: r.usuario };
};

// ── Recarregar ─────────────────────────────────────────────────────
export const loadData = async () => {
  if (!temSessao()) return null;
  const r = await chamar({ action: "load", userId: sessao.userId, pin: sessao.pin });
  if (r.status !== 200) return null;
  ultimoUpdatedAt = r.updatedAt || null;
  return r.data;
};

// ── Salvar ─────────────────────────────────────────────────────────
export const saveDataDetailed = async (payload) => {
  if (!temSessao()) return { ok: false, conflict: false, reason: "Sessão encerrada." };

  const r = await chamar({
    action: "save",
    userId: sessao.userId,
    pin: sessao.pin,
    payload,
    expectedUpdatedAt: ultimoUpdatedAt,
  });

  if (r.status === 409 && r.conflict) {
    const detalhe = {
      ok: false, conflict: true,
      reason: r.reason,
      currentData: r.currentData,
      currentUpdatedAt: r.currentUpdatedAt,
      rejectedPayload: payload,     // o que VOCÊ fez não se perde
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("arcd:data-conflict", { detail: detalhe }));
    }
    return detalhe;
  }

  if (r.status !== 200) return { ok: false, conflict: false, reason: r.error || "Falha ao salvar." };

  ultimoUpdatedAt = r.updatedAt || null;
  return { ok: true, conflict: false, updatedAt: ultimoUpdatedAt };
};

export const saveData = async (payload) => {
  const r = await saveDataDetailed(payload);
  return !!r.ok;
};

// Depois de um conflito: adota a versão do servidor como base
export const adoptServerVersion = (updatedAt) => { ultimoUpdatedAt = updatedAt || null; };

export const loadDataWithMeta = async () => {
  const data = await loadData();
  return { data, updatedAt: ultimoUpdatedAt };
};

export const logout = fecharSessao;

// ── Sobe foto do diario de obra ────────────────────────────────────
// A foto ja vem comprimida do cliente (data URL). O servidor guarda no
// Storage e devolve a URL publica. Reusa o PIN da sessao em memoria.
export const subirFoto = async ({ dataUrl, obraId, ext }) => {
  if (!sessao.userId || !sessao.pin) return { error: "Sem sessao." };
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: sessao.userId, pin: sessao.pin, dataUrl, obraId, ext }),
  });
  return await r.json().catch(() => ({ error: "Falha no upload." }));
};
