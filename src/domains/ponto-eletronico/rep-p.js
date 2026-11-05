// Identificação formal do programa REP-P. Puro.
//
// Campos que a Portaria 671/2021 exige para um REP-P "oficial" ficam aqui,
// mas VAZIOS até existirem de verdade. Em especial:
//   INPI: PENDENTE - executar somente após congelamento da versão final.
// Enquanto houver pendência, nenhuma tela pode dizer "REP-P conforme".
export const REP_P = Object.freeze({
  nomeOficial: null,                  // nome do programa como será registrado (a definir)
  nomeProvisorio: "MARCELL Ponto de Obra",
  versao: "0.2.0-tecnica",            // versão técnica (não é versão registrada)
  desenvolvedor: null,                // razão social/CNPJ do desenvolvedor (a definir)
  inpiRegistrationNumber: null,       // certificado de registro no INPI (pendente)
});

export function situacaoRepP(config = REP_P) {
  const pendencias = [];
  if (!config.nomeOficial) pendencias.push("nome oficial do programa não definido");
  if (!config.desenvolvedor) pendencias.push("desenvolvedor não informado");
  if (!config.inpiRegistrationNumber) pendencias.push("registro no INPI pendente (após congelar a versão final)");
  // Geradores locais não comprovam configuração, assinatura ou operação em
  // produção; preencher um identificador não certifica o sistema.
  pendencias.push("AFD, AEJ, assinatura ICP-Brasil, atestado técnico e acesso do trabalhador dependem de configuração e validação formal");
  return { conforme: false, pendencias, rotulo: "Em desenvolvimento - não é REP-P registrado" };
}
