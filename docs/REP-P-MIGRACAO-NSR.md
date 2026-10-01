# REP-P — Migração do "NSR por aparelho" para o NSR por estabelecimento

Plano e execução da mudança de modelo da Fase 1 (migration 017, app formato
2). Princípio: **nada do que já existe é reescrito em silêncio.**

## Regras em uma página

- Registros formato 1 **não são renumerados**, alterados nem apagados: o
  histórico legado é preservado no servidor e no aparelho.
- O formato 1 continua identificável: `record_format_version = 1` no
  servidor, `formato = 1` no aparelho. O campo `nsr` desses registros é a
  sequência **do aparelho** (`legacyDeviceSequence`, lido por
  `sequenciaLegadaDoAparelho`), **não** o NSR fiscal.
- O formato 2 é o modelo novo: evento local com `localSequence` + cadeia
  local + NSR fiscal atribuído pela ARP.
- Num aparelho que já tem histórico, a nova `localSequence` **continua do
  topo existente** (ex.: legado 1, 2 → novos 3, 4). Eventos formato 2 **não
  reiniciam em 1** quando existe cadeia legada.
- `localSequence` **não é** NSR fiscal. O NSR fiscal só existe depois que a
  ARP aceita o evento, e é por estabelecimento.

## Antes (formato 1)

- O aparelho numerava as batidas 1, 2, 3... e chamava isso de **NSR**.
- O servidor (`ponto_registrar_marcacoes`, migration 016) gravava em
  `ponto_marcacoes` exigindo a sequência e o hash encadeado **por aparelho**.
- Se o aparelho perdesse o banco, havia um "realinhamento" que **renumerava**
  as batidas pendentes depois do último número do servidor.
- Problema: o NSR oficial é **por estabelecimento** (FAQ do MTE, pergunta 41),
  não por aparelho. Com dois aparelhos haveria dois "NSR 1".

## Depois (formato 2)

- O aparelho cria **eventos** com `localSequence` (por aparelho) e cadeia
  local. Não há NSR no evento.
- A ARP atribui o **NSR fiscal por estabelecimento** numa transação do banco.
- Nada é renumerado. O realinhamento foi removido.

## Como cada dado existente é tratado

| Onde | O que existe | Tratamento |
|---|---|---|
| Servidor, `ponto_marcacoes` | marcações formato 1 com `nsr` por aparelho | **Ficam como estão.** Ganham a coluna `record_format_version = 1` (DEFAULT, sem reescrever linha; CHECK garante que só existe formato 1 ali). Na API saem com `nsr: null`, `localSequence` = o antigo "nsr" e `situacaoFiscal: "legado_sem_nsr"`. **Não recebem NSR fiscal automaticamente.** |
| Servidor, `ponto_dispositivos` | `ultimo_nsr`/`ultimo_hash` da cadeia formato 1 | Ficam (usados pelo caminho legado). As colunas novas `ultima_sequencia_local`/`ultimo_hash_local` começam em 0 / hash inicial. Enquanto o dispositivo não tiver nenhum evento formato 2, a ARP parte do **topo legado** dele (`ultimo_nsr`/`ultimo_hash`): a cadeia local do aparelho continua **única** entre os dois formatos. Aparelho novo tem topo legado 0 / hash inicial, então começa em 1. |
| Aparelho, tabela `marcacoes` (SQLite cifrado) | batidas formato 1 (`nsr`, `hash`, `hash_anterior`) | Migração local idempotente em `prepararBanco`: **só renomeia colunas** (`nsr → sequencia_local`, `hash → hash_local`, `hash_anterior → hash_local_anterior`) e acrescenta `formato` (DEFAULT 1 para as linhas que já existiam), `nsr_fiscal`, `hash_fiscal`, `estabelecimento_fiscal`, `gravado_em`. O conteúdo (`dados`) e os hashes não mudam. |
| Aparelho, batidas formato 1 ainda não enviadas | | Enviadas **como estão** pelo caminho legado (`apps/ponto-obra/src/logica/legado-v1.js` → `ponto-enviar-marcacoes` com `{ marcacoes }`). Se o servidor tiver outra cadeia, **não renumera**: ficam guardadas, pendentes, e o diagnóstico mostra o problema. |
| Aparelho, eventos novos | | Formato 2. A sequência local **continua** a numeração do aparelho e o primeiro evento novo aponta para o hash da última batida antiga. A ARP aceita essa continuação (ver linha de `ponto_dispositivos`), então a cadeia local do aparelho segue única e **nada é renumerado**. |

Como a continuação funciona: num aparelho atualizado com batidas formato 1, o
primeiro evento formato 2 tem `localSequence` = última antiga + 1 e
`localPreviousHash` = hash da última antiga. O aparelho envia primeiro as
batidas antigas, pelo caminho legado, e depois os eventos novos, pela ARP. A
ARP confere o evento novo contra o topo legado do dispositivo e grava. O NSR
fiscal do estabelecimento começa em 1 nos eventos formato 2, e as batidas
antigas continuam sem NSR fiscal. Coberto por teste no banco
(`server/ponto-eletronico/arp/arp-migration.pglite.test.js`) e ponta a ponta
(`apps/ponto-obra/src/logica/rep-p-ponta-a-ponta.test.js`).

Se as batidas antigas não subirem (o servidor tem outra cadeia legada para
esse aparelho), os eventos novos também esperam: ficam guardados, nada se
perde e o diagnóstico mostra o problema. A solução operacional é **parear de
novo** (novo dispositivo, cadeia nova), e o banco antigo é preservado com
outro nome.

Hoje isso é teórico: as versões anteriores do app nunca chegaram a gravar
batida em produção. O APK piloto travava antes, no carregamento dos modelos,
e o defeito do SQLCipher impediria a gravação.

## Distinção entre legado e modelo novo

- Servidor: `ponto_marcacoes.record_format_version = 1` × `ponto_eventos.record_format_version = 2`.
- API (`ponto-marcacoes`): campo `formato` (1 ou 2), `nsr` só no formato 2
  gravado, `situacaoFiscal` (`registrado`, `sem_nsr`, `acesso_sem_nsr`,
  `legado_sem_nsr`).
- Aparelho: coluna `formato` e `formatVersion` no objeto.
- Envio: `{ eventos: [...] }` = formato 2 (ARP); `{ marcacoes: [...] }` = legado.

## O que **não** foi feito (de propósito)

- Não se atribuiu NSR fiscal às marcações legadas. Se for necessário (ex.:
  para constarem de um AFD), isso deve ser uma **função de backfill própria,
  auditada e explícita**, por estabelecimento, em ordem de `marcado_em`, que
  crie registros novos em `ponto_arp_registros` sem tocar em `ponto_marcacoes`.
  **REQUER DECISÃO DO RESPONSÁVEL** (e jurídica, se as marcações legadas forem
  tratadas como registro oficial).
- O caminho legado continua aceitando envios de apps antigos para não perder
  batida. Desligá-lo depois que todos os aparelhos estiverem no formato 2 é
  uma decisão operacional futura.

## Reversão

`017_ponto_arp_estabelecimento_nsr.down.sql` só roda com a ARP **vazia**; com
qualquer evento gravado, recusa (registro de ponto não se apaga). Não toca nos
dados da 016.
