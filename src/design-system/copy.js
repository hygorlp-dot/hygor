// Somente linguagem compartilhada. Textos de negócio pertencem ao módulo.
// Preserve chaves; ao mudar um rótulo operacional, revise ajuda e manual.
export const UI_TEXT = Object.freeze({
  actions:Object.freeze({confirm:"Confirmar",cancel:"Cancelar",previous:"Anterior",next:"Próxima"}),
  feedback:Object.freeze({recordUnavailable:"Registro indisponível",loading:"Carregando",loadingDescription:"Aguarde enquanto os dados são preparados."}),
  confirmation:Object.freeze({reason:"Motivo",reasonRequired:"Informe o motivo para continuar."}),
  pagination:Object.freeze({label:"Paginação",page:(current,total)=>`Página ${current} de ${total}`}),
});
