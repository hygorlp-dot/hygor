import { createHash } from "node:crypto";

// Os caminhos antigos continuam no bucket privado. Novos bytes vão apenas
// para o OneDrive central, sem depender do cookie Microsoft do aparelho.
export function criarArmazenamentoFotos({ db, company, carregarGraph = () => import("../microsoft/graph.js") }) {
  const segmentos = caminho => {
    const parts = String(caminho).split("/");
    if (!/^(marcacoes|biometria)$/.test(parts[0]) || parts.some(p => !p || p === "." || p === ".." || /[\\\x00-\x1f]/.test(p))) throw new Error("Caminho de foto inválido.");
    return ["Ponto de Obra", String(company), ...parts];
  };
  const conectar = async () => {
    const ms = await carregarGraph();
    if (!ms.configured()) throw new Error("OneDrive não configurado.");
    const { accessToken } = await ms.refresh({ headers: {} });
    const root = await ms.rootItem(accessToken);
    return { ms, token: accessToken, drive: root.parentReference.driveId, root: root.id };
  };
  const destino = (ctx, parts) => `/drives/${encodeURIComponent(ctx.drive)}/items/${encodeURIComponent(ctx.root)}:/${parts.map(encodeURIComponent).join("/")}`;
  const localizar = async (ctx, parts) => {
    try { return await (await ctx.ms.graph(ctx.token, destino(ctx, parts))).json(); }
    catch (error) { if (error.status === 404) return null; throw error; }
  };
  const salvar = async (caminho, buffer) => {
    const parts = segmentos(caminho);
    const ctx = await conectar();
    let parent = ctx.root;
    for (const name of parts.slice(0, -1)) {
      const children = `/drives/${encodeURIComponent(ctx.drive)}/items/${encodeURIComponent(parent)}`;
      const path = `${children}:/${encodeURIComponent(name)}`;
      let folder;
      try { folder = await (await ctx.ms.graph(ctx.token, path)).json(); }
      catch (error) {
        if (error.status !== 404) throw error;
        try {
          folder = await (await ctx.ms.graph(ctx.token, `${children}/children`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
          })).json();
        } catch (conflict) {
          if (conflict.status !== 409) throw conflict;
          folder = await (await ctx.ms.graph(ctx.token, path)).json();
        }
      }
      if (!folder?.id || !folder.folder) throw new Error("A pasta das fotos não está disponível.");
      parent = folder.id;
    }
    const endpoint = `/drives/${encodeURIComponent(ctx.drive)}/items/${encodeURIComponent(parent)}:/${encodeURIComponent(parts.at(-1))}:/content?@microsoft.graph.conflictBehavior=fail`;
    try {
      await ctx.ms.graph(ctx.token, endpoint, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: buffer });
    } catch (error) {
      if (error.status !== 409) throw error;
      // Resposta perdida/reenvio: só confirmar se os bytes existentes forem
      // os mesmos. Nunca substituir nem criar uma cópia com outro nome.
      const response = await ctx.ms.graph(ctx.token, `${destino(ctx, parts)}:/content`);
      const existente = Buffer.from(await response.arrayBuffer());
      const hash = value => createHash("sha256").update(value).digest("hex");
      if (hash(existente) !== hash(buffer)) throw new Error("A foto já armazenada possui conteúdo diferente.");
    }
    return { caminho, provedor: "onedrive" };
  };
  const url = async (caminho, { legado = true } = {}) => {
    const parts = segmentos(caminho);
    let falha;
    try {
      const item = await localizar(await conectar(), parts);
      if (item?.["@microsoft.graph.downloadUrl"]) return { url: item["@microsoft.graph.downloadUrl"], provedor: "onedrive" };
      if (item) throw new Error("O OneDrive não forneceu acesso à foto.");
    } catch (error) { falha = error; }
    if (legado) {
      const signed = await db.storage.from("ponto-obra").createSignedUrl(caminho, 300);
      if (!signed.error && signed.data?.signedUrl) return { url: signed.data.signedUrl, provedor: "supabase", expiraEmSegundos: 300 };
    }
    if (falha) throw falha;
    return null;
  };
  // Uma única sessão por consulta do painel; não há cache de URL temporária.
  const urls = async caminhos => {
    const result = new Map();
    if (!caminhos.length) return result;
    const ctx = await conectar();
    for (let i = 0; i < caminhos.length; i += 5) {
      await Promise.all(caminhos.slice(i, i + 5).map(async caminho => {
        const item = await localizar(ctx, segmentos(caminho));
        if (item?.["@microsoft.graph.downloadUrl"]) result.set(caminho, item["@microsoft.graph.downloadUrl"]);
      }));
    }
    return result;
  };
  return { salvar, url, urls };
}
