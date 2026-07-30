export const COMPANY_EXPENSE_GROUPS = Object.freeze([
  { id:"pessoal", label:"Pessoal e benefícios", shortLabel:"Pessoal" },
  { id:"ocupacao", label:"Ocupação e infraestrutura", shortLabel:"Ocupação" },
  { id:"administrativo", label:"Administrativo e tecnologia", shortLabel:"Administrativo" },
  { id:"comercial", label:"Comercial, viagens e mobilidade", shortLabel:"Comercial e viagens" },
  { id:"financeiro", label:"Despesas financeiras", shortLabel:"Financeiro" },
  { id:"fiscal", label:"Tributos, taxas e obrigações", shortLabel:"Fiscal" },
  { id:"outros", label:"Outras despesas operacionais", shortLabel:"Outros" },
]);

export const COMPANY_EXPENSE_CATEGORIES = Object.freeze([
  { id:"pessoal_admin", label:"Salários administrativos", group:"pessoal" },
  { id:"beneficios_admin", label:"Benefícios administrativos", group:"pessoal" },
  { id:"encargos_admin", label:"Encargos trabalhistas administrativos", group:"pessoal" },
  { id:"recrutamento", label:"Recrutamento e seleção", group:"pessoal" },
  { id:"treinamentos", label:"Treinamentos e capacitação", group:"pessoal" },
  { id:"medicina_trabalho", label:"Medicina e segurança do trabalho", group:"pessoal" },

  { id:"aluguel", label:"Aluguel da sede", group:"ocupacao" },
  { id:"condominio", label:"Condomínio", group:"ocupacao" },
  { id:"energia", label:"Energia elétrica", group:"ocupacao" },
  { id:"agua", label:"Água e saneamento", group:"ocupacao" },
  { id:"internet", label:"Internet", group:"ocupacao" },
  { id:"comunicacao", label:"Telefonia e comunicação", group:"ocupacao" },
  { id:"limpeza_escritorio", label:"Limpeza e conservação", group:"ocupacao" },
  { id:"manutencao_sede", label:"Manutenção da sede", group:"ocupacao" },
  { id:"seguranca_sede", label:"Segurança e monitoramento", group:"ocupacao" },

  { id:"material_adm", label:"Material de escritório", group:"administrativo" },
  { id:"software", label:"Softwares e assinaturas", group:"administrativo" },
  { id:"equipamentos_escritorio", label:"Equipamentos de escritório", group:"administrativo" },
  { id:"correios", label:"Correios, cartuchos e impressões", group:"administrativo" },
  { id:"terceiros", label:"Serviços administrativos terceirizados", group:"administrativo" },
  { id:"contabilidade", label:"Contabilidade e advocacia", group:"administrativo" },

  { id:"viagens", label:"Passagens e viagens", group:"comercial" },
  { id:"hospedagem", label:"Hospedagem", group:"comercial" },
  { id:"alimentacao_viagem", label:"Alimentação em viagem", group:"comercial" },
  { id:"veiculo", label:"Veículos", group:"comercial" },
  { id:"combustivel", label:"Combustível", group:"comercial" },
  { id:"pedagio_estacionamento", label:"Pedágio e estacionamento", group:"comercial" },
  { id:"marketing", label:"Marketing e publicidade", group:"comercial" },
  { id:"representacao", label:"Representação e relacionamento", group:"comercial" },

  { id:"tarifas_bancarias", label:"Tarifas bancárias", group:"financeiro" },
  { id:"juros_multas", label:"Juros e multas", group:"financeiro" },
  { id:"taxas_cartao", label:"Anuidade e taxas de cartão", group:"financeiro" },
  { id:"adquirencia", label:"Taxas de adquirência", group:"financeiro" },
  { id:"seg_fianca", label:"Seguros e fianças", group:"financeiro" },

  { id:"imposto_simples", label:"Simples Nacional e ISS", group:"fiscal" },
  { id:"imposto_ir", label:"IR e CSLL", group:"fiscal" },
  { id:"taxa_cartorio", label:"Taxas e cartório", group:"fiscal" },
  { id:"crea", label:"CREA, IBAPE e anuidades", group:"fiscal" },

  { id:"outros", label:"Outras despesas operacionais", group:"outros" },
]);

export const COMPANY_PAYMENT_METHODS = Object.freeze([
  { id:"", label:"Não informado" },
  { id:"pix", label:"PIX" },
  { id:"boleto", label:"Boleto" },
  { id:"transferencia", label:"Transferência bancária" },
  { id:"debito_automatico", label:"Débito automático" },
  { id:"cartao_credito", label:"Cartão de crédito" },
  { id:"cartao_debito", label:"Cartão de débito" },
  { id:"dinheiro", label:"Dinheiro" },
  { id:"outro", label:"Outro" },
]);

const categoryById = new Map(COMPANY_EXPENSE_CATEGORIES.map(item => [item.id, item]));
const groupById = new Map(COMPANY_EXPENSE_GROUPS.map(item => [item.id, item]));

export const companyExpenseCategory = category =>
  categoryById.get(String(category || "")) || categoryById.get("outros");

export const companyExpenseGroup = category =>
  groupById.get(companyExpenseCategory(category).group) || groupById.get("outros");

export const companyExpenseCategoryOptions = () =>
  COMPANY_EXPENSE_GROUPS.flatMap(group => [
    { v:`__group_${group.id}`, l:group.label, disabled:true },
    ...COMPANY_EXPENSE_CATEGORIES
      .filter(category => category.group === group.id)
      .map(category => ({ v:category.id, l:`  ${category.label}` })),
  ]);

export const emptyCompanyExpenseGroupTotals = () =>
  Object.fromEntries(COMPANY_EXPENSE_GROUPS.map(group => [group.id, 0]));

