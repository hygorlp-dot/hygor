# Ponto de Obra — backup e recuperação

Data: 11/10/2026. Situação: **ferramentas prontas e ensaiadas só em bancos
descartáveis com dados sintéticos.** Nenhum dado real foi exportado.
Executá-las sobre produção exige autorização (seção 5).

## 1. O que o backup atual do ARCD realmente cobre

| O quê | Onde vive | Backup atual | Lacuna |
|---|---|---|---|
| `company_app_data` (obras, funcionários, financeiro, configurações) | Supabase (linhas JSON) | **Sim**: cron `backup-create` às 03:00 UTC, OneDrive, AES-256-GCM; `backup-verify` confere o último contra o manifesto (`server/backup.js`) | Exclui `onedrive_auth_v1` (reconectar a Microsoft depois) |
| Tabelas fiscais do ponto: `ponto_eventos`, `ponto_arp_registros`, `ponto_arp_contadores`, `ponto_tempo_verificacoes` | Supabase (tabelas) | **Não** (a função de backup lê só `company_app_data`) | Só o backup da plataforma Supabase, **não verificado** |
| Tabelas administrativas do ponto: `ponto_estabelecimentos`, `ponto_estabelecimento_obras`, `ponto_dispositivos`, `ponto_pareamentos`, `ponto_responsaveis`, `ponto_biometrias`, `ponto_marcacoes` (legado), `ponto_apropriacoes`, auditorias | Supabase (tabelas) | **Não** | Idem |
| Fotos (batida e cadastro facial) | Supabase Storage, bucket privado `ponto-obra` | **Não** | Pela documentação do Supabase, o backup do banco não inclui objetos do Storage. **Confirmar com o suporte ou o painel** |
| Vínculos entre os dois mundos | `ponto_*.employee_id`/`obra_id` → `company_app_data` | Parcial | Os dois backups precisam ser do **mesmo momento** para os vínculos baterem |
| Chaves e configuração | Vercel (variáveis) e aparelhos | — | Ver seção 4 |

A existência de uma opção de backup no painel do Supabase **não prova**
recuperação: é preciso restaurar e conferir (seção 3).

## 2. Ferramentas (PR do livro de migrations)

- `scripts/backup-ponto.mjs`:
  - conexão em **modo somente leitura** e retrato consistente (`REPEATABLE READ READ ONLY`);
  - exporta as 14 tabelas do ponto e, com `--com-fotos`, o bucket `ponto-obra`;
  - gera `<nome>.arcdponto`, cifrado em AES-256-GCM com a mesma construção
    de `server/backup.js` (formato `arcd-ponto-backup-v1`), mais
    `<nome>.arcdponto.manifest.json` **sem dado pessoal**: contagem e SHA-256
    por tabela e por foto, último NSR e SHA-256 da cadeia fiscal por
    estabelecimento (sem o hash cru), cadeia íntegra sim/não, versão do esquema
    (livro de migrations, ou validação de objetos se o livro ainda não existir)
    e quem autorizou;
  - recusa gravar dentro do repositório e exige `--autorizado-por`;
  - chave em `PONTO_BACKUP_KEY` (base64, 32 bytes).
- `scripts/restaurar-backup-ponto.mjs`: só em banco **descartável e vazio**.
  - Recusa se o destino (host/banco) for a origem, o `POSTGRES_URL_NON_POOLING`
    ou o mesmo servidor de produção, se não for confirmado com
    `--confirmo-descartavel=<host/banco>`, ou se já tiver qualquer linha do
    ponto.
  - Recria o esquema pelo **livro de migrations** e insere as linhas com
    `session_replication_role = replica`. Os triggers ficam suspensos **só
    nessa transação**, como no `pg_restore --disable-triggers`.
  - Ajusta as sequências e confere: SHA-256 de cada tabela igual ao
    manifesto, cadeia fiscal recalculada e fotos por SHA-256.

## 3. Evidência de recuperação efetiva (o que conta)

| Evidência | Como | Estado |
|---|---|---|
| Restauração do pacote do ponto confere linha a linha e a cadeia fiscal | ensaio em PGlite (`scripts/backup-ponto/pacote.test.js`, 5 testes): restauração, ARP continua (NSR 4), travas voltam, chave errada, pacote adulterado, destino com dados, backup anterior ao livro | **Feito** (dados sintéticos) |
| O mesmo, com as linhas de comando de verdade e Postgres real | `scripts/backup-ponto/backup.pg.test.js` (job `rep-p-arp-postgres`): dois bancos descartáveis criados e apagados pelo teste | **Na CI desta PR** |
| Pacote **real** de produção restaurado num banco descartável | rodar o backup (autorizado) e restaurar num Postgres temporário; guardar o log "Restaurado e conferido: … NSR 1..N íntegra" e os dois manifestos | **Pendente: autorização** |
| Backup da plataforma Supabase restaurável | restaurar num projeto ou branch novo (PITR ou backup diário) e rodar as consultas da seção 8 de `docs/PONTO-OBRA-MIGRATION-019.md` comparando com produção | **Pendente: acesso ao painel** |
| Fotos | contagem e SHA-256 do bucket no manifesto, conferidos na restauração (`--fotos-em`) | **Pendente: autorização** |
| RPO/RTO medidos | horário do backup × horário da restauração conferida | Pendente |

## 4. Chaves e configuração necessárias para recuperar

| Item | Para quê | Onde guardar |
|---|---|---|
| `PONTO_BACKUP_KEY` (nova) | abrir o pacote do ponto | cofre fora da Vercel e do Supabase, com 2 guardiões. Sem a chave, o pacote é inútil |
| `BACKUP_ENCRYPTION_KEY` | abrir o backup do OneDrive | idem (já existe na Vercel) |
| `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | acesso ao projeto | Vercel; rotacionar depois de qualquer recuperação |
| Conexão Microsoft (`onedrive_auth_v1`) | backup do OneDrive | refazer o login de administrador depois da restauração |
| Aparelhos | batidas ainda não sincronizadas | ficam no SQLCipher de cada aparelho (chave no SecureStore, **não recuperável fora dele**). O token só existe como hash no servidor: restaurar `ponto_dispositivos` mantém os aparelhos pareados; perder o aparelho exige parear de novo |

## 5. Procedimento (com autorização)

1. Gerar `PONTO_BACKUP_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
   e guardá-la no cofre antes do primeiro uso.
2. Backup: `PONTO_BACKUP_KEY=… POSTGRES_URL_NON_POOLING=… node scripts/backup-ponto.mjs --saida <pasta cifrada fora do repo> --autorizado-por "<nome>" --com-fotos`.
3. Copiar o pacote e o manifesto para um destino fora do Supabase, por exemplo
   a pasta de backups do OneDrive corporativo.
4. Ensaio: subir um Postgres descartável (local ou projeto temporário) e rodar
   `PONTO_RESTAURAR_URL=… node scripts/restaurar-backup-ponto.mjs --pacote <arquivo> --confirmo-descartavel=<host/banco>`.
   Guardar o log.
5. Apagar o banco descartável e as fotos extraídas.

**Frequência proposta:** antes de cada janela (019, livro) e depois
semanalmente até existir automação. Automatizar no cron, como o backup do
OneDrive, é decisão sua.

## 6. Decisões que exigem autorização

1. Exportar dados reais do ponto, com CPF, vetor facial e fotos (cifrados): quem
   autoriza, onde fica e por quanto tempo.
2. Criação e guarda da `PONTO_BACKUP_KEY`.
3. Ensaio com pacote real num ambiente descartável: qual ambiente.
4. Verificação do backup da plataforma Supabase (plano, PITR, retenção) e
   ensaio de restauração dela.
5. Automação periódica do backup do ponto.
