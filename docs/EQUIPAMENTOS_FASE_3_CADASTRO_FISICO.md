# Equipamentos — Fase 3: cadastro físico

Data de início: 4 de agosto de 2026.

## Objetivo

Separar o cadastro legado, que representa ao mesmo tempo produto e quantidade,
nos conceitos `equipmentModels`, `equipmentLots` e `equipmentUnits`, preservando
integralmente `equipamentos` e todos os vínculos históricos existentes.

## Primeiro incremento implementado

- projeção determinística do legado, sem gravação automática ao abrir a tela;
- modelo para cada origem legada;
- unidade física para registro unitário com patrimônio;
- lote para itens controlados por quantidade;
- marcação de ambiguidades para registro unitário sem patrimônio ou registro
  com quantidade múltipla e um único patrimônio;
- relatório com unidades, lotes e itens que exigem revisão manual;
- localização derivada das alocações do calendário único, sem depender de
  `obraAtualId`;
- fracionamento da localização de um lote entre várias obras e depósito;
- comando corporativo, idempotente, versionado, auditável e exclusivo do
  administrador para materializar a projeção no snapshot;
- leitura compatível das três coleções novas na normalização do cliente.

## Compatibilidade

Os identificadores derivados usam o formato `legacy-model:<id>`,
`legacy-lot:<id>` e `legacy-unit:<id>`. A origem permanece em
`legacySourceId`. Coleções já materializadas têm precedência sobre a projeção,
impedindo duplicidade em execuções repetidas.

A coleção `equipamentos` não é removida nem modificada pela migração. Locações,
manutenções, transferências, indisponibilidades, tarifas e relatórios continuam
lendo os identificadores legados durante a transição.

## Próximos incrementos da fase

1. formulários próprios para modelo, lote e unidade;
2. seleção de lote ou unidades físicas em locação, manutenção e transferência;
3. mapa operacional consumindo exclusivamente a localização derivada;
4. adaptação gradual dos relatórios e exportações;
5. relatório administrativo para resolver os itens ambíguos;
6. gates completos de cobertura, build e E2E antes de encerrar a fase.

Este documento registra o início da fase. Os critérios de conclusão do roteiro
ainda não estão declarados como atendidos.

## Segundo incremento

Implementado na sequência:

- aba **Cadastro físico** com totais de modelos, lotes, unidades e pendências;
- mapa atual por modelo, exibindo quantidades em cada obra, manutenção,
  bloqueio, transporte e depósito;
- prévia segura antes da materialização e ação administrativa explícita para
  executar o comando de migração;
- relatório visível dos registros ambíguos e do motivo da revisão;
- seleção de lote ou patrimônio no formulário de locação;
- quantidade sincronizada com as unidades físicas selecionadas;
- validação de domínio que impede unidade de outro modelo, quantidade
  divergente e dupla locação da mesma identidade no mesmo período;
- manutenção de `equipamentoId` em toda locação nova para compatibilidade dos
  cálculos e relatórios existentes.

O teste E2E da aba foi adicionado. Sua execução local ficou impedida pela
ausência da biblioteca nativa `libnspr4.so` no Chromium do ambiente; testes
unitários, typecheck e build não dependem dessa biblioteca.

## Terceiro incremento

- manutenção agora seleciona lote ou patrimônios e materializa o mesmo vínculo
  na indisponibilidade do calendário;
- uma unidade já locada, reservada ou indisponível não pode ser enviada para
  manutenção no período conflitante;
- transferência registra lote, unidades, quantidade, origem e destino;
- movimentos físicos permanecem na projeção de localização após a data do
  transporte, inclusive com saldo fracionado de lote entre depósito e obra;
- unidades transferidas juntas precisam estar na mesma origem;
- registros ambíguos podem ser revisados pelo administrador como lote ou como
  unidades individualizadas;
- a revisão exige a quantidade exata de patrimônios únicos, é versionada,
  idempotente e auditada;
- classificações anteriores são preservadas como `superseded`, sem exclusão
  física, e o equipamento legado permanece intacto.

## Quarto incremento

- a matriz de cobrança preserva `equipmentLotId`, `equipmentUnitId` e
  `equipmentUnitIds` de cada locação, além da obra do fato;
- a memória por obra e o mapa exibem o lote ou os patrimônios efetivamente
  selecionados na locação;
- unidades e lotes diferentes do mesmo modelo não são mais agrupados numa
  única linha de localização;
- relatórios gerenciais, CSV e impressão/PDF usam a identidade física, com a
  obra explicitada nas exportações detalhadas;
- registros antigos continuam legíveis por meio de rótulo de patrimônio ou
  lote legado;
- identidades substituídas continuam resolvidas em relatórios históricos,
  evitando que uma revisão cadastral altere a memória de uma competência.

## Gate de encerramento

Auditoria executada em 4 de agosto de 2026:

- testes unitários: **190 arquivos e 868 testes aprovados**;
- cobertura global: **90,61% de linhas**;
- cobertura do domínio de equipamentos: **95,35% de linhas**;
- typecheck, lint e build de produção: aprovados no quarto incremento;
- E2E de cadastro físico: cenário localizado em
  `e2e/modules-smoke.spec.js`, porém a execução não iniciou o navegador porque
  o ambiente não possui a biblioteca nativa `libnspr4.so`.

Os critérios funcionais da Fase 3 estão implementados. A fase permanece sem a
declaração formal de encerramento até que o mesmo E2E seja executado em um
ambiente com as dependências nativas do Chromium.
