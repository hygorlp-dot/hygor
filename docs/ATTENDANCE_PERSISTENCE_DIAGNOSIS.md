# Diagnóstico do fluxo de persistência do ponto

Data da inspeção: 2026-07-28

## Fluxo mapeado

1. `Ponto` e `PontoGeral`, em `src/LegacyApp.jsx`, constroem uma cópia do
   dataset projetado e chamam o `update` global.
2. `update` reconcilia a cópia com o espelho local, atualiza a interface
   imediatamente e enfileira um snapshot em `createSaveQueue`.
3. A fila chama `saveDataDetailed`, em `src/api.js`, que calcula as seções
   alteradas e envia `save-sections` ou, sem uma base, `save`.
4. `api/data.js` autentica, autoriza as seções, tenta uma mesclagem de três
   vias e persiste o blob por `company_save_with_audit`.
5. `server/section-authorizations.js` autoriza a escrita e
   `server/data-projection.js` recorta a leitura por papel/obra.
6. Bloqueio, desbloqueio, finalização e arquivamento ainda combinam comandos
   server-side com mutações legadas do blob.

## Problemas confirmados

- `Ponto` e `PontoGeral` ainda substituem a seção `attendance` completa
  recebida pelo navegador. Isso é incorreto para projeções parciais e faz o
  payload crescer com todo o histórico.
- A interface confirma observação, hora extra, jornada, lote e finalização
  antes do ACK do servidor.
- A concorrência de vários operadores sobre o único blob pode esgotar a única
  retentativa CAS do `save-sections`, gerando o conflito exibido ao operador.
- A reaplicação do conflito usa `saveData` sem uma base de três vias, perde o
  motivo real do erro e pode entrar novamente em conflito imediatamente.
- `engenheiro_auditor` recebe `attendance`, `attendanceLocks` e
  `unlockRequests`, possui a aba `ponto` por padrão e pode receber a aba por
  `accessTabs`, embora não tenha autorização de escrita.
- `dailyCheckDate` já está autorizado para `admin`, `rh` e `engenheiro`, mas a
  confirmação continua otimista e é enviada junto de outras seções.
- A finalização altera `attendanceLocks` como seção completa e confirma antes
  do servidor.
- Solicitação, aprovação, recusa e aprovação por link de desbloqueio ainda
  alteram `unlockRequests` no frontend; inclusive o solicitante pode aprovar
  a própria solicitação.
- `update` ainda gera e aceita `changeLog` no cliente. A prova append-only
  existe no servidor, mas o histórico legado continua substituível.
- O resolvedor de obra prioriza o registro existente antes da obra
  explicitamente selecionada e não possui uma fonte histórica centralizada.
- A projeção usa `record.obraId` nos registros novos, mas registros legados
  sem obra ainda dependem da lotação atual do funcionário.
- Arquivamento e restauração fazem operações separadas sobre o arquivo e o
  blob principal; uma falha entre elas pode deixar estado parcial.
- Respostas concorrentes de `save-sections`/`save` podem devolver `valor`
  autoritativo sem passar por `projectDataForUser`.
- A migration `migrations/20260725_append_only_audit.sql` existe e cria a RPC
  `company_save_with_audit`, mas falta health check de assinatura/configuração
  com erro operacional específico.
- A fila já serializa saves e aplica backoff, porém não conserva o identificador
  do timer para cancelá-lo no descarte/unmount.

## Arquivos previstos no escopo

- `src/LegacyApp.jsx`
- `src/api.js`
- `src/domains/ponto/attendance-mutations.js`
- `src/domains/ponto/permissions.js`
- `src/domains/ponto/records.js`
- `src/domains/sync/save-queue.js`
- `api/data.js`
- `server/data-projection.js`
- `server/section-authorizations.js`
- novos módulos server-side do domínio de ponto
- migrations versionadas de comandos/auditoria/arquivamento de ponto
- testes unitários, de integração e E2E relacionados ao ponto

Arquivos financeiros, comerciais e de compras não serão refatorados por esta
correção, salvo a remoção estritamente necessária de um caminho genérico que
permita substituir `attendance` ou `changeLog`.
