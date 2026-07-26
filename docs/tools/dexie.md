# Dexie

## Problema

Persistir fila de campo após fechar o navegador.

## Alternativas

Fila offline atual e armazenamento temporário existente.

## Versão analisada, licença e compatibilidade

`dexie` 4.4.4, Apache-2.0. A documentação oficial oferece versionamento e
transações sobre IndexedDB. `dexie-react-hooks` não foi instalado: ainda não há
uma tela que precise de consulta reativa.

## Bundle e segurança

Runtime adicional. IndexedDB não é criptografia e pode falhar em modo privado.

## POC e testes

Foi criada a POC `createOfflineOperationStore` para RDO, progresso, inspeção,
pendência, DDS e APR. Ela persiste somente operações permitidas em
`arcd-field-operations-v1`, deduplica por `idempotencyKey` e conserva o conflito
de sincronização. `fake-indexeddb` 6.2.5 (Apache-2.0, desenvolvimento) prova a
reabertura da base e o bloqueio de comando financeiro sem depender do navegador.

Ainda não há integração com UI, sincronização de rede ou cache de dados do
servidor. Isso preserva o piloto isolado do domínio financeiro.

## Riscos, decisão e rollback

**Adotar em piloto.** Não cachear DRE, conciliação, folha, PIX, documentos ou
qualquer dado sensível. Rollback chama `destroy()` e limpa somente a base local
versionada; não altera o servidor nem registros financeiros.
