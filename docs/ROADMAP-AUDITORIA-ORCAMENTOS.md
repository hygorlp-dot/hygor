# Implantação da conferência de orçamentos

Revisão em 19/11/2026. A FABEJA R01 é o caso de validação. O motor atual reproduz os R$ 2.000.359,36 e o arredondamento por serviço de suas 305 linhas. Esse total é parcial.

| Etapa | Entrega | Critério de aceite | Estado |
|---|---|---|---|
| 1 | Conferência por item. Reaproveitar a lista navegável e a composição gravada no item. | Identificar 26 preços pendentes, 139 quantitativos zerados e a câmera de R$ 583,51 ante R$ 889,92. | Primeiro recorte local |
| 2 | Revisar pendências por etapa. Incluir filtros, exclusão justificada e indicação de total parcial na tela, no PDF e no Excel. | Itens a medir e a cotar ficam localizáveis. A exclusão tem motivo e identificação. Os três formatos exibem o mesmo total em centavos. | Implementada e validada localmente |
| 3 | Conferir Excel antes de aplicar. Preservar valores originais, comparar o recálculo e a referência selecionada. | A prévia explica diferenças de preço, BDI e arredondamento, aponta os campos faltantes e permite sair sem aplicar. | Implementada e validada localmente |
| 4 | Comparar revisões por item. Usar a identidade rastreável e mostrar mudanças de quantidade, preço, BDI e escopo. | A soma das diferenças explica a variação total. Identidade ambígua fica para conferência. A versão aprovada permanece íntegra. | Implementada e validada localmente |
| 5 | Validar com Engenharia em cópia local e preparar publicação. | Repetir o caso FABEJA, conferir permissões e ajuda, exportar e validar os temas Preciso e Noite em desktop e celular. Publicação depende de solicitação explícita. | Planejada |

## Origem e impacto no DRE

A primeira etapa lê quantidade, preço e composição do próprio item. A composição gravada pode ser histórica. Sua soma é uma evidência para revisão e não atualiza o orçamento automaticamente. Notas em texto livre não fornecem parcelas calculáveis. A competência, a obra e os vínculos existentes continuam como referência nas próximas etapas. Usar `calculateBudget` para conferir totais e manter a precisão do motor.

O caminho desta entrega é `OrcamentoView` → `auditWholeBudget` → painel de conferência. A consulta não chama `save-sections`, grava dados ou cria evento financeiro. A previsão do orçamento de controle só muda pelo fluxo existente de aprovação. Compromisso de compra, entrada física em estoque, custo reconhecido e pagamento conservam seus fluxos e fontes. Na homologação, a projeção realizada deve ser idêntica antes e depois de consultar a auditoria.

O piloto inclui apenas dados locais. O arquivo Excel é evidência, e a ligação entre suas linhas e itens persistidos exige o fluxo de importação e conferência da etapa 3.

## Validação local de 19/11/2026

- O caso FABEJA foi convertido em memória a partir da auditoria do Excel. `auditWholeBudget` apresentou 26 preços pendentes e 139 quantidades zeradas. Na linha 28, comparou R$ 583,51 com R$ 889,92. `calculateBudget` manteve R$ 2.000.359,36. O objeto de entrada ficou idêntico após a consulta.
- Vitest executou 22 testes em quatro arquivos: `budget-workflow`, `composition-search`, `calculations` e `OrcamentoView.workflow`.
- `npm run validate:local` passou com lint, design, manual, arquitetura, tipos e build. A ajuda foi revisada e o manual regenerado com `npm run manual:generate`.
- Chromium, com API simulada e build servido localmente, abriu a ocorrência de preço pendente e destacou a linha correspondente nos temas Preciso e Noite, a 1440 e 390 px. A consulta não gerou chamadas de gravação. A primeira tentativa, pelo servidor de desenvolvimento, excedeu o tempo de carregamento. A verificação foi concluída com o build local.
- A conferência da composição foi verificada no domínio com as parcelas da FABEJA. A validação não incluiu importação Excel pelo app, alteração de uma versão aprovada ou comparação do DRE com dados de produção.

## Etapa 2

Na conferência, o filtro por etapa abrange os subníveis. A medir indica quantidade pendente ou inválida. A cotar indica quantidade positiva e preço pendente ou inválido. O contador de total parcial segue essas duas situações, excluídas as decisões de escopo válidas. O aviso em tela e nas exportações usa a mesma apuração. A Curva ABC conserva seu total de custo direto.

Em rascunhos, a exclusão exige item pendente de valor zero, motivo, pessoa identificada e data. Ela preserva a linha e seus campos de origem. O PDF identifica a decisão na linha e o Excel a inclui na aba Fora do escopo. A reinclusão retira a decisão e devolve o serviço à lista. A decisão se aplica aos dados conferidos da linha. Mudanças de identidade, etapa, descrição, unidade, quantidade ou preço podem reabrir a pendência. Cópia de outra obra ou de pavimento requer nova decisão. A revisão da mesma obra preserva a decisão quando a linha continua correspondente.

A gravação usa o fluxo de orçamento existente. A API valida autoria da nova exclusão no mesmo caminho que protege as versões aprovadas. A alteração não modifica os valores do motor, o orçamento de controle em vigor, compromissos, estoque, custo reconhecido ou pagamentos. A comparação local da projeção do DRE antes e depois do fluxo foi idêntica.

- `npm run validate:local` passou. O manual foi regenerado e verificado. Sete arquivos de testes de domínio, interface e autorização passaram, com 57 testes.
- `output/fabeja/validar-etapa2.mjs` abriu a aplicação compilada em Chromium com API simulada. Os dados partiram das 305 linhas reais extraídas do Excel, sem importar a planilha para o ambiente ativo. A busca por tipo e etapa funcionou nos temas Preciso e Noite a 1440 e 390 px. As capturas foram salvas junto ao PDF de teste.
- A exclusão de teste da laje do térreo exigiu motivo. Depois do recarregamento, o registro manteve responsável, data e justificativa e o aviso mostrou 139 a medir e 25 a cotar. Reincluir devolveu o indicador a 26. As 305 linhas e os R$ 2.000.359,36 foram preservados. O teste usou API simulada com as validações reais de autorização de orçamento.
- O PDF foi impresso em 20 páginas e seu texto confirmou aviso na abertura, total e justificativa. Os arquivos Excel completo e padrão foram baixados e reabertos com total de R$ 2.000.359,36. Ambos e o Excel ABC trouxeram o aviso e a aba de exclusões.
- As capturas do tema Noite mostram contraste baixo em superfícies legadas da planilha abaixo do painel. Os novos filtros, o aviso e as ações ficaram legíveis. Não houve validação com dados de produção.

## Etapa 3

A prévia usa a primeira aba e mantém os valores de origem em memória até a confirmação. Confere quantidade, custo unitário sem BDI, BDI, preço unitário com BDI e total informado por linha. O recálculo original e o valor para importação usam o motor de centavos do MARCELL. Campo ausente ou inválido fica indicado na comparação. A escala do BDI numérico pode ser revista no mapeamento. A soma de origem usa somente serviços e informa seu alcance quando há valores ausentes.

O preço para o orçamento vem das referências vinculadas consultadas por código e fonte, ou do catálogo local disponível quando não há referência vinculada. Composições próprias continuam disponíveis pelo catálogo da empresa. A consulta usa o endpoint existente, com variantes de competência, UF, unidade e preço preservadas para detectar ambiguidades. Divergência de unidade impede aplicar o preço. Um serviço pode entrar pendente, com o campo sem valor zerado, se o operador incluir essas linhas. A prévia mostra esse efeito antes de confirmar.

A FABEJA traz um título numerado `7.4` depois do subnível `7.3`. A importação localiza explicitamente a etapa-pai `7` para esse título. A associação dos serviços segue a validação da etapa numerada anterior. Os valores do rodapé não viram serviços ou etapas.

A origem é o arquivo lido no navegador e as referências cadastradas. A consulta da prévia não grava dados. Uma importação confirmada atualiza a previsão da versão editável pelo salvamento já existente. Nenhum caminho novo registra compromisso, estoque, custo reconhecido ou pagamento. A aprovação da versão de controle continua no fluxo próprio.

No Excel original da FABEJA R01, a leitura local encontrou 305 serviços, 55 etapas, 139 quantidades zeradas e 26 serviços com quantidade positiva e custo zero. As linhas originais e seu recálculo com o motor somaram R$ 2.000.359,36. O BDI sem formatação estava gravado como 0,2212 e foi interpretado como 22,12% após conferência da relação entre os preços. O caso da fôrma da sapata usa referência simulada de R$ 205,00 para validar a comparação com R$ 203,73 no Excel. Esse preço é dado do teste.

- `npm run validate:local` passou. Foram 46 testes em cinco arquivos, cobrindo mapeamento, hierarquia, fluxo de orçamento, variantes na API de referências e leitura de formatos Excel. A ajuda foi revisada e `npm run manual:generate` atualizou o manual.
- `output/fabeja/validar-etapa3.mjs` abriu o arquivo original pelo navegador no build local. Conferiu diferenças, dados faltantes e cancelamento nos temas Preciso e Noite a 1440 e 390 px. O arquivo original foi comparado byte a byte ao final. As capturas foram salvas em `output/fabeja/validacao-etapa3`.
- A consulta às bases e o salvamento usaram API simulada no teste de navegador. A confirmação com pendências desmarcadas gravou somente um serviço na simulação, com referência de R$ 205,00 e total com BDI de R$ 25.659,22 para esse serviço. O DRE simulado permaneceu idêntico. Não foi verificada a vigência de preços em produção. O build local emitiu os avisos conhecidos de `fs` no ExcelJS e concluiu com sucesso.

## Etapa 4

Em **Dados e versões → Comparar revisões**, as duas seleções são limitadas às versões disponíveis da mesma obra com ancestral confirmado pelo vínculo `revisionOf`. Os serviços correspondentes usam o ID preservado na revisão, sem associação por descrição ou código. IDs ausentes ou repetidos aparecem em **Identidade a conferir**. A diferença líquida desse grupo permanece explícita na reconciliação.

O comparador usa `calculateItem` para obter totais em centavos. Nos serviços correspondentes, aplica primeiro a quantidade, depois o preço e por último o BDI efetivo. Isso atribui as interações a quem entra mais tarde no cálculo. O total líquido de inclusões, retiradas, exclusões justificadas, reinclusões e mudanças de unidade, código ou fonte entra em escopo. Mudanças de descrição ou etapa são sinalizadas, com efeito de zero quando não há diferença financeira. Títulos hierárquicos ficam fora da soma. O painel indica quando uma versão tem total parcial.

A origem são as revisões já carregadas no ERP e seus vínculos. A tela funciona em consulta, sem gravar, aprovar, atualizar referências, trocar a linha de base de controle ou afetar compromisso, estoque, custo reconhecido ou pagamento. A abertura e o uso do comparador no teste de navegador não geraram gravações. A versão aprovada e o DRE simulado foram comparados antes e depois.

| Conferência da FABEJA | Resultado |
|---|---:|
| Versão de referência com os 305 serviços do Excel | R$ 2.000.359,36 |
| Revisão simulada a partir da mesma versão | R$ 1.956.506,14 |
| Quantidade | +R$ 560,65 |
| Preço | +R$ 158,96 |
| BDI | +R$ 383,43 |
| Escopo | −R$ 44.956,26 |
| Variação líquida | **−R$ 43.853,22** |

- O cenário parte do levantamento real e simula seis mudanças, incluindo uma exclusão de valor zero. Não trata os arquivos exportados em separado como revisões vinculadas. Uma conta independente em Decimal reproduziu os quatro impactos, e o comparador reconciliou as linhas e os totais em centavos.
- `npm run validate:local` passou. Foram 65 testes direcionados em cinco arquivos, incluindo comparador, motor, hierarquia, fluxo do orçamento e autorização. A ajuda foi atualizada e `npm run manual:generate` regenerou o manual. O build concluiu com avisos conhecidos do ExcelJS sobre `fs`.
- `output/fabeja/validar-etapa4.mjs` abriu o build em Chromium com API simulada. Conferiu as versões selecionáveis, os filtros, a inversão do sentido da comparação, a ausência de gravações, a versão aprovada e o DRE nos temas Preciso e Noite a 1440 e 390 px. As capturas estão em `output/fabeja/validacao-etapa4`.
