export const INCOME_RECONCILIATION_CATEGORIES = [
  { id:"receita", label:"Recebimento de cliente a vincular", effect:"unallocated", group:"a_classificar", groupLabel:"Recebimentos a vincular",
    description:"Vincule à medição ou ao contrato existente. Sem vínculo, o valor fica no caixa a classificar e não reconhece receita novamente." },
  { id:"receita_servicos", label:"Receita de serviços", effect:"revenue", group:"receitas", groupLabel:"Receitas no DRE",
    description:"Reconhece uma nova receita na competência informada. Use somente quando o serviço ainda não estiver lançado no sistema." },
  { id:"outras_receitas", label:"Outras receitas", effect:"revenue", group:"receitas", groupLabel:"Receitas no DRE",
    description:"Reconhece uma nova receita na competência informada. Compras, medições e recebimentos já cadastrados devem ser vinculados." },
  { id:"aporte_cliente", label:"Aporte / Adiantamento de cliente", effect:"funding", group:"sem_dre", groupLabel:"Entradas sem efeito no DRE",
    description:"Registra recurso recebido no caixa, sem reconhecer faturamento." },
  { id:"capital_socio", label:"Aporte de sócio", effect:"funding", group:"sem_dre", groupLabel:"Entradas sem efeito no DRE",
    description:"Aporte de capital: entrada de caixa sem receita no DRE." },
  { id:"credito", label:"Empréstimo / Financiamento recebido", effect:"loan", group:"sem_dre", groupLabel:"Entradas sem efeito no DRE",
    description:"Empréstimo recebido: entrada de caixa sem receita no DRE." },
  { id:"outros_recursos", label:"Outros recursos sem efeito no DRE", effect:"funding", group:"sem_dre", groupLabel:"Entradas sem efeito no DRE",
    description:"Movimento de caixa explicitamente classificado sem efeito no resultado." },
];

export const incomeCategoryEffect = category => INCOME_RECONCILIATION_CATEGORIES.find(item => item.id === category)?.effect || "unallocated";

export const receiptRecognitionDate = receipt => {
  const competence = String(receipt?.competencia || "");
  const date = String(receipt?.dataReconhecimento || receipt?.date || receipt?.data || "").slice(0,10);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(competence) && !date.startsWith(competence)) return `${competence}-01`;
  return date || (competence ? `${competence}-01` : "");
};

// Um recebimento pode liquidar um fato já reconhecido. Só a classificação
// explícita de receita nova reconhece outro fato; texto bancário não decide.
export const classifyReceiptForDre = receipt => {
  const linked = Boolean(receipt?.medicaoId || receipt?.contratoId);
  const effect = incomeCategoryEffect(receipt?.categoria);
  const recognizeRevenue = !linked && receipt?.efeitoDRE === "receita" && effect === "revenue";
  const funding = !linked && receipt?.efeitoDRE === "sem_efeito" && ["funding", "loan"].includes(effect);
  return { recognizeRevenue, funding, unallocated:!linked && !recognizeRevenue && !funding,
    category:receipt?.categoria || "recebimento_avulso" };
};
