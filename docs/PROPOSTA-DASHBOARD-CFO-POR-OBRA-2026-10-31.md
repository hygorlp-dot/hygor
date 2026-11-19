# Proposta de gestão financeira por obra · MARCELL

Pesquisa e desenho funcional em 31/10/2026. Documento de proposta, sem alterações no produto, cálculos, permissões, dados ou publicação. Nenhum valor ilustrativo representa a empresa.

## Objetivo e públicos

A diretoria precisa saber quais obras geram resultado, quanto falta gastar e onde faltará caixa. O gestor precisa localizar o desvio, sua etapa e sua origem. O cliente precisa acompanhar os recursos e as despesas da própria obra com documentos e regras contratuais claras.

Organizar três visões conectadas, com escopos próprios:

1. Carteira da empresa: resultado e risco comparados entre obras.
2. Financeiro completo da obra: custos, orçamento, caixa, rateio e previsão.
3. Prestação de contas do cliente: entradas e saídas autorizadas da obra, pendências e documentos, com projeção específica no servidor.

## Referências de mercado verificadas

| Referência oficial | Padrão observado | Aplicação proposta ao MARCELL |
|---|---|---|
| [Procore · orçamento](https://support.procore.com/faq/what-are-procores-standard-budget-views) | Orçamento revisado, compromissos, custos e estimativa para concluir | Colunas com definições explícitas e prevenção de sobreposição entre pedido, nota e pagamento |
| [Buildertrend · Job Costing](https://buildertrend.com/help-article/job-costing-budget-overview/) | Custos por código, dados de suporte acessíveis na linha, previsão e rentabilidade conforme contrato | Hierarquia obra → etapa → categoria → lançamento; resultado adaptado ao tipo de contrato |
| [Buildertrend · cliente](https://buildertrend.com/help-article/client-contacts-overview/) | Escolha dos campos financeiros e itens relacionados que o cliente pode consultar | Prestação de contas específica, com itens/documentos autorizados e sem espelhar dados internos |
| [Sienge · rateio padrão](https://ajuda.sienge.com.br/support/solutions/articles/153000200121-para-que-serve-a-funcionalidade-rateio-padr%C3%A3o-e-como-cadastrar-um-rateio-padr%C3%A3o-) | Apropriações por centro de custo, conta financeira e percentual | Critérios de rateio explícitos e memória de cálculo, em vez de divisão implícita |
| [Autodesk Build · performance](https://help.autodesk.com/cloudhelp/ENU/Build-Cost/files/forecast/Cost_Performance_Tracking.html) | Comparação entre recursos, avanço e impacto no custo final | Relacionar mão de obra e avanço físico quando houver unidades e medições suficientes |
| [Vobi · físico-financeiro](https://ajuda.vobi.com.br/pt-br/articles/9071053-otimize-o-controle-da-sua-obra-com-o-cronograma-fisico-financeiro-e-a-curva-s-na-vobi) | Planejado versus realizado e curva S seguindo o orçamento | Integrar o resultado à estrutura de etapas e ao cronograma |
| [Vobi · DRE](https://ajuda.vobi.com.br/pt-br/articles/9641347-como-analisar-os-resultados-da-sua-empresa-com-o-dre-gerencial) | DRE por competência com filtros por projeto e centro de custo | Manter explícita a diferença entre resultado e caixa |

Referências são padrões de produto; não constituem validação dos dados ou das fórmulas do MARCELL. Nesta rodada a Vobi foi consultada pela documentação oficial, sem nova varredura autenticada.

Skills consultadas: `data-dashboard-design` para público, hierarquia, gráficos e detalhamento; `impeccable` para experiência operacional e legibilidade; `shadcn` para reaproveitar os componentes da aplicação; `brainstorming` para definir o desenho antes de alterar o produto.

## O que já existe e será reaproveitado

- Central de relatórios: resultado por competência, caixa realizado e títulos em aberto, com agrupamentos e exportações (`src/domains/financeiro/report-center.js`).
- Controle por etapa: orçamento, comprometido, material recebido, incorrido, pago, pagamento direto do cliente, custo restante, contingência e desvios (`work-stage-costs.js`). “Recebido” nesse contexto é recebimento de compras, não recebimento financeiro.
- Projeção de mão de obra: separação de parcelas apuradas, estimadas, reservas e pendências (`src/domains/ponto/labor-projection.js`).
- Memoriais, consulta de documentos originais, filtros e leitor do OneDrive já existentes.
- Contratos diferenciados no DRE, inclusive base e percentual da taxa de administração (`src/domains/dre/calculations.js`).
- Portal com projeção de dados por obra. A política atual restringe custos internos; a prestação de contas nova precisa de uma projeção própria com campos autorizados, em vez de enviar o razão interno e ocultá-lo visualmente.

Não foi localizado, nos módulos examinados, um motor específico de distribuição mensal da administração central com política versionada e memória de cálculo. A taxa contratual de administração existente tem outra finalidade. A revisão deverá também evitar reutilizar como “lucro completo” indicadores de contrato cujo cálculo considera apenas receita e mão de obra.

## Visão da carteira

Topo com no máximo seis indicadores: resultado gerencial do período, margem final prevista, necessidade de caixa em 30 dias, recebíveis vencidos, compromissos ainda abertos e montante sem classificação confiável. Cada valor abre seu memorial.

Tabela principal por obra: cliente, modalidade contratual, orçamento revisado, custo incorrido direto, administração rateada, custo final previsto, margem prevista e necessidade de caixa. A rentabilidade deve explicitar quais categorias estão incluídas. Se faltam componentes relevantes, apresentar resultado parcial, sem chamar de lucro líquido.

Alertas: custo final acima do orçamento; margem abaixo da meta configurada da obra; caixa projetado negativo; atraso de recebimento; orçamento ou previsão vencidos; despesas sem obra; documentos ausentes; extrato desatualizado. Limiares e responsáveis não serão inventados: dependem da configuração e das permissões existentes.

## Financeiro completo da obra

Cabeçalho persistente: obra/cliente, modalidade contratual, período, data de corte, última atualização e qualidade da base. Atalhos para orçamento, medições, documentos e memorial. Período mensal e acumulado desde o início devem ficar distinguíveis.

As áreas propostas são **Resumo, Custos, Mão de obra, Materiais e terceiros, Administração central, Caixa e previsão, Prestação de contas e Pendências**. No celular, seletor de área e linhas expansíveis; sem comprimir uma planilha extensa em colunas ilegíveis.

Resumo com seis indicadores: custo incorrido total com rateio; resultado gerencial; custo final previsto; desvio previsto contra orçamento; necessidade de caixa; obrigações vencidas. Caixa precisa de abertura e cobertura para exibir saldo; movimentos líquidos não serão chamados de saldo bancário.

Gráficos: barras por categoria comparando orçamento e custo; evolução mensal do custo; caixa realizado e projetado com mudança visual da previsão; ponte entre receita, custos diretos, rateio e resultado. A tabela continua sendo a base de conferência.

Tabela de custos com agrupamento selecionável por etapa, categoria ou contraparte. Colunas de orçamento original/revisado, incorrido, pago, comprometido em aberto, estimativa restante e custo final previsto. Perfis de colunas evitam exibir todas ao mesmo tempo.

## Categorias e detalhes

| Grupo | Composição a apresentar | Detalhamento de conferência |
|---|---|---|
| Mão de obra direta | Remuneração, encargos cadastrados, benefícios, horas extras, parcelas de rescisão/provisões quando disponíveis | Pessoa, função, dias/horas, valor-base, componente, obra/etapa, período e origem do cálculo |
| Terceirizados | Contratos e medições, retenções registradas, custos reconhecidos e pagamentos | Contrato, medição, fornecedor/prestador, saldo e documentos |
| Materiais | Itens adquiridos, recebidos, devolvidos e custos reconhecidos conforme política atual | Pedido, nota, fornecedor, item, quantidade, unidade, frete, desconto, obra/etapa e anexo |
| Equipamentos | Locações, uso próprio, manutenção e mobilização quando apropriados à obra | Equipamento, utilização, contrato, critério de apropriação e fonte |
| Outros custos diretos | Transporte, alojamento, serviços técnicos, taxas, seguros e demais categorias cadastradas | Registro de origem, beneficiário, critério e documento |
| Administração central | Parcela gerencial das despesas compartilhadas elegíveis | Despesa original, grupo de rateio, base, percentual e valor atribuído |

Subtotais distintos para apurado, estimado/provisionado e sem base. Não tratar parcela ausente como zero. A projeção da quinzena mostrada no anexo não deve ser apresentada como custo histórico integral de toda a obra.

O custo de mão de obra será apropriado pelo vínculo histórico efetivo de dias/horas, quando disponível, não pela obra atual do cadastro. Componentes e períodos fechados precisam preservar sua origem. Ponto, folha e Pix são etapas do mesmo fato e não três custos.

Uma nota paga não representa custo novo além da nota reconhecida. Pedido, recebimento de material, nota, pagamento e consumo devem manter suas identidades. Compra recebida não significa automaticamente consumo de estoque.

## Rateio proporcional da administração central

Recomendação de desenho: grupos mensais de despesas compartilhadas, cada qual com critério justificável. Custos identificáveis de uma obra vão diretamente para ela; somente o restante elegível integra o rateio.

Critérios suportados na proposta:

- Horas de equipe central registradas por obra, quando existentes.
- Horas de mão de obra direta ou custo direto incorrido para grupos de apoio à execução.
- Receita reconhecida quando ela for comparável entre as obras e fizer sentido para o grupo.
- Percentuais fixos justificados ou critério contratual, com vigência.

Não definir receita como padrão universal: uma obra por administração pode movimentar recursos de terceiros que não são receita da construtora. Também não presumir horas de equipe central quando elas não são registradas.

Fórmula da simulação mensal: **despesas compartilhadas elegíveis × base da obra ÷ soma das bases das obras elegíveis**.

Exemplo fictício: grupo administrativo de R$ 10.000 e bases de 40%, 35% e 25% resulta em R$ 4.000, R$ 3.500 e R$ 2.500. A interface mostrará tanto os lançamentos que formam os R$ 10.000 quanto os valores que compõem as bases e os percentuais.

Regras necessárias:

- Denominador usa todas as obras elegíveis da política; filtrar uma obra na tela não altera seu percentual.
- Obras elegíveis e período de execução são explícitos; situação atual da obra não reescreve meses anteriores.
- Despesa já apropriada diretamente ou já distribuída não volta ao grupo.
- Sem base válida, manter montante não rateado e avisar; não dividir igualmente de forma silenciosa.
- Cálculos em centavos, com regra determinística para resíduos e total conferível.
- Versão da regra, vigência, responsáveis e histórico; simulação separada de eventual aprovação futura.
- A administração central entra uma única vez no consolidado da empresa. Sua distribuição às obras é uma visão de atribuição, não uma nova despesa ou novo pagamento.
- Mostrar resultado antes e depois do rateio e conciliação do total atribuído com a origem.
- **Taxa cobrada do cliente e administração central rateada ficam em linhas distintas.** O rateio gerencial não cria cobrança nem saída de caixa do cliente.

## Resultado e previsão

Receita da construtora segue a modalidade do contrato e sua política existente. Aporte do cliente, empréstimo ou transferência não será tratado automaticamente como receita operacional.

Resultado gerencial = receita reconhecida pertinente ao contrato − custos reconhecidos de responsabilidade da construtora − administração central atribuída. Em contratos por administração, separar custos custeados com recursos do cliente, custos próprios e remuneração contratual da gestora.

Custo final previsto = incorrido + estimativa para concluir + contingências/impactos ainda não incluídos. A estimativa restante incorpora os compromissos em aberto pertinentes uma única vez; não somar novamente o valor integral do pedido. Previsão deve informar data, versão, cobertura e itens não revisados. Não presumir que orçamento restante é uma estimativa revisada de engenharia.

## Prestação de contas do cliente

Mostrar todos os movimentos pertinentes e autorizados da obra, por data efetiva, com abertura do período, entradas, saídas, estornos/devoluções e posição final da prestação. Não chamar essa posição de saldo bancário quando a conta atende várias obras ou há conciliação incompleta.

Entradas classificadas: recursos recebidos do cliente, reembolsos e demais origens identificadas. Saídas: materiais, mão de obra agregada, terceiros, equipamentos, demais despesas e honorários efetivamente cobrados conforme contrato. Transferências internas e pagamentos diretos precisam de tratamento explícito para não duplicar entradas/saídas.

Pagamentos feitos diretamente pelo cliente ao fornecedor ficam em quadro separado: integram o acompanhamento da obra, mas não movimentam novamente o caixa administrado pelo MARCELL.

Cada linha apresenta data, descrição, categoria, contraparte apropriada ao público, etapa, documento, valor e situação. Contas futuras/vencidas ficam em seção de previsão, separadas dos movimentos realizados. Totais sem documento ou sem conciliação ficam identificados.

O cliente acessa os documentos pertinentes à própria obra por autorização no servidor. Folha individual, salário, CPF e Pix dos funcionários, margem interna e despesas centrais de outras obras não são enviados ao portal. A mão de obra pode aparecer agregada com demonstrativo autorizado. Para contratos de administração, detalhar os custos e honorários previstos no contrato; para preço fechado, a apresentação deve acompanhar o nível de abertura definido para aquela obra.

Primeira entrega: prévia interna de como o relatório será visto pelo cliente, sem ativar acesso externo, enviar mensagens ou publicar documentos.

## Memoriais e exportação

Todo número abre memória no mesmo filtro: obra → etapa/categoria → lançamento → documento original. Busca e paginação conservam o subtotal dos resultados e o total do conjunto. Um único componente financeiro deve fornecer os números da tela, do PDF e do Excel.

Exportação deve conter escopo, período, regime, data de corte, versão do rateio/previsão, moeda, pendências e anexos referenciados de maneira autorizada. Arquivo para o cliente é produzido da projeção do cliente, nunca do relatório interno com colunas apenas escondidas.

## Sequência de implementação proposta

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 1 | Relatório completo de uma obra, categoria/etapa e mão de obra total; memorial e exportação | Mesmos valores no razão e no relatório; componentes sem dupla contagem; custo apurado e estimado separados |
| 2 | Simulador mensal de administração central | Origem rastreável, total distribuído conferível, política explícita, cenário não altera a empresa |
| 3 | Resumo CFO e previsão final/caixa | Orçamento, incorrido, compromisso e restante reconciliados; dados incompletos identificados; lacunas bancárias visíveis |
| 4 | Prévia de prestação de contas do cliente | Entradas/saídas e pagamentos diretos conferíveis; ausência de dados internos indevidos; nenhuma publicação automática |
| 5 | Carteira comparativa e fechamento mensal | Comparação entre obras na mesma base, snapshots de períodos e rateios preservados, ponte entre obras e consolidado |

Decisões de negócio a confirmar antes de aplicar políticas: despesas elegíveis da central e seus critérios; se existe registro de horas da equipe central; regras por modalidade contratual; nível de detalhamento público por obra. A etapa inicial pode usar dados existentes, mantendo essas políticas em simulação e sem preencher lacunas por suposição.

## Validação futura

Casos mínimos: funcionário que troca de obra; rateio de duas obras; despesa central com parte direta; obra sem base ou encerrada; recebimento parcial; nota com múltiplas etapas; compra devolvida; material em estoque; pagamento direto do cliente; depósito/repasse sem natureza de receita; aditivo; custo já coberto por compromisso; competência diferente de pagamento; conciliação incompleta; denominador de rateio constante ao filtrar; arredondamento; duas obras com clientes distintos; exportação conforme recorte e isolamento do portal.

Este documento não afirma que o novo painel foi implementado, que houve validação de números reais ou que os cálculos existentes foram corrigidos. A entrega desta rodada é a pesquisa e uma especificação integrada para implementação local.
