# Conciliação automática

A tela separa **Identificados** (destinos inequívocos e baixas automáticas já realizadas) de **Não identificados / revisar**. A identificação cruza funcionários, fornecedores, clientes comerciais e suas obrigações por relações explícitas do ERP. Reconhecer a pessoa sem encontrar uma obrigação permanece como pendência, com o motivo visível.

Enquanto a tela estiver aberta para Financeiro ou Administrador, a fila é processada sequencialmente. Pode ser pausada; falhas aparecem para revisão com opção de nova tentativa. Não há tarefa em segundo plano quando a tela está fechada. O perfil RH preserva seu fluxo de confirmação existente.

O servidor recebe `AUTO_MATCH` com o ID da transação e recalcula a decisão sobre seu estado atual, dentro da mesma infraestrutura de concorrência e idempotência dos demais comandos. O navegador não escolhe o destino final nem o valor da baixa.

Para executar automaticamente, exige valor integral exato, uma referência bancária compartilhada ou identidade forte (Pix/CPF/CNPJ completo) com data até dois dias da previsão, identificador bancário para verificar duplicidades, destino único, ausência de alertas e bloqueios. Nome ou valor isolado não autoriza baixa. Rejeições anteriores, movimentos desfeitos/reabertos, extratos arquivados e disputas pelo mesmo lançamento não são automatizados. A política vigente de fechamento continua aplicada pelo servidor.

Funcionários exigem título de folha existente; clientes são cruzados com parcelas, medições e entradas de contrato; pagamentos já registrados são apenas vinculados. A regra e as evidências ficam na transação e na observação auditável. Desfazer uma conciliação remove seu marcador automático e exige nova revisão humana.

Referência pesquisada: [bank-reconciliation e regras de matching](https://github.com/Receiptor-AI/bookkeeping-skills/tree/main/skills/bank-reconciliation). A implementação usa critérios mais restritos que valor/data isolados. A skill foi consultada como referência, sem adicionar dependência de serviço externo ou enviar dados financeiros.

## Verificação local

```sh
npx vitest run src/domains/conciliacao server/reconciliation-command.test.js server/reconciliation-policy.test.js server/reconciliation-response.test.js server/reconciliation-execution.test.js
npm run lint
npm run typecheck
npx vite build --outDir build/conciliacao-check
npx playwright test --config playwright.conciliacao.config.js
```

O teste de navegador usa dados sintéticos e executa o comando real de domínio em uma rota interceptada. Não acessa o banco de produção. Confere baixa, exceção, nova tentativa, ausência de duplicação e apresentação em desktop/mobile.
