# Análise: levar o release consolidado de 02/11 para a `main`

03/11/2026. Análise feita só com leitura e merges simulados num worktree descartável. Nada foi enviado, mergeado ou gravado no banco.

## Situação

- O release consolidado (`682bd466`) foi publicado pela CLI da Vercel em 02/11 às 20:34, sem push nem PR.
- Às 23:12, o merge do #231 publicou a `main` por cima dele. Desde então ele está **fora do ar e fora da `main`**.
- Com ele saíram: o tema "MARCELL Preciso" como padrão, as barras de comando unificadas de Compras e Financeiro, a alocação de adiantamentos da P5, a gestão de membros, o relatório financeiro por obra, os indicadores contábeis, as Previsões e a linha de base com SPI.
- O Ponto, apagado da mesma forma às 10:20 de 03/11, já voltou pela `main` (#233).

## O tamanho real

O commit aparece com 993 arquivos porque é um *squash* feito sobre a `main` de 30/10. Quase tudo nesse intervalo já entrou na `main` por outros PRs. O que falta de fato são duas partes:

| Parte | O que é | Tamanho | Conflito com a `main` atual |
|---|---|---|---|
| **A** | Branch `codex/marcell-precise-local-20261101` (`8bfa833d`): 22 commits **com histórico**, sobre `e1b56855` | 195 arquivos, +5,0 mil / −2,8 mil | 4 arquivos, 7 blocos |
| **B** | O que o consolidado tem além de `8bfa833d` (nunca commitado em separado) | 106 arquivos, +3,6 mil / −0,3 mil | 6 arquivos em comum com a `main`; não simulado em separado |

### Conflitos da parte A (todos mecânicos)

- `src/LegacyApp.jsx`: a branch **não tem** a religação do Ponto (`dispatchAttendanceCommand` e `onTab`). Na resolução, manter as props da `main` e o `LoadingState` da branch. O teste `legacy-wiring.test.js` (#233) falha se isso se perder.
- `src/domains/compras/components/PurchaseWorkspace.jsx` (2 blocos) e `src/features/financeiro/FinanceToday.jsx` (3 blocos): usar a versão nova da branch (barra de comandos, `RecordPanel`, fila) e reaplicar o `contar()` da Etapa 0 no lugar dos "(s)".
- `src/features/help/help-content.js`: juntar os dois textos dos guias (Ponto e Equipes).

## Riscos e regras do CLAUDE.md

| Ponto | Parte | Situação | O que exige |
|---|---|---|---|
| Razão financeiro (`ledger.js`): pagamento de pedido alocado a notas | A | Alimenta `financial-shadow`, `financial-dre-integration` e `dre/calculations` | `dre-integration-guardian`; decidir se `DRE_PROJECTION_VERSION` sobe. Hoje nenhum dado tem `pedidoPagamentoId`, então os valores atuais não mudam. |
| `labor-cost-engine.js`: detalhamento do custo por função (`includeRoles`) | B | Os totais não mudam; é uma opção nova e a chave do cache foi ajustada | Regra 2: o mesmo cenário testado na folha, no motor e na DRE do servidor; guardian |
| Novas regras de acesso no servidor: base contábil (até para admin), linha de base, RDO resumido para o financeiro | B | `data-projection.js`, `operational-command-policy.js`, `section-authorizations.js`, `api/data.js` | Regra 3: **não há teste de 403** para essas regras na parte B; precisam ser escritos |
| Tema padrão | A | A `main` usa "MARCELL Claro" (`saas`); a parte A volta o padrão para `marcell`, rotulado "MARCELL Preciso" | É a decisão do "tema único" da Etapa 0. Quem não salvou preferência muda de tema. |
| Catraca da Etapa 0 (`design:check`) | A e B | A branch é anterior à catraca | Rodar `npm run design:check` depois do merge; se algum número subir, corrigir em vez de subir a baseline |
| Migrations | A e B | Nenhum `.sql` novo | Nada |
| Dados gravados enquanto o consolidado estava no ar | A e B | A linha principal `arced_ponto_v1` foi gravada pela última vez em 02/11 às 19:36, antes do deploy (20:34). As linhas `__ponto` e `__equipamentos` só foram gravadas hoje, pela `main`. | Nada a migrar. As linhas são gzip, então o conteúdo em si não foi lido por SQL. |

## Proposta: três PRs, nesta ordem

1. **PR A: merge da branch `8bfa833d` na `main`** (merge de verdade, preservando os 22 commits).
   - Resolver os 4 conflitos como descrito acima.
   - Rodar o `dre-integration-guardian` por causa do `ledger.js`.
   - Barra completa, o e2e de Ponto e duplicidade e a revisão de layout.
   - Este PR traz de volta o tema Preciso como padrão, as barras de comando e a P5.
2. **PR B1: relatório financeiro por obra e detalhamento por função.**
   - Testes da regra 2 (folha, motor e DRE do servidor, mesmo cenário) e o guardian.
3. **PR B2: base contábil, Previsões, linha de base e SPI, membros.**
   - Testes de 403 para cada regra nova do servidor, antes de abrir o PR.

Cada PR só entra com o CI verde. **Nada pode ser publicado pela CLI** até a `main` ter tudo: cada publicação fora da `main` é apagada no merge seguinte.

## Decisões que são suas

1. Tema padrão: aceitar a volta do "MARCELL Preciso" com o PR A (recomendo, porque era o que estava em produção antes das 23:12) ou manter o "Claro".
2. Se a parte B entra em dois PRs (recomendo) ou num só.
