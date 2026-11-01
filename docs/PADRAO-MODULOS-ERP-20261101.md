# Padrão dos módulos MARCELL — 01/11/2026

## Entrega

A direção MARCELL Operacional, inspirada na organização SAP, foi estendida à base compartilhada das demais telas. Marca e logo permanecem. O trabalho está no checkout local `C:/dev/releases/marcell-saas-release-20261101`, branch `codex/sap-operational-theme-20261101`, prévia http://127.0.0.1:4253/. Não houve push ou deploy desta etapa.

Impeccable orientou a hierarquia e a inspeção renderizada; shadcn orientou a composição com controles existentes, variantes e papéis semânticos. Não foi instalada outra biblioteca de interface.

## Receita comum

| Elemento | Padrão |
| --- | --- |
| Cabeçalho de página | PageHeader e PageHero na mesma receita, título de 24px e descrição de 14px, ações próximas ao título |
| Tema | Superfície, peso, preenchimento, seleção e bordas vêm do registro de tokens; escolhas anteriores continuam disponíveis |
| Botões e abas | Controles compartilhados e variantes existentes; rótulos de ação explícitos, foco e seleção preservados |
| Filtros | FilterBar em grade, alinhamento pela base e adaptação para uma coluna no celular |
| Formulários e indicadores | Seções, subtítulos e valores seguem a hierarquia comum, com estados semânticos |
| Gráficos e resultados vazios | Superfícies opacas, sem desfoque decorativo; mensagem legível e ação existente preservada |
| Uso móvel | Ações podem quebrar em linhas, seletores de área existentes permanecem, tabelas largas usam rolagem própria |

O Modo TV mantém sua escala para leitura à distância. A apresentação impressa não foi convertida em tela operacional.

## Ajustes específicos

- Projetos: busca, situação, obra, responsável e visualização agrupados no mesmo conjunto.
- Arquivos: obra e área documental no mesmo conjunto, preservando o explorador e os comandos existentes.
- Patrimônio, Conferência e Ranking de fornecedores: filtros usam a mesma receita.
- Gestão do ponto: filtros ocupam a largura disponível; contagem e sincronização ficam abaixo. Administrativo e pessoal de obra continuam separados com a classificação já aprovada.
- Marcos e Curva A: cabeçalho e navegação compartilhados, botões do sistema, perfil de fornecimento identificado e limites A/B com rótulos acessíveis. Cores próprias foram substituídas por papéis do tema; cálculos e aprovação não mudaram.
- Ponto eletrônico: cabeçalho e estado sem obras compartilhados; navegação por teclado das abas e orientações formais preservadas.
- Orçamento: ação principal “Novo orçamento” e recurso local “Guia do orçamento”.
- Comercial: cabeçalhos, estados vazios e grafia de “Novo lead” padronizados sem mudar estados do negócio.
- Conciliação: “Importar extrato” passa a ser um botão real do sistema, acionável por teclado, mantendo os mesmos formatos e a mesma importação. O ícone acompanha a cor do botão.

## Ajuda e manual

Revisada a fonte única `src/features/help/help-content.js`. Incluída orientação para reconhecer a organização das telas e atualizados os nomes dos controles do orçamento. O guia de Marcos e Curva A foi corrigido para descrever proposta ABC, aprovação, geração de planos e configuração que a tela efetivamente oferece. Manual regenerado; 96 guias cobrem as 65 abas.

## Verificação

- 136 cenários da varredura geral aprovados: 65 abas em desktop/celular e controles compartilhados. As 64 áreas operacionais apresentam cabeçalho compartilhado nos dois tamanhos; Modo TV é a exceção deliberada.
- 12 cenários específicos aprovados para filtros, preservação de contexto ao abrir ajuda, abertura de formulários, configuração de suprimentos e seletor de arquivos acionado pelo teclado.
- 8 cenários SAP aprovados para temas, fonte local, densidades e contexto em Compras, Financeiro, Ponto e Folha.
- Regressão de navegação, temas, condições adversas e grupos: 51 aprovados, uma exclusão preexistente; os dois casos de tipografia foram repetidos após preservar o peso do tema Claro.
- 114 testes aprovados em 23 arquivos; mais 11 testes de Conciliação aprovados após o ajuste do botão.
- Lint, TypeScript, manual sincronizado, build e orçamento de bundle aprovados. Auditoria de importações sem ciclos; detector de layout nos alvos compartilhados sem ocorrências.
- A última mudança isolada de Conciliação também passou por nova renderização em desktop/celular. Não houve alteração de instruções operacionais, pois nome, arquivos aceitos e resultado da importação permanecem.

Uma execução concorrente com build teve falha transitória de importação dinâmica; a repetição integral estabilizada passou nos 136 cenários. Um teste de navegação móvel excedeu o tempo sob concorrência; a suíte completa foi repetida com dois workers e passou. Não foram alterados temporizadores ou regras do produto para contornar essas falhas.

Relatórios locais em `artifacts/module-standard` e capturas gerais em `artifacts/sap-theme/whole-erp`.

As verificações usam dados fictícios e APIs interceptadas localmente. Não representam aprovação de transações reais, piloto acompanhado por operadores ou teste em aparelho físico. O objetivo desta etapa é padronização da interface e preservação dos controles existentes.
