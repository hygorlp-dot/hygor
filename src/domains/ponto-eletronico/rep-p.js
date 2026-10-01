// Identificação formal do programa REP-P. Puro.
//
// Campos que a Portaria 671/2021 exige para um REP-P "oficial" ficam aqui,
// mas VAZIOS até existirem de verdade. Em especial:
//   INPI: PENDENTE - executar somente após congelamento da versão final.
// Enquanto houver pendência, nenhuma tela pode dizer "REP-P conforme".
export const REP_P = Object.freeze({
  nomeOficial: null,                  // nome do programa como será registrado (a definir)
  nomeProvisorio: "ARCD Ponto de Obra",
  versao: "0.2.0-tecnica",            // versão técnica (não é versão registrada)
  desenvolvedor: null,                // razão social/CNPJ do desenvolvedor (a definir)
  inpiRegistrationNumber: null,       // certificado de registro no INPI (pendente)
});

export function situacaoRepP(config = REP_P) {
  const pendencias = [];
  if (!config.nomeOficial) pendencias.push("nome oficial do programa não definido");
  if (!config.desenvolvedor) pendencias.push("desenvolvedor não informado");
  if (!config.inpiRegistrationNumber) pendencias.push("registro no INPI pendente (após congelar a versão final)");
  // Demais requisitos formais (AFD, comprovante assinado, atestado técnico)
  // são da Fase 2 em diante - por isso "conforme" fica falso nesta fase
  // mesmo que os campos acima sejam preenchidos.
  pendencias.push("AFD, comprovante eletrônico assinado e atestado técnico ainda não implementados");
  return { conforme: false, pendencias, rotulo: "Em desenvolvimento - não é REP-P registrado" };
}
