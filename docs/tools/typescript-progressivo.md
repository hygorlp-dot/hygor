# TypeScript progressivo

## Problema

Explicitar contratos em módulos novos sem reescrever o monólito.

## Alternativas

JavaScript com JSDoc e testes, mantendo Vite atual.

## Versão analisada, licença e compatibilidade

TypeScript estável, Apache-2.0. A documentação oficial permite migração com
`allowJs`, `checkJs` e ativação gradual de `strict`.

## Bundle e segurança

Sem runtime direto; risco é deslocar esforço para conversão ampla e criar falsos
contratos em domínio financeiro.

## POC e testes

Foi migrado somente `src/domains/documentos/upload-retry.ts`, adaptador novo e
não financeiro de evidências móveis. `tsconfig.quality.json` é estrito, não emite
arquivos e inclui exclusivamente esse módulo; `npm run typecheck` entrou no CI.
O teste protege esse escopo para impedir que o legado passe a ser verificado por
acidente. `LegacyApp.jsx` não foi convertido.

## Riscos, decisão e rollback

**Adotar em piloto estrito.** TypeScript 5.9.3 continua sem runtime e somente
tipa uma fronteira nova. A próxima conversão precisa ser um módulo novo, isolado
e não financeiro, com typecheck verde antes de ampliar o `include`. Rollback
renomeia apenas o adaptador para JavaScript e remove sua entrada do `tsconfig`,
sem tocar no legado ou no domínio financeiro.
