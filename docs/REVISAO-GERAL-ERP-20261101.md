# Revisão geral do ERP — 01/11/2026

## Escopo

Revisão local motivada pelos desalinhamentos e pela dificuldade de reconhecer os botões na captura de Compras enviada pelo usuário. A cobertura percorre o catálogo real `TAB_META_BASE`, incluindo os destinos comerciais antigos, em 1440 × 1000 e 390 × 844. A conferência de cabeçalho também usa 320 px e as densidades compacta e confortável.

O trabalho está na branch local `codex/saas-theme-system-20261031`, worktree `C:/dev/releases/saas-theme-20261031`. A prévia com dados fictícios continua em http://127.0.0.1:4250/. Não houve deploy, push, migração de banco ou alteração de regras de cálculo e autorização.

## Achados e correções

| Achado | Correção aplicada |
|---|---|
| Botão de criação e menu de Compras centralizados na altura do campo com rótulo | Grade alinhada pela base dos controles; ações de PageHeader e barras de filtro seguem o mesmo princípio |
| Abas de Compras e Financeiro pareciam texto comum | Botões delimitados, seleção com fundo/borda, contadores separados, hover, cursor e foco por teclado; quebra de linha conserva os destinos em larguras intermediárias |
| Consultas e cadastros parecia um texto solto | Acionador delimitado com chevron, estados aberto/hover/foco e alinhamento com as outras áreas |
| Paleta de aparência sem contorno e Ponto com estilo isolado | Aparência e Ponto usam o contrato de botão; alturas do status e das ações do cabeçalho ficam alinhadas, com 44 px no celular |
| Mais módulos desaparecia ao abrir no celular | O painel estava dentro da barra que seu próprio bloqueio de rolagem ocultava. Agora usa Dialog compartilhado, fora desse ancestral, com sobreposição, foco, Escape e restauração do foco |
| Controles do cronograma tinham aparência e cores próprias | Dia, Semana, Mês, Dias e Colunas usam Button; escala selecionada e abertura de colunas têm estado acessível |
| Situação inicial do Licenciamento não anunciava a seleção | Novo processo/Obra já aprovada recebem aria-pressed e estados de seleção que respondem ao tema, mantendo os comandos existentes |
| Orientação sobre aparência escrita diretamente no painel de ajuda | Conteúdo movido para HELP_INTERFACE_GUIDE em help-content.js; ajuda e manual passam a consumir a mesma fonte |

O indicador de salvamento permanece informativo. Não recebeu um clique fictício. Dados, filtros, validações, permissões e comandos dos registros foram preservados.

## Cobertura por módulo

- Visão gerencial: Dashboard, DREs, relatórios, TV, comunicação e aprovações.
- Financeiro: gestão, medições, caixa e conciliação; áreas internas e continuidade de documentos/pagamentos nos cenários de fluxo.
- Obras e projetos: obras, projetos, arquivos, orçamento, planejamento, marcos, diário, medição, conferência e licenciamento.
- Compras: fila, áreas do processo, fornecedores, curva/preços e estoque; abertura de solicitação, seleção e menus por teclado.
- Equipamentos e locações: cadastro, central de locações e acesso pelo menu móvel.
- Pessoas e terceiros: equipes, equipe nas obras, ponto, ponto eletrônico, folha, rescisão, terceirizados e indicadores.
- Comercial: seis áreas atuais e os destinos antigos presentes no catálogo.
- Administração: central, patrimônio, cadastros, ajustes, IA e telas antigas.

## Critérios e evidências

A varredura registra a aba realmente aberta, dimensões da página/cabeçalho, possíveis controles fora da largura, captura e erros de execução. Aguarda o carregamento do módulo antes de conferir. Os cenários de interação verificam alinhamento, seleção, mudança de área por Enter, hover, foco visível, menu, escala do cronograma, densidade e abertura de formulário.

As capturas e medições usam dados de teste isolados e estão em `artifacts/erp-review/`. Abertura e geometria de uma aba não representam validação de todas as suas transações. Não houve piloto com operadores nem avaliação em aparelhos físicos neste ciclo.

## Validação final

- 65 abas × 2 larguras: 130 verificações de abertura, aba real, cabeçalho, ajuda, erros e transbordamento.
- Mais 6 cenários de interação e alinhamento: 136 aprovados na varredura geral.
- 45 cenários adicionais aprovados de navegação, perfis, ajuda, temas e recuperação WF09. Um cenário de paisagem foi ignorado no projeto desktop por se aplicar somente ao celular; foi executado no projeto móvel.
- 57 testes automatizados aprovados em 15 arquivos, incluindo o menu móvel e o diálogo compartilhado.
- Build, lint, TypeScript e verificação do diff aprovados. Detector de layout: nenhuma ocorrência nos alvos compartilhados revisados.
- Ajuda com revisão de 01/11/2026 e manual gerado com 90 guias para as 65 abas.

Os testes de identidade foram atualizados para o padrão Claro/Inter e seus tamanhos documentados. A espera pela navegação interna foi ajustada para o módulo lazy terminar de carregar antes de escolher entre destinos principais e menu adicional. Não houve retirada de verificações de permissão, dados financeiros ou retorno de contexto.
