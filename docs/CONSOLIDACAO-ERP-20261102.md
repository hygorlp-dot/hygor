# Consolidação do checkout principal e publicação coordenada

02/11/2026. Fonte principal: C:/dev/repositorio-mrc.

## Conteúdo preservado

Correções do checkout 8bfa833d, padronização global MARCELL, gestão de membros, relatório financeiro completo por obra e integração contábil/Previsões/SPI concluída na conversa Adicionar gestão de projetos. A autorização humana de coordenação determinou uma única publicação final. A outra conversa confirmou congelamento; o manifesto de 1.141 entradas foi comparado ao principal, sem diferenças.

As correções dos nove testes foram mantidas: oito expectativas desatualizadas e um problema real de retorno do foco em diálogos empilhados. A suíte completa revelou e permitiu corrigir também o cancelamento da transferência de PDF e o encerramento do worker, além de mocks de carregamento e consultas a portais. A data do servidor fictício no teste de previsão foi fixada para coincidir com a data do cenário, preservando as verificações de histórico.

Backup anterior à integração em C:/dev/backups/marcell-consolidation-20261102, com inventário, hashes, patch dos arquivos rastreados e propostas de merge. Alterações do conjunto contábil também preservadas em C:/dev/releases/accounting-integration/backup. Não foram apagados artefatos locais ou arquivos do usuário. As 12 diferenças próprias do principal foram revisadas; três conflitos de imports/estilos foram resolvidos preservando o menu ajustável, usuários e relatórios. A conferência anterior à integração contábil não encontrou mudanças fora do escopo.

## Validação do conjunto congelado

- Suíte completa: 4.729 testes aprovados em 624 arquivos; 15 testes e três arquivos já marcados como ignorados, sem novas exclusões. artifacts/consolidation-unit-verified.log.
- Navegador no build final: 209 cenários aprovados, desktop e celular. Inclui 65 abas, alinhamento global, Compras, Financeiro, Conciliação, fotos, RH, membros e relatório completo por obra. artifacts/consolidation-browser-verified.log.
- No mesmo checkout: sete cenários contábeis e quatro de linha de base/SPI aprovados em desktop, tablet e celular, com APIs e dados fictícios locais. artifacts/consolidation-accounting.log e consolidation-spi.log. Total: 220 cenários de navegador.
- Lint, tipos, arquitetura e auditoria de ciclos aprovados. Baseline de exceções visuais idêntica à revisão 8bfa833d; não foi ampliada. artifacts/consolidation-combined-{lint,typecheck,architecture}.log e consolidation-combined-cycles.json.
- Ajuda e manual sincronizados: 116 guias para 65 abas. Incluem retorno de foco, PDF, membros, relatório por obra, indicadores, previsões e linha de base.
- Build direto do Vite aprovado sem prebuild ou migrações. JS/CSS: 1.887.938 bytes gzip, dentro de 1.889.280 (1845 KiB). O conjunto de indicadores/Previsões/SPI foi incorporado ao orçamento, com justificativa registrada em scripts/bundle-budgets.mjs. O núcleo financeiro tem teto específico de 204 KiB; genérico de 200 KiB e demais tetos/mídia preservados. A margem é pequena; o aviso de chunks grandes continua como dívida técnica conhecida.

Duas falhas de início de sessão na primeira execução do navegador foram transitórias; passaram na repetição e na execução final de 209 cenários. Uma falha anterior do manual coincidiu com alterações simultâneas de guias; passou após o congelamento, inclusive na suíte completa. Esses resultados não foram tratados como sucesso antes da repetição.

## Publicação

Destino conferido por API autenticada e CLI: projeto mrc, prj_t7UJ797nm3uYPRSSTlFWWZc42tn7, equipe team_poBZ5I1rwStzhvD73ar22b7v. Endereço principal: https://marcellapp.vercel.app.

A tentativa staged anterior da outra conversa (dpl_FDH6YQP5GMNFggRNNNMDy8rQXkrK) falhou antes da promoção: o pacote isolado omitiu a referência operacional src/domains/orcamentos/fixtures/foundation-geometry-reference.json. A referência foi reincluída. A publicação final conserva arquivos operacionais de src e exclui testes, scripts/fixtures, protótipos, relatórios e credenciais. Não houve ativação daquela tentativa. A preparação prebuilt local também encontrou incompatibilidade de execução no Windows; o build remoto final usa a origem validada e o buildCommand sem migrações.

O resultado da publicação e a conferência do domínio serão registrados após sua conclusão. Validação automatizada não substitui homologação com operadores ou aparelhos físicos. O piloto humano permanece preparado para aplicação posterior.
