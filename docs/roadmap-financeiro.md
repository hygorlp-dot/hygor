# Roadmap do financeiro MARCELL

Atualização de 31/10/2026: layout operacional, distinção entre saldo inicial
ausente e zero explícito e preparação da previsão por conta implementados
localmente. Contrato, limites e evidências em
[LAYOUT-OPERACIONAL-CAIXA-2026-10-31.md](LAYOUT-OPERACIONAL-CAIXA-2026-10-31.md).
Saldo bancário automático e atribuição de contas aos títulos permanecem fora
desta entrega; nenhuma publicação foi realizada.

Base: análise comparativa da Vobi de 29/10/2026. Esta etapa não autoriza publicação automática em produção.

| Etapa | Entregas | Critério de conclusão |
|---|---|---|
| 1 — Rotina e rastreabilidade | Filtros de obra preservados entre Hoje, visão, pagamentos e notas; período do histórico de caixa explícito; recebimentos e exportação no período; fila Hoje; indicadores clicáveis; memorial compartilhado | Testes de saldos parciais, isolamento por obra, datas, documentos, navegação e apresentação responsiva |
| 2 — Previsão e exceções | Caixa diário por títulos de 7/30/60/90 dias, menor saldo previsto, separação de estimativas e dados conciliados; filas por motivo de divergência | Títulos liquidados saem da previsão; pagamentos diretos e transferências não distorcem caixa; cenários não gravam transações |
| 3 — Documentos e fechamento | Fila única de recebimento/conferência, documento ao lado dos campos, duplicidades, cobertura de classificação e pendências do fechamento | Reprocessamento idempotente; acesso à origem; histórico fechado preservado |
| 4 — Resultado por etapa | Orçado, comprometido, recebido, incorrido, pago e custo para concluir integrados | Mesma base aprovada; apropriações auditáveis; todos os totais abrem sua composição |

## Contrato da primeira etapa

- Hoje usa a data atual e a obra compartilhada. Seu texto explica que o mês da análise não restringe a fila operacional.
- Visão financeira usa competência para resultado, data efetiva para caixa e posição acumulada até o fim do mês para obrigações.
- Pagamentos conserva seu alcance operacional de todo o histórico, com posição atual; notas conservam o filtro por situação. Ambos compartilham a obra, sem esconder pendências antigas por um filtro mensal implícito.
- Histórico de caixa ancora o horizonte no mês selecionado, filtra a obra e identifica claramente a janela histórica e as estimativas. A fórmula de previsão por títulos pertence à etapa 2.
- O memorial reutiliza a apresentação do DRE e expõe a ficha operacional, vínculos, documentos, valores e metadados disponíveis. Dados ausentes são declarados. Não se inventa documento para custo calculado.
- Fluxos principais desta entrega: indicadores da visão, indicadores e documentos de pagamentos, recebimentos, notas fiscais e títulos da fila Hoje. A revisão bancária permanece na etapa 2.
- Ações de pagamento, aprovação, estorno e fechamento mantêm seus comandos e permissões existentes.

## Validação e acompanhamento

Verificar casos de duas obras, recebimento parcial, pagamento futuro, nota com vencimento sem metadado no razão, títulos sem data e mês histórico. Conferir memorial por teclado, fechamento por Escape, links seguros e retorno à origem. Rodar testes de domínio, componentes, verificações estáticas e build; revisar desktop e celular.

Medir, após disponibilização: tempo para localizar nota a partir de um indicador, tempo para identificar vencimentos do dia e quantidade de pendências sem informação. Não há estimativa percentual de ganho validada.

## Sequência de entrega

Implementação local → testes e revisão → revisão do diff → publicação quando autorizada. Esta documentação acompanha o código; o status final e os resultados da validação constam no relato da entrega.

## Status em 30/10/2026

Etapa 1 recuperada do backup de 29/10 e integrada em `C:/dev/repositorio-mrc`, sobre a base existente. A aplicação do patch preservou as alterações já presentes. Foram validados 39 testes direcionados, lint, tipos e build. O build mantém o aviso de chunks grandes.

A verificação local com dados fictícios confirmou: saldo parcial de nota na fila Hoje, isolamento entre duas obras, filtro preservado ao alternar áreas, memorial em pagamentos e notas, abertura pelo indicador de caixa, link do documento e fechamento por Escape. A apresentação foi capturada em 1440×1000 e 390×844; sem transbordamento horizontal da página no celular.

A entrega permanece local, sem publicação em produção. Evidências visuais em `artifacts/financeiro/`.

## Etapa 2 — implementação local em 30/10/2026

Previsão diária por saldos residuais dos títulos, horizontes de 7/30/60/90 dias, menor saldo e primeira data negativa, memorial dos títulos por dia. Vencidos e sem data permanecem explícitos; cenários de atraso e inclusão de vencidos não persistem dados. Saldo inicial é informado pelo usuário como hipótese, não um saldo bancário conciliado automático. A integração com saldo bancário certificado e seleção de conta permanece como evolução pendente.

Conciliação: filtros de revisão por valor, contraparte, possível duplicidade, bloqueio, falta de candidato e vínculo parcial. Classificação derivada das evidências do motor existente, sem novo comando de conciliação. Contagens refletem conta/busca atuais e podem se sobrepor. Divergências não substituem revisão humana.

Referência revisitada: documentação oficial de extrato e conciliação da Vobi, que distingue pago de conciliado, pendências por conta e transferências entre contas. A sessão autenticada da Vobi não estava disponível no navegador de automação desta rodada; não foi presumida uma nova validação visual da plataforma.

Fontes: https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi e https://ajuda.vobi.com.br/pt-br/articles/8632074-como-utilizar-a-conciliacao-bancaria-na-vobi.

## Etapa 3 — central documental e fechamento (30/10/2026)

Central local de documentos para notas, pedidos, medições e despesas da empresa/obra. Busca por referência/fornecedor, recorte compartilhado por obra, competência explícita ou mês de emissão; sem data consultável ao limpar o mês. Filtros de conferência, ausência de anexo/obra/categoria, divergência informada e possível duplicidade. Duplicidades verificadas entre notas ativas, inclusive fora do mês exibido, por chave fiscal ou fornecedor+valor+data; nenhum registro é criado, mesclado ou eliminado automaticamente.

Painel de consulta do documento original e dados associados, com links em nova aba. A edição, importação XML, anexação, aprovação e rejeição reutilizam a ficha fiscal e os comandos existentes, incluindo bloqueio de chave duplicada e período fechado. Não foi criado um novo processamento de IA ou integração externa. O original abre no provedor; visualização PDF incorporada e conferência lado a lado com campos editáveis permanecem como evolução.

Fechamento: lista de bloqueios retornados pelo motor, alertas documentais com memorial da origem e movimentos bancários pendentes/parciais do mês. Atalho abre a central no mesmo mês e no escopo da empresa inteira. Alertas documentais não alteram automaticamente as regras de bloqueio. Snapshots históricos existentes são preservados.

Referências revisitadas: central de lançamentos/revisão antes de confirmar e identificação de semelhantes na documentação oficial da Vobi; importação XML e consulta da nota a partir do lançamento. Sessão autenticada não revalidada visualmente nesta rodada.

Fontes: https://ajuda.vobi.com.br/pt-br/articles/12691800-agente-de-ia-financeiro-da-vobi-sua-rotina-no-piloto-automatico e https://ajuda.vobi.com.br/pt-br/articles/9431811-importacao-manual-de-notas-fiscais-via-xml.

Validação: testes direcionados de domínio e componentes; lint, tipos e build; navegação local com dados fictícios para central, documento original, ficha fiscal e apresentação desktop/celular. Evidências em `artifacts/financeiro/documentos-desktop.png` e `documentos-mobile.png`. Tudo local, sem push ou deployment.

## Etapa 4 — custos por obra e etapa (30/10/2026)

Nova área “Custos por etapa” compartilha o filtro de obra e reúne custo orçado na baseline ativa de controle, compras comprometidas, recebido físico valorizado pelo critério de compras, custo incorrido do razão, pago pela empresa e pago diretamente pelo cliente. Colunas possuem memorial; custo final estimado e estimativa para concluir explicam sua fórmula.

Posição acumulada atual: compras/recebimentos refletem cadastro atual, custo é por competência até o mês de referência e pagamentos pela data até a referência. O mês da visão financeira não restringe esta tela. Não há reconstrução histórica das quantidades recebidas. Etapas exibidas são raízes do orçamento, incluindo raízes sem valor orçado mas com custo apropriado.

Premissa de previsão: para concluir = máximo entre zero, orçado menos incorrido e comprometido em compras menos incorrido. Final = incorrido + para concluir. É uma referência automática, não um levantamento físico dos serviços restantes nem garantia de custo final. Compras comprometidas são valores brutos dos pedidos vivos, incluindo os já faturados; não se somam diretamente ao incorrido.

Apropriação: usa etapa explícita, rateio da nota ou pedido inteiramente vinculado a uma única etapa. Custos sem vínculo ou com vínculo inválido ficam em Sem apropriação. Pagamento de nota com múltiplos rateios permanece sem etapa quando o evento não permite identificar a parcela por etapa. Não há rateio artificial. Pagamentos diretos do cliente ficam separados do caixa da empresa. Sem baseline válida, comparativos orçamentários ficam indisponíveis, mas fatos financeiros permanecem visíveis. Obra sem início válido mostra aviso de incompletude para o acumulado de ponto/equipamentos.

Reutilizado o acumulado do motor de DRE para ponto/equipamentos; nenhum cálculo persistido novo. Controle orçamentário de compras passou a expor os valores recebidos dos pedidos para seus memoriais. Não foram alteradas as interfaces de Compras em andamento em outro chat.

Referência revisitada: https://ajuda.vobi.com.br/pt-br/articles/8837723-como-utilizar-o-relatorio-orcado-x-realizado-para-o-sucesso-de-suas-obras (apropriação, referência de custo sem BDI e itens sem apropriação). Pesquisa documental, sem nova auditoria da sessão autenticada.

Validação: 35 testes de integração de cálculos, acumulado DRE e controle de compras; lint e tipos aprovados; build local aprovado com aviso de chunks grandes. Navegação da área, memorial do custo e ausência de transbordamento horizontal da página em 390px conferidos localmente. Evidências em artifacts/financeiro/etapas-desktop.png e etapas-mobile.png.

Escopo de coordenação: alterações de integração em LegacyApp.jsx, domains/dre/calculations.js e domains/compras/budget-tracking.js; novos work-stage-costs.js/test e WorkStageCosts.jsx. Trabalho permanece em C:/dev/repositorio-mrc na branch existente, sem push/PR/deployment. Alterações de histórico de preços de materiais de outro chat preservadas.

## Consolidação das quatro etapas — 30/10/2026

Revisão integrada concluída localmente, com correções de recorte por competência, seleção de conciliação entre contas, anexos/URLs e vínculos de etapas inválidas. Relatório de cobertura, reprodução, comparação com a Vobi e limitações: [REVISAO-INTEGRADA-FINANCEIRO.md](REVISAO-INTEGRADA-FINANCEIRO.md).

Evidências: 386 testes em 48 arquivos, regressão final de 6 testes (parcialmente sobreposta à bateria anterior), 14 cenários de navegador e 18 verificações de jornadas integradas. Nenhum push, PR ou deployment.

## Evolução prioritária — layout operacional e continuidade (30/10/2026)

Implementação local do primeiro recorte aprovado após a nova revisão autenticada da Vobi, registrada em `analises/vobi-financeiro-revisao-ampliada-2026-10-30.md`.

- Entrada pela fila Hoje para os perfis que já acessam o módulo. A fila mantém sua seleção entre áreas e oferece expansão para planejamento de caixa.
- Na Visão financeira, previsão antes das análises; ranking e gráficos reunidos em seção recolhível. Competência dos resultados e data dos movimentos identificadas no cabeçalho. Navegação financeira quebra em linhas no celular, sem ocultar áreas em rolagem lateral.
- Obra e período da visão, competência/busca/situação/seleção documental e parâmetros da simulação mantidos durante a navegação interna do financeiro.
- Memorial abre a central no registro de origem ou em nota vinculada disponível, ajustando a competência documental. O retorno recompõe a consulta anterior, obra, pesquisa e expansão do memorial; consultas encadeadas preservam o retorno anterior. A ação só aparece quando existe origem na central e o perfil tem permissão.
- Ficha fiscal aberta pela central oferece retorno à conferência, mantendo o recorte e o documento selecionado. Posições dos contêineres de rolagem são capturadas para os retornos explícitos.
- Documentos deixam de exibir um item selecionado quando ele sai do recorte; busca/situação têm ação de limpeza. Painel de conferência aparece apenas com seleção válida, com fechamento explícito. No celular, o documento selecionado antecede a lista.
- No memorial compartilhado, originais e dados principais continuam acessíveis; ficha completa, vínculos, memória de cálculo e metadados ficam em expansões próprias. Nenhum campo foi removido do memorial.

Validação desta evolução: 23 testes direcionados em 8 arquivos; 18 verificações da jornada integrada existente; 10 verificações novas de continuidade em 1440 e 390 px, sem erros de execução ou transbordamento horizontal externo nas telas capturadas. Capturas inspecionadas em `artifacts/financeiro/operacional-1440.png`, `operacional-390.png`, `continuidade-documentos-1440.png` e `continuidade-documentos-390.png`; relatório automatizado em `continuidade-browser.json`. APIs interceptadas com dados fictícios, sem gravação real.

Limites: continuidade em memória enquanto o módulo está montado; recarregar a página ou sair do módulo não salva uma consulta. Documentos originais continuam em nova aba; visualização incorporada e edição lado a lado ficam para o próximo recorte. Sem alteração de cálculo financeiro, schema, integração bancária/fiscal, permissão ou fluxo de confirmação. Alterações preexistentes de outros módulos preservadas; sem push, PR ou publicação.

## Conferência fiscal com original ao lado dos campos — 30/10/2026

O recorte seguinte implementa visualização interna na ficha de nota fiscal, acessível pela central documental e por Notas fiscais. No desktop, original à esquerda e formulário existente à direita; até 900 px, abas Documento e Dados da nota mantêm os dois painéis montados e preservam o preenchimento. O limite de visualização em nova aba registrado no recorte anterior foi superado para os formatos suportados abaixo.

- PDF com leitor local, páginas e zoom; imagens PNG/JPEG/GIF/WebP/AVIF/BMP; XML fiscal exibido como texto, sem executar seu conteúdo. O leitor de PDF usa a dependência já instalada, carregada sob demanda, sem serviço externo de conversão.
- Seletor entre anexos da nota sem alterar os campos ou os arquivos. Ausência de original, tipo sem visualização interna e falha de acesso têm orientação e abertura em nova aba; falhas permitem nova tentativa. URLs executáveis, de arquivos locais e de rotas internas arbitrárias não são aceitas pelo visualizador.
- OneDrive reutiliza `file-link` e a rota assinada já existentes, com validação de escopo no servidor. Nenhum proxy de URL arbitrária ou integração foi criado. Arquivos antigos usam o drive da obra original mesmo quando a apropriação é editada na ficha; novos anexos fiscais registram o drive retornado pelo envio.
- Campos, cálculos de retenção, vínculo com pedido e comando versionado de salvar permanecem os existentes. Trocar documento ou aba não grava a nota; salvar e aprovar continuam ações distintas. Retorno à central preserva os filtros implementados na etapa anterior.

Comparação Vobi: formulário real de Nova despesa e aba Notas fiscais e anotações revisitados sem salvar. A Vobi separa esses conteúdos em abas; esta observação não comprova o comportamento da conferência fiscal Premium. Referência documental: [importação XML da Vobi](https://ajuda.vobi.com.br/pt-br/articles/9431811-importacao-manual-de-notas-fiscais-via-xml), distinguindo preenchimento inicial e vínculo a lançamento existente. No MARCELL, a visualização isolada nunca preenche ou altera valores automaticamente.

Validação local: 23 testes em 5 arquivos, incluindo classificação/URLs e comandos fiscais; 10 verificações novas de navegador em 1440 e 390 px, mais 10 regressões de continuidade. Casos novos: PDF protegido com duas páginas e zoom, imagem, XML, formato externo, imagem ausente, PDF inválido, acesso negado no OneDrive, manutenção dos campos/obra, ausência de anexo e salvamento pelo comando fiscal existente. APIs interceptadas; o salvamento foi aplicado somente ao conjunto fictício do teste. Nenhuma operação em produção.

Capturas inspecionadas: `artifacts/financeiro/conferencia-original-1440.png` e `conferencia-original-390.png`. Relatório: `conferencia-original-browser.json`. Reprodução: servidor local isolado em 4185 e `node scripts/finance-document-conference-verify.mjs`.

Limites: fontes externas podem bloquear leitura no navegador por autenticação ou política de origem; nesse caso, o original abre em nova aba. XML é leitura do arquivo, sem nova extração automática. Outros tipos de lançamento conservam suas fichas existentes; este recorte é de notas fiscais. Nenhuma publicação, push, PR, contratação ou alteração de infraestrutura.

## Prévias de recorrências e importações — 30/10/2026

Implementadas nos três fluxos existentes, com confirmação explícita:

**DRE mensal → Despesas operacionais → Replicar.** A prévia lista a origem, competência de destino, vencimento, fornecedor, valor e resultado da checagem. Permite selecionar quais despesas copiar e mostra o total selecionado. Ocorrências já existentes no destino e repetições dentro da própria origem ficam desabilitadas; a identidade considera série quando disponível ou categoria/descrição/fornecedor normalizados. Fornecedores distintos não são fundidos. A cópia avança o vencimento pelo intervalo entre competências, respeita o último dia do mês e conserva eventual vencimento no mês seguinte à competência. Nova obrigação não reutiliza pagamento, transação bancária, comprovante ou documento fiscal anterior.

O mesmo planejador roda no servidor. A confirmação da prévia envia seleção e uma fotografia dos campos relevantes; alterações nas fontes ou no destino exigem atualizar a prévia. Continua sendo o comando versionado de replicação existente, sem rotina automática, nova API ou migração. A operação legada mantém compatibilidade para chamadas sem fotografia, com deduplicação recalculada na base atual.

**Conciliação → Importar extrato.** OFX/QFX e planilhas CSV/XLS/XLSX passam primeiro por uma prévia com novos movimentos, duplicados e linhas inválidas. Os totais usam o mesmo comando puro que valida a importação no servidor, sem gravar. Registros inválidos da planilha deixam de ser descartados silenciosamente: aparecem na revisão e bloqueiam o lote até correção do arquivo. Datas impossíveis também são rejeitadas no comando do servidor. Cancelar não grava; confirmar importa apenas movimentos ainda novos, usando a checagem de identidade bancária já existente. Reimportação integralmente repetida não permite confirmar e não cria extrato vazio. A conta selecionada e o período ficam visíveis antes da confirmação.

**Ficha fiscal → Importar XML da NF-e.** A prévia compara campos atuais e propostos, mostra quantidade de itens e localização do fornecedor. Cancelar mantém a ficha. Aplicar preenche a ficha em memória e continua exigindo Salvar e conferir para persistência. Chave de acesso já cadastrada bloqueia aplicação e oferece abrir a nota existente; fornecedor/série/número semelhantes exigem revisão explícita. O servidor conserva a proteção de chave duplicada ao salvar. Anexar XML pelo fluxo de documentos passa a apenas anexar; deixa de sobrescrever campos financeiros sem a prévia de importação.

As listas têm paginação de 50 itens. No celular, as prévias com cinco colunas apresentam campos por registro, mantendo valor e motivo da checagem visíveis; a comparação de três colunas do XML permanece tabular. A conferência com original ao lado e a continuidade entre filtros, memorial e documentos foram preservadas.

**Comparação Vobi.** Documentação oficial revisitada: [recorrências](https://ajuda.vobi.com.br/pt-br/articles/7866335-como-cadastrar-despesas-e-receitas-recorrentes-na-vobi), [importação financeira](https://ajuda.vobi.com.br/pt-br/articles/7997797-importacao-de-financeiro-na-vobi) e a referência de XML da etapa anterior. A Vobi descreve periodicidade e última ocorrência, anexos restritos à ocorrência inicial e escolha entre editar uma ocorrência ou próximas em aberto. Sua importação destaca correspondência de cadastros e efeito da data de pagamento. Neste recorte, o MARCELL trabalha com a replicação mensal já existente, revisão anterior à criação e ausência de baixas automáticas. A tentativa de nova leitura da sessão autenticada nesta rodada expirou; as novas conclusões de comparação são documentais, somadas à navegação real registrada nas revisões anteriores.

**Validação.** 46 testes em 8 arquivos, incluindo mutações/comandos existentes e nove casos novos de prévia. Navegador: seis jornadas novas agrupadas em 1440 e 390 px, mais vinte verificações de regressão de conferência e continuidade; APIs interceptadas e comandos aplicados apenas a dados fictícios. Build local aprovado, mantendo o aviso conhecido de chunks grandes; lint e tipos aprovados. A versão estática usada nas jornadas evita recargas de desenvolvimento durante a validação.

Evidências: `artifacts/financeiro/previas-browser.json`, `previa-recorrencias-1440.png`, `previa-recorrencias-390.png`, `previa-extrato-1440.png`, `previa-extrato-390.png`, `previa-xml-1440.png` e `previa-xml-390.png`. Reprodução: `node scripts/finance-previews-verify.mjs [URL_LOCAL]` (padrão: `http://127.0.0.1:4185`).

Escopo: replicação mensal de despesas da empresa, importação de extratos e XML fiscal. Séries semanais/anuais e importador genérico de receitas/despesas por planilha permanecem para evolução posterior. Nenhuma aprovação, pagamento ou conciliação é gerada pela leitura de um arquivo. Alterações preexistentes preservadas; tudo local, sem push, PR, build remoto ou publicação na Vercel.

## Central de relatórios e exportações no mesmo recorte — 30/10/2026

Acesso: **Financeiro → Gestão financeira → Relatórios financeiros**, nos perfis que já acessam as áreas administrativas do financeiro. A central acrescenta três consultas à navegação existente:

| Consulta | Base e fórmula | Alcance |
|---|---|---|
| Resultado por competência | Receitas reconhecidas menos custos incorridos, líquidos de estornos, pela competência | Usa o adaptador da visão financeira, incluindo composição mensal de mão de obra e equipamentos; não é o demonstrativo tributário completo |
| Caixa realizado | Entradas menos saídas financeiras pela data do movimento | Saldo inicial, títulos em aberto, pagamento direto do cliente ao fornecedor e extrato ainda sem fato financeiro vinculado ficam fora |
| Títulos em aberto por vencimento | Saldo a receber menos saldo a pagar na data de posição, com janela de vencimentos independente | A data de posição determina as liquidações consideradas. Títulos sem vencimento têm inclusão explícita; filtro Vencido também contempla obrigações parcialmente liquidadas |

Agrupamentos por obra, categoria e cliente/fornecedor. Filtros de obra, período, tipo, categoria e busca; conta do movimento bancário vinculado somente no caixa; data de posição, situação e inclusão de sem vencimento somente nos títulos. Consulta limitada a até 12 meses. Bases incompatíveis com filtros não são combinadas silenciosamente. Datas impossíveis e intervalos inválidos bloqueiam os resultados e as exportações.

Os fatos do adaptador mensal são reunidos por identidade, evitando duplicar eventos comuns ao consultar vários meses. Composição externa de equipamentos mantém identificação por competência. Fontes, agrupamentos, totais e exportações usam o mesmo objeto de relatório filtrado. Registros sem categoria ou contraparte permanecem identificados; fornecedor legado das despesas da empresa e fornecedor vinculado por cadastro são lidos na composição.

Cada grupo abre o memorial da sua coluna líquida: receitas/entradas/a receber positivas e custos/saídas/a pagar negativos, com a convenção explicada. O total do memorial corresponde à coluna líquida, sem somar os dois lados como se fossem um único resultado. Original, ficha completa e acesso à central documental continuam disponíveis. Filtros e página do relatório ficam no estado do financeiro durante ida/volta entre áreas, memorial e documentos.

**Exportações.** CSV com seções de recorte, resumo e lançamentos; Excel com abas Recorte, Resumo e Lançamentos; impressão com opção de salvar PDF. Todos incluem a composição completa filtrada, não apenas os 50 grupos da página visível. Metadados: relatório, base/fórmula, fonte, moeda, obra, período, agrupamento, tipo, categoria, conta, situação, busca, posição, regra de sem vencimento e instante da consulta. Planilhas preservam valores numéricos e neutralizam textos que possam virar fórmulas; o HTML de impressão escapa o conteúdo dos registros. O arquivo captura o relatório ativo no clique e mantém o mesmo instante nos diferentes formatos enquanto o recorte/dados não mudam.

**Layout.** Tabela agrupada no desktop e campos por grupo no celular, com valores e origem visíveis. Fórmula e filtros ativos acompanham os totais. Exportações têm estados de processamento/erro; os filtros da central ficam desabilitados durante a geração do Excel.

**Comparação Vobi.** Revisada a [documentação oficial dos relatórios](https://ajuda.vobi.com.br/pt-br/articles/6682929-garanta-o-controle-financeiro-do-seu-negocio-com-os-relatorios-da-vobi): DRE por competência, fluxos diário/mensal, resultados de parcelas pagas ou previstas e relatórios por categoria, centro, cliente e fornecedor. O MARCELL explicita suas próprias bases gerenciais e transporta o mesmo recorte para o arquivo. A tentativa de abrir os relatórios na automação redirecionou ao login; a comparação atual é documental, complementada pela navegação autenticada registrada na revisão ampliada anterior.

**Validação local.** 43 testes em quatro arquivos, incluindo dez testes novos da central. Dez verificações novas de navegador em 1440 e 390 px, mais dez regressões da continuidade existente. Casos: competência diferente da emissão; obra/categoria/direção/busca; conta bancária vinculada e ausência de vínculo; parcial vencido e sem vencimento; datas inválidas; igualdade entre grupo e memorial líquido; download CSV; leitura real do XLSX e seus valores; impressão; instante preservado entre formatos; 65 grupos com exportação completa e retorno à segunda página. APIs interceptadas e dados fictícios. Lint, tipos e build local aprovados; permanece o aviso conhecido de chunks grandes.

Evidências: `artifacts/financeiro/relatorios-browser.json`, `relatorios-1440.png` e `relatorios-390.png`. Reprodução: `node scripts/finance-reports-verify.mjs [URL_LOCAL]`. O build estático isolado usado nos testes fica em `artifacts/financeiro/reports-build`.

Limites: base atual disponível no ERP; snapshots imutáveis continuam no DRE mensal/anual. Conta é a do movimento bancário vinculado, não uma inferência pelo cadastro da nota. Esta consulta não certifica saldo bancário nem cria projeções de recebimento. Preservados os relatórios anteriores de mão de obra, compras e demais módulos, além de todas as alterações preexistentes. Nenhum push, PR, deployment, nova API ou migração de banco.

## Apropriação assistida e previsão para concluir — 30/10/2026

Acesso: **Financeiro → Gestão financeira → Custos por etapa → Conferir apropriação e previsão**, por obra. As bases de cálculo ficam em uma expansão própria; no celular, a comparação apresenta cada etapa com seus campos e valores, sem depender de rolagem horizontal.

**Apropriação.** A fila mostra custos incorridos ainda sem etapa, com busca, valor, data, contraparte e acesso ao memorial e aos documentos. Sugestões usam descrições normalizadas idênticas às dos itens do orçamento de controle; correspondências em várias etapas exigem escolha manual. Nada é apropriado ao abrir a tela. Cada confirmação exige etapa válida e justificativa. Rascunhos, busca, etapa e página permanecem no retorno do memorial e dos documentos.

O comando dedicado `APROPRIACAO_CUSTO_SALVA` altera somente a etapa de uma despesa da obra, medição de terceiro ou rateio identificado da nota. Preserva valores, pagamentos, documentos e os demais rateios; registra responsável, data, justificativa e vínculo anterior. Exige versão atual do lançamento, orçamento de controle vigente e etapa de primeiro nível. O servidor restringe a operação a administrador/financeiro no escopo da obra e bloqueia períodos fechados por data ou competência. O comando segue a persistência financeira já existente, com idempotência; não há escrita direta de snapshot pela tela.

**Previsão.** O usuário informa o custo restante completo da etapa, incluindo compras comprometidas ainda não incorridas. A prévia mostra custo final = incorrido + restante revisado e desvio = custo final − orçamento. Compras, recebido físico e pago não são somados novamente. Valor zero é uma revisão explícita válida; previsão abaixo do saldo entre comprometido e incorrido recebe aviso para justificar a premissa.

`PREVISAO_CONCLUSAO_SALVA` registra o planejamento dentro da obra, com versão própria (`costPlanning`), histórico, data de corte, orçamento, premissas, responsável e memória numérica. Não cria obrigação, custo ou pagamento. A conferência compara a assinatura dos fatos econômicos e a base numérica da etapa, evitando falsos conflitos por nomes/defaults normalizados no cliente. Revisão só vale para o mesmo corte, orçamento e fontes conferidos. Ao mudar a base ou a data, mantém o histórico, marca reconferência e restaura a referência automática. Rascunhos com base/versão alteradas bloqueiam confirmação até descarte e nova conferência.

**Comparação Vobi.** Revisitado o [artigo oficial de Orçado x Realizado](https://ajuda.vobi.com.br/pt-br/articles/8837723-como-utilizar-o-relatorio-orcado-x-realizado-para-o-sucesso-de-suas-obras): apropriação ao nível do orçamento, separação entre custo/preço, visibilidade dos lançamentos sem apropriação e acesso à origem pelo realizado. O MARCELL conserva essas distinções e acrescenta uma revisão explícita do custo restante. A nova tentativa de navegação em Resumo redirecionou para login; esta comparação é documental e complementa observações autenticadas anteriores. Não foi verificada uma interface equivalente de previsão assistida na Vobi.

**Limites.** Sugestões são correspondências determinísticas para revisão humana. Não fazem rateio automático por percentual ou inferência por fornecedor. Ponto, equipamento e outras origens calculadas continuam visíveis e exigem conferência em seus cadastros responsáveis. Pagamento de nota multietapas permanece sem etapa quando não identifica o rateio, evitando atribuição artificial. A referência automática continua sendo o máximo entre zero, orçamento menos incorrido e comprometido menos incorrido; não representa medição física. Sem orçamento de controle, não é possível confirmar apropriação ou previsão. Falta de início válido da obra mantém o alerta de acumulado incompleto.

**Validação.** 217 testes em seis arquivos, incluindo 15 casos da nova etapa: invariância dos valores e IDs de origem, rateio específico, ambiguidade, fontes legadas, versão, período fechado, permissões, revisão zero, custo suplementar, normalização, previsão e reconferência. Oito verificações agrupadas de navegador em 1440 e 390 px, mais vinte regressões da navegação e dos relatórios; dados fictícios e APIs interceptadas. Lint, tipos e build direto do Vite locais. Permanece o aviso anterior de chunks grandes.

Evidências: `artifacts/financeiro/custos-browser.json`, `custos-conferencia-1440.png`, `custos-conferencia-390.png`, `custos-etapas-1440.png`, `custos-etapas-390.png` e `custos-build.log`. Reprodução: `node scripts/finance-cost-control-verify.mjs [URL_LOCAL]`. Build estático: `artifacts/financeiro/cost-control-build`.

Alterações existentes preservadas. Nenhum push, PR, preview ou deployment na Vercel; nenhuma migração ou operação em banco de produção.

## Consolidação das evoluções do financeiro — 30/10/2026

A revisão atual reúne as quatro etapas originais, continuidade operacional, original ao lado da conferência, prévias com prevenção de duplicidade, central de relatórios e apropriação/previsão por etapa. Matriz de fluxos, limites, comparação documental com a Vobi e reprodução em [CONSOLIDACAO-FINANCEIRO.md](./CONSOLIDACAO-FINANCEIRO.md).

Corrigidas duas diferenças entre os fluxos: arquivos protegidos do provedor agora são reconhecidos pelo mesmo critério na central, memorial e leitor do original; vencimentos impossíveis ficam para conferência, com data original preservada, em vez de serem deslocados para outro dia na previsão. Hoje, previsão e relatório usam a mesma posição enriquecida. A central informa quando existem anexos cadastrados sem link disponível.

A validação pode ser repetida com `node scripts/finance-consolidation-verify.mjs http://127.0.0.1:4191`, usando o build estático local descrito no documento. O executor percorre as seis suítes de jornadas e os cenários Playwright de DRE/conciliação. Relatório: `artifacts/financeiro/consolidacao-browser.json`. A configuração recusa URLs remotas e evita iniciar outro servidor quando uma URL local explícita é fornecida. Os testes antigos do DRE passaram a abrir Dados completos do lançamento antes de conferir a observação; documentos externos e protegidos são verificados nos DREs mensal, anual e fechado.

Resultado final: **659 testes em 59 arquivos**, **62 verificações de jornada** e **14 testes Playwright de DRE/conciliação**, sem falhas, instabilidade ou testes pulados na execução completa final. Lint, tipos e build local aprovados, com o aviso conhecido de chunks grandes. As contagens já incluem as regressões novas, sem somar reruns. Evidências: `consolidacao-tests.json`, `consolidacao-browser.json`, `consolidacao-dre-conciliacao.log` e `consolidacao-build.log` em `artifacts/financeiro/`.

Mantidas todas as alterações existentes. Nenhuma publicação, push, PR, build remoto ou alteração em banco de produção.

## Revisão com a base real — 30/10/2026

Corrigida a identificação de cliente, fornecedor, parcela e documento na central e nos memoriais, aproveitando vínculos existentes sem alterar lançamentos. Central, memorial e relatórios agora compartilham a busca sem acentos e com espaços normalizados. Categorias do razão têm nomes legíveis também nas exportações. A regra do layout móvel da fila Hoje foi delimitada à própria fila: os filtros da previsão de caixa permanecem acessíveis no celular.

Validação: 185 testes em 32 arquivos; oito verificações agrupadas com dados reais em memória, desktop e celular; trinta regressões de navegador com dados fictícios. Lint, tipos e build local aprovados. A base financeira não foi alterada e a revisão com login habitual permanece em somente consulta na porta 4192. Método, evidências e limites: [REVISAO-FINANCEIRO-DADOS-REAIS.md](./REVISAO-FINANCEIRO-DADOS-REAIS.md).
