# Registro de implementação e portões de teste

## Etapa 0 — Inventário, linha de base e reprodução

**Status:** APROVADA

- Aplicação: React 18 com Vite 8; testes em Vitest; persistência via `api/data.js` e Supabase (`company_app_data`); normalização em `src/LegacyApp.jsx::normalizeData`.
- Arquivo principal: `src/LegacyApp.jsx` — SHA-256 inicial desta etapa: `d2893a51bd1c964c17ea9d594d801109eea09ad27413e6ae91b1e1ef1bc2194e`.
- Estado do motor financeiro: modo sombra; `FINANCIAL_ENGINE_ENFORCE` permanece desativado.
- Risco legado registrado: chamada a `setFirstSetup(true)` sem estado declarado no carregamento de perfis.
- Backup recuperável: histórico Git do commit anterior à etapa; nenhum dado de produção foi modificado nesta etapa.

### Próxima etapa

Etapa 1 — correção de erro direto do primeiro acesso.

## Etapa 1 — Primeiro acesso e referências de execução

**Status:** APROVADA

- Comportamento anterior: ao servidor responder `precisaSetup=true`, a aplicação lançava `ReferenceError` por `setFirstSetup` não declarado.
- Resultado esperado: a tela cria o administrador inicial, preserva os dados já existentes no servidor e autentica o novo usuário pelo PIN.

### Arquivos alterados

- `src/LegacyApp.jsx`
- `src/LegacyApp.setup.test.js`

### Testes criados ou alterados

- `src/LegacyApp.setup.test.js`: contrato do estado de primeiro acesso, tela de cadastro, criação e autenticação do administrador.

### Execução e resultados

- `npm test -- --run src/LegacyApp.setup.test.js src/LegacyApp.dre-wiring.test.js src/domains/financeiro/ledger.test.js` — 3 arquivos, 12 testes aprovados, 0 reprovados.
- `npm run lint` — aprovado: fronteira financeira canônica válida.
- `npm run build` — aprovado: Vite concluiu a compilação de produção.
- `npm test` — 29 arquivos, 174 testes aprovados, 0 reprovados.
- `git diff --check` — aprovado, sem erro de espaços.

### Evidência funcional

Quando `profiles` retorna `precisaSetup=true`, `App` agora ativa `firstSetup`; `LoginScreen` exibe o formulário do administrador, chama `criarPrimeiroAdmin`, autentica o usuário recém-criado com `entrarComPin` e entra no aplicativo. A rota de setup do servidor preserva o dataset existente antes de adicionar o usuário.

### Regressões executadas

Contrato de autoria do DRE e razão financeiro canônico incluídos na execução específica; suíte completa verde.

### Riscos remanescentes

- A cobertura desta etapa é de contrato de integração do código; um teste E2E real de navegador ainda será incluído na etapa de E2E prevista.
- O warning de módulo do Node em `server/data-codec.js` não falha build, mas deve ser tratado em etapa de infraestrutura.

### Próxima etapa

**LIBERADA:** Etapa 2 — concorrência, comandos e fila de salvamento.

## Etapa 2 — Concorrência, comandos e fila de salvamento

**Status:** APROVADA

### Subportão 2A — Fila serial, retry e conexão interrompida

- `src/domains/sync/save-queue.js` centraliza estados explícitos: `idle`,
  `saving`, `retry_scheduled`, `offline`, `conflict` e `failed`.
- Uma alteração nova substitui apenas o próximo snapshot pendente; nunca a
  gravação em voo. Assim, o último estado acumulado é preservado sem vários
  `save` concorrentes.
- Falhas temporárias usam backoff limitado. Depois do limite, não há loop
  silencioso: a fila permanece em `failed` até ação explícita do operador.
- Sem conexão, o snapshot fica pendente em `offline` e é retomado no evento
  `online` do navegador. O dashboard mostra o estado real de sincronização.
- Conflitos continuam exigindo resolução explícita; não há last-write-wins.

### Arquivos alterados

- `src/LegacyApp.jsx`
- `src/domains/sync/save-queue.js`
- `src/domains/sync/save-queue.test.js`

### Testes criados ou alterados

- `src/domains/sync/save-queue.test.js`: preservação durante gravação em voo,
  backoff, parada em falha, conflito explícito, reconexão e 100 alterações
  rápidas acumuladas.

### Execução e resultados

- `npm test -- --run src/domains/sync/save-queue.test.js src/LegacyApp.setup.test.js` — 2 arquivos, 7 testes aprovados, 0 reprovados.
- `npm run lint` — aprovado: fronteira financeira canônica válida.
- `npm run build` — aprovado: Vite concluiu a compilação de produção.
- `git diff --check` — aprovado, sem erro de espaços.

### Fechamento do gate — comandos por agregado no servidor

- `src/domains/sync/operational-commands.js` introduz comandos puros,
  idempotência persistida no dataset e `expectedVersion` por entidade para
  medição técnica, RDO e recebimento de pedido.
- RDO, criação/cancelamento de medição técnica e recebimento físico de pedido
  usam `operational-command` no servidor. O navegador não confirma o fato
  antes da resposta autoritativa e adota a projeção devolvida pelo servidor.
- `api/data.js` expõe `operational-command`: autentica o papel, exige chave
  idempotente, revalida `expectedVersion` no snapshot autoritativo e somente
  repete contra leitura recente quando o mesmo comando ainda é compatível.
- O recebimento de pedido é recalculado no servidor a partir do saldo atual:
  excedente, item inválido e divergência entre estoque e pedido são recusados;
  repetição da chave não duplica a entrada física.
- A fila de snapshots permanece apenas como ponte para coleções legadas não
  críticas; não faz last-write-wins e bloqueia um comando se houver edição
  local ainda não sincronizada.

### Execução e resultados do gate final

- `npm test -- --run src/domains/sync/operational-commands.test.js src/domains/sync/save-queue.test.js` — 2 arquivos, 12 testes aprovados.
- `node --check api/data.js` — aprovado.
- `npm run lint` — aprovado.
- `npm run build` — aprovado.
- `npm test` — 32 arquivos, 188 testes aprovados, 0 reprovados.
- `git diff --check` — aprovado.

### Próxima etapa

**LIBERADA:** FIN-002 — carga idempotente e homologação em sombra do motor financeiro.

## FIN-002 / DRE-001 — Homologação em sombra e leitura canônica

**Status:** APROVADA para leitura canônica; **FIN-003 permanece desativado**.

- A carga de produção executada no deploy confirmou `197` fatos legados,
  `153` liquidações e `480` projeções de DRE, com `0` divergências financeiras
  e `0` divergências de projeção.
- As gravações que tocam seções financeiras passam por
  `financial_save_with_sync` mesmo em modo sombra. O blob legado e a projeção
  canônica são atualizados na mesma transação; não existe janela de DRE
  canônico defasado após uma nova operação.
- DRE de obra e DRE da empresa consomem os eventos canônicos quando o relatório
  os disponibiliza. O cálculo legado permanece apenas para detalhes ainda não
  presentes na projeção, sem substituir os indicadores canônicos.
- `FINANCIAL_ENGINE_ENFORCE` não foi alterado. A ativação continua bloqueada
  até a conclusão da baixa/conciliação transacional (REC-001) e do gate final.

### Evidência de produção

- Deploy `pontos-b16xggn3v-hygor-s-projects1.vercel.app`: log do prebuild
  registrou `FIN-002: migration e carga concluídas; 197 fatos, 153
  liquidações, 480 projeções DRE, 0 divergências.`
- `npm test` — 32 arquivos, 189 testes aprovados, 0 reprovados.
- `npm run lint`, `npm run build`, `node --check api/data.js` e
  `git diff --check` — aprovados.

### Próxima etapa

**LIBERADA:** REC-001 — baixa e conciliação bancária pelo comando transacional
do servidor, incluindo baixa parcial e estorno.

### Subportão 2B — Comandos operacionais locais

**Status:** APROVADO

- `src/domains/sync/operational-commands.test.js` cobre preservação de
  coleções distintas, ordem e conflito na mesma entidade, idempotência de
  medição e não duplicidade de estoque em recebimento.
- Execução direcionada após a integração: 3 arquivos, 11 testes aprovados,
  0 reprovados; suíte completa: 31 arquivos, 184 testes aprovados, 0
  reprovados; lint, build, `node --check api/data.js` e `git diff --check`
  aprovados.
