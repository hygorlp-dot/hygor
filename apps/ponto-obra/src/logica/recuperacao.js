export async function conferirTrocaDeAparelho(armazem) {
  if (!armazem) throw new Error("Banco indisponível. Preserve os dados e chame o suporte antes de parear.");
  const c = await armazem.contagem();
  if ([c.pendentes, c.fotos, c.fotosComProblema].some(n => !Number.isSafeInteger(n) || n < 0)) {
    throw new Error("Não foi possível conferir os registros locais. Chame o suporte.");
  }
  if (c.pendentes || c.fotos || c.fotosComProblema) {
    throw new Error("Há registros ou fotos aguardando tratamento neste aparelho. Não é possível trocar o pareamento; sincronize ou chame o suporte, sem limpar os dados.");
  }
}
