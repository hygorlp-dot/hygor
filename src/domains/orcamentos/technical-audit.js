const normalizeAuditText = value => String(value || "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Auditoria tecnica reproduzivel do escopo. A IA recebe estes achados depois,
// mas nao decide sozinha se algo esta faltando: primeiro aplicamos regras
// objetivas e distinguimos erro provavel, confirmacao de escopo e cotacao.
export const auditBudgetTechnicalScope = (orc, areaConstruida) => {
  const itens = (orc?.itens || []).filter(item => item.tipo !== "titulo");
  // Etapas padrao vazias nao contam como servico existente. So a descricao do
  // orcamento e as linhas efetivamente lancadas alimentam as verificacoes.
  const texto = normalizeAuditText([orc?.descricao, ...itens.map(item => item.descricao)].join(" | "));
  const tem = (...termos) => termos.some(termo => texto.includes(normalizeAuditText(termo)));
  const achados = [];
  const add = (nivel, titulo, detalhe, id = "") => {
    const estavel=id||`${nivel}-${normalizeAuditText(titulo).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,72)}`;
    const acaoSugerida=nivel==="cotacao"?"Obter e comparar cotações com escopo equivalente.":nivel==="escopo"?"Confirmar inclusão, exclusão e responsabilidade com cliente/projetista.":"Localizar o item relacionado, corrigir o orçamento e registrar a justificativa.";
    achados.push({ id:estavel, nivel, titulo, detalhe, acaoSugerida });
  };

  const semQuantidade = itens.filter(item => !(Number(item.quantidade) > 0));
  const semPreco = itens.filter(item => !(Number(item.precoUnit) > 0));
  if (semQuantidade.length) add("critico", `${semQuantidade.length} item(ns) sem quantidade`,
    `Revisar: ${semQuantidade.slice(0,4).map(item=>item.descricao||item.codigo||"item sem descrição").join("; ")}.`);
  if (semPreco.length) add("critico", `${semPreco.length} item(ns) sem preço`,
    `O total está subestimado enquanto houver custo unitário zerado. Exemplos: ${semPreco.slice(0,4).map(item=>item.descricao||item.codigo||"item sem descrição").join("; ")}.`);
  if (!(Number(areaConstruida) > 0)) add("atencao", "Área construída não informada",
    "Sem a área de referência não é possível testar quantitativos por m² nem custo por m².");
  if (!orc?.dataBase) add("atencao", "Data-base de preços não informada",
    "Defina a competência das referências e a data das cotações para permitir atualização e rastreabilidade.");

  const porCodigo = new Map();
  itens.filter(item=>item.codigo).forEach(item=>{
    const chave=`${String(item.fonte||"").toUpperCase()}|${String(item.codigo).trim().toUpperCase()}`;
    porCodigo.set(chave,[...(porCodigo.get(chave)||[]),item]);
  });
  const repetidos=[...porCodigo.values()].filter(lista=>lista.length>1);
  if(repetidos.length)add("atencao",`${repetidos.length} código(s) repetido(s)`,
    "Pode ser distribuição legítima entre ambientes/etapas, mas confirme se as quantidades não foram duplicadas.");

  const gruposCotacao = [
    {nome:"Bancadas e pedras", termos:["bancada","granito","marmore","quartzo","silestone"]},
    {nome:"Esquadrias e vidros", termos:["esquadria","janela","porta de aluminio","pele de vidro","box de vidro","vidro temperado"]},
    {nome:"Marcenaria", termos:["marcenaria","armario planejado","movel planejado"]},
    {nome:"Ar-condicionado", termos:["ar condicionado","split","vrf","climatizacao"]},
    {nome:"Hidromassagem", termos:["hidromassagem","spa ","banheira"]},
    {nome:"Sistemas especiais", termos:["elevador","energia solar","fotovolta","automacao","piscina"]},
  ];
  gruposCotacao.forEach(grupo=>{
    const encontrados=itens.filter(item=>grupo.termos.some(t=>normalizeAuditText(item.descricao).includes(normalizeAuditText(t))));
    const oficiais=encontrados.filter(item=>!/^(COTA[CÇ][AÃ]O|EXTERNO|PR[ÓO]PRIA)$/.test(String(item.fonte||"").trim().toUpperCase()));
    if(oficiais.length)add("cotacao",`${grupo.nome}: validar por cotação`,
      `${oficiais.length} item(ns) usam preço de base oficial. Para fornecimento sob medida, confirme escopo, marca, medidas, instalação, frete e validade com fornecedores.`);
  });

  if (tem("porcelanato","ceramica","revestimento de piso","piso vinilico","piso laminado") && !tem("rodape")) add("atencao","Rodapés não localizados",
    "Confirmar rodapé, recortes, perdas, soleiras, perfis de transição e rejuntamento compatíveis com os pisos.");
  if (tem("telha","telhado","cobertura") && !tem("calha","rufo","condutor pluvial")) add("atencao","Complementos da cobertura não localizados",
    "Conferir rufos, calhas, condutores, arremates, fixações, impermeabilização e testes de estanqueidade.");
  if (tem("alvenaria","bloco ceramico","tijolo") && !tem("verga","contraverga")) add("atencao","Vergas e contravergas não localizadas",
    "Conferir reforços sobre e sob vãos, encunhamento, telas de ligação e tratamento de interfaces.");
  if (tem("instalacao eletrica","eletroduto","cabo eletrico","tomada") && !tem("aterramento","quadro de distribuicao","disjuntor")) add("critico","Proteções elétricas não localizadas",
    "Conferir quadros, disjuntores, DR, DPS, aterramento, equipotencialização, identificação e ensaios. SPDA depende do projeto e da análise de risco.");
  if (tem("esgoto","agua fria","agua quente","hidraulica") && !tem("louca sanitaria","vaso sanitario","torneira","registro")) add("atencao","Louças, metais e acessórios não localizados",
    "Confirmar se são fornecidos pela contratada ou pelo cliente e incluir instalação, acabamentos, sifões, válvulas e testes.");
  if (tem("ar condicionado","split","vrf","climatizacao")) {
    if (!tem("dreno de ar","tubulacao frigor","linha frigor","cobre para ar")) add("critico","Infraestrutura frigorígena/drenos não localizada",
      "Conferir linhas de cobre com isolamento, drenos com caimento, passagens, suportes, vácuo, teste e comissionamento.");
    if (!tem("circuito ar condicionado","ponto eletrico ar","alimentacao ar condicionado")) add("atencao","Alimentação elétrica do ar-condicionado não localizada",
      "Prever circuitos dedicados, proteção, seccionamento e compatibilidade com as cargas dos equipamentos cotados.");
  } else add("escopo","Ar-condicionado: confirmar escopo",
    "Confirmar se haverá apenas infraestrutura ou também equipamentos, instalação, drenos, elétrica dedicada e comissionamento. Equipamentos normalmente exigem cotação.");
  if (tem("hidromassagem","spa ","banheira")) {
    if (!tem("ponto hidromassagem","circuito hidromassagem","alimentacao hidromassagem")) add("critico","Pontos dedicados da hidromassagem não localizados",
      "Conferir água quente/fria, esgoto, acesso para manutenção, circuito com DR e aterramento, base, vedação e teste de funcionamento.");
  } else add("escopo","Hidromassagem/SPA: confirmar escopo",
    "Mesmo quando o equipamento é do cliente, podem faltar base, impermeabilização, pontos hidráulicos, esgoto, elétrica dedicada e acesso técnico.");
  if (!tem("bancada","granito","marmore","quartzo")) add("escopo","Bancadas e pedras: confirmar escopo",
    "Conferir bancadas, cubas, frontões, saias, soleiras, peitoris, nichos, furos, transporte e instalação. Preferir cotação por projeto/medição.");
  if (!tem("esquadria","janela","porta de aluminio","vidro temperado")) add("escopo","Esquadrias e vidros: confirmar escopo",
    "Conferir tipologia, perfis, ferragens, vidros, telas, acabamento, contramarcos, instalação e desempenho. Preferir cotação por mapa de vãos.");
  if (!tem("limpeza final","as built","comissionamento","manual de uso")) add("escopo","Entrega e encerramento pouco detalhados",
    "Confirmar limpeza final, testes/comissionamento, as built, manuais, garantias, desmobilização e entrega técnica.");

  const ordem = { critico:0, atencao:1, cotacao:2, escopo:3 };
  achados.sort((a,b)=>ordem[a.nivel]-ordem[b.nivel]);
  return {
    achados,
    resumo: {
      criticos: achados.filter(a=>a.nivel==="critico").length,
      atencoes: achados.filter(a=>a.nivel==="atencao").length,
      cotacoes: achados.filter(a=>a.nivel==="cotacao").length,
      escopo: achados.filter(a=>a.nivel==="escopo").length,
    },
  };
};

