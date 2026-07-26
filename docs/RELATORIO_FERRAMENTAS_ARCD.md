# Relatório de ferramentas — ARCD

## Estado desta rodada

Foi concluída a linha de base e a pesquisa oficial inicial. A iniciativa segue
progressiva: nenhuma regra de negócio, persistência financeira, autenticação ou
contrato de API foi alterado. A POC de campo adicionou uma única dependência de
runtime, isolada e ainda não conectada à UI.

| Ferramenta | Versão | Decisão | Bundle | Risco | Status |
| --- | --- | --- | ---: | --- | --- |
| dependency-cruiser | 18.1.0 | Adotar em piloto | dev | regras excessivas | Gate aprovado |
| Playwright | 1.62.0 | Adiar | dev | bibliotecas do host | POC revertida |
| axe-core Playwright | 4.12.1 | Adiar | dev | dependente do browser | POC revertida |
| Knip | 6.29.0 | Adotar em piloto | dev | falso positivo controlado | Gate aprovado, relatório reproduzível |
| size-limit | 13.0.1 | Solução interna | dev | duplicação | Gate aprovado |
| Storybook React Vite | 10.5.4 | Adotar em piloto | dev isolado | manutenção de histórias | Gate aprovado |
| TypeScript | 5.9.3 | Adotar em piloto estrito | dev | migração ampla | Typecheck isolado aprovado |
| TanStack Table | 8.21.3 | Solução interna | runtime evitado | duplicação | Avaliação concluída |
| React Hook Form | 7.83.0 | Solução interna | runtime evitado | segundo estado de formulário | Avaliação concluída |
| Zod | 4.4.3 | Adiar | runtime evitado | coerção / contrato ausente | Avaliação concluída |
| Dexie | 4.4.4 | Adotar em piloto | sob demanda | conflito/sincronização | Store de campo isolada aprovada |
| Workbox Build | 7.4.1 | POC de build | dev; não registrado | cache sensível | Worker de shell restrito aprovado |
| Lighthouse CI | 0.15.1 | Reprovado nesta versão | não instalado | cadeia `tmp` vulnerável | Instalação revertida |
| Uppy React/Tus | 5.2.0 | Solução interna | runtime evitado | requer backend resumível | Retry de evidência aprovado |
| Sentry React | 10.68.0 | Adiar integração externa | runtime evitado | LGPD/PII | Diagnóstico local redigido aprovado |
| Editor e regressão visual | Registradas | Adiar | runtime evitado | varia por POC | Documentado |

## Evidências da linha de base

- 99 arquivos de teste / 439 testes aprovados;
- cobertura: 79,03% statements, 60,89% branches, 79,11% functions e 87,69%
  lines;
- lint, build, métrica de bundle, sintaxe da API e `git diff --check` aprovados;
- bundle JS/CSS: 1.111,77 kB gzip; LegacyApp: 597,25 kB gzip;
- `npm audit --omit=dev`: nenhuma vulnerabilidade;
- working tree preexistente (471 entradas) preservado, sem commit/push/merge/PR.

## Próximo gate

Preparar um ambiente CI com imagem oficial do Playwright para retomar E2E/axe.
Em paralelo, revisar os 30 arquivos e 62 exports apontados pelo Knip, sempre um
por vez, sem remoção automática. A telemetria externa permanece bloqueada até
que DPA, região, retenção e responsável sejam aprovados.

## Arquivos e dependências desta rodada

- adicionados: `.dependency-cruiser.cjs`,
  `src/tooling-architecture.test.js`, `docs/AVALIACAO_FERRAMENTAS_ARCD.md` e
  os dossiês em `docs/tools/`;
- alterados: `package.json`, `package-lock.json` e
  `.github/workflows/quality.yml`;
- dependências mantidas: `dependency-cruiser@18.1.0` (MIT), `knip@6.29.0`
  (ISC), `storybook@10.5.4`, `@storybook/react-vite@10.5.4` (MIT) e
  `typescript@5.9.3` (Apache-2.0), todas somente de desenvolvimento e sem código
  distribuído ao operador; TypeScript também valida um módulo novo isolado;
  `dexie@4.4.4` (Apache-2.0) foi adicionado em runtime
  para a POC isolada de campo e `fake-indexeddb@6.2.5` (Apache-2.0) somente para
  seus testes; `workbox-build@7.4.1` (MIT) foi adicionado somente para gerar a
  POC não registrada de cache do shell;
- dependências descartadas após POC: `@playwright/test` e
  `@axe-core/playwright`; nenhuma dependência de produção foi adicionada ou
  removida.

## Verificação final da rodada

| Gate | Resultado |
| --- | --- |
| Testes | 99 arquivos / 439 testes aprovados |
| Cobertura | 79,03% statements; 60,89% branches; 79,11% functions; 87,69% lines |
| Lint financeiro | Aprovado |
| Fronteiras arquiteturais | Aprovado: 428 módulos / 839 dependências |
| Build | Aprovado; rotina financeira ignorada em ambiente não produtivo |
| Bundle | 1.111,77 kB gzip; LegacyApp 597,25 kB gzip, warning ainda aberto |
| Catálogo Storybook | Build aprovado; 320,55 kB gzip no iframe de desenvolvimento, fora de produção |
| Segurança | `npm audit`: 0 vulnerabilidades |
| Integridade de diff | `git diff --check` aprovado |
| Diagnóstico de erro | Local, redigido e sem telemetria externa |

Não houve commit, push, merge, PR, migration ou deploy. A POC Playwright foi
revertida por falta de bibliotecas do host, não por uma falha funcional do ARCD.

## Referências oficiais

[Storybook](https://storybook.js.org/docs/),
[Playwright](https://playwright.dev/docs/intro),
[TanStack Table](https://tanstack.com/table/latest/docs/overview),
[Workbox](https://developer.chrome.com/docs/workbox/),
[Uppy](https://uppy.io/docs/react/),
[TypeScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html).
