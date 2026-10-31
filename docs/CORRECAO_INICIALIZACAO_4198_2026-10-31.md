# Inicialização do servidor local 4198 — 31/10/2026

Diagnóstico recebido: `ARCD-1KN9DO7`, `Cannot access 'C' before initialization`.
Endereço informado: `http://127.0.0.1:4198/?_arcd_refresh=1793473036136`.

Esse endereço executa `scripts/rebranding-pilot-preview.mjs`, em modo DEV,
com dados fictícios. Não era o servidor de build usado na varredura anterior.
As consultas iniciais aos logs de produção não explicavam esse erro local.

A dependência síncrona LegacyApp → AditivosContrato → LegacyApp expôs a leitura
antecipada da exportação `C`. A tabela `COR` era construída no escopo do módulo,
antes de LegacyApp inicializar a paleta. Ela agora é construída dentro do
componente, no momento da renderização. O arquivo recebeu essa alteração no
checkout compartilhado durante a investigação; ela foi preservada e validada.

`scripts/verify-development-startup.mjs` reconstitui a declaração antiga apenas
na resposta JavaScript interceptada pelo navegador, sem reverter arquivos.
Esse cenário reproduziu exatamente a mensagem e a referência enviadas.

No endereço real 4198, contextos novos em 1440 e 390 px passaram por login,
abertura da obra e renderização de Mudanças e aditivos, Financeiro, Central do
administrador, Terceirizados e recarga. Nenhum erro de página e nenhuma gravação
de negócio foram registrados. Os dois arquivos de testes de inicialização do
LegacyApp e contratos/aditivos também passaram: sete testes.

Evidências: `artifacts/initialization-debug/verified.json`, `reproduced.png`,
`verified-1440.png`, `verified-390.png`, `regression.log` e `unit.log`.

A aba que já estava no ErrorBoundary precisa ser recarregada: HMR não garante
a limpeza desse estado de erro. Não houve push ou deploy.
