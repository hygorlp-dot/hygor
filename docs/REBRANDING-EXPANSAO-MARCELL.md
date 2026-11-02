# Expansão visual MARCELL — 31/10/2026

Continuação local do [piloto aprovado](PILOTO-VISUAL-MARCELL.md), mantendo nome, logo e arquitetura do ERP. A identidade operacional agora alcança os módulos web, com revisão aprofundada de Obras, Orçamento, Planejamento e Pessoas.

## Revisar a implementação

Prévia isolada: http://127.0.0.1:4198

- E-mail: `piloto@local.test`
- Senha: `piloto-local`
- Dados fictícios em memória, sem conexão com o banco de produção.
- Reiniciar no PowerShell: `$env:MARCELL_PREVIEW_PORT='4198'; node scripts/rebranding-pilot-preview.mjs`.

## Direção aplicada

Source Sans 3 variável, da Adobe, servida pelo próprio app com licença OFL. Corpo de 15 px, rótulos de 14 px, títulos de 24 px e números tabulares. Controles compartilham alturas e estados; densidade do usuário continua respeitada. As regras estão em `src/design-system/themes/marcell-workspaces.css` e no [DESIGN.md](../DESIGN.md).

O conteúdo usa a largura disponível. Cabeçalhos e indicadores ocupam menos altura; a tarefa principal aparece antes das análises complementares. No celular, seletores nativos substituem faixas extensas de abas, mantendo todas as opções acessíveis.

- **Obras:** diretório horizontal em telas largas, cartões responsivos, contratos completos e arquivos sob demanda. A tela interna troca o banner fixo por cabeçalho compacto e resumo expansível. Um seletor agrupado reúne as telas da obra no celular.
- **Orçamento:** dados e versões sob demanda, totais compactos, planilha em destaque e ferramentas agrupadas. Auditoria sinaliza ocorrências mesmo recolhida. Aprovação e avisos financeiros permanecem acessíveis.
- **Planejamento:** cronograma antes de compromissos e indicadores complementares; ferramentas e legenda expansíveis. O aviso de orçamento em rascunho continua visível.
- **Pessoas:** pesquisa e lotação antes do diretório, filtros compactos, seleção de situação no celular. Na folha, título antes da competência e controles em duas colunas no celular.
- **Demais áreas:** tema operacional compartilhado, cabeçalhos e navegação normalizados, incluindo Comercial, Medições, Equipamentos e cadastros.

TV e documentos impressos mantêm suas escalas e tipografia específicas. A marca institucional permanece. As mudanças visuais não alteram cálculos, permissões ou regras de persistência.

## Evidências locais

- Lint do projeto e TypeScript sem erros.
- 161 testes relevantes aprovados, incluindo orçamento, planejamento e navegação de fluxos.
- Build Vite local aprovado; permanece o aviso de tamanho de chunks do app.
- 46 telas operacionais percorridas em desktop e celular, em 100 capturas incluindo os quatro módulos principais. Sem erros JavaScript, títulos principais ausentes ou extravasamento horizontal da página.
- 25 capturas adicionais cobrem edição de orçamento, memória de cálculo, ferramentas do cronograma, filtros de pessoas e obras, navegação interna da obra, 320 px, tela larga e fonte ampliada.
- 14 capturas de regressão do piloto; sem erros JavaScript.
- Detector Impeccable sem ocorrências no novo arquivo de tema.

Relatórios e capturas estão em `artifacts/rebranding-app/final/`, `artifacts/rebranding-app/final-targeted/` e `artifacts/rebranding-pilot/`. Os scripts usam APIs simuladas e verificam a interface real do app; não comprovam integrações de produção nem substituem revisão com dados reais.

Nenhum push, PR, deploy ou migração de banco foi executado nesta expansão.
