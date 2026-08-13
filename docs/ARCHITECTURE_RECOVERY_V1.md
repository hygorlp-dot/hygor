# Architecture Recovery V1

Status: IN PROGRESS

Baseline: `ef5ad21681e76049e8f302eb3ed4fe18da86b705`

## Objetivo

Transformar o ArcD em um monólito modular com fronteiras mecanicamente verificáveis, eliminando progressivamente o papel de `src/LegacyApp.jsx` e `api/data.js` como pontos de concentração de responsabilidades, sem reescrita big-bang e sem interromper o produto.

## Método de execução autônoma

Esta trilha usa quatro princípios operacionais adaptados de práticas de engenharia encontradas em `obra/superpowers` e `github/awesome-copilot`:

1. causa raiz antes de correção;
2. teste de caracterização/regressão antes de alteração comportamental;
3. mudança mínima e reversível por etapa;
4. nenhuma alegação de conclusão sem evidência fresca de CI no SHA exato.

Nenhuma etapa exige aprovação humana, mas nenhuma etapa pode contornar gates técnicos.

## Invariantes

- `NO_DIRECT_MAIN_WRITE`
- `NO_RED_MERGE`
- `NO_BIG_BANG_REWRITE`
- `NO_NEW_LEGACYAPP_RESPONSIBILITY`
- `NO_NEW_API_DATA_RESPONSIBILITY`
- `DOMAIN_RULES_NOT_IN_UI`
- `SERVER_AUTHORIZES_WRITES`
- `THIN_API_HANDLERS`
- `BEHAVIOR_PRESERVING_EXTRACTION`
- `EXACT_HEAD_CI_REQUIRED`
- `POST_MERGE_MAIN_GREEN_REQUIRED`
- `BUNDLE_BUDGETS_MUST_NOT_BE_RAISED_TO_HIDE_REGRESSION`

## Baseline observado

- `src/App.jsx` já separa o portal do cliente do aplicativo operacional.
- `src/routes/OperationalApp.jsx` ainda delega integralmente o aplicativo operacional a `LegacyApp`.
- `src/LegacyApp.jsx` possui aproximadamente 2,98 MB de fonte e continua sendo o principal gargalo estrutural do frontend.
- `api/data.js` possui aproximadamente 123 kB e ainda concentra múltiplos contratos de leitura/escrita.
- já existem diversos bounded contexts em `src/domains/`, testes de domínio, design system, mobile shell, portal do cliente, migrations e políticas server-side.
- o `dependency-cruiser` atual protege poucas fronteiras e ainda não codifica uma direção completa de dependências.
- o workflow de qualidade atual contém lint de fronteira financeira, architecture check, typecheck, testes, coverage, build, Storybook, budget, audit, contratos de migration e Playwright.

## Baseline de qualidade a recuperar

No SHA inicial, os testes unitários/integração, arquitetura, typecheck e build passam; o workflow permanece vermelho por dois bloqueios imediatos:

1. smoke Playwright de Compras preso ao rótulo legado `CRIAR ITEM PRÓPRIO`, enquanto a UI atual apresenta `Adicionar somente a esta solicitação` e `Cadastrar no catálogo e adicionar`;
2. budget de bundle excedido, com o chunk `LegacyApp` acima de 600 kB gzip e o total de JS/CSS ligeiramente acima de 1.200 kB gzip.

O `npm ci` também informa vulnerabilidades high que precisam ser auditadas e removidas antes da estabilização.

## Sequência executável

### Fase 0 — recuperar o verde

- atualizar o smoke para o contrato visual atual sem reduzir cobertura funcional;
- diagnosticar e reduzir o `LegacyApp` abaixo do limite existente, sem aumentar o budget;
- reduzir o total de JS/CSS abaixo do limite existente, sem aumentar o budget;
- executar `npm audit --audit-level=high` e remover vulnerabilidades high;
- exigir Playwright integralmente verde;
- merge somente com CI verde no HEAD exato;
- conferir CI pós-merge de `main`.

### Fase 1 — impedir nova dívida

Adicionar guardas mecânicas:

- nenhum novo import de infraestrutura a partir de domínio;
- nenhum domínio depende de React, Vite, Supabase, Dexie, Postgres ou APIs de navegador;
- `api/` não depende de UI;
- `design-system/` não depende de domínio;
- novos fluxos operacionais não podem ser implementados diretamente em `LegacyApp.jsx`;
- novos contratos não podem ser adicionados diretamente ao catch-all `api/data.js` sem adapter explícito;
- non-regression de tamanho para `LegacyApp.jsx`, `api/data.js` e CSS global.

### Fase 2 — novo shell operacional

Criar `src/app/` como composição de UI e roteamento:

```text
src/app/
  AppShell.jsx
  OperationalRouter.jsx
  routes/
  providers/
```

O roteador novo deve suportar coexistência:

```text
rota migrada -> feature module
rota não migrada -> legacy adapter
```

O fallback legado só pode diminuir.

### Fase 3 — extrair frontend por fatias

Ordem inicial, escolhida por risco e capacidade de caracterização:

1. Compras / Suprimentos;
2. Orçamentos / SINAPI-ORSE;
3. Conciliação;
4. Terceirizados;
5. Planejamento;
6. Financeiro / DRE;
7. RH / ponto;
8. Comercial;
9. Administração / configurações.

Para cada fatia:

```text
characterization test
-> extrair selectors/calculations/commands
-> extrair page/container
-> mover acesso a dados para adapter explícito
-> executar unit + integration + e2e
-> remover bloco equivalente do legado
-> medir tamanho e dependências
```

### Fase 4 — decompor backend

Destino:

```text
api/                     # handlers finos
server/application/      # commands, queries, DTOs, use cases
server/domain/           # regras puras
server/infrastructure/   # postgres, storage, Microsoft, external services
server/policies/         # autorização, idempotência, auditoria
```

`api/data.js` será estrangulado por endpoints/use-cases específicos. Não haverá migração big-bang.

### Fase 5 — convergência estrutural

- unificar `planejamento` e `planning` em um único bounded context;
- consolidar primitives duplicados (`components/ui` vs `design-system`);
- reduzir `src/index.css` e mover estilos para escopo de feature/design system;
- remover dependências mortas via Knip;
- TypeScript progressivo nas fronteiras de API, commands, repositories e DTOs;
- separar cálculos puros de mutações e side effects.

## Gates por PR

Todo PR desta trilha deve comprovar:

- base SHA e head SHA explícitos;
- diff limitado ao objetivo da fase;
- `npm run lint` PASS;
- `npm run architecture:check` PASS;
- `npm run typecheck` PASS;
- `npm run test:coverage` PASS;
- `npm run build` PASS;
- `npm run quality:bundle` PASS;
- `npm audit --audit-level=high` PASS;
- `npm run test:e2e` PASS quando houver impacto de UI/fluxo;
- ausência de aumento não justificado em LegacyApp/API global;
- pós-merge `main` verde.

## Critério de saída V1

A recuperação V1 termina quando:

- `main` estiver verde;
- zero vulnerabilidade high;
- budgets atuais passarem sem elevação de teto;
- guardas de arquitetura impedirem nova concentração de responsabilidade;
- existir shell operacional modular com fallback legado explícito;
- ao menos uma fatia operacional tiver sido removida de `LegacyApp` sem regressão;
- `LegacyApp` e `api/data.js` estiverem em trajetória monotônica de redução.
