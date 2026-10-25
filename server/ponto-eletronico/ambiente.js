// Reaproveita a guarda de isolamento da frente ponto-hardening-piloto (#77).
// A URL, sozinha, não confirma homologação: o banco precisa ter o marcador.
import crypto from "node:crypto";

export const AMBIENTES = Object.freeze(["producao", "homologacao"]);
export const HASH_REF_PRODUCAO = "33d9c2f82b177af37ac81fc05afe8acb11f9b4747f65c39d6ef3f4dfa1613719";
export const hashDoRef = ref => crypto.createHash("sha256").update(String(ref || "").trim().toLowerCase()).digest("hex");
export const refDoSupabase = url => {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")
      ? parsed.hostname.split(".")[0].toLowerCase() : null;
  } catch { return null; }
};
export const TABELA_MARCADOR = "arcd_ambiente";

export function criarAmbiente({ db, declarado, supabaseUrl }) {
  const valor = String(declarado ?? "").trim().toLowerCase() || "producao";
  return async function ambiente() {
    if (!AMBIENTES.includes(valor)) return { erro: "Ambiente do servidor não configurado." };
    if (valor === "producao") return { ambiente: "producao" };
    const ref = refDoSupabase(supabaseUrl);
    if (!ref || hashDoRef(ref) === HASH_REF_PRODUCAO) return { erro: "Banco de homologação não confirmado." };
    // Confere a cada pedido: a remoção do marcador bloqueia a próxima ação.
    try {
      const { data, error } = await db.from(TABELA_MARCADOR).select("ambiente").eq("id", true).maybeSingle();
      if (!error && data?.ambiente === "homologacao") return { ambiente: "homologacao" };
    } catch { /* Falha de consulta nunca libera o ambiente. */ }
    return { erro: "O banco não confirmou o ambiente de homologação." };
  };
}
