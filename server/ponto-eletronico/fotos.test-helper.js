// Adaptador de rede em memória; os testes de fotos.js exercitam o contrato do Graph
// na fronteira de rede. Aqui os fluxos do aparelho continuam sem rede externa.
export function fotosEmMemoria(db) {
  return {
    async salvar(caminho, bytes) { db.arquivos.set(caminho, bytes); return { caminho, provedor: "onedrive" }; },
    async url(caminho) { return db.arquivos.has(caminho) ? { url: `https://onedrive.test/${caminho}`, provedor: "onedrive" } : null; },
    async urls(caminhos) { return new Map(caminhos.filter(c => db.arquivos.has(c)).map(c => [c, `https://onedrive.test/${c}`])); },
  };
}
