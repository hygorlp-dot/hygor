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
