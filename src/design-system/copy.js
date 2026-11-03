// Somente linguagem compartilhada. Textos de negócio pertencem ao módulo.
// Preserve chaves; ao mudar um rótulo operacional, revise ajuda e manual.
export const UI_TEXT = Object.freeze({
  actions:Object.freeze({retrySave:"Tentar salvar novamente",confirm:"Confirmar",cancel:"Cancelar",previous:"Anterior",next:"Próxima"}),
  feedback:Object.freeze({recordUnavailable:"Registro indisponível",loading:"Carregando",loadingDescription:"Aguarde enquanto os dados são preparados."}),
  confirmation:Object.freeze({reason:"Motivo",reasonRequired:"Informe o motivo para continuar."}),
  pagination:Object.freeze({label:"Paginação",page:(current,total)=>`Página ${current} de ${total}`}),
});

const inteiro = new Intl.NumberFormat("pt-BR", {maximumFractionDigits:0});

// "3 críticas", "1 crítica", "0 críticas". Substitui o "crítica(s)" de texto de sistema.
// Quem precisa de outra frase para o zero (ex.: "nenhuma pendência") decide no módulo.
export const contar = (quantidade, singular, plural) => {
  const n = Number(quantidade) || 0;
  return `${inteiro.format(n)} ${Math.abs(n) === 1 ? singular : plural}`;
};
