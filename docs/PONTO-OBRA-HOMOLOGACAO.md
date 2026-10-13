# Ponto de Obra — homologação ISOLADA (NÃO OFICIAL)

Data: 12/10/2026 (revisado no mesmo dia). **Situação real: o código e as ferramentas do ambiente
isolado estão prontos e testados com dados sintéticos (PGlite e Postgres
real na CI). O ambiente em si NÃO existe ainda:** criar o projeto Supabase e o
deploy na Vercel de homologação exige autorização (recurso externo, possível
custo e credenciais). Nenhum NSR de teste foi emitido fora dos bancos
descartáveis dos testes. Nenhum aparelho físico foi homologado.

## 1. Objetivo

Testar o APK em aparelho real — pareamento, cadastro facial autorizado,
batida online e offline, sincronização, NSR, falhas — **sem gerar nenhum
registro fiscal real**. Isso exige um backend inteiro separado: banco
PostgreSQL, projeto Supabase, Storage, credenciais, aparelhos,
estabelecimento e dados próprios. Uma URL de preview da Vercel **não** serve
se usar as credenciais ou o banco de produção.

## 2. Garantias de isolamento (camadas)

| Camada | Onde | O que impede | Teste |
|---|---|---|---|
| Build | `apps/ponto-obra/config/ambiente.js`, `app.config.js` | `PONTO_AMBIENTE` obrigatório; homologação sem `PONTO_API_URL` não compila; recusa a produção (`pontosarcd`/`pontos` e previews `pontos-*.vercel.app`), IP literal, host sem "homolog"; pacote próprio `br.com.arcd.pontoobra.homologacao` | `apps/ponto-obra/src/logica/ambiente.test.js` |
| APK | `apps/ponto-obra/scripts/verificar-apk.mjs` | APK conferido antes de instalar: ambiente e servidor embutidos, pacote, permissões efetivas, assinatura | rodado contra o APK `4f8b84c1` (classificado BLOQUEADO) |
| App em execução | `src/servicos/conexao.js`, `TelaPareamento.js`, `sincronizacao.js`, `App.js` | sem fallback para a produção; toda requisição declara `ambienteApp`; pareamento confere o ambiente do servidor ANTES do código; sessão presa ao ambiente e ao servidor; sincronização com servidor de outro ambiente não guarda cadastro nem envia batida | `ambiente.test.js` |
| Servidor | `server/ponto-eletronico/ambiente.js`, `handler.js` | `PONTO_AMBIENTE=homologacao` só opera com a tabela marcadora `arcd_ambiente` no banco e com um `SUPABASE_URL` que **não** é o projeto de produção (comparado pelo hash do project ref); app de outro ambiente recebe 409 antes de qualquer gravação | `server/ponto-eletronico/ambiente.test.js`; conferido com o `SUPABASE_URL` real de produção: bloqueado |
| Banco | `scripts/homologacao/` | só provisiona banco marcado (`comment on database ... 'arcd-ponto-homologacao'`), confirmado por `usuario@host:porta/banco`, que não seja a produção (identidade, projeto pelo pooler ou acesso direto, hash do ref) e sem registros do ponto ou dados de ERP reais | `scripts/homologacao/homologacao.test.js`, `homologacao.pg.test.js` |

## 3. O que o provisionamento cria (dados 100% sintéticos)

- Esquema do ERP (`schema.sql`) e do ponto pelo **livro de migrations**
  (016–019, origem `homologacao`); gate **GO 019** conferido no fim.
- Marcador `arcd_ambiente` (só aceita `homologacao`; RLS; service_role só lê).
- Empresa com 2 obras "OBRA FICTÍCIA n — HOMOLOGAÇÃO", 6 trabalhadores
  "Trabalhador Sintético nn" com CPF sintético (prefixo 000, dígito válido),
  1 terceirizado fictício, estabelecimento "ESTABELECIMENTO DE TESTE — NÃO
  OFICIAL" (sem inscrição) e encarregado de homologação com PIN informado
  pelo operador (`PONTO_HOMOLOGACAO_PIN`, nunca no repositório).
- **Sem biometria:** o cadastro facial é feito no aparelho, só com pessoas que
  autorizarem por escrito. Nada da biometria de produção é copiado.

## 4. Plano de provisionamento reproduzível (cada item 🔐 exige autorização)

Executado por uma pessoa com acesso às contas, sem nenhuma variável de
produção carregada no terminal. Nenhum valor secreto vai para o repositório.

**4.1 🔐 Supabase de homologação**
1. Criar um projeto NOVO, nome com "homolog" (painel ou `supabase projects create ponto-homologacao --org-id <org> --region sa-east-1`).
2. No SQL editor do projeto novo (nunca na produção):
   ```sql
   comment on database postgres is 'arcd-ponto-homologacao';
   ```
3. Anotar, fora do repositório: URL do projeto, `service_role key`, string de
   conexão direta (porta 5432) — são a `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` e `POSTGRES_URL_NON_POOLING` da homologação.

**4.2 Provisionar o banco** (do computador do operador):
```bash
node scripts/homologacao/cli.mjs provisionar --confirmo-homologacao=<usuario@host:porta/banco>
```
com `PONTO_HOMOLOGACAO_DB_URL` (conexão direta da homologação) e
`PONTO_HOMOLOGACAO_PIN` (4 a 8 números, escolhido pelo responsável) no
ambiente. Esperado: `Homologação provisionada (NÃO OFICIAL): gate GO 019, bucket privado`.
O comando cria esquema do ERP, livro 016–019, marcador, semente sintética e o
**bucket privado** `ponto-obra` (falta de bucket é erro visível).

**4.3 🔐 Vercel de homologação**
1. Montar um arquivo `.env.homologacao` (fora do repositório) só com:
   `PONTO_AMBIENTE=homologacao`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `POSTGRES_URL_NON_POOLING` (da homologação), `CRON_SECRET` NOVO e,
   opcionalmente, `COMPANY_ID=arcd`.
2. Conferir antes de configurar (não conecta em nada, não exibe valores):
   ```bash
   node scripts/homologacao/cli.mjs validar-env --arquivo .env.homologacao
   ```
   Recusa: ambiente diferente de `homologacao`; projeto Supabase de produção
   (pela URL, pela chave de serviço ou pelo banco); chave ou banco de outro
   projeto que não o da URL; variáveis da produção que a homologação não usa
   (`BACKUP_ENCRYPTION_KEY`, `PONTO_BACKUP_KEY`, `MICROSOFT_*`,
   `ONEDRIVE_ROOT_FOLDER_URL`, `GEMINI_API_KEY`, `AI_ENCRYPTION_KEY`).
   Conferido contra o arquivo de variáveis REAL da produção: **NO-GO** (URL e
   chave reconhecidas como produção), sem exibir nenhum valor.
3. Criar o projeto Vercel NOVO (nome com "homolog", **sem** o prefixo
   `pontos`) a partir do mesmo repositório e cadastrar as variáveis do
   arquivo para o ambiente *Production* desse projeto (`vercel env add <NOME> production`).
4. Deploy de produção **do projeto de homologação**. O **primeiro** passo do
   `prebuild` é `scripts/homologacao/guarda-prebuild.mjs`: com
   `PONTO_AMBIENTE=homologacao` ele refaz a conferência do `validar-env` sobre
   as variáveis do próprio deploy e exige o comentário e o marcador da
   homologação no banco (por isso o **4.2 vem antes**); qualquer falha, ou o
   banco sem responder, **recusa o deploy antes de qualquer migration** (falha
   fechada). Sem `PONTO_AMBIENTE=homologacao` (a produção) ele sai na hora,
   sem conectar em nada. Depois, o `prebuild` (auditado: os 10 scripts só leem
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `POSTGRES_URL_NON_POOLING`,
   sem endereço fixo) aplica as
   migrations do ERP no banco de homologação; o gate do ponto vê o livro e não
   reaplica nada. As rotinas agendadas (`backup-create`, `ponto-tempo-verificar`)
   rodam contra o banco de homologação; o backup no OneDrive falha sem
   credenciais (esperado).

**4.4 Conferir banco e API**
```bash
node scripts/homologacao/cli.mjs conferir --api https://<homologacao>/api/data
```
Esperado: marcador `homologacao`, gate GO 019, dados sintéticos, bucket
privado, `projeto Supabase: hash do ref … ≠ produção` e API `ambiente homologacao`.
Qualquer divergência = **NO-GO** (não parear).

**4.5 🔐 APK de homologação (EAS)**
1. A URL vai como variável do EAS no ambiente "preview" (o shell local não
   chega ao servidor de build). O perfil `producao` usa o ambiente
   "production" e recusa qualquer servidor que não seja a produção, então essa
   variável não o afeta:
   ```bash
   eas env:create --environment preview --name PONTO_API_URL --value https://<homologacao>/api/data --visibility plaintext
   ```
2. Build (o primeiro do pacote `br.com.arcd.pontoobra.homologacao` cria a
   keystore no EAS, de forma interativa; o versionCode é incremental e próprio):
   ```bash
   eas build --profile homologacao --platform android
   ```
3. **Duas versões consecutivas** para o cenário de atualização: repetir o
   build depois de um commit novo (versionCode N e N+1, mesma keystore).
4. Conferir cada APK antes de instalar:
   ```bash
   node scripts/verificar-apk.mjs <apk> --build-tools <pasta> --esperado homologacao
   ```
   Esperado: `APROVADO PARA HOMOLOGACAO` (pacote `.homologacao`, servidor
   isolado embutido, permissões só da lista, assinatura ok).

**4.6 Operação**
- Código de pareamento só no banco isolado: `node scripts/homologacao/cli.mjs codigo`.
- Executar a matriz `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` (18 cenários).
- Reset controlado (só banco marcado), apagando também as fotos de teste do
  Storage quando `PONTO_HOMOLOGACAO_SUPABASE_URL` e
  `PONTO_HOMOLOGACAO_SERVICE_ROLE_KEY` estiverem no ambiente (recusa projeto de
  produção e projeto diferente do banco):
  `cli.mjs resetar --confirmo-homologacao=...` e provisionar de novo.

## 4A. Prova de vida e ataques de apresentação (protocolo; nada alterado)

A prova de vida atual (virar o rosto) **não é anti-spoofing**. Os limiares
(`calibracao.js`) **não mudam** sem medição. Na homologação, com voluntários
autorizados, medir e registrar:
- FRR (pessoa cadastrada recusada) e FAR (outra pessoa aceita) por 100
  tentativas, em luz normal, contraluz e sol;
- ataques de apresentação (foto impressa, foto na tela, vídeo) com taxa de
  aceitação por tipo;
- tempo por etapa (captura, análise, identificação, prova de vida) por modelo
  de aparelho de referência.
Só com esses números se decide mudar limiar ou adicionar desafio aleatório.

## 4B. Registro de evidências (modelo por cenário)

`data · executor · aparelho (marca/modelo) · Android · build EAS · versionCode
· commit · pacote · cenário nº · resultado (APROVADO/REPROVADO/BLOQUEADO) ·
evidência (captura do Diagnóstico; foto da tela sem rosto de terceiros) ·
issue (se reprovado)`. Nunca registrar CPF completo, PIN, token ou foto de
rosto de pessoa que não autorizou.

## 5. Requisitos fiscais preservados (Missão 6)

| Requisito | Prova automatizada | Situação |
|---|---|---|
| NSR sequencial por estabelecimento, só pela ARP | `arp-concorrencia.pg.test.js` (5), `arp-019-concorrencia.pg.test.js` (6), `homologacao.test.js` (NSR 1–2 no banco isolado) | TESTADO |
| Evento local imutável; hash local | `armazem-sqlite.test.js` (escrita única, transação, SQLITE_FULL), `regressao.test.js` | TESTADO |
| Hash fiscal e cadeia | `registro-fiscal` (paridade JS/SQL), `pacote.test.js` (cadeia recalculada) | TESTADO |
| Sincronização idempotente | `regressao.test.js`, `rep-p-ponta-a-ponta.test.js`, `homologacao.test.js` (reenvio) | TESTADO |
| Recuperação após timeout | `rep-p-ponta-a-ponta.test.js` (timeout depois do commit) | TESTADO |
| Vários aparelhos no mesmo estabelecimento | `arp-concorrencia.pg.test.js` | TESTADO |
| Funcionário global entre obras | `funcionario-global.test.js` | TESTADO |
| Terceirizado sem NSR de jornada | `homologacao.test.js` (`acesso_registrado`, sem NSR), `regressao.test.js` | TESTADO |
| Evidência original preservada (foto/SHA) | `pacote.test.js`, `regressao.test.js` | TESTADO |
| Hora não confiável | `regressao.test.js`, `arp-019-concorrencia.pg.test.js` | TESTADO |
| Backup e recuperação do banco de teste | `scripts/backup-ponto` funciona em qualquer banco (`pacote.test.js`, `gate-integrado.pg.test.js`) | TESTADO (sintético) |
| **Nenhuma chamada do piloto atinge a produção** | as camadas da seção 2 (build, app, servidor, banco) | TESTADO; **prova no piloto real PENDENTE**: antes e depois da homologação física, contar (consulta somente leitura, 🔐) `ponto_dispositivos` e `ponto_arp_registros` da produção — devem ficar iguais |

## 6. Riscos residuais (registrados, não aceitos)

1. O ambiente de homologação não existe: sem ele, nenhum dos 18 cenários físicos roda.
2. A trava do servidor por hash cobre o projeto Supabase de produção atual; se
   a produção mudar de projeto, o hash precisa ser atualizado.
3. Domínio próprio da produção (fora da Vercel), se existir no futuro, entra
   na lista de hosts de produção do app.
4. A limpeza do Storage no `resetar` exige a URL e a chave de serviço da homologação no ambiente; sem elas, as fotos de teste ficam.
5. Os dois APKs antigos (`e4f41447`, `4f8b84c1`) continuam baixáveis no EAS até expirarem
   (26/10/2026): só a identificação NÃO INSTALAR impede o uso. Expirar os links é decisão da direção.
6. Achados P2/P3 da revisão independente da #72 que não bloqueiam a
   homologação isolada: pareamento sem limite de tentativas; cadastro facial
   confia no `responsavelId` sem prova de PIN no servidor; prova de vida sem
   desafio aleatório; desempenho por batida a medir no aparelho; relógio de 1 s
   re-renderiza a tela de ponto.
