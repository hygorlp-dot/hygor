# Roadmap de arquitetura do MARCELL

A auditoria de 25/11/2026 deu **7,7/10** à arquitetura. A meta proposta é **9,5/10**, com nova medição pelos mesmos critérios. O trabalho segue o [ADR do monólito modular](ADR-001-MONOLITO-MODULAR.md).

| Etapa | Trabalho | Critério de aceite |
| --- | --- | --- |
| 1. Confiabilidade | Corrigir o esgotamento das posições no Kanban de Projetos. | Reproduzir a falha antes da correção. Inserções repetidas continuam funcionando após serialização, com ordem, permissões e histórico preservados. |
| 2. Desempenho em Projetos | Agregar horas por atividade em uma passagem pelas sessões. Medir uma amostra grande no celular. | Totais idênticos para sessões ativas, ajustadas e encerradas. Comparar o tempo de renderização antes e depois com a mesma amostra. |
| 3. Limites da API | Extrair de `api/data.js` um fluxo completo por vez, começando pelas consultas com contratos já testados. Revisar a duplicação das validações de gravação. | Mesmas respostas, erros, autenticação e auditoria. Cobrir concorrência e idempotência nos fluxos de gravação antes de consolidá-los. |
| 4. Aplicação web | Separar de `LegacyApp.jsx` a navegação e os fluxos que já têm fronteiras de domínio. Medir os recursos carregados no login e nos módulos mais usados. | Sem ciclos de inicialização. Menos recursos carregados na entrada no celular, com o teto atual do bundle preservado. |
| 5. Tipagem e contratos | Ampliar o piloto de tipos nos módulos extraídos e automatizar as fronteiras que forem validadas. | Os módulos escolhidos têm contrato verificável e deixam de depender de detalhes internos entre domínios. |
| 6. Reavaliação | Executar a suíte, os fluxos representativos no celular e desktop e os testes de PostgreSQL em banco descartável. | Registrar aprovação, falhas e lacunas. Recalcular as notas com evidências da versão testada. |

A nota mantém os pesos da primeira auditoria. Modularidade vale 30%, testabilidade 25%, integridade e persistência 20%, desempenho 15% e tipagem e fronteiras 10%.

## Andamento

A etapa 1 foi concluída e validada localmente em 25/11/2026. O teste reproduziu a falha antes da correção e passou com 60 inserções consecutivas depois dela. A suíte registrou 5.644 testes aprovados e 15 pulados por falta de PostgreSQL descartável.

A etapa 2 agregou as horas por atividade em uma passagem pelas sessões. Em uma amostra fictícia de 300 atividades e 6.000 sessões, os totais renderizados coincidiram. Em Chromium com viewport de 390 px e CPU limitada a 4×, a mediana de renderização e atualização do DOM caiu de 620 ms para 484 ms em 40 rodadas por versão. A medição foi feita em emulação móvel.

A etapa 3 extraiu a listagem e a abertura das quinzenas arquivadas para um módulo de leitura. Arquivamento e restauração reutilizam a chave e a validação de quinzena.

A revisão de `save` e `save-sections` encontrou validações semelhantes com entradas diferentes. Por exemplo, a validação de exclusões usa a fotografia mesclada no caminho transacional de `save-sections` e o conteúdo recebido no caminho `save`.

Os testes do salvamento com controle de versão agora cobrem as duas rotas. Alterações compatíveis são combinadas, alterações concorrentes no mesmo campo retornam 409 e uma segunda perda de versão preserva a gravação mais recente. O reenvio de uma alteração já aplicada preservou o conteúdo final nesse cenário. A deduplicação de execuções e eventos de auditoria fica fora dessa comprovação.

A etapa 3 foi concluída no recorte deste roadmap. `save` e `save-sections` usam a mesma recuperação após perda de versão. O [módulo compartilhado](../server/legacy-save-retry.js) relê a base, verifica conflitos, reaplica a mudança, confere a autorização e tenta gravar uma vez. Cada rota conserva as próprias validações iniciais, a forma de combinar os dados e a resposta final. A suíte local registrou 5.652 aprovações, zero falhas e 15 testes pulados por falta de PostgreSQL descartável.

A etapa 4 extraiu a barra lateral de desktop do componente principal para uma função de apresentação em `LegacyApp.jsx`. O carregamento separado da barra foi avaliado e excedeu o teto total do bundle. A otimização mantida adia os instrumentos decorativos do login nas larguras em que o CSS já os ocultava.

Na medição com sessão nova e dados fictícios, o login a 390 px passou de 707.544 para 707.082 bytes gzip de JS e CSS. A 1.440 px passou de 707.544 para 708.399 bytes e uma requisição adicional. O bundle total continuou dentro do teto. Login e painel tiveram capturas idênticas antes e depois nas duas larguras e nos temas Preciso e Noite.

A entrada do ERP passou a carregar a área de trabalho após a autenticação. O Rolldown incluía o React no pacote de gráficos e incluía dependências da API e da empresa no pacote financeiro. A prioridade dos grupos mantém essas dependências na entrada sem antecipar os motores de gráficos e do Financeiro.

Em sessão nova de Chromium, a 390 px, o login passou de 707.082 para 252.761 bytes gzip de JS e CSS, com 17 → 9 requisições. A 1.440 px, passou de 708.399 para 254.082 bytes, com 18 → 10 requisições. O build local ficou em 1.890.954 bytes gzip, abaixo do teto de 1.891.328. O grafo do build mostrou 89 módulos de saída JavaScript sem ciclos estáticos e confirmou que o código de gráficos e do Financeiro fica fora da entrada.

A mudança reorganiza o carregamento e preserva as chamadas de autenticação, permissões e regras de cálculo. A revisão da ajuda e do manual confirmou que as instruções de operação continuam aplicáveis. A validação foi local.

A regressão de rede falhou no build de referência e passou no novo build em celular e desktop. O Playwright confirmou login por e-mail e por PIN, primeiro acesso, restauração e saída da sessão, abertura do DRE e solicitação dos gráficos em Relatórios, em DEV e no build local. A navegação registrou 21 aprovações e um teste pulado, além das mesmas duas falhas de tipografia do build de referência. A expectativa de 24 px para o título do Financeiro continua divergindo dos 20 px no desktop e dos 18 px no celular.

A checagem complementar de DRE anual e Compras aprovou 67 de 68 cenários. O DRE anual passou em celular e desktop. Em Compras, o cartão seguinte interceptou o clique em Cancelar pedido no cenário WF04. O mesmo bloqueio foi reproduzido no build de referência.

Lint, arquitetura e tipagem passaram. A primeira execução de `npm test` registrou 5.651 aprovações, 15 testes pulados por falta de PostgreSQL descartável e uma asserção de autenticação que ainda lia o formulário no arquivo antigo. A asserção passou a acompanhar o formulário movido. A reexecução dos três arquivos de teste da fronteira de entrada aprovou os 12 casos.

## Correções de interface após a etapa 4

O título do Financeiro já seguia a escala Compacta do MARCELL, com 20 px no desktop e 18 px no celular. O teste agora consulta o token de título e verifica a ampliação para 200% em Preciso e Noite. A verificação das cores do resumo da Folha também passou a consultar os tokens vigentes.

Em Compras, o cartão do pedido fica acima dos demais enquanto seu menu está aberto. Com dados fictícios, o clique e o toque em Cancelar pedido abriram a etapa correta. O pedido com recebimento parcial apresentou o aviso de estorno e ficou sem comando de cancelamento. O pedido em rascunho manteve o registro e o motivo no histórico. A mudança atua na sobreposição do menu, sem efeito no cálculo do DRE. A orientação foi incluída na ajuda e no manual.

O build local passou no teto atual, com 1.890.929 de 1.891.328 bytes gzip. Lint, arquitetura e tipagem passaram. Os testes de menu, cancelamento, cadeia de compras e política de comandos aprovaram 70 casos. No Playwright, 36 cenários passaram e um cenário exclusivo de celular foi pulado no desktop. A validação ficou local.

## Etapa 5 — Tipagem e contratos

O piloto estrito passou de oito para dez módulos com a leitura das quinzenas arquivadas e a retentativa de gravações de `save` e `save-sections`. O leitor recebe duas operações de consulta e devolve a resposta tipada à API. O adaptador continua filtrando a empresa da sessão, e a autorização é conferida antes da consulta. A retentativa declara os contratos da fotografia, da ação, das versões por linha e das respostas de sucesso, recusa e conflito.

O verificador de arquitetura protege esses módulos contra imports diretos da rota Vercel e dos adaptadores de armazenamento definidos na regra. Em uma prova isolada, rejeitou dois imports proibidos. O TypeScript rejeitou três contratos artificiais inválidos, incluindo uma consulta sem o carimbo de atualização e uma versão de linha numérica.

Os testes selecionados de API, persistência, autorização, concorrência e ferramentas aprovaram 67 casos. Lint, arquitetura, tipagem e build passaram. Os 153 arquivos do build web mantiveram o mesmo SHA-256 do build local anterior, com 1.890.929 de 1.891.328 bytes gzip. As consultas, os retornos e as regras de gravação foram preservados pelos testes. O cálculo do DRE e os fluxos da interface seguem os mesmos contratos. A ajuda e o manual foram revisados e continuam aplicáveis. A validação ficou local. A suíte completa e a rodada com PostgreSQL descartável fazem parte da etapa 6.

## Etapa 6 — Reavaliação de 25/11/2026

A validação usou o checkout `cc4463f5` com as alterações locais acumuladas e uma cópia de teste sem arquivos de ambiente. O Playwright executou o build local com respostas de API fictícias em Chromium, com celular a 390 px e desktop a 1.440 px. Foram conferidos login, navegação, Projetos, Compras, Folha, DRE anual e Conciliação.

| Verificação | Resultado |
| --- | --- |
| Suíte completa | `npm test` aprovou 5.652 casos sem falhas. Os 15 casos que exigem PostgreSQL ficaram pulados nessa execução. A comparação dos relatórios por arquivo e teste confirmou a aprovação dos mesmos 15 na rodada com o banco descartável, cobrindo os 5.667 casos da suíte. |
| Navegador | 54 cenários passaram. O cenário de chat em paisagem, exclusivo de celular, foi pulado no desktop e passou no projeto móvel. A primeira execução revelou que seis cenários da Folha disparavam a busca antes da montagem da área autenticada. Os testes agora esperam a área ficar visível e passaram na nova rodada. |
| PostgreSQL descartável | PostgreSQL 16.14 em contêiner local, com quatro bancos vazios. Passaram 5 cenários de concorrência da ARP, 7 de persistência de orçamentos, 2 de travas do DRE e os 2 casos do arquivo de JSONB, dos quais 1 exercita o banco. O contêiner e o armazenamento temporário foram descartados. |
| Gates locais | Lint, arquitetura, tipagem, manual e build passaram. A auditoria de imports do repositório encontrou 0 ciclos em 1.018 arquivos e 3.865 dependências locais, incluindo imports dinâmicos. |
| Bundle e entrada | Os 153 arquivos coincidiram por SHA-256 com os do build anterior. O total ficou em 1.890.929 de 1.891.328 bytes gzip. O login móvel solicitou 9 arquivos JS/CSS e 252.776 bytes gzip. No desktop foram 10 arquivos e 254.097 bytes. A medição usou sessões novas e os temas Preciso e Noite. |

A conferência das horas em Projetos repetiu a amostra de 300 atividades e 6.000 sessões e confirmou os 300 totais. A alteração desta etapa foi na espera do teste da Folha. O cálculo do DRE, as regras de negócio e o manual do operador foram conferidos pelos testes e gates. A validação ficou local.

### Nota de arquitetura

A média ponderada foi **8,72/10**, ante os **7,7/10** registrados na auditoria inicial. A meta de **9,5/10** segue em aberto. As notas por critério expressam a avaliação técnica das evidências desta rodada com os pesos do roadmap.

| Critério | Peso | Nota | Evidência e lacuna |
| --- | ---: | ---: | --- |
| Modularidade | 30% | 8,3 | Fronteiras extraídas e grafo sem ciclos. `LegacyApp.jsx` reúne 14.734 linhas e 201 dependências estáticas diretas. `api/data.js` concentra 3.119 linhas e 85 dependências diretas. |
| Testabilidade | 25% | 9,3 | Suíte completa, cenários em PostgreSQL e fluxos representativos no navegador aprovados. A cobertura de navegador desta rodada foi Chromium com API simulada. |
| Integridade e persistência | 20% | 9,1 | Travas do DRE, concorrência e idempotência da ARP, gravação JSONB e isolamento de orçamentos em linha própria verificados. A deduplicação dos eventos de auditoria nas retentativas do salvamento legado ainda carece de comprovação. |
| Desempenho | 15% | 8,7 | Cerca de 64% a menos de JS/CSS gzip no login móvel em relação ao início da etapa 4. Os totais de horas de Projetos coincidiram nesta revisão. O bundle tem 399 bytes de folga e o teste foi em navegador emulado. |
| Tipagem e fronteiras | 10% | 7,8 | Dez módulos na checagem estrita e cinco regras de fronteira ativas. A tipagem estrita ainda cobre um recorte do código. |

## Próximo ciclo — De 8,72 a 9,5

As prioridades seguem a avaliação de 25/11/2026. O teto permanece em 1.891.328 bytes gzip. A cada extração, medir as responsabilidades que saíram dos arquivos centrais, verificar o comportamento pelos pontos de entrada e executar tipagem, auditoria de imports e build local. As notas seguem os pesos da primeira auditoria.

| Ordem | Trabalho | Evidência de aceite |
| --- | --- | --- |
| 1. Primeiras extrações | Levar o índice e a ordenação da busca global para navegação. Levar a verificação de persistência para um módulo do servidor. Tipar os dois contratos. | Mesmos resultados, destinos e filtros por perfil na busca. Mesmos códigos, mensagens e consultas na API. Build dentro do teto e entrada móvel sem antecipar gráficos ou Financeiro. |
| 2. Fronteiras por responsabilidade | Retirar do `LegacyApp.jsx` a coordenação de navegação e as telas com dependências próprias, uma por vez. Extrair consultas e depois famílias de comandos do `api/data.js`. | Testes dos consumidores e do handler passam a cada bloco. As dependências seguem do transporte para o domínio. Medir linhas, imports diretos e ciclos. Conferir auditoria, permissões e efeito no DRE de cada fluxo extraído. |
| 3. Tipagem dos contratos de escrita | Tipar a entrada validada, versão, identificação da operação e respostas de `save` e `save-sections`. Ampliar a checagem estrita nas fronteiras extraídas. | Casos inválidos são recusados pelos verificadores. O conteúdo legado continua compatível e passa pelas guardas atuais. A tipagem entra no gate local e no CI. |
| 4. Deduplicação da auditoria | Medir o reenvio hoje no PostgreSQL. Projetar uma identidade de operação estável, com escopo de empresa, autor e ação. Gravar a operação e seu recibo de auditoria na mesma transação. | Reenvio, perda da resposta e concorrência com a mesma identidade geram uma gravação e um evento. Reuso da identidade com outro conteúdo é recusado. Operações diferentes continuam distinguíveis. Validar rollback e compatibilidade com clientes antigos em banco descartável, preservando a trilha existente. |
| 5. Reavaliação | Rodar suíte completa, fluxos representativos em celular e desktop, cenários concorrentes em PostgreSQL descartável e nova medição de entrada e bundle. | Registrar no roadmap local a nota com os mesmos pesos, as evidências e as lacunas até 9,5. |

### Primeiro bloco

`LegacyApp.jsx` passou de 14.734 para 14.702 linhas. A [busca global](../src/navigation/global-search.js) concentra a projeção dos dados, os destinos, o filtro por abas autorizadas e a ordenação. A interface mantém o atalho, a navegação e a apresentação. A extração da [verificação de persistência](../server/persistence-health.js) levou `api/data.js` de 3.119 para 3.091 linhas. A rota de transporte conserva a sessão e envia o status e o corpo do verificador. Os dois módulos elevaram o piloto de tipagem estrita de dez para doze entradas.

Em PostgreSQL descartável 16.14, a RPC de auditoria recusou uma gravação com a versão antiga e deixou essa tentativa sem evento. A reaplicação do mesmo valor com a versão relida foi aceita. Foram gravados dois eventos no total, com correlações distintas, incluindo um evento com fotografias de antes e depois iguais. A prova executou a RPC vigente isoladamente. A deduplicação será verificada de ponta a ponta no passo 4, incluindo o caminho de persistência financeira.

Passaram 44 testes selecionados de módulo, integração e ferramentas, além de 27 cenários de navegação em celular e desktop. O caso de chat em paisagem foi pulado no desktop por configuração. A verificação de sintaxe da API, lint, tipagem e arquitetura passaram. A auditoria de imports encontrou zero ciclos. O build ficou em 1.890.970 bytes gzip, 358 abaixo do teto. O teste de rede confirmou que o login continua sem solicitar os módulos operacionais antes da sessão. Tudo ficou local.

A busca faz consultas sobre os dados já recebidos. A verificação administrativa usa chaves de sondagem e preservou as linhas existentes no teste da API. Nenhuma dessas operações lança custo ou pagamento no DRE. Os guias da ajuda e do manual foram conferidos. A próxima extração deve tratar a coordenação de navegação no aplicativo e uma consulta completa na API, com testes dos consumidores antes da mudança.

### Etapa 2 — Navegação e carga autenticada

O [coordenador de navegação](../src/navigation/use-workspace-navigation.js) passou a controlar a seleção da aba, o menu, os atalhos e a trilha de retorno entre setores. A [intenção e a trilha de navegação](../src/navigation/workflow-navigation-state.js) têm contratos JSDoc com checagem estrita. A busca e os componentes visuais continuam como consumidores. `LegacyApp.jsx` passou de 14.702 para 14.605 linhas.

A [carga autenticada](../server/load-company-workspace.js) passou a reunir a recomposição dos custos arquivados, a conferência do índice de login e OneDrive, a projeção de dados autorizados e a resposta com a versão da fotografia. A sessão e o status HTTP continuam sob responsabilidade de `api/data.js`, que passou de 3.091 para 3.086 linhas. O caso de índice indisponível continua usando a fotografia original para o reparo. A consulta usa a mesma origem de custos arquivados e não reconhece novas despesas, pagamentos ou valores no DRE.

O piloto de tipagem passou de doze para catorze módulos. A revisão da ajuda e do manual confirmou que os passos, botões e permissões descritos continuam aplicáveis.

`npm run build:local` e `npm run quality:bundle` mediram 1.891.212 bytes gzip, 116 abaixo do teto vigente. Lint, tipagem estrita do piloto, sintaxe da API e regras de dependência passaram. A auditoria de imports encontrou zero ciclos. No Playwright sobre o build local, passaram 105 cenários em 390 e 1.440 px, incluindo permissões, carimbo da obra e retorno entre setores. O caso de chat em paisagem foi pulado no desktop por configuração e passou no celular. Os cenários usaram dados fictícios.

No Vitest, passaram 666 testes em 86 arquivos que exercitam a API, o aplicativo e os módulos extraídos. Nove testes de PostgreSQL real foram pulados porque a rodada usou o ambiente local sem conexão configurada. A execução geral do Vitest foi interrompida após dez minutos com um processo ainda ativo e sem relatório conclusivo. A validação e as alterações ficaram locais.

### Etapa 3 — Contratos de escrita

O [contrato de escrita legada](../server/legacy-save-contract.js) concentra a preparação das requisições, a comparação das versões, as ações de auditoria, o recibo de gravação e os tipos de resposta usados por `save` e `save-sections`. A retentativa usa os mesmos tipos da gravação inicial. O piloto estrito passou de catorze para quinze módulos.

A preparação preserva a compatibilidade do blob e a reconstrução dos deltas sobre os dados correntes. A autorização, a mesclagem, o bloqueio de competências fechadas e as chamadas transacionais continuam na rota. O carimbo permanece comparado pelo instante, mesmo com formatos equivalentes de JavaScript e PostgreSQL. A correlação continua gerada no servidor para a tentativa de gravação. A identidade estável para deduplicação pertence à etapa 4.

O cálculo do DRE usa os mesmos dados e chamadas de persistência financeira. Os testes integrados confirmaram que entradas inválidas são recusadas antes da gravação, a versão equivalente é aceita e a guarda de competência fechada continua no fluxo. A revisão da ajuda e do manual confirmou que os passos existentes se aplicam.

O Vitest foi instrumentado localmente com início e fim por arquivo e por caso. Nas primeiras duas rodadas completas, a regressão do Ponto de Obra foi a última a terminar, em cerca de três minutos e meio. Isolada com `--maxWorkers 1`, a mesma regressão passou em 30 segundos, com 38 casos. O teste abre e fecha um banco PGlite por caso. O rastreamento confirmou progresso nessa etapa e o travamento anterior não se reproduziu. A causa da interrupção anterior continua indeterminada.

A primeira rodada encontrou uma asserção antiga sobre a localização do diagnóstico de persistência. Depois da tipagem, a suíte também encontrou uma asserção que verificava a forma anterior do retorno HTTP 403 das bases contábeis. As duas verificações foram atualizadas para acompanhar os módulos e o retorno vigentes.

Na rodada final, o Vitest concluiu em 3 min 53 s com 5.668 testes aprovados em 753 arquivos, sem falhas. Os 15 testes condicionais de PostgreSQL direto foram pulados por falta de `PONTO_PG_URL`. Lint, arquitetura, tipagem, sintaxe da API e a auditoria de importações passaram, com zero ciclos. O build local e o relatório do bundle mostraram os mesmos arquivos da etapa 2 e 1.891.212 bytes gzip, 116 abaixo do teto. A validação ficou local.

### Etapa 4 — Deduplicação da auditoria

A fila conserva a identidade, a versão de origem e a base do item durante os reenvios de `save` e `save-sections`. O servidor separa as identidades por empresa, autor e ação. A [migration 024](../migrations/024_legacy_save_receipts.up.sql) guarda a impressão SHA-256 da requisição e o recibo com o carimbo e a correlação do evento. A rota HTTP confirma um reenvio com dados atualizados e projetados para o perfil da sessão. Usar a mesma identidade com outro conteúdo retorna HTTP 409.

A gravação, o evento de auditoria e o recibo são confirmados na mesma transação. O bloqueio por identidade vale tanto para a RPC de compatibilidade quanto para a transação por seções. Clientes que omitem a identidade seguem a gravação anterior. Os recibos registram gravações confirmadas. Respostas sem alterações e recusas sem escrita continuam sem evento.

Em PostgreSQL 16.14 descartável, os testes observaram duas conexões aguardando o mesmo bloqueio. A RPC e a transação por seções passaram nos cenários administrativos e de persistência financeira em sombra, com uma gravação, um evento e um recibo para cada par. Uma falha injetada na gravação do recibo reverteu os dados e o evento em ambos os caminhos. A suíte também confirmou a consultabilidade de uma edição mais recente após reenvio, o uso de identidades distintas e a compatibilidade com o cliente legado.

O teste financeiro confirmou a despesa fictícia de R$ 123,45 uma vez no DRE. A deduplicação usa a saída da gravação existente e preserva as regras de cálculo, lançamentos, conciliações e reconhecimento de custos. O teste em PGlite aplicou a migration duas vezes, verificou os privilégios e executou o rollback mantendo dados e auditoria. A revisão de ajuda e manual confirmou que os passos existentes continuam aplicáveis.

Os oito casos do novo fluxo passaram no PostgreSQL descartável, incluindo a recomposição de mão de obra pela fonte arquivada ao reenviar. Também passaram as onze regressões de orçamentos, fechamento e JSONB executadas com PostgreSQL disponível. O teste da fila local confirmou que uma retentativa mantém o conteúdo do primeiro envio mesmo após a atualização da base em memória.

`npm run build:local` e `npm run quality:bundle` mediram 1.891.241 bytes gzip, 87 abaixo do teto. Lint, tipagem, arquitetura, sintaxe da API e auditoria de importações passaram, com zero ciclos. A migration foi executada apenas no ambiente descartável de teste. O processo do banco foi encerrado.

A rodada geral do Vitest encontrou inicialmente uma asserção que esperava apenas a RPC anterior. O teste passou a verificar a delegação à gravação auditada nos dois caminhos. A rodada final teve 5.671 aprovações, nenhuma falha e 23 casos condicionais pulados na execução sem conexão. Os casos do novo fluxo e as regressões financeiras e de JSONB passaram separadamente no banco descartável. Os cinco casos condicionais de concorrência da ARP ficaram fora desta rodada.

### Etapa 5 — Reavaliação de 25/11/2026

A validação usou o checkout `cc4463f5` com as alterações locais acumuladas. O build foi servido em localhost e o navegador recebeu dados fictícios. O PostgreSQL 16.14 usou um cluster novo, com bancos separados por grupo. O processo foi encerrado e o diretório de dados desse cluster foi descartado.

| Verificação | Resultado |
| --- | --- |
| Suíte completa | O Vitest isolado com `--maxWorkers 8` terminou em 5 min 35 s, com 5.671 aprovações e zero falhas. O cruzamento dos relatórios por arquivo e nome do teste confirmou os 23 casos condicionais na execução em PostgreSQL. Os 5.694 casos ficaram cobertos nas duas rodadas. |
| Celular e desktop | 138 cenários distintos aprovados, em Chromium, com foco em 390 e 1.440 px. O caso de chat em paisagem foi pulado no desktop por configuração e passou no celular. A rodada cobriu login, contexto da obra, permissões, recuperação, Projetos, Compras, Folha, Conciliação e DRE. |
| PostgreSQL descartável | 23 cenários que dependem da conexão real passaram. Oito exercitaram recibos e auditoria, cinco a concorrência da ARP, sete o isolamento de orçamentos, dois as travas do DRE e um a gravação JSONB. |
| Gates locais | Lint, manual, arquitetura, tipagem e build local passaram. O grafo de imports mediu 1.025 arquivos e 3.880 dependências locais, com zero ciclos, incluindo imports dinâmicos. |
| Bundle | 1.891.241 bytes gzip de um teto de 1.891.328, com 87 bytes de folga. Os 153 arquivos do build coincidiram por SHA-256 com os da etapa 4. |
| Entrada sem sessão | O celular solicitou 9 arquivos JS/CSS e 252.816 bytes gzip. No desktop foram 10 arquivos e 254.137 bytes. Nos temas Preciso e Noite, a entrada cresceu 40 bytes gzip em relação à última avaliação e continuou sem antecipar os módulos operacionais. |

No teste de tipografia, a primeira rodada leu a posição do aviso e a do campo durante momentos diferentes da animação do diálogo. O teste passou a medir as duas posições no mesmo quadro. As duas repetições por formato passaram. A única alteração desta etapa fora do roadmap foi essa correção do teste. O manual e o comportamento financeiro foram conferidos por testes, sem mudança nas orientações ou no cálculo.

Na primeira execução, simultânea ao navegador, o Vitest registrou uma falha no cenário de alteração do relógio do Ponto e deixou de avançar no teste da cadeia local da ARP em PGlite. Essa execução foi interrompida após mais de seis minutos sem avanço naquele caso. Com o navegador encerrado, ambos os casos passaram na nova rodada geral. A causa da interrupção não foi isolada.

#### Nota de arquitetura

Com os mesmos pesos do ciclo anterior, a nota passou de **8,72 para 8,90/10**. Faltam **0,60 ponto** para a meta de 9,5. As notas por critério são avaliações técnicas do checkout local.

| Critério | Peso | Anterior | Atual | Evidência e lacuna |
| --- | ---: | ---: | ---: | --- |
| Modularidade | 30% | 8,3 | **8,4** | Busca, navegação, carga autenticada e contratos de escrita ganharam fronteiras próprias. O `LegacyApp.jsx` ainda tem 14.605 linhas e 201 dependências estáticas diretas. O `api/data.js` tem 3.111 linhas e 89 dependências estáticas diretas. |
| Testabilidade | 25% | 9,3 | **9,4** | A validação juntou suíte geral, navegador em dois formatos e concorrência no banco. O navegador usou API simulada. Os testes de ambiente e animação ainda exigiram reexecução. |
| Integridade e persistência | 20% | 9,1 | **9,5** | Reenvio, concorrência, rollback e reuso com conteúdo diferente foram verificados. As travas do DRE e a concorrência da ARP passaram. A deduplicação cobre `save` e `save-sections` quando o cliente envia uma identidade. |
| Desempenho | 15% | 8,7 | **8,7** | A carga inicial manteve o número de arquivos e o carregamento após o login. A margem de 87 bytes limita a evolução do bundle. |
| Tipagem e fronteiras | 10% | 7,8 | **8,2** | O piloto estrito passou de 10 para 15 módulos e as cinco regras de dependência continuam ativas. A checagem estrita ainda cobre apenas partes dos contratos e das fronteiras dos arquivos centrais. |

As maiores lacunas para 9,5 estão na modularidade e na tipagem. O desempenho também precisa de margem para evoluir dentro do teto atual. Uma jornada de navegador ligada ao PostgreSQL descartável permitiria validar, no mesmo cenário, o fluxo da tela até o recibo e a auditoria.

## Novo ciclo — De 8,90 a 9,5

O ciclo parte de 14.605 linhas e 201 dependências estáticas diretas em `LegacyApp.jsx`, 3.111 linhas e 89 dependências em `api/data.js`, 15 módulos em tipagem estrita e 87 bytes de folga no bundle. O teto continua em 1.891.328 bytes gzip. Cada extração mede o que saiu dos arquivos centrais e verifica os consumidores que já existem.

| Etapa | Trabalho | Evidência de aceite |
| --- | --- | --- |
| 1. Separar consultas e projeções | Extrair a fila de prioridades do Dashboard e a leitura do link legado do Portal do Cliente. Tipar o recorte de dados que cada módulo consome e a resposta entregue ao chamador. | Mesmas prioridades, permissões e atalhos do painel. Mesmo contrato HTTP e mesma validação de obra, token e arquivos do portal. Tipagem, build e bundle aprovados localmente. |
| 2. Desacoplar o aplicativo por fluxo | Extrair a coordenação de salvamento otimista e recuperação do `CompanyWorkspace`. Em seguida, mover blocos de tela completos, começando por Relatórios e pela carteira de Obras, um por vez. | Fluxos de conflito, perda de resposta, rascunho, troca de empresa e atalhos passam. Medir a redução de linhas e imports diretos de `LegacyApp.jsx` e a rede antes do login. |
| 3. Separar operações da API por domínio | Extrair o restante da coordenação de `save` e `save-sections`. Depois mover famílias com guardas próprias, começando por relatórios do DRE. Tipar as entradas validadas, respostas HTTP e adaptadores de dados. | As mesmas permissões, códigos HTTP, travas, auditoria e resultados financeiros passam nos testes do handler. Medir linhas e imports de `api/data.js` e verificar as fronteiras de dependência. |
| 4. Recuperar folga no bundle | Medir PDF, planilhas, gráficos e dependências carregadas por setores. Adiar o que pertence a uma ação específica e reaproveitar dependências pesadas já presentes. | Redução mensurável no gzip total dentro do teto vigente. Sessão nova no celular e desktop abre sem antecipar módulos operacionais. Os fluxos e a exportação continuam funcionando. |
| 5. Validar a jornada completa com banco | Ligar um fluxo de navegador à API local e a PostgreSQL descartável. Cobrir salvamento com resposta perdida, reenvio concorrente, permissão por perfil e reflexo no DRE e na auditoria. | A tela recupera a versão correta. O banco confirma uma gravação, um evento e um recibo por operação. A autorização e o DRE passam com dados fictícios e casos de recusa. |
| 6. Reavaliar com os mesmos pesos | Rodar a suíte completa, incluindo seus casos condicionais, fluxos representativos em celular e desktop, auditoria de imports e medição de entrada e bundle. | Registrar novamente as cinco notas, as evidências, as limitações e o resultado ponderado. |

Uma composição de referência para atingir 9,5 com os pesos atuais é modularidade 9,4, testabilidade 9,6, integridade 9,7, desempenho 9,4 e tipagem 9,3. A avaliação depende dos resultados observados em cada critério.

### Etapa 1 — Prioridades do Dashboard e link legado do portal

A [fila de prioridades](../src/domains/dashboard/operator-priorities.js) passou a receber pela fronteira tipada os dados necessários, o perfil, as cores e a data de referência. O Dashboard continua responsável por renderizar a lista e navegar para os destinos. `LegacyApp.jsx` passou de 14.605 para 14.530 linhas e mantém 201 dependências estáticas diretas.

A [leitura do link legado](../server/legacy-client-portal.js) concentra a verificação do token da obra, a projeção pública e a assinatura de fotos autorizadas. O handler conserva o transporte HTTP e a comparação em tempo constante. `api/data.js` passou de 3.111 para 3.062 linhas e de 89 para 87 dependências estáticas diretas. O piloto estrito passou de 15 para 17 módulos.

O build inicial, com a exportação de composições já presente no checkout, ficou em 1.892.302 bytes gzip. O build final agrupou Conferência, Licenciamento e Medição no mesmo chunk, sem incorporar recursivamente suas dependências. O total passou a 1.890.975 bytes gzip, com 353 bytes de folga no teto vigente. A medição em sessões novas confirmou que o chunk não é solicitado no login nem no Dashboard. A entrada ficou em 9 arquivos e 252.833 bytes gzip no celular e 10 arquivos e 254.154 bytes no desktop.

O portal usa a projeção editorial existente e o Dashboard apenas lê os registros que geram prioridades. A revisão dos testes e do manual confirmou que a extração preserva as informações exibidas e não altera o reconhecimento de valores no DRE ou as orientações ao operador.

Passaram 129 testes direcionados em 41 arquivos e 33 cenários em Chromium no celular e no desktop com API simulada. O cenário de chat em paisagem passou no celular e foi pulado no desktop por configuração. Lint, manual, tipagem, arquitetura, sintaxe da API e build passaram localmente. A análise de 1.028 arquivos e 3.890 dependências locais encontrou zero ciclos. A suíte completa e a jornada com PostgreSQL descartável seguem previstas nas etapas finais.

### Etapa 2 — Salvamento e recuperação no CompanyWorkspace

O [hook de salvamento](../src/features/workflow/use-workspace-saving.js) concentra a atualização otimista, a fila serializada, a adoção de respostas do servidor e a recuperação de edições protegidas. O CompanyWorkspace mantém a navegação, as guardas de troca de conta e empresa e a execução dos comandos de Ponto. `LegacyApp.jsx` passou de 14.530 para 14.256 linhas. O piloto estrito passou de 17 para 19 módulos, com tipos para o snapshot, a identidade da retentativa, o estado da fila e os recibos de recuperação. Os tipos de React são dependência de desenvolvimento.

As rotas e o cálculo do DRE seguem usando as mesmas origens e comandos. A extração não introduz gravação, reenvio automático na recarga ou alteração nas regras de acesso. A revisão da ajuda e do manual confirmou que as instruções ao operador continuam válidas.

O build sem o ajuste de agrupamento excedia o teto em 205 bytes. Ao incluir o Diário de Obra no grupo sob demanda de Conferência, Licenciamento e Medição, o bundle final passou a 1.890.853 bytes gzip, 475 abaixo do teto vigente. O arquivo compartilhado passou de 35.967 para 52.510 bytes gzip e é baixado no primeiro acesso a uma das quatro telas. Em sessões novas nos temas Preciso e Noite, o grupo ficou fora do login e do Dashboard. A entrada ficou em 9 arquivos e 252.832 bytes gzip a 390 px, e 10 arquivos e 254.153 bytes a 1.440 px.

Os ensaios do IndexedDB passaram a usar a chave do armazenamento ativo. As falhas do teste com a chave antiga foram observadas também no build anterior. O próximo recorte da etapa 2 é a separação dos blocos de Relatórios e da carteira de Obras.

Lint, manual, arquitetura, tipagem e build passaram localmente. A suíte geral teve 5.675 testes aprovados e 23 pulados, com o PostgreSQL externo desativado. Na reexecução direcionada sobre os arquivos finais, passaram 222 testes em 38 arquivos.

Os 36 cenários do build em Chromium passaram entre a rodada geral e a reexecução dirigida, com API simulada a 390 e 1.440 px. O ensaio de falha de gravação local passou duas vezes em cada largura depois que o teste passou a aguardar a mensagem de erro antes de liberar a próxima tentativa.

### Etapa 2 — Extração de Relatórios

O [hub Relatórios](../src/features/relatorios/RelatoriosView.jsx) concentra o painel analítico, os relatórios executivo, de Caixa de Obra, de Compras e de Administração, e a entrada da Projeção de Mão de Obra. `LegacyApp.jsx` passou de 14.254 para 13.275 linhas e mantém a ligação da tela com a navegação. O [extrato do Caixa de Obra](../src/reports/work-cash-report.js) continua compartilhado entre a tela de Caixa e Relatórios. A checagem estrita passou de 19 para 21 módulos. A contagem total de exceções de estilo e UX foi preservada na transferência entre arquivos.

A origem e a competência dos valores permanecem nas funções canônicas da Folha, do Caixa e do DRE. Os relatórios continuam consultivos e a ajuda e o manual mantêm o fluxo existente. Em seis ensaios com dados fictícios, o build anterior e o atual produziram capturas idênticas nos temas Preciso e Noite a 390 e 1.440 px. Também coincidiram os textos, as duas planilhas e o conteúdo das prévias para PDF. A aba de projeção continuou condicionada ao perfil.

O build final ficou em 1.889.903 bytes gzip, com folga de 1.425 bytes no teto vigente. Os gráficos financeiros passaram a compartilhar um chunk de 2.438 bytes gzip. O arquivo do gráfico analítico antes tinha 1.104 bytes gzip. A rede foi verificada no login e no Dashboard, e o Excel continuou carregando na primeira exportação. O próximo recorte da etapa 2 é a carteira de Obras.

Lint, manual, arquitetura, tipagem e build passaram localmente. A suíte geral teve 5.675 testes aprovados e 23 pulados com o PostgreSQL externo desativado. Passaram também 84 testes direcionados. O gráfico atrasado preservou o resumo, os filtros e as ações em celular e desktop no build e em DEV. As primeiras execuções em DEV expiraram durante a carga inicial e passaram nas reexecuções.

### Etapa 2 — Extração da carteira de Obras

A [carteira de Obras](../src/domains/obras/components/ObrasCarteira.jsx) concentra o painel, a busca, a paginação, o quadro de fases, os formulários e a integração de pastas. `LegacyApp.jsx` passou de 13.275 para 12.355 linhas e mantém a navegação para o detalhe da obra. A checagem estrita passou de 21 para 22 módulos, incluindo o recorte de dados, os formulários, os estados da carteira, os retornos do OneDrive e os comandos versionados. O código continua no grupo operacional sob demanda do build.

As regras de gravação, permissões e cálculo do DRE permanecem nas mesmas origens. A carteira continua usando o comando de obra com versão esperada e não escreve ao abrir. A ajuda e o manual mantêm as instruções atuais. A transferência dos estilos e textos preservou a contagem total das exceções registradas.

O primeiro build com a extração passou no teto com 1.890.403 bytes gzip, com 925 bytes de margem. Durante a validação, entraram alterações na exportação de composições do Orçamento. Com essas alterações preservadas, o checkout passou a 1.894.239 bytes gzip, 2.911 acima do teto de 1.891.328. Um build local do mesmo checkout com apenas a carteira anterior substituída em memória mediu 1.894.218 bytes gzip. A diferença medida da extração no checkout atualizado foi de 21 bytes. O limite segue igual. As variantes de agrupamento e minificação avaliadas não passaram nos limites vigentes e ficaram fora da configuração do projeto.

Em seis cenários comparativos com API simulada, as dez capturas do painel e do fluxo coincidiram entre os builds. As verificações cobriram 390 e 1.440 px, os temas Preciso e Noite e os perfis Administração e Engenharia. Busca, filtro, paginação, acesso ao detalhe, movimentação, desfazer e edição mantiveram os mesmos resultados e versões esperadas. Login e Dashboard ficaram sem carregar o grupo operacional. Passaram também 16 cenários Playwright de contexto, formulário e troca de empresa em celular e desktop e 100 testes direcionados.

A suíte geral registrou 5.675 aprovações, 23 pulados com o PostgreSQL externo desativado e quatro falhas durante a atualização da exportação de composições. Os cinco testes desse arquivo passaram isoladamente depois que a implementação correspondente entrou no checkout. A rodada direcionada ao checkout atualizado passou em 108 testes e a reexecução no navegador confirmou os mesmos resultados e comandos nos seis cenários comparativos. Lint, manual, arquitetura, tipagem e compilação local passaram. A checagem de tamanho do checkout combinado segue pendente.

### Etapa 2 — Ajuste do bundle após Obras e Orçamento

Com as alterações do Orçamento, o build combinado chegou a 1.896.436 bytes gzip. A [minificação seletiva](../scripts/minify-vendor-chunks.mjs) reduziu o total para 1.890.803 bytes gzip, com 525 bytes de margem no teto de 1.891.328. A checagem de tamanho passou para o total, os chunks individuais e a mídia. A redução veio dos chunks de Recharts, ExcelJS e do leitor ESM do PDF.js. O worker do PDF.js mantém os mesmos bytes. O Vite mantém a minificação padrão para os demais chunks.

A mudança atua na compilação. Os fluxos, permissões e cálculos continuam usando o mesmo código da aplicação. A revisão da ajuda contextual e do manual confirmou que as instruções existentes seguem aplicáveis. Em seis cenários com dados fictícios, a carteira de Obras manteve os mesmos resultados e comandos, com dez capturas idênticas à referência. O leitor do Orçamento extraiu texto de um PDF sintético de duas páginas a 390 e 1.440 px, usando o worker local.

As dependências estáticas da entrada continuaram em 245.510 bytes gzip. No Playwright, 28 verificações da primeira rodada passaram. O teste de exportação das composições precisou acompanhar a posição atual das colunas e o seletor do celular. Na reexecução, o Excel passou nas duas larguras e o teste do PDF com prévias em ambos os tamanhos também passou. A verificação isolada do ExcelJS manteve XLSX, CSV e a proteção de planilhas.

Lint, manual, arquitetura e tipagem passaram. A suíte completa incluiu 760 arquivos. A rodada paralela registrou falhas de tempo e encerrou com dois processos de teste travados. Os sete arquivos afetados passaram nas reexecuções direcionadas. O resultado consolidado foi de 5.683 testes aprovados e 23 pulados porque dependem de PostgreSQL externo.

### Etapa 2 — Extração da Medição de evolução

A [Medição de evolução](../src/domains/medicoes/components/MedicaoEvolucao.jsx) reúne o boletim técnico, o vínculo das etapas de terceirizados e a prévia de faturamento. O [contrato tipado](../src/domains/medicoes/evolution-contract.ts) cobre os dados da tela, as ações e os comandos enviados. O [resumo da medição](../src/domains/medicoes/evolution-summary.js) é compartilhado com o detalhe de Obras. O `LegacyApp.jsx` conserva os pontos de entrada e as exportações existentes.

O avanço aprovado dos terceirizados continua sendo uma proposta para o boletim. O boletim confirmado continua alimentando o Planejamento. O cálculo do faturamento e a entrada no DRE continuam nos fluxos financeiros existentes. A extração preservou o comportamento da interface e transferiu as exceções de estilo legadas com o mesmo total. A ajuda e o manual continuam aplicáveis.

O build passou de 1.890.733 para 1.890.962 bytes gzip, com 366 bytes de margem no teto vigente. Em quatro cenários comparativos a 390 e 1.440 px, nos temas Preciso e Noite, as oito capturas da tela e do diálogo ficaram idênticas. A confirmação pelo deslizador gerou o mesmo comando nos dois builds, incluindo o percentual do diário, a proposta do terceirizado e o percentual confirmado, com API simulada.

O `LegacyApp.jsx` passou de 12.355 para 11.779 linhas. Lint, manual, arquitetura e tipagem passaram, assim como nove cenários Playwright de contexto de Obras e Orçamento e exportações de composições. A suíte completa em 760 arquivos teve 5.682 aprovações, 23 pulados que exigem PostgreSQL externo e uma falha na lista esperada de módulos com tipagem estrita. O teste foi atualizado para incluir Medição de evolução e o resumo compartilhado e passou na reexecução isolada, totalizando 5.683 aprovações.

### Etapa 2 — Extração de Comunicação

A [tela de Comunicação](../src/features/workflow/Comunicacao.jsx) reúne notificações, prioridades da equipe, tarefas de conferência e ranking. O [contrato tipado](../src/features/workflow/communication-contract.ts) cobre os dados consultados, o perfil do usuário e as respostas do ranking. O `LegacyApp.jsx` conserva o ponto de entrada e passou de 11.779 para 11.623 linhas.

As prioridades continuam consultando Ponto, Diário e Conferências. Os ajustes do ranking continuam usando `/api/presence` com a permissão de administrador conferida no servidor. Os pontos são indicadores operacionais e não alteram os lançamentos ou cálculos do DRE. As instruções da ajuda continuam aplicáveis. As exceções de estilo existentes foram transferidas sem mudar o total.

O build final passou da referência de 1.890.962 para 1.890.703 bytes gzip, com 625 bytes de margem no teto atual. A versão final descartou dois campos intermediários que a tela não consumia. Em seis cenários comparativos, a pontuação e os pedidos simulados de inclusão e remoção coincidiram. O perfil de Engenharia continuou sem controles de ajuste. A revisão cobriu 390 e 1.440 px, com os temas Preciso e Noite. Treze das 14 capturas coincidiram byte a byte e a diferença restante foi de 12 pixels na captura do ranking.

Lint, arquitetura, tipagem e manual passaram. A suíte completa registrou 5.683 testes aprovados, 23 pulados por dependerem de PostgreSQL externo e nenhuma falha. Passaram 13 cenários Playwright de Comunicação, contexto de Obras e exportações do Orçamento. A carteira de Obras passou em seis cenários e a Medição manteve seus comandos e as oito capturas da comparação. A validação usou dados fictícios e ocorreu localmente, sem publicação.

### Etapa 2 — Extração do chat flutuante

O [chat flutuante](../src/features/workflow/ChatFlutuante.jsx) passou a ter [contratos tipados](../src/domains/chat/contracts.ts) para participantes, mensagens, menções, anexos e respostas da API. O `LegacyApp.jsx` conserva a montagem junto ao cabeçalho e à navegação móvel e passou de 11.623 para 11.266 linhas.

Foram preservadas a frequência das consultas, a indicação de menções, a resolução de anexos protegidos e as ações de moderação. As permissões e a persistência continuam nos endpoints existentes. Mensagens e anexos pertencem à comunicação da empresa e não alteram o cálculo do DRE. A ajuda atual continua aplicável. As exceções de estilo existentes foram transferidas sem aumentar o total.

O build da extração mediu 1.890.704 bytes gzip, ante 1.890.659 na referência local. Com as alterações locais de Orçamento, relatórios e ajuda preservadas, o build combinado mediu 1.891.178 bytes gzip, com 150 bytes de margem no teto vigente. Em quatro comparações a 390 e 1.440 px, nos temas Preciso e Noite, as capturas foram idênticas. Com API simulada, coincidiram os pedidos de envio com menção e anexo, além de silenciamento, dessilenciamento e exclusão no perfil de Administração. O perfil de Engenharia manteve o acesso à conversa com os controles de moderação ocultos.

Lint, arquitetura, tipagem e manual passaram. A suíte completa em 760 arquivos registrou 5.682 aprovações, 23 pulados por dependerem de PostgreSQL externo e uma falha na sincronização do manual enquanto a ajuda era atualizada. A reexecução passou depois da sincronização e incluiu os quatro testes de impressão do Orçamento que entraram após o início da suíte, para um resultado consolidado de 5.687 aprovações. Também passaram 14 cenários Playwright. A carteira de Obras passou nos seis cenários comparativos e a Medição preservou os comandos e as oito capturas. A validação ficou local, sem publicação.

### Etapa 2 — Extração da Busca Global

A [Busca Global](../src/navigation/BuscaGlobal.jsx) passou a receber um contrato tipado para o índice de resultados, as abas permitidas e os callbacks de navegação e fechamento. O componente reaproveita o tipo de entrada do [índice existente](../src/navigation/global-search.js). O `LegacyApp.jsx` conserva a montagem e passou de 11.266 para 11.205 linhas. O índice, a ordenação e os destinos continuam usando as funções existentes.

A busca consulta os dados já carregados e encaminha o usuário para a tela escolhida, sem modificar os lançamentos ou o cálculo do DRE. Os atalhos continuam coordenados pelo hook de navegação. A ajuda atual continua aplicável. As exceções de estilo foram transferidas sem alterar o total registrado.

O build da extração mediu 1.891.266 bytes gzip, ante 1.891.178 na referência. Com as alterações de impressão do Orçamento preservadas, o checkout ultrapassou o teto antes do ajuste de empacotamento. A minificação seletiva passou a incluir o chunk `LegacyApp` e o build final mediu 1.891.037 bytes gzip, com 291 bytes de margem no teto vigente. Em quatro comparações a 390 e 1.440 px, nos temas Preciso e Noite, as oito capturas foram idênticas. A conferência cobriu o foco inicial, Ctrl/Cmd+K, Escape, clique fora, consulta vazia, ordem dos resultados, abertura de obra por toque ou teclado e a filtragem por perfil.

Lint, arquitetura, tipagem e manual passaram. No build final passaram 22 testes Playwright de navegação, permissões, Comunicação, chat em paisagem, contexto de Obras e Medição e exportações do Orçamento. A verificação de inicialização em sessões novas completou 214 cenários sem falhas. As verificações comparativas da carteira de Obras e da Medição também passaram.

A suíte completa em 761 arquivos registrou 5.685 aprovações, 23 pulados por dependerem de PostgreSQL externo e seis falhas em impressão e sincronização do manual durante as alterações locais. A reexecução passou no estado final, incluindo um teste de impressão acrescentado durante a rodada. O resultado consolidado foi de 5.692 testes aprovados. A validação ficou local, sem publicação.

### Etapa 2 — Extração de Telas antigas

A [tela de obras inativas e funcionários desligados](../src/domains/administracao/components/Obsoletos.jsx) passou a receber um [contrato tipado](../src/domains/administracao/components/archived-records-contract.ts) para os dados, os destinos e o comando de readmissão. O `LegacyApp.jsx` passou de 11.205 para 11.071 linhas e continua montando a tela no menu Administração. O estado vazio permanece compartilhado com Cadastros.

A reativação da obra continua alterando seu status pelo salvamento existente. A readmissão mantém o comando versionado com as permissões do servidor. A extração preservou os campos enviados e não mudou as regras financeiras do DRE. A ajuda atual segue aplicável e as exceções de estilo foram transferidas sem alterar o total registrado.

O build da extração mediu 1.891.047 bytes gzip, ante 1.891.037 na referência. Com as alterações locais do Orçamento e da ajuda preservadas, o build combinado passou com 1.891.072 bytes gzip e 256 bytes de margem no teto vigente. Em quatro cenários com API simulada a 390 e 1.440 px, nos temas Preciso e Noite, as oito capturas ficaram idênticas. As duas operações enviaram os mesmos dados do build anterior. A readmissão preservou a versão esperada, a reativação retirou somente a obra selecionada da lista de inativas e o atalho Ver dados continuou abrindo Obras.

A suíte completa registrou 5.693 testes aprovados, 23 pulados por dependerem de PostgreSQL externo e nenhuma falha. Lint, arquitetura, tipagem e manual passaram. Também passaram 22 cenários Playwright de regressão e três reexecuções das exportações em PDF e Excel no build combinado. A validação ficou local, sem publicação.
