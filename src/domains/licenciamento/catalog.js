export const LIC_SIMPLIFICADA_PRE = [
  { id:"tipo",      texto:"Residência unifamiliar (qualquer área), OU comércio/serviço até 750 m², OU institucional até 750 m²" },
  { id:"poluidor",  texto:"Atividade de baixo potencial poluidor (isenta de licença ambiental)" },
  { id:"bombeiro",  texto:"Isento de projeto do Corpo de Bombeiros, ou com projeto aprovado pelo órgão" },
  { id:"comar",     texto:"Isento de consulta ao COMAR, ou com anuência do órgão" },
  { id:"tombado",   texto:"Imóvel não tombado nem em processo de tombamento" },
  { id:"iep",       texto:"Imóvel fora da lista de imóvel especial de preservação (IEP)" },
];

export const LIC_SIMPLIFICADA_DOCS = [
  { id:"taxa",           nome:"Taxa administrativa", quando:"sempre", grupo:"Taxas" },
  { id:"procuracao",     nome:"Procuração + documento com foto do proprietário e do procurador",
    quando:"condicional", cond:"Só quando houver procurador", anexo:"ANEXO VIII", grupo:"Proprietário" },
  { id:"titulo",         nome:"Título de propriedade registrado em cartório de Caruaru",
    quando:"sempre", grupo:"Proprietário",
    obs:"Se for contrato ou escritura de compra e venda, anexar também a certidão do cartório do lote - mesmo que do antigo dono." },
  { id:"contrato_social",nome:"Contrato social com último aditivo",
    quando:"condicional", cond:"Só se o proprietário for empresa", grupo:"Proprietário" },
  { id:"iptu",           nome:"Certidão Negativa de débitos do IPTU atualizada", quando:"sempre", grupo:"Proprietário" },
  { id:"docs_foto",      nome:"Cópia de documento com foto de todos que assinam",
    quando:"sempre", grupo:"Proprietário", obs:"Proprietário e responsáveis técnicos." },
  { id:"art_projeto",    nome:"ART ou RRT do projeto arquitetônico", quando:"sempre", grupo:"Responsabilidade técnica" },
  { id:"art_execucao",   nome:"ART ou RRT da execução da obra", quando:"sempre", grupo:"Responsabilidade técnica" },
  { id:"iss_projeto",    nome:"ISS do responsável pelo projeto (ou nota avulsa)", quando:"sempre", grupo:"Responsabilidade técnica" },
  { id:"iss_execucao",   nome:"ISS do responsável pela execução, inscrito em Caruaru",
    quando:"sempre", grupo:"Responsabilidade técnica",
    obs:"Atenção: para execução a prefeitura NÃO aceita nota avulsa. O profissional precisa ter inscrição no município." },
  { id:"elevador",       nome:"ART/RRT + documento com foto + ISS do responsável pelo elevador",
    quando:"condicional", cond:"Se tiver elevador ou mais de 4 pavimentos", grupo:"Responsabilidade técnica" },
  { id:"art_compl",      nome:"ART ou RRT dos projetos complementares",
    quando:"condicional", cond:"Quando houver complementares", grupo:"Responsabilidade técnica" },
  { id:"iss_compl",      nome:"ISS dos projetos complementares (ou nota avulsa)",
    quando:"condicional", cond:"Quando houver complementares", grupo:"Responsabilidade técnica" },
  { id:"termo_prop",     nome:"Termo de responsabilidade do proprietário", quando:"sempre", anexo:"ANEXO III", grupo:"Termos" },
  { id:"termo_projeto",  nome:"Termo de responsabilidade do responsável técnico pelo projeto",
    quando:"sempre", anexo:"ANEXO IV", grupo:"Termos" },
  { id:"termo_exec",     nome:"Termo de responsabilidade do responsável técnico pela execução",
    quando:"sempre", anexo:"ANEXO V", grupo:"Termos" },
  { id:"plantas",        nome:"04 jogos de plantas impressos e assinados + arquivos PDF e DWG",
    quando:"sempre", grupo:"Projeto",
    obs:"Assinados pelo proprietário e pelos responsáveis técnicos." },
];

// Fluxo fornecido pela Associacao Terras Alpha Caruaru. Ele cobre a analise
// interna do condominio e a liberacao posterior ao alvara da Prefeitura, para
// que o operador nao confunda "projeto aprovado" com "obra liberada".
const LIC_TERRAS_ALPHA_PRE = [
  { id:"normas_condominio", texto:"Projeto conferido conforme o Regulamento do Condomínio Terras Alpha Caruaru e o plano diretor do Município" },
  { id:"titularidade", texto:"Proprietário do projeto confere com o titular do lote/quadra e com os documentos de propriedade" },
  { id:"adimplencia", texto:"Associado adimplente com as despesas da Associação" },
  { id:"fiduciaria", texto:"Situação fiduciária do lote verificada; certidão atualizada disponível quando houver alienação ou gravame" },
];

const LIC_TERRAS_ALPHA_DOCS = [
  { id:"projeto_arquitetonico", nome:"Projeto arquitetônico no padrão da Prefeitura", quando:"sempre", grupo:"Projeto arquitetônico", obs:"Incluir plantas de todos os pavimentos, implantação, localização e cobertura." },
  { id:"elevacoes", nome:"Elevações de todas as fachadas", quando:"sempre", grupo:"Projeto arquitetônico" },
  { id:"cortes", nome:"Mínimo de dois cortes", quando:"sempre", grupo:"Projeto arquitetônico" },
  { id:"levantamento_planialtimetrico", nome:"Levantamento planialtimétrico - 1 via", quando:"sempre", grupo:"Projetos e levantamentos" },
  { id:"projeto_hidrossanitario", nome:"Projeto hidrossanitário de águas pluviais, esgoto e vazão da piscina", quando:"condicional", cond:"Obrigatório quando houver piscina", grupo:"Projetos e levantamentos" },
  { id:"estudo_solo", nome:"Estudo do solo (sondagem) ou Termo de Responsabilidade da Sondagem", quando:"sempre", grupo:"Projetos e levantamentos", obs:"O termo deve ter firma reconhecida. Quando escolhido, deve ser solicitado por e-mail à Associação." },
  { id:"contrato_compra", nome:"Contrato de compra do imóvel - cópia integral", quando:"sempre", grupo:"Propriedade", obs:"Deve constar o nome do proprietário do projeto e a identificação do lote/quadra." },
  { id:"certidao_propriedade", nome:"Certidão de propriedade atualizada", quando:"sempre", grupo:"Propriedade", obs:"Em nome do proprietário que consta no projeto; entregar antes da liberação da obra." },
  { id:"termo_inscricao", nome:"Termo de inscrição no Loteamento Terras Alpha Caruaru", quando:"sempre", grupo:"Propriedade", obs:"Confirmar com o Setor Administrativo da Associação se o proprietário já possui o termo." },
  { id:"art_rrt_projeto", nome:"ART ou RRT do responsável técnico pelo projeto", quando:"sempre", grupo:"Responsabilidade técnica" },
  { id:"art_rrt_execucao", nome:"ART ou RRT do responsável técnico pela execução da obra", quando:"sempre", grupo:"Responsabilidade técnica" },
  { id:"croqui_canteiro", nome:"Croqui do canteiro, acesso e ligações provisórias", quando:"sempre", grupo:"Execução", obs:"Indicar local de acesso, sanitário e ligações de água e energia." },
  { id:"dwg_projeto", nome:"Arquivo digital do projeto arquitetônico em DWG", quando:"sempre", grupo:"Entrega digital", obs:"Enviar por e-mail ao setor responsável pela análise." },
  { id:"memorial_areas", nome:"Memorial de cálculo de áreas conforme modelo padrão", quando:"sempre", grupo:"Entrega digital" },
];

export const LIC_TERRAS_ALPHA_VERIFICACAO = [
  { id:"condominio_aprovado", nome:"Projeto aprovado pelo Condomínio" },
  { id:"prefeitura_aprovada", nome:"Projeto aprovado e licença de construção emitida pela Prefeitura" },
  { id:"licenca_entregue", nome:"Cópia da licença de construção entregue à Associação" },
  { id:"vias_carimbadas", nome:"Vias impressas aprovadas devolvidas à Associação para carimbo e assinatura" },
  { id:"via_arquivada", nome:"Uma via do projeto ficou arquivada na Associação" },
  { id:"adimplencia_confirmada", nome:"Adimplência e situação fiduciária confirmadas na liberação" },
  { id:"liberacao_emitida", nome:"Termo/autorização de liberação da obra emitido pela Associação" },
];

export const CONDOMINIOS_PADRAO = [{
  id:"cond-terras-alpha-caruaru", nome:"Terras Alpha Caruaru", cidade:"Caruaru", uf:"PE",
  cep:"55038-215", endereco:"Rua Quitéria Luiza da Silva Nova, 35 - Universitário, Empresarial Ethos, sala 810",
  contato:"Departamento Técnico", telefone:"", email:"", checklistTipo:"terras_alpha_caruaru", ativo:true,
  atendimento:"Segunda a sexta, das 08:00 às 12:00. Análises iniciadas na segunda e na quarta-feira após a entrega.",
  observacoes:"A entrega do projeto é presencial. A aprovação do condomínio antecede o protocolo na Prefeitura.",
}];

export const LICENCAS = [
  { id:"simplificada", orgao:"URB Caruaru", nome:"Licença de Construção Simplificada",
    prazo:"10 dias úteis",
    finalidade:"Atesta que o projeto atende a legislação vigente e que existe responsável técnico pela execução.",
    pre:LIC_SIMPLIFICADA_PRE, docs:LIC_SIMPLIFICADA_DOCS },
  { id:"terras_alpha_caruaru", orgao:"Associação Terras Alpha Caruaru", nome:"Aprovação e liberação de obra",
    prazo:"Conforme calendário de análise da Associação",
    finalidade:"Organiza a aprovação condominial, o protocolo municipal e a liberação definitiva para iniciar a obra.",
    pre:LIC_TERRAS_ALPHA_PRE, docs:LIC_TERRAS_ALPHA_DOCS },
];
export const licencaPorId = id => LICENCAS.find(l => l.id === id) || LICENCAS[0];

