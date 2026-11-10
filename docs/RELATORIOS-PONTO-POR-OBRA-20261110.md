# Relatórios de ponto por obra — validação local

Aba em **Pessoas e terceiros → Ponto eletrônico (app) → Relatórios por obra**. Desenho aprovado pelo usuário em 10/11/2026. Permanece local, sem push ou deploy.

## Uso

Escolha obra, início e fim (até 62 dias), funcionário e visualização Batidas/Banco de horas. Gerar relatório confirma o período. A exportação Excel inclui Consulta, Batidas e Banco de horas; Exportar PDF abre a prévia MARCELL com Imprimir / salvar PDF. As duas saídas incluem todos os registros do filtro, além da página visível.

O relatório consulta a ação existente `ponto-banco-horas`; não há endpoint novo de gravação. A autorização de aba, perfis e população consultável continua no servidor. Filtros locais não ampliam os dados retornados pela API. As batidas são lidas do app; registros ainda na fila do celular não aparecem antes do recebimento pelo servidor.

## Apuração

Reutiliza `construirBancoHoras`, incluindo almoço padrão e tolerância vigentes. Apura o dia inteiro antes de recortar a obra. Sem jornada ou saída, o dia permanece pendente; desconhecido não vira zero. O tempo entre registros não é apresentado como hora líquida.

Uma jornada diária não é descontada para cada obra visitada. Nos dias com várias obras, o saldo diário aparece nas observações, sem rateio automático. As colunas de jornada/saldo da obra ficam não atribuídas. Almoço padrão sem horário também não é distribuído arbitrariamente entre obras. A consulta é estimada, sem saldo anterior ou compensações e não substitui documentos fiscais oficiais.

Exportação bloqueada durante consulta, falha de atualização, cobertura incompleta ou datas ainda não consultadas. Avisos da apuração acompanham a tela e a seção Consulta dos arquivos exportados. Conteúdo de cadastro é escapado no HTML do PDF. A exportação não recalcula uma consulta diferente.

## Harmonia e acessibilidade

Skills Brainstorming, Impeccable e shadcn consultadas; interface herda o sistema MARCELL existente. Usa Button/Input/SelectControl, WorkspaceCommandBar, estados compartilhados e composição/CSS já usados no banco de horas, sem nova paleta, fonte, dependência ou exceção à baseline.

No computador, tabela comparável; no celular, registros empilhados com rótulos e valores completos. Explicação extensa fica em expansão acessível. Navegação entre as três abas por setas, Home/End e foco; guia específico no botão Ajuda e manual atualizado.

O Impeccable carregou o contexto e o detector não apontou ocorrências. Revisão visual manual das capturas integrada ao app em 1440×1000 e 390×844, dos resultados com dados sintéticos e da prévia/PDF. No PDF, foi corrigida a largura dos rótulos de identificação para evitar palavras partidas. A4 paisagem, logo, fontes e marca d’água vêm do tema compartilhado dos relatórios.

## Evidência

- 153 testes em 12 arquivos aprovados: relatórios, interface, almoço, tolerância, autorização/cobertura da API e preparação/corte local.
- Quatro cenários Playwright aprovados: exportação e navegação integrada, em desktop e celular. Excel reaberto com ExcelJS; conteúdo e abas conferidos. PDF real gerado pelo Chromium e renderizado para revisão.
- Teste com 120 batidas verifica paginação 100/20 e exportação integral dos 120 registros.
- Lint, design:check, manual:check, typecheck e diff --check aprovados. Sem alterar a baseline.
- Arquivos de demonstração e capturas em `artifacts/repp-tecnico/relatorios-ponto/`; são dados sintéticos, sem funcionários reais. Esses artefatos não entram no commit.

Os testes de navegador interceptam as APIs; não constituem homologação com celular físico ou verificação dos aparelhos reais. Nenhuma migração, pagamento, permissão, batida ou APK foi alterado. A preparação do corte fiscal continua bloqueada pelas condições registradas no inventário separado.
