import { authenticateAppUser } from "./auth.js";

const somenteDigitos = value => String(value || "").replace(/\D/g, "");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const user = await authenticateAppUser(req.body || {}, {scope:"cnpj"});
  if (!user) return res.status(401).json({ error: "Sessão inválida." });

  const cnpj = somenteDigitos(req.body?.cnpj);
  if (cnpj.length !== 14) return res.status(400).json({ error: "CNPJ deve ter 14 dígitos." });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 404) return res.status(404).json({ error: "CNPJ não encontrado na base da Receita." });
    if (!response.ok) {
      console.error("BrasilAPI respondeu erro:", response.status);
      return res.status(502).json({ error: "A consulta cadastral está temporariamente indisponível." });
    }
    const data = await response.json();
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error("Falha na consulta de CNPJ:", error?.name || error);
    return res.status(504).json({ error: "A consulta cadastral demorou para responder. Tente novamente." });
  } finally {
    clearTimeout(timeout);
  }
}
