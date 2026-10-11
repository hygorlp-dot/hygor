# Ponto de Obra — backup e recuperação

Data: 11/10/2026. Situação: **ferramentas prontas e ensaiadas só em bancos
descartáveis com dados sintéticos** (PGlite local e Postgres real na CI).
Nenhum dado real foi exportado e nenhuma recuperação de produção foi
demonstrada. Executar as ferramentas sobre produção exige autorização
(seção 10). Este documento não afirma que o backup de produção é
recuperável: afirma o que as ferramentas fazem e o que falta provar.

## 1. O que o backup atual do ARCD realmente cobre

| O quê | Onde vive | Backup atual | Lacuna |
|---|---|---|---|
| `company_app_data` (obras, funcionários, financeiro, configurações) | Supabase (linhas JSON) | **Sim**: cron `backup-create` às 03:00 UTC, OneDrive, AES-256-GCM; `backup-verify` confere o último contra o manifesto (`server/backup.js`) | Exclui `onedrive_auth_v1` (reconectar a Microsoft depois) |
| Tabelas fiscais do ponto: `ponto_eventos`, `ponto_arp_registros`, `ponto_arp_contadores`, `ponto_tempo_verificacoes` | Supabase (tabelas) | **Não** (a função de backup lê só `company_app_data`) | Só o backup da plataforma Supabase, **não verificado** |
| Tabelas administrativas do ponto (estabelecimentos, vínculos, aparelhos, pareamentos, responsáveis, biometrias, marcações legadas, apropriações, auditorias) | Supabase (tabelas) | **Não** | Idem |
| Fotos (batida e cadastro facial) | Supabase Storage, bucket privado `ponto-obra` | **Não** | Pela documentação do Supabase, o backup do banco não inclui objetos do Storage. **Confirmar com o suporte ou o painel** |
| Vínculos entre os dois mundos | `ponto_*.employee_id`/`obra_id` → `company_app_data` | Parcial | Os dois backups precisam ser do **mesmo momento** para os vínculos baterem |
| Chaves e configuração | Vercel (variáveis) e aparelhos | — | Ver seção 9 |

A existência de uma opção de backup no painel do Supabase **não prova**
recuperação: é preciso restaurar e conferir (seção 8).

## 2. Requisitos de um backup restaurável do ponto

Um backup só conta para o gate de produção se **todos** valerem:

1. **Banco:** as 14 tabelas do ponto num retrato único e consistente
   (`REPEATABLE READ, READ ONLY`, em UTC), guardadas como o texto exato do
   `to_jsonb` (`numeric` e `bigint` sem perda), com contagem e SHA-256
   por tabela no manifesto.
2. **Cadeia fiscal:** por estabelecimento, último NSR, SHA-256 da sequência de
   hashes (sem o hash cru), cadeia recalculada íntegra e contador igual ao
   último registro (`contadorConfere`).
3. **Fotos:** tiradas do bucket (`--com-fotos`) e com qualidade
   `consistente` (seção 3). Um pacote `sem_fotos` serve só para recuperar o
   banco.
4. **Esquema:** versão registrada (livro de migrations, ou a validação de
   objetos se o livro ainda não existir), para recriar o mesmo esquema.
5. **Cifragem e guarda:** AES-256-GCM com `PONTO_BACKUP_KEY` (cofre, 2
   guardiões), pacote e manifesto fora do Supabase e fora do repositório.
6. **Prova:** restaurado num banco descartável com estado `completa`
   (seção 5), com o log guardado.

## 3. Consistência banco × Storage

Não há transação entre o Postgres e o Storage. O backup
(`scripts/backup-ponto/pacote.mjs`, `exportar`) faz:

1. lista o bucket;
2. tira o retrato do banco (`REPEATABLE READ, READ ONLY`);
3. baixa cada foto listada e calcula o SHA-256;
4. lista o bucket de novo.

Se uma foto **já listada** mudou (tamanho ou versão) ou sumiu entre listar e
baixar, **repete** tudo, até 3 tentativas. Foto **nova** no bucket não conta
como mudança: é de uma batida posterior ao retrato do banco e fica para o
próximo backup. Depois cruza as
referências do banco com os arquivos. A origem dos caminhos é única:
`server/ponto-eletronico/fotos-caminho.js`, a mesma que o servidor usa para
gravar.

- Batida (formato 2 e legado): `marcacoes/<obra>/<data UTC>/<id>.jpg`, com o
  `foto_sha256` gravado na batida.
- Cadastro facial: o caminho e o SHA-256 que estão em `ponto_biometrias.fotos`.

| Qualidade (manifesto) | Quando | Serve para o gate? |
|---|---|---|
| `consistente` | toda referência tem arquivo com o SHA-256 registrado; nenhum órfão; o bucket não mudou | **Sim** |
| `consistente_com_pendencias` | batida sem arquivo (o aparelho envia a foto **depois** da ARP: pode estar a caminho) ou arquivo órfão (foto de batida posterior ao retrato) | Não: refazer o backup mais tarde; se a pendência persistir, investigar |
| `inconsistente` | SHA-256 divergente (prova trocada ou adulterada), cadastro facial sem foto, ou o bucket mudou nas 3 tentativas | **Não**: investigar antes de qualquer janela |
| `sem_fotos` | backup sem `--com-fotos` | Não: só o banco |

O manifesto (texto claro) traz só as **contagens** de cada pendência, o
número de tentativas e se o bucket mudou. A lista de caminhos (que contém IDs
internos de obra, funcionário e evento) fica **dentro** do pacote cifrado. A CLI sai com
código 0 (`consistente`), 2 (pendências ou sem fotos), 3 (`inconsistente`) ou
1 (falha). **Nenhuma qualidade é afirmada sem ter sido verificada.**

## 4. Ferramentas

- `scripts/backup-ponto.mjs`, **somente leitura**:
  - exporta as 14 tabelas e, com `--com-fotos`, o bucket `ponto-obra`
    (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). `--fotos-de-pasta <pasta>`
    lê de uma pasta local e serve só para ensaio;
  - gera `<nome>.arcdponto` (formato `arcd-ponto-backup-v3`) e
    `<nome>.arcdponto.manifest.json` **sem dado pessoal**: contagens,
    SHA-256 por tabela e do conjunto de fotos, consistência (contagens),
    resumo fiscal, esquema, origem (`usuário@host:porta/banco`, sem senha) e
    quem autorizou;
  - o pacote é uma sequência de **registros cifrados independentes**
    (AES-256-GCM, IV e tag próprios). Cada foto é um registro autenticado com a
    sua posição, caminho e SHA-256; cada tabela é um registro; o índice final é
    autenticado com o SHA-256 do **manifesto** (manifesto editado = pacote não
    abre). As fotos vão para o disco uma a uma: o tamanho do bucket não fica na
    memória (o formato v2 falhava por volta de 400 MB);
  - grava em `<nome>.arcdponto.parcial` e só renomeia se tudo terminar: uma
    cópia interrompida nunca fica com o nome final;
  - recusa gravar dentro do repositório (comparação pelo caminho real, sem
    distinguir maiúsculas no Windows) e exige `--autorizado-por`.
- `scripts/restaurar-backup-ponto.mjs`, só em banco **descartável e vazio**:
  - identifica o destino como `usuário@host:porta/banco` (no pooler do
    Supabase o host é compartilhado entre projetos; o projeto vem no usuário);
  - recusa se o destino for a origem do pacote ou o `POSTGRES_URL_NON_POOLING`,
    ou estiver no mesmo servidor ou projeto deles (exceto local);
  - exige o **marcador de descartável**, posto pelo operador no banco novo e
    nunca em produção: `comment on database <banco> is 'arcd-ponto-descartavel';`;
  - exige `--confirmo-descartavel=<usuário@host:porta/banco>`; o valor
    esperado **não** é impresso;
  - recusa se o destino **já tiver o esquema do ponto**, mesmo com tabelas
    vazias (por exemplo, produção antes do go-live). Exceção: o esquema que
    uma tentativa anterior desta ferramenta criou (livro só com origem
    `restauracao`), ainda vazio;
  - recusa `--fotos-em` dentro do repositório ou em pasta sincronizada com o
    OneDrive: as fotos saem **em claro**;
  - abre o pacote e confere tabelas, conjunto de fotos e cada foto (tamanho e
    SHA-256) contra o manifesto. Chave errada, pacote adulterado ou manifesto
    trocado: **não abre**;
  - recria o esquema pelo **livro de migrations** e insere as linhas (em lotes)
    com `session_replication_role = replica` **só na transação de carga**
    (como o `pg_restore --disable-triggers`), ajustando as sequências na
    **mesma** transação: uma queda no meio desfaz tudo;
  - confere, num retrato em UTC, o SHA-256 de cada tabela, a cadeia fiscal, os
    contadores e se cada sequência está **à frente** dos dados; depois grava
    cada foto e a **relê do destino** para conferir tamanho e SHA-256. Nunca
    sobrescreve uma foto diferente já existente;
  - `--somente-fotos`: nova tentativa só das fotos sobre um banco **já
    restaurado e conferido** (idempotente: fotos já iguais contam como
    restauradas).

## 5. Estados da restauração

| Estado | Condição | Saída | Mensagem | Satisfaz o gate? |
|---|---|---|---|---|
| `completa` | banco conferido **e** todas as fotos do pacote gravadas e relidas **e** toda foto que o banco referencia está no destino com o SHA-256 registrado no banco | 0 | `RECUPERAÇÃO COMPLETA` | **Sim** |
| `apenas_banco` | banco conferido; pacote sem fotos ou sem destino de fotos | 2 | `RECUPERAÇÃO APENAS DO BANCO (não satisfaz o gate)` | Não |
| `parcial` | banco conferido; alguma foto ausente, truncada, corrompida, substituída ou não gravada, **ou** registro do banco cuja foto já faltava ou estava trocada na origem | 3 | `RECUPERAÇÃO PARCIAL (não satisfaz o gate)` | Não |
| `falha` | o banco não foi restaurado ou não confere; nada é afirmado | 1 | `FALHA NA RECUPERAÇÃO` | Não |

A conferência pelas referências do banco existe porque conferir só o pacote
não basta: se a prova de uma batida já faltava ou estava adulterada na
origem, o pacote sai sem ela, e "todas as fotos do pacote conferidas" seria
um falso conforto. Arquivos órfãos não rebaixam o estado: não são prova de
nenhum registro.

## 6. Verificações de integridade na restauração

- SHA-256 e contagem de cada tabela iguais ao manifesto.
- Cadeia fiscal recalculada (`verificarCadeiaFiscal`, a mesma canonicalização
  do servidor) íntegra por estabelecimento; último NSR e SHA-256 da cadeia
  iguais ao manifesto; contador = último registro.
- Fotos: tamanho e SHA-256 relidos do destino; cada referência do banco
  coberta.
- Esquema: o gate (`node scripts/aplicar-migracoes-ponto.mjs --verificar`)
  dá **GO** no banco restaurado, com versão fiscal igual à da origem.
- A ARP continua: a próxima batida no banco restaurado recebe o NSR seguinte
  e a sequência local seguinte, com a cadeia íntegra (ensaio integrado,
  passos 17 e 18).

## 7. Limitações conhecidas

1. **Sem retrato distribuído.** Banco e bucket não são copiados atomicamente.
   A dupla listagem detecta mudança no bucket, mas uma foto **substituída no
   mesmo caminho, com o mesmo tamanho e sem mudar a versão** entre o
   download e a segunda lista só é pega pelo cruzamento de SHA-256 com o
   banco (vira `inconsistente`), não pela listagem. O app nunca sobrescreve
   foto (`upsert: false`).
2. **Foto pendente × órfã.** O aparelho envia a foto depois da ARP; uma batida
   recente sem arquivo pode ser só atraso. A ferramenta classifica, não
   decide: refazer o backup mais tarde.
3. **`session_replication_role` e `comment on database` no Supabase.**
   Exigem privilégio de superusuário ou de dono. Funcionam no Postgres local e
   na CI; num projeto Supabase temporário ainda **não foram verificados**.
4. **Aparelhos.** Batidas ainda não sincronizadas ficam no SQLCipher de cada
   aparelho e não entram no backup do servidor.
5. **RPO/RTO não medidos** com dado real.
6. **Mesmo momento que `company_app_data`.** Os dois backups são
   independentes; o horário de cada um vai no manifesto e no log.
7. **Chaves estrangeiras** não são revalidadas depois da carga em modo
   `replica`; a integridade vem da conferência por SHA-256 contra o retrato
   da origem.
8. **Volume.** As fotos não ficam na memória, mas cada tabela ainda é um
   registro só (uma tabela de centenas de MB exigiria dividir o registro). O
   volume real do bucket e das tabelas ainda **não foi medido**.
9. **Fotos restauradas só para pasta local.** Não há caminho de volta para um
   bucket novo nem roteiro para promover o banco restaurado a produção: isso
   define o RTO real e precisa de decisão.

## 8. Evidência de recuperação efetiva (o que conta)

| Evidência | Como | Estado |
|---|---|---|
| Restauração confere banco, cadeia e fotos; estados `completa`/`apenas_banco`/`parcial`/`falha` | `scripts/backup-ponto/pacote.test.js` (PGlite, 23 testes): íntegra, sem destino, foto ausente, corrompida, truncada, SHA divergente, falha de escrita, interrompida, nova tentativa, prova faltando ou trocada na origem, pacote adulterado (registro, foto, manifesto, corte), chave errada, destino com esquema, backup anterior ao livro, cadeia quebrada e contador divergente (falha), queda no ajuste das sequências, sequência atrasada, fuso diferente e `numeric` com escala, consistência banco × Storage, `storageSupabase` com bucket falso (paginação, pastas, 404) | **Feito** (sintético) |
| Fluxo do gate de ponta a ponta (18 passos) | `scripts/gate-integrado.test.js` (PGlite) e `scripts/gate-integrado.pg.test.js` (Postgres real, com as CLIs) | **Feito** (sintético; o Postgres real roda na CI) |
| Linhas de comando em Postgres real | `scripts/backup-ponto/backup.pg.test.js` (job `rep-p-arp-postgres`) | **Feito na CI** (sintético) |
| Pacote **real** de produção restaurado num banco descartável com estado `completa` | backup autorizado + restauração em Postgres temporário; guardar log e manifestos | **Pendente: autorização** |
| Backup da plataforma Supabase restaurável | restaurar num projeto ou branch novo (PITR ou diário) e rodar as consultas da seção 8 de `docs/PONTO-OBRA-MIGRATION-019.md` | **Pendente: acesso ao painel** |
| RPO/RTO medidos | horário do backup × horário da restauração conferida | Pendente |

## 9. Chaves e configuração necessárias para recuperar

| Item | Para quê | Onde guardar |
|---|---|---|
| `PONTO_BACKUP_KEY` (nova) | abrir o pacote do ponto | cofre fora da Vercel e do Supabase, com 2 guardiões. Sem a chave, o pacote é inútil. Nunca é impressa pelas ferramentas |
| `BACKUP_ENCRYPTION_KEY` | abrir o backup do OneDrive | idem (já existe na Vercel) |
| `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | acesso ao projeto | Vercel; rotacionar depois de qualquer recuperação |
| Conexão Microsoft (`onedrive_auth_v1`) | backup do OneDrive | refazer o login de administrador depois da restauração |
| Aparelhos | batidas não sincronizadas | no SQLCipher de cada aparelho (chave no SecureStore, **não recuperável fora dele**). O token só existe como hash no servidor: restaurar `ponto_dispositivos` mantém os aparelhos pareados |

## 10. Procedimento (com autorização) e contingência

1. Gerar `PONTO_BACKUP_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
   e guardá-la no cofre antes do primeiro uso.
2. Backup: `node scripts/backup-ponto.mjs --saida <pasta fora do repo> --autorizado-por "<nome>" --com-fotos`
   (variáveis `PONTO_BACKUP_KEY` e `POSTGRES_URL_NON_POOLING` no ambiente,
   nunca na linha de comando). Exigir saída **0** (`consistente`). Com 2,
   esperar e repetir; com 3, parar e investigar.
3. Copiar pacote e manifesto para fora do Supabase (por exemplo, a pasta de
   backups do OneDrive corporativo).
4. Ensaio: criar um Postgres **novo** e descartável, marcá-lo
   (`comment on database <banco> is 'arcd-ponto-descartavel';`) e rodar
   `node scripts/restaurar-backup-ponto.mjs --pacote <arquivo> --confirmo-descartavel=<usuário@host:porta/banco> --fotos-em <pasta fora do repo e do OneDrive>`
   (`PONTO_RESTAURAR_URL` no ambiente). Exigir `RECUPERAÇÃO COMPLETA` (saída 0).
5. Se sair `parcial` por escrita de foto: repetir só as fotos com
   `--somente-fotos` (o banco já conferido não é tocado). Se sair `parcial`
   por prova faltando ou trocada na origem: **não é problema da restauração**;
   investigar a origem.
6. **Destruir** no mesmo dia o banco descartável (tem CPF e vetor facial em
   claro) e a pasta de fotos extraídas; guardar só o log e os manifestos e
   registrar a destruição.

**Nunca:** restaurar por cima de produção; apagar, renumerar ou editar
registro fiscal; desligar trigger em produção.

**Frequência proposta:** antes de cada janela (livro, 019) e depois
semanalmente até existir automação. Automatizar é decisão da direção.

## 11. Decisões que exigem autorização da direção

1. Exportar dados reais do ponto, com CPF, vetor facial e fotos (cifrados):
   quem autoriza, onde fica e por quanto tempo.
2. Criação e guarda da `PONTO_BACKUP_KEY` (guardiões).
3. Ensaio com pacote real num ambiente descartável: qual ambiente.
4. Verificação do backup da plataforma Supabase (plano, PITR, retenção) e
   ensaio de restauração dela.
5. Automação periódica do backup do ponto e metas de RPO/RTO.
6. Tratamento das limitações da seção 7. Elas ficam **registradas, não
   aceitas**: só a direção pode aceitá-las.
