# Playwright

## Problema

Vitest/JSDOM não valida jornadas, foco e visual em navegadores reais.

## Alternativas

Somente testes unitários; insuficiente para login, mobile, portal e anexos.

## Versão analisada, licença e compatibilidade

`@playwright/test` 1.62.0, Apache-2.0, Node >=20. A documentação oficial suporta
Chromium, Firefox e WebKit, screenshots e trace em falhas.

## Bundle e segurança

Dev-only, sem bundle de produção. Browsers aumentam tempo/armazenamento de CI;
testes usarão base isolada e jamais produção.

## Implementação

O Playwright foi mantido como dependência exclusiva de desenvolvimento. A suíte
usa um backend isolado em memória: não acessa nem altera produção. O primeiro
fluxo cobre login inválido e o ciclo crítico de Ponto em viewport mobile:
lançamento, resposta do servidor, recarga, isolamento por obra e finalização.

O ambiente local desta auditoria não permite instalar pacotes do sistema. Para
executar o Chromium, as bibliotecas Debian foram extraídas numa pasta temporária
e fornecidas por `LD_LIBRARY_PATH`. Na CI, a instalação homologada é feita com
`npx playwright install --with-deps chromium`.

## Testes

```bash
npm run test:e2e
```

Falhas preservam screenshot, vídeo e trace. O job `browser-critical-flows` da
CI executa a jornada em Chromium e publica essas evidências quando necessário.

## Riscos, decisão e rollback

**Adotar para fluxos críticos.** O custo permanece fora do bundle de produção.
O rollback remove `@playwright/test`, `playwright.config.js`, `e2e/` e o job
`browser-critical-flows`.
