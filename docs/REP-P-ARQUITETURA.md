# REP-P — Arquitetura de referência (Ponto de Obra / ARCD)

Referência técnica oficial do registro de ponto por programa (REP-P,
Portaria MTP nº 671/2021) do ARCD. Vale para o app Android
`apps/ponto-obra`, para o servidor (`server/ponto-eletronico`) e para o banco
(migrations 016 e 017). Escrito na Fase 1 (01/10/2026). Toda fase seguinte
parte daqui.

**INPI: PENDENTE — executar somente após congelamento da versão final.**

> Este documento descreve o que o código faz. Não declara conformidade: o
> programa **não é** um REP-P registrado. Ver "Situação formal" no fim.

## 1. Entidades

| Entidade | O que é | Onde vive |
|---|---|---|
| **Empresa** | Dona dos dados (`company_id`). Hoje uma só (`arcd`). | todas as tabelas `ponto_*` |
| **Estabelecimento** | Unidade fiscal que **conta o NSR**. Identificado por inscrição (CNPJ 14 dígitos ou CPF 11), com CNO/CAEPF opcionais (CEI só para dado histórico), fuso e situação. Campos fiscais podem ficar vazios até alguém cadastrá-los. Nada é inventado. | `ponto_estabelecimentos` · `src/domains/ponto-eletronico/estabelecimento.js` |
| **Obra** | Local de trabalho do cadastro do ARCD (`data.obras`). **Não é estabelecimento.** Uma obra pertence a no máximo um estabelecimento, por vínculo cadastrado no ARCD. | blob do ARCD + `ponto_estabelecimento_obras` |
| **Dispositivo** | Celular da obra (coletor), pareado por código de uso único. Pertence a uma obra; o estabelecimento dele é fixado na primeira vez que é conhecido e **não muda** (trocar = parear de novo). | `ponto_dispositivos` |
| **Trabalhador** | Funcionário da base única do ARCD (`data.employees`), referido por `employeeId` (o "workerId" do REP-P). **É global da empresa:** qualquer funcionário ativo cadastra o rosto e bate ponto em **qualquer** aparelho, de qualquer obra (ver seção 2-A). Terceirizados continuam só como controle de acesso, por obra. | blob do ARCD |
| **Evento local** | O que o aparelho cria no instante da batida, com ou sem internet. Formato 2. | aparelho (SQLCipher) → `ponto_eventos` |
| **Marcação fiscal** | Evento de **ponto** aceito pela ARP, com NSR do estabelecimento e hash fiscal. | `ponto_arp_registros` |

```
Empresa
 └─ Estabelecimento (CNPJ/CPF)  ── uma sequência de NSR
     ├─ Obra A ── Dispositivo A1 (sequência local própria)
     │          └ Dispositivo A2 (sequência local própria)
     └─ Obra B ── Dispositivo B1 (sequência local própria)
```

## 2-A. Funcionário global e as três "obras" (complemento da Fase 1)

Os funcionários trabalham em obras diferentes e mudam de obra no mesmo dia.
Por isso:

- **Funcionário é entidade global da empresa.** Todo aparelho recebe **todos**
  os funcionários ativos (`funcionariosAtivos`), e não só os lotados na obra
  dele. O cadastro facial vale em todos os aparelhos, e mudar a lotação não
  apaga nem invalida a biometria. Desligado ou inativo sai de todos os
  aparelhos na próxima sincronização.
- **O aparelho continua pertencendo a uma obra.** Essa obra diz **onde** a
  batida aconteceu, e não quem pode bater nele. O trabalhador não escolhe obra
  na batida: ela vem do aparelho, o que evita erro e fraude.
- O **cadastro facial** pode ser feito em qualquer aparelho, para qualquer
  funcionário ativo. Quem precisa estar autorizado na obra do aparelho é o
  **responsável** (encarregado ou engenheiro com PIN).

| Conceito | O que é | Onde | Muda? |
|---|---|---|---|
| **Obra de lotação** (administrativa) | Obra atual do funcionário no RH (`employee.obra`, exposta como `lotacaoObraId`) | cadastro do ARCD | Muda no RH. É **só informação**: não decide quem bate em qual aparelho |
| **Obra de captura** | Obra do **aparelho** onde a batida aconteceu (`ponto_eventos.obra_id`, exposta como `obraCapturaId`) | ARP | **Nunca.** Faz parte do registro imutável |
| **Obra apropriada** | Obra que recebe cada **intervalo** de trabalho no tratamento do ponto | `ponto_apropriacoes` (migration 018) | Sim, com motivo e auditoria. **Nunca** altera a ARP |

- O **estabelecimento fiscal** da marcação vem da obra **do aparelho** (via
  vínculo obra → estabelecimento), nunca da lotação do funcionário. Uma pessoa
  que bate em obras de estabelecimentos diferentes no mesmo dia recebe NSR de
  cada estabelecimento, e o tratamento posterior **não** reatribui
  estabelecimento nem NSR.
- **Apropriação** (`ponto_apropriacoes`): intervalos `[início, fim)` por
  funcionário, cada um com sua obra. Pode haver **várias obras no mesmo dia**;
  só não pode haver sobreposição para a mesma pessoa (o banco confere sob
  trava). Toda criação, alteração (com motivo obrigatório) e cancelamento vai
  para `ponto_apropriacoes_auditoria` (antes, depois, responsável, quando e
  motivo), que é imutável. Escrita só pelas funções
  `ponto_apropriacao_salvar`/`ponto_apropriacao_cancelar`.
- **Proposta automática** (`proporApropriacoes`, só sugestão): batida aberta
  seguida de batida na **mesma** obra forma entrada e saída; seguida de batida
  em **outra** obra significa troca de obra sem bater saída, e o intervalo vai
  até a chegada. Batida que sobra no fim do dia vira aviso de "sem saída". Ex.:
  João, lotado na A: 07:00 no Tablet A, 11:30 no Tablet B, 17:00 no Tablet B
  → 07:00–11:30 A e 11:30–17:00 B. Quem trata o ponto confirma
  (`ponto-apropriacao-salvar`).
- **Escala do reconhecimento 1:N** com a base global (benchmark em
  `apps/ponto-obra/src/logica/escala-reconhecimento.test.js`, vetores
  sintéticos):

  | Funcionários | Tempo por identificação (Node) | Base de vetores |
  |---|---|---|
  | 50 | 0,02 ms | ~195 KB |
  | 100 | 0,04 ms | ~390 KB |
  | 250 | 0,09 ms | ~980 KB |
  | 500 | 0,15 ms | ~1,9 MB |

  A comparação é linear e desprezível perto do TFLite (centenas de ms por
  foto), então não há indexação nesta fase. A base de vetores pesa: por isso a
  sincronização manda uma **assinatura** do conjunto (`biometriasAssinatura`),
  e os vetores só descem quando algo mudou. Os limiares não mudaram. Comparar
  com mais pessoas aumenta a chance de rostos parecidos, e isso só se mede em
  campo (`relatorio-calibracao.js`); a regra da margem sobre o 2º candidato
  continua mandando os casos duvidosos ao encarregado.

## 2. Sequência local × NSR fiscal (a regra central)

| | Sequência local | NSR fiscal |
|---|---|---|
| Campo | `localSequence` | `nsr` |
| Escopo | **por dispositivo** | **por estabelecimento** |
| Quem atribui | o aparelho, na batida, offline | **só a ARP**, no banco, quando o evento chega |
| Começa | 1 por dispositivo | 1 por estabelecimento |
| Para quê | ordem, integridade e auditoria do aparelho; operação offline | número oficial do registro (AFD futuro) |
| Muda depois? | nunca (não existe mais "renumerar") | nunca (registro imutável) |

Base normativa do NSR por estabelecimento: FAQ oficial do MTE sobre a
Portaria 671, pergunta 41 — "cada estabelecimento (CNPJ com 14 posições ou
CPF com 11 posições) terá sua própria sequência de NSR … iniciando-se em 1".
(<https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP>)

Regras:
- evento local **não tem NSR** (`nsr` nem existe nele; a validação recusa);
- o aparelho nunca calcula nem simula NSR; o comprovante na tela mostra
  "registro nº N deste aparelho" e avisa que o NSR é atribuído pelo ARCD;
- atribuir o NSR **não altera** nenhum dado material do evento: o aparelho
  guarda NSR e hash fiscal **ao lado** do evento;
- vários aparelhos do mesmo estabelecimento compartilham **uma** sequência
  de NSR; cada um mantém sua sequência local e sua cadeia local.

## 3. Evento local (formato 2)

`src/domains/ponto-eletronico/evento.js`. Campos: `formatVersion` (2),
`eventId` (UUID gerado no aparelho), `deviceId`, `estabelecimentoId` (o que o
aparelho já sabe; pode ir vazio — a ARP resolve), `localSequence`,
`localPreviousHash`, `localHash`, `tipoRegistro` (`ponto` |
`acesso_terceiro`), `employeeId`, `terceiroId`, `cpf`, `marcadoEm`,
`relogioAparelho`, `horaConfiavel`, `relogioAlterado`, `divergenciaMs`,
`fonteHora`, `idadeReferenciaMs`, `metodo` (`facial` | `encarregado`),
`confianca`, `encarregadoId`, `gps`, `fotoSha256`.

**Hash local** = SHA-256 do texto canônico (`canonicalizarEvento`) com todos
os campos materiais e o `localPreviousHash`. Prova que o evento não mudou
desde a batida e que nenhum evento do aparelho sumiu do meio.

## 4. ARP — Armazenamento de Registro de Ponto

Fronteira em `server/ponto-eletronico/arp/arp.js` + função
`ponto_arp_registrar` (migration 017). A ARP **não conhece tela nem app**:
só banco, fonte de hora e regras puras.

```
handler.js (aparelho autenticado pelo token)
   │  { eventos: [...] }
   ▼
ARP ── 1. ingresso: formato 2, aparelho certo, só um aparelho por lote
    ── 2. validação: hash local recalculado de cada evento
    ── 3. ponto_arp_registrar (UMA transação no Postgres):
    │      trava o dispositivo (FOR UPDATE) → resolve o estabelecimento
    │      por evento, em ordem de sequência local:
    │        eventId já gravado com o mesmo hash → devolve o MESMO NSR (idempotência)
    │        confere a cadeia local (sequência +1, hash anterior)
    │        grava em ponto_eventos
    │        se for PONTO: trava o contador do estabelecimento (FOR UPDATE),
    │          NSR = último + 1, hash fiscal, grava em ponto_arp_registros
    │      qualquer exceção desfaz TUDO (contador inclusive) → sem lacuna
    ▼
resposta POR EVENTO: [{ eventId, localSequence, status, nsr, fiscalHash, estabelecimentoId, gravadoEm, motivo }]
```

Também é da ARP: consulta (`consultar`, base da tela do ARCD) e leitura em
ordem de NSR por estabelecimento (`registrosEmOrdemDeNsr`, base do AFD da Fase
2 — o AFD **não** é gerado nesta fase).

Status possíveis: `registrado`, `ja_registrado`, `acesso_registrado`,
`acesso_ja_registrado` (gravados) · `aguardando_estabelecimento`,
`estabelecimento_inativo`, `conflito`, `fora_de_sequencia`,
`cadeia_quebrada`, `invalido`, `nao_processado` (não gravados: o evento fica
pendente no aparelho) · `dispositivo_revogado` (vira HTTP 403).

**Acesso de terceirizado** passa pela ARP (fica em `ponto_eventos`, na cadeia
local), mas **não consome NSR**: não é marcação de ponto de empregado e não
entra no AFD.

## 5. Hash local × hash fiscal

| | Hash local | Hash fiscal |
|---|---|---|
| Quem calcula | aparelho (e a ARP confere) | ARP, no banco, depois de atribuir o NSR |
| Encadeia | eventos do **dispositivo** | registros do **estabelecimento** (NSR n aponta para o n−1) |
| Cobre | todos os campos materiais do evento | NSR, estabelecimento, eventId, CPF, trabalhador, marcação, gravação, dispositivo, sequência local e o **hash local** (que cobre o resto) |
| Prova | o evento não mudou desde a batida | a sequência fiscal não mudou desde a gravação |
| Texto | `canonicalizarEvento` | `canonicalizarRegistroFiscal` (JS) = `ponto_arp_texto_fiscal` (SQL), com teste de igualdade |

O hash fiscal **não é** o hash do AFD: o leiaute do AFD (Fase 2) terá o
cálculo próprio exigido pela norma.

## 6. Banco (migration 017, forward-only e idempotente)

| Objeto | Função |
|---|---|
| `ponto_estabelecimentos` | cadastro fiscal; CHECK de inscrição (CNPJ 14 / CPF 11, ou nenhuma), CNO 12, CAEPF 14, CEI 12 |
| `ponto_estabelecimento_obras` | vínculo obra → estabelecimento (PK por obra = uma obra, um estabelecimento) |
| `ponto_dispositivos` (+colunas) | `estabelecimento_id` (fixo depois de definido), `ultima_sequencia_local`, `ultimo_hash_local` (só a ARP avança; nunca volta) |
| `ponto_eventos` | ingresso imutável: PK `(company_id, event_id)`, UNIQUE `(company_id, dispositivo_id, local_sequence)`, `record_format_version = 2` |
| `ponto_arp_contadores` | último NSR e último hash fiscal por estabelecimento; só +1, só pela ARP, nunca apagado |
| `ponto_arp_registros` | registro fiscal: PK `(company_id, event_id)` (um NSR por evento), UNIQUE `(company_id, estabelecimento_id, nsr)`, FK para o evento e o estabelecimento |
| `ponto_tempo_verificacoes` | medições da hora do servidor contra o NTP.br (só se acrescenta) |
| `ponto_apropriacoes` + `_auditoria` (018) | apropriação da jornada por obra, **fora da ARP**: intervalos sem sobreposição por funcionário, versão, motivo obrigatório na correção, auditoria imutável |
| `ponto_marcacoes` (016) | **legado formato 1**, marcado com `record_format_version = 1` (ver `REP-P-MIGRACAO-NSR.md`) |

Imutabilidade: `UPDATE`, `DELETE` e `TRUNCATE` bloqueados por trigger em
`ponto_eventos`, `ponto_arp_registros` e `ponto_tempo_verificacoes`.
`INSERT` em eventos e registros só com a marca de transação que a função da
ARP liga. A API (`service_role`) tem só `SELECT` nas tabelas fiscais e
`EXECUTE` na função. O navegador (`anon`/`authenticated`) não acessa nada.
Correção futura = registro novo, nunca edição.

## 7. Idempotência

`eventId` é a chave. Reenviar o mesmo evento (timeout, rede caiu, Vercel
caiu, resposta perdida, retry manual, retry simultâneo) devolve o **mesmo**
NSR e o **mesmo** hash fiscal, com status `ja_registrado`. O mesmo `eventId`
com outro conteúdo (hash local diferente) é `conflito` e não grava nada. Isso
vale dentro do banco: dois retries simultâneos do mesmo aparelho esperam um
pelo outro na trava do dispositivo, e o segundo encontra o evento já gravado.

## 8. Concorrência

- Travas sempre na ordem **dispositivo → contador do estabelecimento**. Dois
  aparelhos diferentes do mesmo estabelecimento não disputam a trava do
  dispositivo; eles se enfileiram no contador. Não há impasse.
- O contador é lido com `SELECT ... FOR UPDATE` e atualizado na mesma
  transação, e um trigger exige que ele avance exatamente +1.
- Rollback de qualquer erro desfaz o contador junto: NSR nunca é "queimado".
- Testes: lógica com PGlite (vários aparelhos, ordem de chegada B1, A1, B2,
  A2, retry simultâneo, timeout depois do commit) e **conexões paralelas
  reais** num Postgres de verdade
  (`server/ponto-eletronico/arp/arp-concorrencia.pg.test.js`, job de CI
  `rep-p-arp-postgres`).

## 9. Sincronização e operação offline

```
APARELHO (offline)                       SERVIDOR (ARP)                      APARELHO
batida → eventId (UUID)                  token do aparelho → dispositivo     resultado do SEU eventId:
       → localSequence = último + 1      → estabelecimento                   → guarda nsr + fiscalHash
       → localPreviousHash               → validação + hash local              AO LADO do evento
       → localHash                       → transação: idempotência,          → marca sincronizado
       → SQLCipher (mesma transação        cadeia local, NSR, hash fiscal    → depois envia a foto
         grava o caminho da foto)        → resposta por evento
       → fila (pendente)
```

- A batida **nunca** depende de internet, GPS, câmera, biometria ou hora
  sincronizada: o evento é criado e sinalizado (`horaConfiavel=false`,
  `metodo=encarregado`, sem foto, sem GPS).
- O aparelho só tira o evento da fila quando a resposta cita **aquele
  `eventId`** com status gravado e NSR válido.
- Obra sem estabelecimento: os eventos ficam guardados no aparelho
  (`aguardando_estabelecimento`) e sobem quando o vínculo é feito no ARCD.
- Aparelho revogado: as sincronizações autenticadas param, mas banco, eventos,
  fotos e cadeia local ficam intactos. Ao parear de novo (outro dispositivo),
  o banco antigo é **preservado** com outro nome e um novo começa.
- Banco local ilegível ou perdido: nada é renumerado. O aparelho é pareado de
  novo e vira outro dispositivo, com cadeia própria. Se o banco sumir e a
  sessão continuar, o app só sinaliza a divergência (`cadeiaDivergente`) e os
  eventos novos ficam guardados.

## 10. Relógio confiável

Ver `REP-P-TEMPO-CONFIAVEL.md`. Resumo:
- servidor: **fonte de hora oficial** (`server/ponto-eletronico/tempo/`), com
  hora do host + evidência de medição contra o NTP.br (HLB). Nenhuma regra do
  ponto usa `new Date()` solto;
- aparelho: referência `{servidorMs, monotonicoMs, bootId, fonte, ...}` +
  relógio monotônico (`SystemClock.elapsedRealtime`) e `BOOT_COUNT` (módulo
  Kotlin). Mudar a hora do celular não muda a hora da batida; reboot sem
  sincronizar → `horaConfiavel=false`;
- cada evento leva `fonteHora`, `idadeReferenciaMs`, `divergenciaMs` e
  `relogioAlterado`; o registro fiscal guarda a evidência da hora no momento
  da gravação (`evidencia_hora`).

## 11. Futuro (não implementado nesta fase)

- Tela do ARCD para confirmar e corrigir apropriações (a API e o banco já
  existem: `ponto-apropriacao-propor`, `-salvar`, `-cancelar`,
  `-auditoria`, `ponto-apropriacoes`) e a ligação com a Gestão do ponto e a
  folha.

- **AFD** (Fase 2): leitura em ordem de NSR por estabelecimento
  (`registrosEmOrdemDeNsr`), leiaute oficial, hash do AFD e assinatura
  **CAdES (.p7s)** com certificado ICP-Brasil.
- **Comprovante eletrônico** (Fase 2): comprovante oficial da marcação em PDF
  com assinatura **PAdES**, entregue ao trabalhador.
- **Registro no INPI**: só depois de congelar a versão final. O campo
  `REP_P.inpiRegistrationNumber` (`src/domains/ponto-eletronico/rep-p.js`)
  fica `null` até lá.

## 12. Situação formal

`situacaoRepP()` devolve sempre `conforme: false` nesta fase, com as
pendências (nome oficial, desenvolvedor, INPI, AFD, comprovante assinado,
atestado técnico). Nenhuma tela pode dizer "REP-P conforme"; a aba do ARCD
mostra "Em desenvolvimento - não é REP-P registrado".
