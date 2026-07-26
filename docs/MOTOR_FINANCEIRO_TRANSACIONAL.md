# Motor financeiro transacional

## Arquitetura

O contexto `Financial Ledger` é separado de Compras, Fiscal, Folha e
Conciliação. A interface envia comandos autenticados para
`/api/data` com a ação `financial-command`; a função `financial_execute_command` executa a
operação, o evento, a auditoria, a outbox e a idempotência em uma única
transação PostgreSQL. A interface não é fonte de saldo ou de pontuação.

## Instalação e migração

1. Faça backup da linha `company_app_data` e exporte um hash por coleção.
2. Execute [20260725_financial_engine.sql](../migrations/20260725_financial_engine.sql) no SQL Editor do Supabase.
3. Execute [20260725_financial_engine_verify.sql](../migrations/20260725_financial_engine_verify.sql). Todos os itens precisam retornar `OK`.
4. Migre dados para tabelas canônicas e grave cada origem em
   `legacy_record_links` com hash.
5. Rode em sombra: compare totais, saldos, órfãos e duplicidades por período.
6. Corrija cada diferença em `data_quality_cases`; não descarte diferenças.
7. Só então habilite `FINANCIAL_ENGINE_ENFORCE=true` na Vercel e faça um teste de criação, liquidação, reversão e fechamento em homologação.

### Critério objetivo para ativar a trava

Mantenha `FINANCIAL_ENGINE_ENFORCE` ausente ou `false` enquanto houver um dos
seguintes: uma linha diferente de `OK` na verificação, `data_quality_cases`
abertos sem responsável, divergência entre saldo/título/recebimento do legado
e canônico, ou ausência de vínculo em `legacy_record_links`. A ativação torna
as coleções financeiras legadas somente leitura; por isso ela não é um passo
de deploy automático.

## Comandos iniciais

- `CREATE_FINANCIAL_TITLE`
- `REGISTER_SETTLEMENT`
- `REVERSE_SETTLEMENT`
- `CLOSE_ACCOUNTING_PERIOD`

Todos exigem `idempotencyKey`. `REGISTER_SETTLEMENT` bloqueia título e
transação bancária, recalcula saldo no banco e não gera despesa nova.

## Rollback

Desative `FINANCIAL_ENGINE_ENFORCE`, preserve as tabelas canônicas para
auditoria e reverta somente comandos por `REVERSE_SETTLEMENT`. Não apague
liquidações, eventos, extratos ou vínculos processados.
