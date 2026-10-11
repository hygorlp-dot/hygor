// Adaptadores de Storage do backup do ponto. Interface comum:
//   listar()          -> [{ caminho, tamanho, versao }]  (versao: muda quando o objeto muda)
//   baixar(caminho)   -> Buffer | null (null = não existe)
//   enviar(caminho, Buffer)  (não sobrescreve objeto diferente)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CAMINHO_SEGURO = /^(marcacoes|biometria)\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\.jpg$/;
export const caminhoSeguro = c => CAMINHO_SEGURO.test(String(c)) && !String(c).split("/").includes("..");

// Supabase Storage (bucket privado). Só leitura no backup; enviar só é
// usado num projeto DESCARTÁVEL (a CLI de restauração recusa produção).
export function storageSupabase(bucket) {
  const listarTudo = async (prefixo = "") => {
    const itens = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket.list(prefixo, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      for (const it of data || []) {
        const caminho = prefixo ? `${prefixo}/${it.name}` : it.name;
        if (it.id) itens.push({ caminho, tamanho: Number(it.metadata?.size ?? -1), versao: `${it.updated_at || ""}|${it.metadata?.eTag || ""}|${it.metadata?.size ?? ""}` });
        else itens.push(...await listarTudo(caminho));
      }
      if ((data || []).length < 1000) break;
    }
    return itens;
  };
  return {
    listar: () => listarTudo(),
    async baixar(c) {
      const { data, error } = await bucket.download(c);
      if (error) { if (/not.?found|404/i.test(`${error.message} ${error.statusCode || ""}`)) return null; throw error; }
      return Buffer.from(await data.arrayBuffer());
    },
    async enviar(c, b) {
      const { error } = await bucket.upload(c, b, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
    },
  };
}

// Pasta local (ensaio de recuperação e testes). Escrita atômica: grava num
// temporário e renomeia - um corte no meio não deixa arquivo truncado com o
// nome final.
export function storagePasta(raiz) {
  const abs = c => {
    if (!caminhoSeguro(c)) throw new Error(`caminho de foto inválido: ${c}`);
    return path.join(raiz, ...c.split("/"));
  };
  const listarTudo = (dir, prefixo = "") => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
      const c = prefixo ? `${prefixo}/${e.name}` : e.name;
      if (e.isDirectory()) return listarTudo(path.join(dir, e.name), c);
      if (!e.name.endsWith(".jpg")) return [];
      const st = fs.statSync(path.join(dir, e.name));
      return [{ caminho: c, tamanho: st.size, versao: `${st.mtimeMs}|${st.size}` }];
    });
  };
  return {
    listar: async () => listarTudo(raiz).sort((a, b) => a.caminho.localeCompare(b.caminho)),
    baixar: async c => { const f = abs(c); return fs.existsSync(f) ? fs.readFileSync(f) : null; },
    async enviar(c, b) {
      const f = abs(c);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      if (fs.existsSync(f)) {
        if (Buffer.compare(fs.readFileSync(f), b) === 0) return;
        throw new Error(`já existe outra foto em ${c} (não sobrescrevo)`);
      }
      const tmp = `${f}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      fs.writeFileSync(tmp, b, { mode: 0o600 });
      fs.renameSync(tmp, f);
    },
  };
}

// Memória (testes). falhas: { enviar?: (c) => bool, baixar?: (c) => Buffer|null|undefined }.
export function storageMemoria(inicial = {}, falhas = {}) {
  const arquivos = new Map(Object.entries(inicial).map(([c, b]) => [c, Buffer.from(b)]));
  let versao = 0;
  const versoes = new Map([...arquivos.keys()].map(c => [c, ++versao]));
  return {
    arquivos,
    listar: async () => [...arquivos.keys()].sort().map(caminho => ({ caminho, tamanho: arquivos.get(caminho).length, versao: String(versoes.get(caminho)) })),
    async baixar(c) {
      if (falhas.baixar) { const r = falhas.baixar(c); if (r !== undefined) return r; }
      return arquivos.has(c) ? Buffer.from(arquivos.get(c)) : null;
    },
    async enviar(c, b) {
      if (falhas.enviar?.(c)) throw new Error(`falha simulada ao gravar ${c}`);
      if (arquivos.has(c) && Buffer.compare(arquivos.get(c), b) !== 0) throw new Error(`já existe outra foto em ${c} (não sobrescrevo)`);
      arquivos.set(c, Buffer.from(b)); versoes.set(c, ++versao);
    },
    // Só para simular atividade concorrente nos testes.
    _gravar(c, b) { arquivos.set(c, Buffer.from(b)); versoes.set(c, ++versao); },
  };
}
