# Histórico de conferência das duplicidades

Implementação local de 31/10/2026, sem publicação ou deploy.

## Como usar

Em **Financeiro → Custos por etapa**, abra a conferência da previsão. Para cada aditivo, escolha a decisão e preencha **Justificativa da conferência do aditivo**. A justificativa é opcional: sua ausência gera aviso e permite confirmar.

O **Histórico de conferência das duplicidades** fica visível junto de **Mudanças e aditivos**, tanto na visão geral da obra quanto em Custos por etapa. Mostra:

- responsável e data da gravação, com fuso do dispositivo;
- decisão: Já está no restante, Custo separado do restante ou Ainda não conferido;
- justificativa individual, aditivo, etapa e revisão;
- impacto e restante conferidos na época.

Use **Aditivo do histórico** para filtrar. A lista mostra dez registros por página, do mais recente para o mais antigo. Consultar, filtrar e paginar não gravam dados nem alteram a previsão.

A decisão registrada é sobre a composição do custo restante. Não é a aprovação comercial do cliente. Registrar que um custo já está no restante também não muda automaticamente a opção de impacto no acompanhamento do aditivo.

## Gravação e preservação

Cada confirmação da previsão registra as decisões informadas, com autor e data do comando. Corrigir uma justificativa ou decisão exige confirmar outra revisão; a anterior permanece disponível. Rascunhos não aparecem como conferências salvas.

As novas conferências preservam um retrato do nome do aditivo, etapa, valores, decisão e justificativa, além de autor e data. Renomeações posteriores não reescrevem os novos registros históricos. A conferência de uma base anterior fica identificada para não ser confundida com uma validação dos valores daquela revisão.

O histórico detalhado é mantido separadamente da janela de cem revisões resumidas da previsão. Na primeira nova confirmação, preserva também os registros antigos ainda disponíveis na base. Não recupera revisões que já tenham sido descartadas antes desta alteração.

Registros antigos mostram apenas as informações disponíveis: responsável ou data ausentes são apresentados como não registrados. Premissas da previsão aparecem separadamente quando não há justificativa individual; elas não são transformadas retroativamente em uma justificativa individual. Os registros antigos são identificados na tela.

## Avisos e limites

Justificativa ausente e possível duplicidade geram avisos, sem impedir confirmar a previsão ou acompanhar o aditivo. O histórico é de consulta e não altera contrato, custo incorrido, pagamentos ou impactos. Permissões, integridade dos valores, identidade da obra/etapa e conflitos de versão permanecem verificados.

Repetir a mesma requisição idempotente não cria outra revisão nem duplica a conferência.

## Validação local

```powershell
npx vitest run src/LegacyApp src/features/financeiro src/domains/financeiro src/domains/obras src/domains/sync src/domains/dre src/features/help server/operational-command-policy.test.js
npm run lint
npm run typecheck
npm run architecture:check
npx vite build --outDir artifacts/ajuda/review-history-build
npx playwright test --config playwright.forecast-review-history.config.mjs
```

O build direto evita o `prebuild` com migrações remotas. A validação no navegador usa dados fictícios e executa comandos reais em memória. A ajuda e o manual continuam gerados de `src/features/help/help-content.js`.

Evidências: `artifacts/ajuda/review-history-*`.

Resultado local: **577 testes em 98 arquivos e 9 cenários de navegador aprovados**. Lint, tipos, arquitetura, manual e build passaram. O detector das interfaces alteradas não encontrou problemas. O build mantém o aviso existente de chunks maiores que 650 kB.
