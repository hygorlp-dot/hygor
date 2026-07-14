// ═══════════════════════════════════════════════════════════════════
// /api/data — a única porta de entrada para o banco
//
// POR QUE ISTO EXISTE
//
// Sem o login do Supabase, a alternativa "óbvia" seria o navegador falar
// direto com o banco usando a anon key. Só que a anon key está no bundle
// JavaScript — é pública. Qualquer pessoa abre o DevTools em
// pontosarcd.vercel.app, copia, e baixa CPF, PIX, salário e contrato de
// todo mundo. Nenhuma trava no App.jsx impede isso, porque o atacante nem
// usa o seu app: fala direto com o Supabase.
//
// A saída é o navegador NUNCA tocar no banco. Ele fala com esta função, que
// roda no servidor do Vercel e guarda a SERVICE_ROLE_KEY — chave que nunca
// chega ao navegador.
//
// E o PIN, que antes era só uma tela, vira credencial de verdade: é
// conferido AQUI, no servidor. Sem PIN válido, esta função não devolve dado.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const URL     = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;   // sem REACT_APP_ — server-side
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY     = "arced_ponto_v1";

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// Dois carimbos de tempo apontam para o mesmo instante?
// Compara o VALOR, não o texto: "…Z" (JS) e "…+00:00" (Postgres) são o mesmo
// momento escrito de duas formas.
const mesmoInstante = (a, b) => {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return false;
  return ta === tb;
};

// ── Freio contra força bruta ───────────────────────────────────────
// Um PIN de 4 dígitos tem 10.000 combinações — um script testa tudo em
// minutos se deixarmos. Aqui a memória é por instância (serverless recicla),
// então é um freio, não um cofre. O que realmente protege é PIN de 6 dígitos.
const tentativas = new Map();
const LIMITE = 8;
const JANELA = 5 * 60 * 1000;

const bloqueado = (ip) => {
  const t = tentativas.get(ip);
  if (!t) return false;
  if (Date.now() - t.desde > JANELA) { tentativas.delete(ip); return false; }
  return t.n >= LIMITE;
};

const registrarFalha = (ip) => {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.desde > JANELA) tentativas.set(ip, { n: 1, desde: Date.now() });
  else t.n += 1;
};

const lerLinha = async () => {
  const { data, error } = await db
    .from("company_app_data")
    .select("value, updated_at")
    .eq("company_id", COMPANY)
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { payload: null, updatedAt: null };
  const payload = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
  return { payload, updatedAt: data.updated_at || null };
};

// Confere o PIN contra o hash guardado no próprio dataset
const conferirPin = (payload, userId, pin) => {
  const u = (payload?.usuarios || []).find(x => x.id === userId && x.active !== false);
  if (!u) return null;
  // Comparação em tempo constante: comparar strings com === vaza, pelo tempo
  // de resposta, quantos caracteres iniciais bateram.
  const a = Buffer.from(sha256(pin));
  const b = Buffer.from(String(u.pin || ""));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return u;
};

export default async function handler(req, res) {
  if (!URL || !SERVICE) {
    return res.status(503).json({ error: "Banco não configurado no servidor." });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "desconhecido";
  const { action, userId, pin, payload, expectedUpdatedAt } = req.body || {};

  try {
    // ── 1. Lista de perfis (tela de login) ─────────────────────────
    // Não exige PIN — é o que a tela precisa ANTES de alguém digitar.
    // Devolve só nome e papel. O hash do PIN nunca sai daqui.
    if (action === "profiles") {
      const { payload: p } = await lerLinha();
      const usuarios = (p?.usuarios || [])
        .filter(u => u.active !== false)
        .map(u => ({ id: u.id, nome: u.nome, role: u.role }));
      return res.status(200).json({ usuarios, precisaSetup: usuarios.length === 0 });
    }

    // ── 2. Primeiro acesso: cria o admin inicial ───────────────────
    //
    // ATENÇÃO — este trecho já teve um bug que destruía dados.
    //
    // A versão errada fazia `value = payload`, ou seja, gravava por cima da
    // linha o dataset VAZIO que o navegador manda (só com o admin recém-criado).
    // Se a empresa já tivesse obras, funcionários e pontos lançados, mas ainda
    // nenhum usuário com PIN, o "Primeiro acesso" apagaria TUDO.
    //
    // Agora o admin é MESCLADO no que já existe. A base atual é a verdade;
    // o cliente só contribui com o usuário. Nenhum outro campo é tocado.
    if (action === "setup") {
      const { payload: existente } = await lerLinha();

      if ((existente?.usuarios || []).length > 0) {
        return res.status(409).json({ error: "Já existe usuário. Setup encerrado." });
      }

      const novoUsuario = (payload?.usuarios || [])[0];
      if (!novoUsuario?.id || !novoUsuario?.pin) {
        return res.status(400).json({ error: "Dados do administrador incompletos." });
      }

      // Se já há dados, PRESERVA tudo e só acrescenta o usuário.
      // Se a linha está vazia/inexistente, aí sim usa o payload como base.
      const temDados = existente && Object.keys(existente).length > 0;
      const base = temDados
        ? { ...existente, usuarios: [novoUsuario] }
        : { ...(payload || {}), usuarios: [novoUsuario] };

      const agora = new Date().toISOString();

      if (!existente) {
        await db.from("company_app_data")
          .insert({ company_id: COMPANY, key: KEY, value: base, updated_at: agora });
      } else {
        await db.from("company_app_data")
          .update({ value: base, updated_at: agora })
          .eq("company_id", COMPANY).eq("key", KEY);
      }

      const novo = await lerLinha();
      return res.status(200).json({ data: novo.payload, updatedAt: novo.updatedAt });
    }

    // ── Daqui pra baixo, PIN obrigatório ───────────────────────────
    if (bloqueado(ip)) {
      return res.status(429).json({ error: "Muitas tentativas. Aguarde 5 minutos." });
    }

    const { payload: atual, updatedAt } = await lerLinha();
    const usuario = conferirPin(atual, userId, pin);

    if (!usuario) {
      registrarFalha(ip);
      return res.status(401).json({ error: "PIN incorreto." });
    }

    // ── 3. Carregar ────────────────────────────────────────────────
    if (action === "load") {
      return res.status(200).json({
        data: atual,
        updatedAt,
        usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role, email: usuario.email || "" },
      });
    }

    // ── 4. Salvar (com trava otimista) ─────────────────────────────
    if (action === "save") {
      if (!payload) return res.status(400).json({ error: "Nada para salvar." });

      // Se outro salvou depois da sua leitura, recusa — e devolve a versão
      // do servidor + o que você tentou salvar, para o app reaplicar.
      //
      // ⚠️ COMPARAR INSTANTE, NÃO STRING.
      //
      // Este trecho já teve um bug que travava TODO salvamento a partir do
      // segundo. O JS gera "2026-07-14T09:46:11.545Z"; o Postgres, na coluna
      // timestamptz, devolve "2026-07-14T09:46:11.545+00:00". É o MESMO
      // instante, mas são strings diferentes — e comparar com !== dava
      // conflito eterno. O ponto simplesmente não salvava.
      if (expectedUpdatedAt && updatedAt && !mesmoInstante(expectedUpdatedAt, updatedAt)) {
        return res.status(409).json({
          conflict: true,
          reason: "Outro usuário salvou enquanto você trabalhava.",
          currentData: atual,
          currentUpdatedAt: updatedAt,
        });
      }

      const agora = new Date().toISOString();

      // .select() devolve a linha COMO O BANCO A GUARDOU. Assim o carimbo que
      // mandamos de volta ao navegador é exatamente o que estará lá na próxima
      // comparação — sem discrepância de formato.
      const { data: gravado, error } = await db
        .from("company_app_data")
        .update({ value: payload, updated_at: agora, updated_by: null })
        .eq("company_id", COMPANY)
        .eq("key", KEY)
        .select("updated_at")
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({ ok: true, updatedAt: gravado?.updated_at || agora });
    }

    return res.status(400).json({ error: "Ação desconhecida." });
  } catch (err) {
    console.error("Falha em /api/data:", err);
    // Não devolve o erro cru: pode conter nome de tabela, coluna, etc.
    return res.status(500).json({ error: "Erro interno." });
  }
}
